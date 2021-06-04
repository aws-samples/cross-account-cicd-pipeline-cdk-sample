import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as lambdaNodejs from '@aws-cdk/aws-lambda-nodejs'

export class LambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    new lambdaNodejs.NodejsFunction(this, `${id}-sample-lambda`, {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'handler',
      timeout: cdk.Duration.minutes(15),
      bundling: {
        nodeModules: [
          /* 'aws-sdk' */
        ]
      },
      entry: './lambda/hello.ts'
    })
  }
}
