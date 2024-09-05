# ecs-bg-samples
## Overview
This repository is a sample for ECS Fargate Blue Green Deployment using aws-cdk.

## Requirements
- Node.js v18.x
- go v1.22.x or higher
- docker
- AWS Account

## Setup

- confirm docker is running
- open `infrastructure/config/index.ts` and modify variables
- install node modules following below commands
  ```bash
  cd infrastructure
  npm install
  ```

### Quick Start

- deploy all resources using Makefile
  ```bash
  [AWS_PROFILE=xxx] make deploy
  ```

### Manual Setup

- deploy cdk resources following below commands
  ```bash
  cd infrastructure
  # current directory is infrastructure
  npx cdk deploy SampleInfrastructureStack SampleContainerRepositoryStack [--profile <AWS_PROFILE>]
  ```

- after deployed registryStack, push initial image to ECR
  ```bash
  cd ../app && docker build -t <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/sample-api:latest .
  aws ecr get-login-password [--profile <AWS_PROFILE>] | docker login --username AWS --password-stdin '<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com'
  docker push <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/sample-api:latest
  ```

- deploy rest of stacks
  ```bash
  npx cdk deploy SampleTaskDefinitionStack [--profile <AWS_PROFILE>]
  npx cdk deploy SampleServiceStack [--profile <AWS_PROFILE>]
  npx cdk deploy SampleServicePreferenceStack [--profile <AWS_PROFILE>]
  npx cdk deploy SamplePipelineStack [--profile <AWS_PROFILE>]
  ```

- Notice: Manually refresh Pending connections if SourceAction fails after pipeline deployment
  https://docs.aws.amazon.com/dtconsole/latest/userguide/connections-update.html
