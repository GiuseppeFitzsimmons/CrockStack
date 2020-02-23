/*
HelloLambda exists to test aspects of CrockStack.
*/

const { helper } = require('helper')

exports.requestHandler = async (event, context) => {
    let returnObject = {};
    returnObject.statusCode = 200;
    console.log("hello", process.env.BUILD_VERSION);
    returnObject.body = JSON.stringify({ version: process.env.BUILD_VERSION, 
        environment: process.env.ENVIRONMENT, 
        greeting:process.env.GREETING, 
        helper: helper(),
        userTable: process.env.USER_TABLE_NAME,
        mapGreeting: process.env.MAP_TEST,
        region: process.env.SUB_TEST
    })
    return returnObject
}