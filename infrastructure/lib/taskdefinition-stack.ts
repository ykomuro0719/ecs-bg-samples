import {
  CfnOutput,
  Fn,
  Stack,
  type StackProps,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_logs as logs,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export interface SampleTaskDefinitionStackProps extends StackProps {
  registryStackName: string
  infrastructureStackName: string
}
export class SampleTaskDefinitionStack extends Stack {
  public readonly taskDefinition: ecs.FargateTaskDefinition
  constructor(
    scope: Construct,
    id: string,
    props: SampleTaskDefinitionStackProps,
  ) {
    super(scope, id, props)
    const { registryStackName, infrastructureStackName } = props
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'repository',
      Fn.importValue(`${registryStackName}ContainerRepository`),
    )

    const taskRole = iam.Role.fromRoleArn(
      this,
      'taskRole',
      Fn.importValue(`${infrastructureStackName}TaskRole`),
      {
        mutable: false,
      },
    )
    const executionRole = iam.Role.fromRoleArn(
      this,
      'taskExecutionRole',
      Fn.importValue(`${infrastructureStackName}TaskExecutionRole`),
      {
        mutable: false,
      },
    )

    const { taskDefinition } = new SampleTaskDefinition(
      this,
      'TaskDefinition',
      {
        repository,
        taskRole,
        executionRole,
      },
    )
    this.taskDefinition = taskDefinition

    new CfnOutput(this, 'TaskDefinitionFamily', {
      value: taskDefinition.family,
      exportName: `${this.stackName}TaskDefinitionFamily`,
    })
    new CfnOutput(this, 'TaskDefinitionDefaultContainerName', {
      value: taskDefinition.defaultContainer?.containerName || '',
      exportName: `${this.stackName}TaskDefinitionDefaultContainerName`,
    })
  }
}

export interface SampleTaskDefinitionProps {
  repository: ecr.IRepository
  taskRole: iam.IRole
  executionRole: iam.IRole
}

export class SampleTaskDefinition extends Construct {
  readonly taskDefinition: ecs.FargateTaskDefinition

  constructor(scope: Construct, id: string, props: SampleTaskDefinitionProps) {
    super(scope, id)
    const { repository, taskRole, executionRole } = props

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'FargateTaskDefinition',
      {
        family: 'sample-api',
        cpu: 256,
        memoryLimitMiB: 512,
        executionRole,
        taskRole,
      },
    )

    taskDefinition.addContainer('sample-api', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      portMappings: [{ containerPort: 1323, hostPort: 1323 }],
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'ecs/sample-api',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      essential: true,
      environment: {
        HEALTH_RATE: '1.0',
      },
    })

    this.taskDefinition = taskDefinition
  }
}
