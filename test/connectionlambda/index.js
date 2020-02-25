exports.handler = async (event, context) => {
    let returnObject = {};
    returnObject.statusCode = 200;
    console.log("connectionLambda", event.requestContext.connectionId);
    return returnObject
}