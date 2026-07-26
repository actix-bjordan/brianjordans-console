import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as ssm from "aws-cdk-lib/aws-ssm";
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
  repository: ecr.IRepository;
  usersTable: dynamodb.ITable;
  /** Address seeded as the first admin when the directory has no admin yet. */
  bootstrapAdminEmail: string;
}

const SSM_PREFIX = "/brianjordans/console";

/**
 * Management console at app.<domain>: one container serving the React app
 * behind server-enforced Google SSO.
 *
 * Deliberately a separate origin from the marketing site so the browser
 * enforces isolation of console session state, and so the two can carry
 * different cache, indexing, and CSP policies without path-prefix rules.
 */
export class ConsoleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConsoleStackProps) {
    super(scope, id, props);

    const { domainName, hostedZoneId, customDomain, repository, usersTable, bootstrapAdminEmail } =
      props;
    const consoleDomainName = `app.${domainName}`;

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId,
      zoneName: domainName,
    });

    let certificate: acm.ICertificate | undefined;
    if (customDomain) {
      certificate = new acm.Certificate(this, "ConsoleCertificate", {
        domainName: consoleDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
    }

    // ---------------------------------------------------------------------
    // Container platform
    // ---------------------------------------------------------------------

    // Public subnets only. The task gets a public IP for image pulls and the
    // Google token endpoint; a NAT gateway would cost more than everything
    // else in this stack combined. Inbound is closed to all but the ALB.
    const vpc = new ec2.Vpc(this, "ConsoleVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
      restrictDefaultSecurityGroup: true,
    });

    const cluster = new ecs.Cluster(this, "ConsoleCluster", {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });

    const logGroup = new logs.LogGroup(this, "ConsoleLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Created out of band so no secret value ever passes through this
    // repository or a CloudFormation template. See README.
    const googleClientId = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      "GoogleClientIdParam",
      { parameterName: `${SSM_PREFIX}/google-client-id` },
    );
    const googleClientSecret = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      "GoogleClientSecretParam",
      { parameterName: `${SSM_PREFIX}/google-client-secret` },
    );
    const sessionSecret = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      "SessionSecretParam",
      { parameterName: `${SSM_PREFIX}/session-secret` },
    );

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "ConsoleService", {
      cluster,
      serviceName: "brianjordans-console",
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      // Required for image pulls without a NAT gateway.
      assignPublicIp: true,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      publicLoadBalancer: true,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificate,
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
      redirectHTTP: true,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      enableExecuteCommand: false,
      // Carry the stack tags onto the tasks themselves, which is what ECS split
      // cost allocation reports against.
      enableECSManagedTags: true,
      propagateTags: ecs.PropagatedTagSource.SERVICE,
      taskImageOptions: {
        // Rolled by scripts/deploy.sh with a forced new deployment, so an app
        // release does not require a CloudFormation change.
        image: ecs.ContainerImage.fromEcrRepository(repository, "latest"),
        containerName: "console",
        containerPort: 8080,
        environment: {
          NODE_ENV: "production",
          PORT: "8080",
          PUBLIC_BASE_URL: `https://${consoleDomainName}`,
          USERS_TABLE: usersTable.tableName,
          BOOTSTRAP_ADMIN_EMAIL: bootstrapAdminEmail,
        },
        secrets: {
          GOOGLE_CLIENT_ID: ecs.Secret.fromSsmParameter(googleClientId),
          GOOGLE_CLIENT_SECRET: ecs.Secret.fromSsmParameter(googleClientSecret),
          SESSION_SECRET: ecs.Secret.fromSsmParameter(sessionSecret),
        },
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: "console", logGroup }),
      },
    });

    usersTable.grantReadWriteData(service.taskDefinition.taskRole);

    service.targetGroup.configureHealthCheck({
      path: "/healthz",
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      interval: cdk.Duration.seconds(15),
      timeout: cdk.Duration.seconds(5),
    });
    // One task, so drain fast rather than holding a replaced task open.
    service.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "30");
    service.loadBalancer.setAttribute("routing.http.drop_invalid_header_fields.enabled", "true");

    // ---------------------------------------------------------------------
    // DNS
    // ---------------------------------------------------------------------

    if (customDomain) {
      const target = route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(service.loadBalancer),
      );

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

    new cdk.CfnOutput(this, "LoadBalancerDns", {
      value: service.loadBalancer.loadBalancerDnsName,
      description: "Verify the container here before cutting DNS over",
    });
    new cdk.CfnOutput(this, "ServiceName", { value: service.service.serviceName });
    new cdk.CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new cdk.CfnOutput(this, "ConsoleUrl", { value: `https://${consoleDomainName}` });
  }
}
