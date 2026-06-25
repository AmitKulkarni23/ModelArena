#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ModelArenaStack } from "../lib/model-arena-stack";

const app = new cdk.App();

new ModelArenaStack(app, "ModelArenaStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});
