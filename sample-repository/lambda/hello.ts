import * as lambda from 'aws-lambda'

exports.handler = async (event: lambda.APIGatewayEvent) => {
  // TODO implement
  const response = {
    statusCode: 200,
    body: 'Hello from Lambda!'
  }
  return response
}
