import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecr from "aws-cdk-lib/aws-ecr";
import type { Construct } from "constructs";

/**
 * Resources the container depends on but that must exist before it can run.
 *
 * Split from the service stack to break the ordering problem: the Fargate task
 * cannot start until an image exists in ECR, and an image cannot be pushed
 * until the repository exists.
 */
export class FoundationStack extends cdk.Stack {
  readonly repository: ecr.Repository;
  readonly usersTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, "ConsoleRepository", {
      repositoryName: "brianjordans-console",
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      encryption: ecr.RepositoryEncryption.AES_256,
      // Deliberately no rule targeting untagged images. When a push produces a
      // manifest list, the platform manifest underneath it is itself untagged,
      // and expiring it would break new task launches while the tagged index
      // still appears healthy. Counting by total image age avoids that trap.
      lifecycleRules: [
        {
          description: "Keep the 10 most recent images",
          rulePriority: 1,
          tagStatus: ecr.TagStatus.ANY,
          maxImageCount: 10,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.usersTable = new dynamodb.Table(this, "UsersTable", {
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "RepositoryUri", { value: this.repository.repositoryUri });
    new cdk.CfnOutput(this, "UsersTableName", { value: this.usersTable.tableName });
  }
}
