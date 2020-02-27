const AWS = require('aws-sdk');

const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    //endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
});



exports.handler = async (event, context) => {
    let returnObject = {};
    returnObject.statusCode = 200;
    console.log("messagelambda event", event);
    try {
        await apigwManagementApi.postToConnection({ ConnectionId: event.requestContext.connectionId, Data: { message: 'hello from messagelambda' } })//.promise();
    } catch (e) {
        if (e.statusCode === 410) {
            console.log(`Found stale connection, deleting ${connectionId}`);
        } else {
            throw e;
        }
    }
    return returnObject
}