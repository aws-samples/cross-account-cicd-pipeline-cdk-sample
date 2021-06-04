#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { LambdaStack } from './lib/stack/lambda'

const app = new cdk.App()
new LambdaStack(app, 'SampleLambdaStack')
