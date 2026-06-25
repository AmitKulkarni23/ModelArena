import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as crypto from "crypto";
import path = require("path");

export class ModelArenaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── Secrets ─────────────────────────────────────────────
    const originVerifySecret = cdk.SecretValue.unsafePlainText(
      crypto.randomUUID()
    );

    // ─── Lambda: Models ──────────────────────────────────────
    const modelsLambda = new lambda.Function(this, "ModelsLambda", {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      handler: "bootstrap",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../../backend/models/target/lambda/models/")
      ),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
        CLOUDFRONT_ORIGIN_VERIFY: originVerifySecret.unsafeUnwrap(),
        RUST_LOG: "info",
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    const modelsUrl = modelsLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ["Content-Type"],
      },
    });

    // ─── Lambda: Orchestrator ────────────────────────────────
    const orchestratorLambda = new lambda.Function(
      this,
      "OrchestratorLambda",
      {
        runtime: lambda.Runtime.PROVIDED_AL2023,
        handler: "bootstrap",
        code: lambda.Code.fromAsset(
          path.join(
            __dirname,
            "../../backend/orchestrator/target/lambda/orchestrator/"
          )
        ),
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(300),
        environment: {
          OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
          CLOUDFRONT_ORIGIN_VERIFY: originVerifySecret.unsafeUnwrap(),
          RUST_LOG: "info",
        },
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    const orchestratorUrl = orchestratorLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["Content-Type"],
      },
    });

    // ─── S3: Frontend Bucket ─────────────────────────────────
    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
    });

    // ─── CloudFront ──────────────────────────────────────────

    // Security headers
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(
      this,
      "SecurityHeaders",
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "img-src 'self' data:",
              "font-src 'self'",
            ].join("; "),
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.seconds(63072000),
            includeSubdomains: true,
            preload: true,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          xssProtection: {
            protection: true,
            modeBlock: true,
            override: true,
          },
        },
      }
    );

    // Cache policies
    const apiCachePolicy = new cloudfront.CachePolicy(
      this,
      "ModelsCachePolicy",
      {
        defaultTtl: cdk.Duration.minutes(5),
        maxTtl: cdk.Duration.minutes(10),
        minTtl: cdk.Duration.minutes(1),
        queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        enableAcceptEncodingGzip: true,
      }
    );

    const noCachePolicy = new cloudfront.CachePolicy(
      this,
      "NoCachePolicy",
      {
        defaultTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.seconds(0),
        minTtl: cdk.Duration.seconds(0),
      }
    );

    // Origin request policy — forward origin-verify header to Lambda
    const originVerifyRequestPolicy =
      new cloudfront.OriginRequestPolicy(
        this,
        "OriginVerifyRequestPolicy",
        {
          headerBehavior:
            cloudfront.OriginRequestHeaderBehavior.allowList(
              "x-origin-verify"
            ),
          queryStringBehavior:
            cloudfront.OriginRequestQueryStringBehavior.all(),
        }
      );

    // Lambda Function URL origins
    const modelsOrigin = new origins.FunctionUrlOrigin(modelsUrl, {
      customHeaders: {
        "x-origin-verify": originVerifySecret.unsafeUnwrap(),
      },
    });

    const orchestratorOrigin = new origins.FunctionUrlOrigin(
      orchestratorUrl,
      {
        customHeaders: {
          "x-origin-verify": originVerifySecret.unsafeUnwrap(),
        },
      }
    );

    // Distribution
    const distribution = new cloudfront.Distribution(
      this,
      "Distribution",
      {
        enabled: true,
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(
            frontendBucket
          ),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: securityHeaders,
        },
        additionalBehaviors: {
          "/api/models*": {
            origin: modelsOrigin,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: apiCachePolicy,
            originRequestPolicy: originVerifyRequestPolicy,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          },
          "/api/benchmark*": {
            origin: orchestratorOrigin,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: noCachePolicy,
            originRequestPolicy: originVerifyRequestPolicy,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          },
        },
        defaultRootObject: "index.html",
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    // ─── S3 Deployment ───────────────────────────────────────
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist"))],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // ─── Outputs ─────────────────────────────────────────────
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "ModelsLambdaUrl", {
      value: modelsUrl.url,
    });
    new cdk.CfnOutput(this, "OrchestratorLambdaUrl", {
      value: orchestratorUrl.url,
    });
  }
}
