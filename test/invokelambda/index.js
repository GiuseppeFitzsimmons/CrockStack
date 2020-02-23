/*
Invoke exists to test the AWS mock functions of CrockStack.
*/

const AWS = require('aws-sdk');
var lambda = new AWS.Lambda();

function handler(event, context, callback) {
    let returnObject = {};
    returnObject.statusCode = 200;
    var params = {
        ClientContext: "MyApp",
        FunctionName: "HelloLambda",
        InvocationType: "Event",
        LogType: "Tail",
        Payload: { "some": "thing" },
        Qualifier: "1"
    };
    lambda.invoke(params, function (err, data) {
        if (err) {
            callback(err)
        } else {
            callback(null, returnObject)
        }
    });
}

exports.handler=handler