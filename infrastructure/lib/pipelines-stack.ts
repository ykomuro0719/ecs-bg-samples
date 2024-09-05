import {
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
  Stage,
  type StageProps,
  aws_codepipeline_actions as actions,
  aws_cloudwatch as cloudwatch,
  aws_codebuild as codebuild,
  aws_codedeploy as codedeploy,
  aws_codepipeline as codepipeline,
  aws_codestarconnections as codestarconnections,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  pipelines,
  aws_s3 as s3,
} from 'aws-cdk-lib'

import { Construct } from 'constructs'
import type { Variables } from '../config'
import { SampleTaskDefinitionStack } from './taskdefinition-stack'

interface ECSDeploymentProps {
  blueTG: elbv2.IApplicationTargetGroup
  greenTG: elbv2.IApplicationTargetGroup
  prodListener: elbv2.IApplicationListener
  service: ecs.IBaseService
  variables: Variables
}

export class ECSDeployment extends Construct {
  public readonly ecsApplication: codedeploy.EcsApplication
  public readonly ecsDeploymentGroup: codedeploy.EcsDeploymentGroup
  constructor(scope: Construct, id: string, props: ECSDeploymentProps) {
    super(scope, id)
    const {
      blueTG,
      greenTG,
      service,
      prodListener,
      variables: {
        deploymentConfig = codedeploy.EcsDeploymentConfig
          .CANARY_10PERCENT_5MINUTES,
        terminationWaitMinutes = 0,
      },
    } = props

    const blueTGUnhealthyHosts = new cloudwatch.Alarm(
      this,
      'TargetGroupUnhealthyHosts',
      {
        alarmName: `${Stack.of(this).stackName}-Unhealthy-Hosts-Blue`,
        metric: new cloudwatch.MathExpression({
          expression: 'FILL(m1, 0)',
          usingMetrics: {
            m1: blueTG.metrics.unhealthyHostCount({
              statistic: 'sum',
              period: Duration.minutes(1),
            }),
          },
          period: Duration.minutes(5),
        }),
        threshold: 2,
        evaluationPeriods: 1,
      },
    )

    // Alarm if 5xx in target group exceeds 20% of total
    const blueTGApiFailure = new cloudwatch.Alarm(this, 'TargetGroup15xx', {
      alarmName: `${Stack.of(this).stackName}-Http-500percentage-Blue`,
      metric: new cloudwatch.MathExpression({
        label: '5xx-rate',
        expression: 'm1/m2',
        usingMetrics: {
          m1: new cloudwatch.MathExpression({
            expression: 'FILL(m11, 0)',
            usingMetrics: {
              m11: blueTG.metrics.httpCodeTarget(
                elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
                {
                  period: Duration.minutes(1),
                  statistic: 'sum',
                },
              ),
            },
          }),
          m2: new cloudwatch.MathExpression({
            expression: 'FILL(m12, 1)',
            usingMetrics: {
              m12: blueTG.metrics.requestCount({
                period: Duration.minutes(1),
                statistic: 'sum',
              }),
            },
          }),
        },
        period: Duration.minutes(1),
      }),
      threshold: 0.2,
      evaluationPeriods: 1,
    })

    const greenTGUnhealthyHosts = new cloudwatch.Alarm(
      this,
      'TargetGroup2UnhealthyHosts',
      {
        alarmName: `${Stack.of(this).stackName}-Unhealthy-Hosts-Green`,
        metric: new cloudwatch.MathExpression({
          expression: 'FILL(m1, 0)',
          usingMetrics: {
            m1: greenTG.metrics.unhealthyHostCount({
              period: Duration.minutes(1),
              statistic: 'sum',
            }),
          },
          period: Duration.minutes(5),
        }),
        threshold: 2,
        evaluationPeriods: 1,
      },
    )

    // Alarm if 5xx in target group exceeds 20% of total
    const greenTGApiFailure = new cloudwatch.Alarm(this, 'TargetGroup25xx', {
      alarmName: `${Stack.of(this).stackName}-Http-500percentage-Green`,
      metric: new cloudwatch.MathExpression({
        label: '5xxrate',
        expression: 'm1/m2',
        usingMetrics: {
          m1: new cloudwatch.MathExpression({
            expression: 'FILL(m11, 0)',
            usingMetrics: {
              m11: greenTG.metrics.httpCodeTarget(
                elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
                {
                  period: Duration.minutes(1),
                  statistic: 'sum',
                },
              ),
            },
          }),
          m2: new cloudwatch.MathExpression({
            expression: 'FILL(m12, 1)',
            usingMetrics: {
              m12: greenTG.metrics.requestCount({
                period: Duration.minutes(1),
                statistic: 'sum',
              }),
            },
          }),
        },
        period: Duration.minutes(1),
      }),
      threshold: 0.2,
      evaluationPeriods: 1,
    })

    // CodeDeploy Resources
    const ecsApp = new codedeploy.EcsApplication(
      this,
      'CodeDeployApplication',
      {
        applicationName: `AppECS-${Stack.of(this).stackName}`,
      },
    )

    const deploymentGroup = new codedeploy.EcsDeploymentGroup(
      this,
      'DeploymentGroup',
      {
        application: ecsApp,
        deploymentGroupName: `DgpECS-${Stack.of(this)}`,
        deploymentConfig,
        alarms: [
          blueTGUnhealthyHosts,
          blueTGApiFailure,
          greenTGUnhealthyHosts,
          greenTGApiFailure,
        ],
        service,
        blueGreenDeploymentConfig: {
          blueTargetGroup: blueTG,
          greenTargetGroup: greenTG,
          listener: prodListener,
          terminationWaitTime: Duration.minutes(terminationWaitMinutes),
        },
        autoRollback: {
          stoppedDeployment: true,
        },
      },
    )

    this.ecsApplication = ecsApp
    this.ecsDeploymentGroup = deploymentGroup
  }
}

interface SampleTaskdefinitionStageProps extends StageProps {
  registryStackName: string
  infrastructureStackName: string
}

class SampleTaskdefinitionStage extends Stage {
  constructor(
    scope: Construct,
    id: string,
    props: SampleTaskdefinitionStageProps,
  ) {
    super(scope, id, props)
    const { registryStackName, infrastructureStackName } = props
    new SampleTaskDefinitionStack(this, 'SampleTaskdefinitionStack', {
      env: { account: this.account, region: this.region },
      stackName: 'SampleTaskDefinitionStack',
      registryStackName: registryStackName,
      infrastructureStackName,
    })
  }
}

export interface SamplePipelineStackProps extends StackProps {
  infrastructureStackName: string
  serviceStackName: string
  containerRegistryStackName: string
  variables: Variables
}

export class SamplePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: SamplePipelineStackProps) {
    super(scope, id, props)
    const {
      containerRegistryStackName,
      infrastructureStackName,
      serviceStackName,
      variables,
    } = props
    const { owner, repository: repo, branch, clusterName, vpcId } = variables
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'Repository',
      Fn.importValue(`${containerRegistryStackName}ContainerRepository`),
    )
    const githubOutput = codepipeline.Artifact.artifact('MyApp')
    const buildOutput = codepipeline.Artifact.artifact('MyAppBuild')

    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName:
        `${Stack.of(this).account}-${Stack.of(this).stackName.toLowerCase()}-artifact-bucket`.substring(
          0,
          63,
        ),
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    })
    /**
     * Manually refresh Pending connections if SourceAction fails after pipeline deployment
     * https://docs.aws.amazon.com/dtconsole/latest/userguide/connections-update.html
     * **/
    const connection = new codestarconnections.CfnConnection(
      this,
      'GithubConnection',
      {
        connectionName: 'SampleGitHubConnection',
        providerType: 'GitHub',
      },
    )

    const sourceAction = new actions.CodeStarConnectionsSourceAction({
      actionName: 'Source',
      codeBuildCloneOutput: false,
      connectionArn: connection.attrConnectionArn,
      output: githubOutput,
      owner,
      repo,
      runOrder: 1,
      branch,
    })
    const pp = new codepipeline.Pipeline(this, 'SamplePipeline', {
      pipelineName: 'sample-pipeline',
      artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
      ],
    })

    const pipeline = new pipelines.CodePipeline(this, 'CodePipeline', {
      selfMutation: false,
      synth: new pipelines.CodeBuildStep('Synth', {
        input: pipelines.CodePipelineFileSet.fromArtifact(githubOutput),
        installCommands: ['cd infrastructure', 'npm ci'],
        commands: [`npx cdk synth ${id}`],
        primaryOutputDirectory: 'infrastructure/cdk.out',
        env: {
          privileged: 'true',
        },
        rolePolicyStatements: [
          new iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: [
              `arn:aws:iam::${this.account}:role/cdk-hnb659fds-lookup-role-${this.account}-${this.region}`,
            ],
            conditions: {
              StringEquals: {
                'iam:ResourceTag/aws-cdk:bootstrap-role': ['lookup'],
              },
            },
          }),
        ],
      }),
      codePipeline: pp,
    })

    const taskdefinitionStage = new SampleTaskdefinitionStage(
      this,
      'TaskDefinitionStage',
      {
        env: { account: this.account, region: this.region },
        stageName: 'UpdateTaskDefinition',
        registryStackName: containerRegistryStackName,
        infrastructureStackName,
      },
    )

    pipeline.addStage(taskdefinitionStage)
    pipeline.buildPipeline()

    const vpc = ec2.Vpc.fromLookup(this, 'VPC', { vpcId: vpcId })
    const { ecsDeploymentGroup } = new ECSDeployment(this, 'ECSDeployment', {
      blueTG: elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(
        this,
        'BlueTG',
        {
          targetGroupArn: Fn.importValue(
            `${infrastructureStackName}BlueTargetGroup`,
          ),
          loadBalancerArns: Fn.importValue(
            `${infrastructureStackName}LoadBalancerArn`,
          ),
        },
      ),
      greenTG: elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(
        this,
        'GreenTG',
        {
          targetGroupArn: Fn.importValue(
            `${infrastructureStackName}GreenTargetGroup`,
          ),
          loadBalancerArns: Fn.importValue(
            `${infrastructureStackName}LoadBalancerArn`,
          ),
        },
      ),
      prodListener: elbv2.ApplicationListener.fromApplicationListenerAttributes(
        this,
        'ProdRoute',
        {
          listenerArn: Fn.importValue(
            `${infrastructureStackName}ProdTrafficListener`,
          ),
          securityGroup: ec2.SecurityGroup.fromSecurityGroupId(
            this,
            'LBSecurityGroup',
            Fn.importValue(
              `${infrastructureStackName}LoadBalancerSecurityGroup`,
            ),
            { allowAllOutbound: true },
          ),
        },
      ),
      service: ecs.FargateService.fromFargateServiceAttributes(
        this,
        'FargateService',
        {
          cluster: ecs.Cluster.fromClusterAttributes(this, 'cluster', {
            clusterName: clusterName,
            vpc,
          }),
          serviceArn: Fn.importValue(`${serviceStackName}ServiceOutput`),
        },
      ),
      variables,
    })

    const stages = [
      this._createImageBuildStage({
        repository,
        input: githubOutput,
        output: buildOutput,
      }),
      this._createDeployStage({
        input: buildOutput,
        ecsDeploymentGroup,
      }),
    ]

    stages.forEach((__stage) => pipeline.pipeline.addStage(__stage))
  }

  _createImageBuildStage(props: {
    repository: ecr.IRepository
    input: codepipeline.Artifact
    output: codepipeline.Artifact
  }): codepipeline.StageOptions {
    const { repository, input, output } = props
    const taskDefinitionName = 'sample-api'
    const containerName = 'sample-api'
    const appSpec: any = {
      version: 0.0,
      Resources: [
        {
          TargetService: {
            Type: 'AWS::ECS::Service',
            Properties: {
              TaskDefinition: '<TASK_DEFINITION>',
              LoadBalancerInfo: {
                ContainerName: containerName,
                containerPort: 1323,
              },
            },
          },
        },
      ],
    }

    const project = new codebuild.PipelineProject(this, 'SampleProject', {
      projectName: 'SampleProject',
      environment: {
        privileged: true,
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      environmentVariables: {
        REPOSITORY_URI: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: repository.repositoryUri,
        },
      },
      timeout: Duration.minutes(30),
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '0.2',
        env: {
          variables: {
            DOCKER_BUILDKIT: '1',
          },
        },
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              `aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${this.account}.dkr.ecr.${this.region}.amazonaws.com`,
              'IMAGE_TAG=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
            ],
          },
          build: {
            commands: [
              'echo Building the Docker image....',
              'cd app && docker build -t $REPOSITORY_URI:latest . --build-arg VERSION=$IMAGE_TAG -f Dockerfile && cd ..',
              'docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker images...',
              'docker push $REPOSITORY_URI:latest',
              'docker push $REPOSITORY_URI:$IMAGE_TAG',
              'echo Writing image detail file...',
              'echo "{\\"ImageURI\\":\\"${REPOSITORY_URI}:${IMAGE_TAG}\\"}" | tee imageDetail.json',
              `aws ecs describe-task-definition --task-definition ${taskDefinitionName} | jq '.taskDefinition | del (.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities)' | jq --arg image '<IMAGE1_NAME>' '.containerDefinitions[] |= if .name == "${containerName}" then .image = $image else . end' > taskdef.json`,
              `echo '${JSON.stringify(appSpec)}' | tee appspec.json`,
            ],
          },
        },
        artifacts: {
          files: ['imageDetail.json', 'taskdef.json', 'appspec.json'],
        },
      }),
    })
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:DescribeTaskDefinition'],
        resources: ['*'],
      }),
    )
    repository.grantPullPush(project)

    return {
      stageName: 'ImageBuild',
      actions: [
        new actions.CodeBuildAction({
          runOrder: 1,
          actionName: 'ImageBuild',
          input: input,
          outputs: [output],
          project: project,
        }),
      ],
    }
  }

  _createDeployStage(props: {
    ecsDeploymentGroup: codedeploy.EcsDeploymentGroup
    input: codepipeline.Artifact
  }): codepipeline.StageOptions {
    const { ecsDeploymentGroup, input } = props

    const deployAction = new actions.CodeDeployEcsDeployAction({
      runOrder: 1,
      actionName: 'deploy',
      appSpecTemplateFile: input.atPath('appspec.json'),
      taskDefinitionTemplateInput: input,
      containerImageInputs: [
        {
          input,
          taskDefinitionPlaceholder: 'IMAGE1_NAME',
        },
      ],
      deploymentGroup: ecsDeploymentGroup,
    })

    return {
      stageName: 'Deploy',
      actions: [deployAction],
    }
  }
}
