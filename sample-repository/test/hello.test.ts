const lambda = require('../lambda/hello')

test('the response is successful', async () => {
  const data = await lambda.handler()
  expect(data).toHaveProperty('body', 'Hello from Lambda!')
  expect(data).toHaveProperty('statusCode', 200)
})
