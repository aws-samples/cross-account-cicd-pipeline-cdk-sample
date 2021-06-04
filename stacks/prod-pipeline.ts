import * as cdk from '@aws-cdk/core'
import * as codecommit from '@aws-cdk/aws-codecommit'
import * as codebuild from '@aws-cdk/aws-codebuild'
import * as codepipeline from '@aws-cdk/aws-codepipeline'
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions'
import * as iam from '@aws-cdk/aws-iam'
import * as events from '@aws-cdk/aws-events'
import * as s3 from '@aws-cdk/aws-s3'
import * as kms from '@aws-cdk/aws-kms'

export interface prodPipelineProps extends cdk.StackProps {
  repositoryArn: string
  branch?: string
  development: {
    account: string
  }
}

export class prodPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: prodPipelineProps) {
    super(scope, id, props)

    const crossAccessRole = iam.Role.fromRoleArn(
      this,
      `${id}-cross-access-role`,
      `arn:aws:iam::${props.development.account}:role/CodeCommitCrossAccessRoleSample`
    )

    const sourceOutput = new codepipeline.Artifact()

    const repository = codecommit.Repository.fromRepositoryArn(
      this,
      `${id}-repo`,
      props.repositoryArn
    )

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: `codecommit`,
      repository: repository,
      output: sourceOutput,
      branch: props.branch ?? 'master',
      role: crossAccessRole
    })

    const deployRole = new iam.Role(this, `${id}-deploy-role`, {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/PowerUserAccess' }
      ],
      inlinePolicies: {
        [`${id}-inline-policies`]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['iam:*'],
              resources: ['*']
            })
          ]
        })
      }
    })

    const deployDefinition = new codebuild.PipelineProject(
      this,
      `${id}-deploy`,
      {
        buildSpec: codebuild.BuildSpec.fromSourceFilename('./buildspec.yml'),
        role: deployRole,
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_1_0,
          environmentVariables: {
            SAMPLE_VARIABLE_KEY: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: 'sample_variable_value'
            }
          }
        }
      }
    )

    const deployAction = new codepipeline_actions.CodeBuildAction({
      actionName: `deploy`,
      input: sourceOutput,
      project: deployDefinition
    })

    const key = new kms.Key(this, `${id}-artifact-key`, {
      enableKeyRotation: true
    })

    const artifactBucket = new s3.Bucket(this, `${id}-artifact-bucket`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key
    })

    artifactBucket.grantReadWrite(new iam.ArnPrincipal(crossAccessRole.roleArn))

    const pipeline = new codepipeline.Pipeline(this, `${id}-pipeline`, {
      artifactBucket: artifactBucket,
      stages: [
        {
          stageName: 'source',
          actions: [sourceAction]
        },
        {
          stageName: 'deploy',
          actions: [deployAction]
        }
      ]
    })

    pipeline.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:*', 'codecommit:*', 'kms:*'],
        resources: [crossAccessRole.roleArn]
      })
    )

    new events.CfnEventBusPolicy(this, `${id}-eventbus-policy`, {
      action: 'events:PutEvents',
      eventBusName: 'default',
      principal: props.development.account,
      statementId: `AcceptEventsFrom_${props.development.account}`
    })
  }
}
