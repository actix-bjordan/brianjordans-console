import * as cdk from "aws-cdk-lib";
import { ConsoleStack } from "../lib/console-stack.js";
import { FoundationStack } from "../lib/foundation-stack.js";

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

// Until the cutover, app.brianjordans.com still resolves to the old static
// distribution and the container is verified on the load balancer hostname.
// Deploy with `-c legacyStatic=false` to flip DNS and retire the static stack.
const legacyStatic = app.node.tryGetContext("legacyStatic") !== "false";

const bootstrapAdminEmail =
  app.node.tryGetContext("bootstrapAdminEmail") ?? "contact@brianjordans.com";

const foundation = new FoundationStack(app, "BrianJordansConsoleFoundation", { env });

new ConsoleStack(app, "BrianJordansConsole", {
  env,
  domainName,
  hostedZoneId,
  customDomain,
  legacyStatic,
  repository: foundation.repository,
  usersTable: foundation.usersTable,
  bootstrapAdminEmail,
});
