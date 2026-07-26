import * as cdk from "aws-cdk-lib";
import type { IConstruct } from "constructs";

/**
 * Tags applied to every resource in this repository.
 *
 * These double as cost allocation keys, so they have to be activated once in
 * Billing → Cost allocation tags before Cost Explorer will group by them.
 * Keys stay in PascalCase to match the AWS-generated `aws:` namespace, and
 * values stay lowercase and hyphenated so grouping is not split by casing.
 */
export const COMMON_TAGS = {
  /** Everything under the brianjordans.com umbrella, across repositories. */
  Project: "brianjordans",
  /** The workload itself. */
  Application: "management-console",
  Environment: "production",
  Owner: "contact@brianjordans.com",
  /** Warns anyone editing in the console that changes will be reverted. */
  ManagedBy: "cdk",
  CostCenter: "brianjordans-console",
  Repository: "actix-bjordan/brianjordans-console",
} as const;

/** The cost allocation keys to activate in Billing. */
export const COST_ALLOCATION_TAG_KEYS = [
  "Project",
  "Application",
  "Environment",
  "CostCenter",
  "Component",
] as const;

/**
 * @param component Distinguishes spend within the application, so the load
 * balancer and the compute can be told apart in a cost report.
 */
export function applyStandardTags(scope: IConstruct, component: string): void {
  const tags = cdk.Tags.of(scope);
  for (const [key, value] of Object.entries(COMMON_TAGS)) {
    tags.add(key, value);
  }
  tags.add("Component", component);
}
