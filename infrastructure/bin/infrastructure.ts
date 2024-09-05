#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { variables } from '../config'
import { SampleContainerRepositoryStack } from '../lib/ecr-stack'
import { SampleInfrastructureStack } from '../lib/infrastructure-stack'
import { SamplePipelineStack } from '../lib/pipelines-stack'
import {
  SampleServicePreferenceStack,
  SampleServiceStack,
} from '../lib/service-stack'
import { SampleTaskDefinitionStack } from '../lib/taskdefinition-stack'

const app = new cdk.App()
const infrastructureStack = new SampleInfrastructureStack(
  app,
  'SampleInfrastructureStack',
  {
    stackName: 'SampleInfrastructureStack',
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    variables,
  },
)

const containerRegistryStack = new SampleContainerRepositoryStack(
  app,
  'SampleContainerRepositoryStack',
  {
    stackName: 'SampleContainerRepositoryStack',
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
  },
)

const taskDefinitionStack = new SampleTaskDefinitionStack(
  app,
  'SampleTaskDefinitionStack',
  {
    stackName: 'SampleTaskDefinitionStack',
    env: {
      region: process.env.CDK_DEFAULT_REGION,
      account: process.env.CDK_DEFAULT_ACCOUNT,
    },
    registryStackName: containerRegistryStack.stackName,
    infrastructureStackName: infrastructureStack.stackName,
  },
)

const serviceStack = new SampleServiceStack(app, 'SampleServiceStack', {
  stackName: 'SampleServiceStack',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  infrastructureStackName: infrastructureStack.stackName,
  taskDefinitionStackName: taskDefinitionStack.stackName,
  variables,
})

new SampleServicePreferenceStack(app, 'SampleServicePreferenceStack', {
  stackName: 'SampleServicePreferenceStack',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  serviceStackName: serviceStack.stackName,
  variables,
})

new SamplePipelineStack(app, 'SamplePipelineStack', {
  stackName: 'SamplePipelineStack',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  serviceStackName: serviceStack.stackName,
  infrastructureStackName: infrastructureStack.stackName,
  containerRegistryStackName: containerRegistryStack.stackName,
  variables,
})
