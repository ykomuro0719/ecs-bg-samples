import type { aws_codedeploy as codedeploy } from 'aws-cdk-lib'

export interface Variables {
  vpcId: string
  clusterName: string
  publicSubnetIds: string[]
  privateSubnetIds: string[]
  owner: string
  repository: string
  branch: string
  minCapacity?: number
  maxCapacity?: number
  deploymentConfig?: codedeploy.IEcsDeploymentConfig
  terminationWaitMinutes?: number
}

export const variables: Variables = {
  vpcId: '<YOUR-VPCID>',
  clusterName: '<CLUSTERNAME-FOR-SERVICE>',
  publicSubnetIds: ['<YOUR-PUBLIC-SUBNET1>', '<YOUR-PUBLIC-SUBNET2>'],
  privateSubnetIds: ['<YOUR-PRIVATE-SUBNET1>', '<YOUR-PRIVATE-SUBNET2>'],
  owner: '<YOUR-GITHUB-NAME>',
  repository: '<GITHUB-REPOSITORY-FOR-THIS>',
  branch: '<HOOK-BRANCH>',
  minCapacity: 1,
  maxCapacity: 2,
  terminationWaitMinutes: 0,
}
