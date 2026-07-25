import * as cdk from "aws-cdk-lib";
import { ConsoleStack } from "../lib/console-stack.js";

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

new ConsoleStack(app, "BrianJordansConsole", {
  env,
  domainName,
  hostedZoneId,
  customDomain,
});
