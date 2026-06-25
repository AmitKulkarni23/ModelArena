import { Construct } from "constructs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";

export interface WafAclProps {
  /** Must be 'CLOUDFRONT' for CloudFront distributions. */
  scope: "CLOUDFRONT" | "REGIONAL";
  /** Prefix used for CloudWatch metric names. */
  metricNamePrefix: string;
}

export function createWafAcl(
  scope: Construct,
  id: string,
  props: WafAclProps
): wafv2.CfnWebACL {
  return new wafv2.CfnWebACL(scope, id, {
    defaultAction: { allow: {} },
    scope: props.scope,
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: `${props.metricNamePrefix}WebAcl`,
      sampledRequestsEnabled: true,
    },
    rules: [
      {
        // Blocks common web exploits: SQLi, XSS, LFI, etc.
        name: "AWSManagedCommonRuleSet",
        priority: 1,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesCommonRuleSet",
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${props.metricNamePrefix}CommonRuleSet`,
          sampledRequestsEnabled: true,
        },
      },
      {
        // Blocks Log4J, SSRF, and other known bad input patterns.
        name: "AWSManagedKnownBadInputs",
        priority: 2,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesKnownBadInputsRuleSet",
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${props.metricNamePrefix}KnownBadInputs`,
          sampledRequestsEnabled: true,
        },
      },
      {
        // Rate limit per IP.
        // AWS WAF minimum is 100 req per evaluation window. Acts as coarse
        // first-line defence against volumetric abuse; Lambda validates the
        // x-origin-verify secret for finer-grained origin enforcement.
        name: "RateLimitPerIp",
        priority: 3,
        action: { block: {} },
        statement: {
          rateBasedStatement: {
            limit: 100,
            evaluationWindowSec: 300, // 5-min window → ~20 req/min cap
            aggregateKeyType: "IP",
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${props.metricNamePrefix}RateLimitPerIp`,
          sampledRequestsEnabled: true,
        },
      },
    ],
  });
}
