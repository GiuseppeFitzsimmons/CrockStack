/*
HelloLambda exists to test aspects of CrockStack.
*/

const { helper } = require('helper')

function handler(event, context, callback) {
    let returnObject = {}
    returnObject.statusCode = 200
    returnObject.informationThatWontBeReturned=1000;
    console.log("hello sync", process.env.BUILD_VERSION);
    returnObject.body = JSON.stringify({ version: process.env.BUILD_VERSION, 
        environment: process.env.ENVIRONMENT, 
        greeting:process.env.GREETING, 
        helper: helper(),
        userTable: process.env.USER_TABLE_NAME,
        mapGreeting: process.env.MAP_TEST,
        region: process.env.SUB_TEST
    })
    if (event.queryStringParameters.useContext) {
        context.succeed(returnObject.body);
    } else {
        callback(null, returnObject)
    }
}
exports.handler=handler