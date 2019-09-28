const { helper } = require('helper')

exports.requestHandler = async (event, context) => {
    let returnObject = {}
    returnObject.statusCode = 200
    returnObject.body = JSON.stringify({ version: process.env.BUILD_VERSION, environment: process.env.ENVIRONMENT, greeting:process.env.GREETING  })
    console.log('called helper' + helper())
    return returnObject
}