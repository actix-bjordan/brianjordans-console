import * as cdk from "aws-cdk-lib";
import { ConsoleStack } from "../lib/console-stack.js";
import { FoundationStack } from "../lib/foundation-stack.js";
import { applyStandardTags } from "../lib/tags.js";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "us-east-1", // us-east-1 required for CloudFront ACM certificates
};

const domainName = "brianjordans.com";

// Route 53 zone for brianjordans.com, created and owned by the
// brianjordans-website repository. Referenced here, never modified.
const hostedZoneId = "Z00406963PWDGGJZA3WA2";

const customDomain = app.node.tryGetContext("customDomain") !== "false";

const bootstrapAdminEmail =
  app.node.tryGetContext("bootstrapAdminEmail") ?? "contact@brianjordans.com";

const foundation = new FoundationStack(app, "BrianJordansConsoleFoundation", { env });

const consoleStack = new ConsoleStack(app, "BrianJordansConsole", {
  env,
  domainName,
  hostedZoneId,
  customDomain,
  repository: foundation.repository,
  usersTable: foundation.usersTable,
  bootstrapAdminEmail,
});

// Storage and the image registry outlive any single deployment of the service,
// so they are billed and reported separately from the running workload.
applyStandardTags(foundation, "data-and-registry");
applyStandardTags(consoleStack, "runtime");
