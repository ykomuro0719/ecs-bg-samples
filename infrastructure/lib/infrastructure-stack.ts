import {
  CfnOutput,
  Stack,
  type StackProps,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { Variables } from '../config'

export interface SampleInfrastructureStackProps extends StackProps {
  variables: Variables
}

export class SampleInfrastructureStack extends Stack {
  constructor(
    parent: Construct,
    name: string,
    props: SampleInfrastructureStackProps,
  ) {
    super(parent, name, props)
    const {
      variables: { vpcId, publicSubnetIds, clusterName },
    } = props
    const vpc = ec2.Vpc.fromLookup(this, 'VPC', { vpcId })

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName,
    })

    const serviceSG = new ec2.SecurityGroup(this, 'serviceSG', {
      securityGroupName: 'sample-api-v2-service-sg',
      vpc,
      allowAllOutbound: true,
    })

    const primaryPort = 1323
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      securityGroupName: 'sample-service-lbv2-sg',
      description: 'Security Group for Service ALBv2',
      vpc,
    })
    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ServiceLB', {
      vpc,
      internetFacing: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
        subnetFilters: [ec2.SubnetFilter.byIds(publicSubnetIds)],
      },
      securityGroup: albSecurityGroup,
    })

    serviceSG.connections.allowFrom(loadBalancer, ec2.Port.tcp(primaryPort))
    // First target group for blue fleet
    const healthCheck: elbv2.HealthCheck = {
      path: '/health',
      healthyHttpCodes: '200',
    }
    const tg1 = new elbv2.ApplicationTargetGroup(this, 'BlueTargetGroup', {
      vpc,
      targetGroupName: 'sample-blue-tg',
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      port: primaryPort,
      healthCheck,
    })

    // Second target group for green fleet
    const tg2 = new elbv2.ApplicationTargetGroup(this, 'GreenTargetGroup', {
      vpc,
      targetGroupName: 'sample-green-tg',
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      port: primaryPort,
      healthCheck,
    })

    const listener = loadBalancer.addListener('PublicListener', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: true,
      defaultTargetGroups: [tg1],
    })

    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      roleName: 'sample-task-execution-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    })

    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup'],
        resources: ['*'],
      }),
    )

    const taskRole = new iam.Role(this, 'TaskRole', {
      roleName: 'sample-task-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })

    // Export values to use in other stacks
    new CfnOutput(this, 'LoadBalancerOutput', {
      value: loadBalancer.loadBalancerArn,
      exportName: `${this.stackName}LoadBalancerArn`,
    })
    new CfnOutput(this, 'LoadBalancerEndpoint', {
      value: loadBalancer.loadBalancerDnsName,
      exportName: `${this.stackName}LoadBalancerEndpoint`,
    })
    new CfnOutput(this, 'LoadBalancerSecurityGroup', {
      value: albSecurityGroup.securityGroupId,
      exportName: `${this.stackName}LoadBalancerSecurityGroup`,
    })
    new CfnOutput(this, 'ServiceSecurityGroupOutput', {
      value: serviceSG.securityGroupId,
      exportName: `${this.stackName}ServiceSecurityGroup`,
    })
    new CfnOutput(this, 'BlueTargetGroupOutput', {
      value: tg1.targetGroupArn,
      exportName: `${this.stackName}BlueTargetGroup`,
    })
    new CfnOutput(this, 'GreenTargetGroupOutput', {
      value: tg2.targetGroupArn,
      exportName: `${this.stackName}GreenTargetGroup`,
    })
    new CfnOutput(this, 'ProdTrafficListenerOutput', {
      value: listener.listenerArn,
      exportName: `${this.stackName}ProdTrafficListener`,
    })
    new CfnOutput(this, 'TaskExecutionRoleOutput', {
      value: taskExecutionRole.roleArn,
      exportName: `${this.stackName}TaskExecutionRole`,
    })
    new CfnOutput(this, 'TaskRoleOutput', {
      value: taskRole.roleArn,
      exportName: `${this.stackName}TaskRole`,
    })
  }
}
