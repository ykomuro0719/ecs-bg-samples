import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_ecr as ecr,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export interface SampleContainerRepositoryStackProps extends StackProps {}

/* after deploy this stack、push initial image to ECR
commands
```bash
cd app && docker build -t <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/sample-api:latest .
aws ecr get-login-password [--profile <AWS_PROFILE>] | docker login --username AWS --password-stdin '<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com' \
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/sample-api:latest
```
*/
export class SampleContainerRepositoryStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: SampleContainerRepositoryStackProps,
  ) {
    super(scope, id, props)
    const repository = new ecr.Repository(this, 'Repository', {
      repositoryName: 'sample-api',
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        { rulePriority: 1, maxImageCount: 10, tagStatus: ecr.TagStatus.ANY },
      ],
    })

    new CfnOutput(this, 'ContainerRepositoryOutput', {
      value: repository.repositoryName,
      exportName: `${this.stackName}ContainerRepository`,
    })
  }
}
