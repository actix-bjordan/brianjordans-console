import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface ConsoleStackProps extends cdk.StackProps {
  domainName: string;
  /**
   * The hosted zone is owned by the brianjordans-website repository, so it is
   * referenced here by ID rather than created.
   */
  hostedZoneId: string;
  /** Attach the ACM certificate + custom domain alias. */
  customDomain: boolean;
}

/**
 * Management console hosting at app.<domain>.
 *
 * Deliberately a separate origin from the marketing site so the browser
 * enforces isolation of console session state, and so the two can carry
 * different cache, indexing, and CSP policies without path-prefix rules.
 */
export class ConsoleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConsoleStackProps) {
    super(scope, id, props);

    const { domainName, hostedZoneId, customDomain } = props;
    const consoleDomainName = `app.${domainName}`;

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId,
      zoneName: domainName,
    });

    const consoleBucket = new s3.Bucket(this, "ConsoleBucket", {
      bucketName: `${consoleDomainName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: cdk.Duration.days(30),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    let certificate: acm.ICertificate | undefined;
    if (customDomain) {
      certificate = new acm.Certificate(this, "ConsoleCertificate", {
        domainName: consoleDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // Stricter than the marketing site: the console is never indexed, never
    // stored by shared caches, and never framed. The CSP is self-only apart
    // from the Google sign-in endpoints that federated auth will need.
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, "ConsoleHeaders", {
      comment: "Security headers for the management console",
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365 * 2),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        xssProtection: { protection: true, modeBlock: true, override: true },
        contentSecurityPolicy: {
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self' https://accounts.google.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://*.googleusercontent.com",
            "font-src 'self' data:",
            "connect-src 'self' https://accounts.google.com",
            "frame-src https://accounts.google.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self' https://accounts.google.com",
            "object-src 'none'",
          ].join("; "),
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: "X-Robots-Tag", value: "noindex, nofollow", override: true },
        ],
      },
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(consoleBucket);

    const distribution = new cloudfront.Distribution(this, "ConsoleDistribution", {
      comment: consoleDomainName,
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      certificate,
      domainNames: customDomain ? [consoleDomainName] : undefined,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        responseHeadersPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        // The shell is authenticated content; never let an edge or browser
        // hold onto it. Hashed assets under /assets/* stay immutable.
        "/index.html": {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          compress: true,
          responseHeadersPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(0),
        },
      ],
    });

    if (customDomain) {
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));

      new route53.ARecord(this, "ConsoleAlias", {
        zone: hostedZone,
        recordName: consoleDomainName,
        target,
      });
      new route53.AaaaRecord(this, "ConsoleAliasV6", {
        zone: hostedZone,
        recordName: consoleDomainName,
        target,
      });
    }

    new cdk.CfnOutput(this, "ConsoleBucketName", { value: consoleBucket.bucketName });
    new cdk.CfnOutput(this, "ConsoleDistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "ConsoleUrl", {
      value: customDomain
        ? `https://${consoleDomainName}`
        : `https://${distribution.distributionDomainName}`,
    });
  }
}
