# LLD: CDK Infrastructure

**Service:** CDK Infrastructure (ModelArenaStack)
**Date:** 2026-06-24
**HLD ref:** `docs/system-specs/hld-modelarena.md` §6

---

## 1. API Contract

N/A — infrastructure, not a service. Defines the resources that host other services.

---

## 2. Database Schema

N/A — no database for POC.

---

## 3. Component Design

### Stack Structure

Single CDK app, single stack:

```
infra/
├── bin/
│   └── app.ts                    # CDK app entry — instantiates ModelArenaStack
├── lib/
│   └── model-arena-stack.ts      # All resources in one stack
├── cdk.json
├── package.json
└── tsconfig.json
```

### CDK App Entry

```typescript
// bin/app.ts
import * as cdk from "aws-cdk-lib";
import { ModelArenaStack } from "../lib/model-arena-stack";

const app = new cdk.App();
new ModelArenaStack(app, "ModelArenaStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
});
```

### ModelArenaStack — Full Construct

```typescript
// lib/model-arena-stack.ts

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
        "../backend/models/target/lambda/models/",
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
          "../backend/orchestrator/target/lambda/orchestrator/",
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
      },
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
      },
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
      },
    );

    const noCachePolicy = new cloudfront.CachePolicy(
      this,
      "NoCachePolicy",
      {
        defaultTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.seconds(0),
        minTtl: cdk.Duration.seconds(0),
      },
    );

    // Origin request policy — forward origin-verify header to Lambda
    const originVerifyRequestPolicy =
      new cloudfront.OriginRequestPolicy(
        this,
        "OriginVerifyRequestPolicy",
        {
          headerBehavior:
            cloudfront.OriginRequestHeaderBehavior.allowList(
              "x-origin-verify",
            ),
          queryStringBehavior:
            cloudfront.OriginRequestQueryStringBehavior.all(),
        },
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
      },
    );

    // Distribution
    const distribution = new cloudfront.Distribution(
      this,
      "Distribution",
      {
        enabled: true,
        defaultBehavior: {
          origin:
            origins.S3BucketOrigin.withOriginAccessControl(
              frontendBucket,
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
            allowedMethods:
              cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          },
          "/api/benchmark*": {
            origin: orchestratorOrigin,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: noCachePolicy,
            originRequestPolicy: originVerifyRequestPolicy,
            allowedMethods:
              cloudfront.AllowedMethods.ALLOW_ALL,
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
      },
    );

    // ─── S3 Deployment ───────────────────────────────────────
    new s3deploy.BucketDeployment(this, "DeployFrontend", {
      sources: [s3deploy.Source.asset("../frontend/dist")],
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
```

---

## 4. CloudFront Behavior Details

### Path Routing

| Path | Origin | Methods | Cache | Headers forwarded |
|------|--------|---------|-------|-------------------|
| `/*` (default) | S3 bucket (OAC) | GET, HEAD | CACHING_OPTIMIZED (24h) | None |
| `/api/models*` | Models Lambda URL | GET, HEAD | 5 min TTL, all query strings | `x-origin-verify` |
| `/api/benchmark*` | Orchestrator Lambda URL | ALL | No cache (0s TTL) | `x-origin-verify` |

### SSE Through CloudFront

CloudFront supports streaming responses when:
- Cache policy TTL = 0 (no caching)
- Origin returns `Transfer-Encoding: chunked` or `Content-Type: text/event-stream`
- No response compression (CloudFront won't buffer for compression when `Content-Encoding` is absent)

The Orchestrator Lambda must set:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### SPA Routing

Error responses 403/404 redirect to `/index.html` with 200 status. This enables hash-based client-side routing — all paths resolve to the SPA shell.

---

## 5. Lambda Function URL Configuration

### Models Lambda

```
Invoke mode:    BUFFERED (default)
Auth type:      NONE (CloudFront handles access via origin-verify)
CORS:           Allow GET from *
Timeout:        30s
Memory:         256 MB
Architecture:   ARM_64 (Graviton — cheaper, faster for Rust)
Runtime:        PROVIDED_AL2023 (custom runtime, bootstrap binary)
```

### Orchestrator Lambda

```
Invoke mode:    RESPONSE_STREAM (required for SSE)
Auth type:      NONE
CORS:           Allow POST from *
Timeout:        300s (5 min — max for streaming benchmarks)
Memory:         1024 MB
Architecture:   ARM_64
Runtime:        PROVIDED_AL2023
```

**RESPONSE_STREAM invoke mode:** Lambda streams bytes as they're written. The Rust handler uses `lambda_runtime::StreamResponse` to write SSE events incrementally. Without this, Lambda would buffer the entire response before sending.

---

## 6. Security Design

### Origin Verification

Same pattern as Radar. CloudFront injects `x-origin-verify` custom header on all requests to Lambda origins. Lambda validates this header — rejects requests that bypass CloudFront (direct Lambda URL access).

```
CloudFront → Lambda: x-origin-verify: <random-uuid>
Lambda checks: req.headers["x-origin-verify"] == env.CLOUDFRONT_ORIGIN_VERIFY
```

**Secret generation:** `crypto.randomUUID()` at synth time. Stored in Lambda env var. Rotated on each `cdk deploy`.

### IAM

Both Lambdas use auto-generated execution roles with:
- `AWSLambdaBasicExecutionRole` (CloudWatch Logs)
- `AWSXRayDaemonWriteAccess` (X-Ray tracing)
- No additional policies (no DynamoDB, no S3, no Secrets Manager)

---

## 7. Build & Deploy

### Makefile

```makefile
.PHONY: build-models build-orchestrator build-frontend build deploy clean

build-models:
	cd backend/models && cargo lambda build --release --arm64

build-orchestrator:
	cd backend/orchestrator && cargo lambda build --release --arm64

build-frontend:
	cd frontend && bun install && bun run build

build: build-models build-orchestrator build-frontend

deploy: build
	cd infra && npx cdk deploy --require-approval never

synth:
	cd infra && npx cdk synth

clean:
	cd backend/models && cargo clean
	cd backend/orchestrator && cargo clean
	cd frontend && rm -rf dist node_modules

dev-frontend:
	cd frontend && bun run dev

dev-models:
	cd backend/models && cargo lambda watch

dev-orchestrator:
	cd backend/orchestrator && cargo lambda watch
```

### Local Development

```bash
# Terminal 1: Models Lambda (port 9001)
cargo lambda watch --port 9001

# Terminal 2: Orchestrator Lambda (port 9002)
cargo lambda watch --port 9002

# Terminal 3: Frontend dev server (port 5173, proxies to lambdas)
bun run dev
```

Vite proxy config routes `/api/models*` → `localhost:9001` and `/api/benchmark*` → `localhost:9002`.

---

## 8. CDK Dependencies

```json
// infra/package.json
{
  "dependencies": {
    "aws-cdk-lib": "^2.173.0",
    "constructs": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "aws-cdk": "^2.173.0"
  }
}
```

---

## 9. Error Handling & Resilience

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Lambda code asset missing (not built) | `cdk deploy` fails with "asset not found" | Makefile runs `build` before `deploy` |
| OpenRouter key not set | Lambdas start but all API calls fail | CDK outputs warning if env var empty |
| CloudFront cache stale after deploy | Users see old frontend | BucketDeployment invalidates `/*` on deploy |
| Lambda cold start | ~100ms for Rust on ARM_64 | Acceptable for POC. No provisioned concurrency. |

---

## 10. Test Plan

### Synth Tests

| Test | Description |
|------|-------------|
| `stack_creates_2_lambdas` | Synth stack → assert 2 `AWS::Lambda::Function` resources |
| `models_lambda_config` | Assert memory=256, timeout=30, runtime=provided.al2023, arch=arm64 |
| `orchestrator_lambda_config` | Assert memory=1024, timeout=300, invokeMode=RESPONSE_STREAM |
| `cloudfront_behaviors` | Assert 3 behaviors: default (S3), /api/models* (Models Lambda), /api/benchmark* (Orchestrator) |
| `no_cache_on_benchmark` | Assert /api/benchmark* behavior has TTL=0 |
| `s3_bucket_private` | Assert bucket has BLOCK_ALL public access |
| `origin_verify_header` | Assert custom headers on Lambda origins include x-origin-verify |
| `spa_error_responses` | Assert 404→200 /index.html and 403→200 /index.html |

### Integration Tests

Manual — deploy to AWS, hit CloudFront URL, verify:
1. SPA loads
2. `/api/models` returns model list
3. `/api/benchmark` streams SSE events
4. Direct Lambda URL access returns 403 (origin verify fails)
