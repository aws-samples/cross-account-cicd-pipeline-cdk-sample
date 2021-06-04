import * as cdk from '@aws-cdk/core'
import * as codecommit from '@aws-cdk/aws-codecommit'
import * as codebuild from '@aws-cdk/aws-codebuild'
import * as codepipeline from '@aws-cdk/aws-codepipeline'
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions'
import * as iam from '@aws-cdk/aws-iam'
import * as events from '@aws-cdk/aws-events'
import * as targets from '@aws-cdk/aws-events-targets'

export interface devPipelineProps extends cdk.StackProps {
  repositoryName: string
  branch?: string
  production: {
    account: string
    region: string
  }
}

export class devPipelineStack extends cdk.Stack {
  public repositoryArn: string
  public crossAccessRoleArn: string

  constructor(scope: cdk.Construct, id: string, props: devPipelineProps) {
    super(scope, id, props)

    const sourceOutput = new codepipeline.Artifact()

    const repository = codecommit.Repository.fromRepositoryName(
      this,
      `${id}-repo`,
      props.repositoryName
    )

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: `codecommit`,
      repository: repository,
      output: sourceOutput,
      branch: props.branch ?? 'develop'
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

    new codepipeline.Pipeline(this, `${id}-pipeline`, {
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

    const crossAccessRole = new iam.Role(this, `${id}-cross-access-role`, {
      roleName: 'CodeCommitCrossAccessRoleSample',
      assumedBy: new iam.AccountPrincipal(props.production.account)
    })

    crossAccessRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['codecommit:*', 's3:*', 'kms:*'],
        resources: ['*']
      })
    )

    repository.onStateChange(`${id}-state-change-event`, {
      target: new targets.EventBus(
        events.EventBus.fromEventBusArn(
          this,
          'External',
          `arn:aws:events:${props.production.region}:${props.production.account}:event-bus/default`
        )
      )
    })

    this.repositoryArn = repository.repositoryArn
    this.crossAccessRoleArn = crossAccessRole.roleArn

    new cdk.CfnOutput(this, `${id}-repository-arn`, {
      value: this.repositoryArn
    })

    new cdk.CfnOutput(this, `${id}-cross-access-role-arn`, {
      value: this.crossAccessRoleArn
    })
  }
}
