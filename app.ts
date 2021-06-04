#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { devPipelineStack } from './stacks/dev-pipeline'
import { prodPipelineStack } from './stacks/prod-pipeline'

const app = new cdk.App()

const devPipeline = new devPipelineStack(app, `DevelopmentCICDPipelineStack`, {
  env: {
    account: '************',
    region: '**************'
  },
  repositoryName: '************',
  branch: '*******',
  production: {
    account: '************',
    region: '**************'
  }
})

new prodPipelineStack(app, `ProductionCICDPipelineStack`, {
  env: {
    account: '************',
    region: '**************'
  },
  repositoryArn: devPipeline.repositoryArn,
  branch: '******',
  development: devPipeline
})
