import {
  CfnOutput,
  Duration,
  Fn,
  Stack,
  type StackProps,
  aws_applicationautoscaling as applicationautoscaling,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_iam as iam,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { Variables } from '../config'
export interface SampleServiceStackProps extends StackProps {
  infrastructureStackName: string
  taskDefinitionStackName: string
  variables: Variables
}

export class SampleServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: SampleServiceStackProps) {
    super(scope, id, props)
    const {
      taskDefinitionStackName,
      infrastructureStackName,
      variables: { vpcId, privateSubnetIds, clusterName },
    } = props

    const serviceSG = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ServiceSecurityGroup',
      Fn.importValue(`${infrastructureStackName}ServiceSecurityGroup`),
    )
    const vpc = ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
    const cluster = ecs.Cluster.fromClusterAttributes(this, 'cluster', {
      clusterName,
      vpc,
      securityGroups: [serviceSG],
    })

    const service = new ecs.CfnService(this, 'Service', {
      cluster: clusterName,
      serviceName: 'sample-service',
      deploymentConfiguration: {
        maximumPercent: 200,
      },
      deploymentController: {
        type: 'CODE_DEPLOY',
      },
      healthCheckGracePeriodSeconds: 10,
      launchType: 'FARGATE',
      loadBalancers: [
        {
          containerName: Fn.importValue(
            `${taskDefinitionStackName}TaskDefinitionDefaultContainerName`,
          ),
          containerPort: 1323,
          targetGroupArn: Fn.importValue(
            `${infrastructureStackName}BlueTargetGroup`,
          ),
        },
      ],
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: 'DISABLED',
          securityGroups: [serviceSG.securityGroupId],
          subnets: privateSubnetIds,
        },
      },
      taskDefinition: Fn.importValue(
        `${taskDefinitionStackName}TaskDefinitionFamily`,
      ),
    })

    new CfnOutput(this, 'ServiceOutput', {
      value: service.attrServiceArn,
      exportName: `${this.stackName}ServiceOutput`,
    })
  }
}

export interface SampleServicePreferenceStackProps extends StackProps {
  serviceStackName: string
  variables: Variables
}
export class SampleServicePreferenceStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SampleServicePreferenceStackProps,
  ) {
    super(scope, id, props)
    const {
      serviceStackName,
      variables: { clusterName, minCapacity = 1, maxCapacity = 2 },
    } = props

    const service = ecs.FargateService.fromFargateServiceArn(
      this,
      'Service',
      Fn.importValue(`${serviceStackName}ServiceOutput`),
    )
    const scalableTaskCount = new ecs.ScalableTaskCount(
      this,
      'ScalableTaskCount',
      {
        serviceNamespace: applicationautoscaling.ServiceNamespace.ECS,
        resourceId: `service/${clusterName}/${service.serviceName}`,
        minCapacity,
        maxCapacity,
        dimension: 'ecs:service:DesiredCount',
        role: iam.Role.fromRoleName(
          this,
          'Role',
          'AWSServiceRoleForApplicationAutoScaling_ECSService',
        ),
      },
    )
    scalableTaskCount.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: Duration.minutes(1),
      scaleOutCooldown: Duration.minutes(1),
    })
    scalableTaskCount.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: Duration.minutes(1),
      scaleOutCooldown: Duration.minutes(1),
    })
  }
}
