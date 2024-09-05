AWS_PROFILE ?=
ifeq ($(AWS_PROFILE),)
_AWS_REGION = $(shell aws configure get region)
AWS_ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)
else
export AWS_PROFILE
_AWS_REGION = $(shell aws configure get region)
AWS_ACCOUNT_ID = $(shell aws sts get-caller-identity --query Account --output text)
endif

ifeq ($(_AWS_REGION),)
 export AWS_REGION = ap-northeast-1
else
 export AWS_REGION = $(_AWS_REGION)
endif

REPOSITORY_NAME = sample-api
REPOSITORY_URI = $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com/$(REPOSITORY_NAME)

.PHONY: destroy deploy

destroy:
	cd infrastructure \
	&& npx cdk destroy SamplePipelineStack --force \
	&& npx cdk destroy SampleServicePreferenceStack --force \
	&& npx cdk destroy SampleServiceStack --force \
	&& npx cdk destroy SampleTaskDefinitionStack --force \
	# delete image from ECR
	&& aws ecr list-images --repository-name $(REPOSITORY_NAME) --query 'imageIds[*].imageDigest' --output text \
	| tr ' ' '\n' | xargs -n 1 -I {} aws ecr batch-delete-image --repository-name $(REPOSITORY_NAME) --image-ids imageDigest={} \
	# destroy rest
	&& npx cdk destroy SampleContainerRepositoryStack --force \
	&& npx cdk destroy SampleInfrastructureStack --force

deploy:
	cd infrastructure \
	&& npx cdk deploy SampleInfrastructureStack --require-approval never \
	&& npx cdk deploy SampleContainerRepositoryStack --require-approval never
	# push image to ECR
	cd app && docker build -t $(REPOSITORY_URI):latest . \
	&& aws ecr get-login-password --region $(AWS_REGION) \
	| docker login --username AWS --password-stdin $(REPOSITORY_URI) \
	&& docker push $(REPOSITORY_URI):latest
	# deploy rest
	cd infrastructure \
	&& npx cdk deploy SampleTaskDefinitionStack --require-approval never \
	&& npx cdk deploy SampleServiceStack --require-approval never \
	&& npx cdk deploy SampleServicePreferenceStack --require-approval never \
	&& npx cdk deploy SamplePipelineStack --require-approval never
