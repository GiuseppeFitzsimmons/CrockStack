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
        await new Promise( (resolve, reject)=>{
            //Little wait, so that we can test, for instance, stale connections
            setTimeout(resolve, 5000)
        })
        let data=await new Promise( (resolve, reject) => {
            apigwManagementApi.getConnection({ ConnectionId: event.requestContext.connectionId}, function(error, connectionDetail) {
                console.log("Connection detail", connectionDetail);
                let d={ message: `hello from messagelambda - your ip address is ${connectionDetail.Identity.SourceIp}, the current time is ${new Date().toISOString()}` };
                resolve(d);
            });
        })
        await apigwManagementApi.postToConnection({ ConnectionId: event.requestContext.connectionId, Data: data }).promise();
        
        
    } catch (e) {
        if (e.statusCode === 410) {
            console.log(`Found stale connection ${event.requestContext.connectionId}`);
            await apigwManagementApi.deleteConnection({ ConnectionId: event.requestContext.connectionId}).promise();
        } else {
            throw e;
        }
    }
    return returnObject
}