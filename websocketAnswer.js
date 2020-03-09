/*
Find the lambda by the routeKey, of railing that by $default
*/
function findLambda(routeKey, stack) {
    let routeResource = findResource(stack, 'AWS::ApiGatewayV2::Route', 'RouteKey', routeKey);
    if (!routeResource && routeKey!='$default') {
        routeResource=findResource(stack, 'AWS::ApiGatewayV2::Route', 'RouteKey', '$default');
    }
    if (!routeResource) {
        console.log("Unable to find route for ", routeKey);
        return;
    }
    let _target = routeResource.Properties.Target;
    if (typeof _target != 'string') {
        _target = stack.resolveParameter(_target);
    }
    let integrationResourceName = _target.split('/');
    integrationResourceName = integrationResourceName[integrationResourceName.length - 1];
    let integrationResource = stack.Resources[integrationResourceName]
    let lambdaName = stack.resolveParameter(integrationResource.Properties.IntegrationUri)
    let lambdaNameSplit = lambdaName.split('/')
    for (var i in lambdaNameSplit) {
        if (lambdaNameSplit[i] == 'functions') {
            lambdaName = lambdaNameSplit[i * 1 + 1]
            break
        }
    }
    return stack.Resources[lambdaName]
}

function websocketAnswer(ws, apiGatewayV2, stack, uniqueId) {
    this.uniqueId = uniqueId;
    this.lastActiveAt = new Date().toISOString();
    this.connectedAt = new Date().toISOString();
    //first thing we want to do is call the lambda associated with a connection.
    //The way that works in AWS APIGateWayV2, is there must be a resource of type AWS::ApiGatewayV2::Route,
    //which has a parameter called RouteKey which is equal to "$connect".
    let lambda = findLambda('$connect', stack);
    if (lambda) {
        stack.prepareLambdaForExecution(lambda)
        event = { requestContext: { connectionId: uniqueId } }
        stack.executeLambda(lambda, event)
    }
    ws.websocketAnswer = this;
    ws.on('message', function incoming(message) {
        this.websocketAnswer.lastActiveAt = new Date().toISOString();
        //The apiGateWayV2 will have a property called RouteSelectionExpression, the value of which is something like $request.body.action
        //We want to isolate whatever is after $request.body.
        let key = apiGatewayV2.Properties.RouteSelectionExpression.replace('$request.body.', '');
        //Now we've got our routeKey. If, for example, the RouteSelectionExpression was $request.body.action, then the key is "action"
        //So that would mean we'd want to find the value of "action" in the incoming message from the user.
        //If, for example, the message from the client was {action:'update'},
        //then the action would be "update". 
        let request = JSON.parse(message);
        let route = request[key];
        let lambda = findLambda(route, stack);
        if (lambda) {
            stack.prepareLambdaForExecution(lambda);
            let requestContext={
                connectionId: this.websocketAnswer.uniqueId,
                routeKey: route
            }
            event = { requestContext, body: message }
            stack.executeLambda(lambda, event)
        }
    });
    ws.on('close', function () {
        //This is like connect, except it's disconnect. We want to do the same thing as with connect
        //except we're looking for a $routeKey the value of which is '$disconnnect'
        let lambda = findLambda('$disconnect', stack);
        if (lambda) {
            stack.prepareLambdaForExecution(lambda);
            event = { requestContext: { connectionId: uniqueId, routeKey: '$disconnect' } }
            stack.executeLambda(lambda, event)
        }
    })
    this.sendMessage = function (data, callback) {
        this.lastActiveAt = new Date().toISOString();
        if (ws.readyState === 3 /*connection is closed*/) {
            callback({ statusCode: 410 });
        } else {
            if (typeof data=='object') {
                data=JSON.stringify(data);
            }
            ws.send(data, (error, data) => {
                callback(error, data);
            })
        }
    }
    this.getConnectionDetail = function () {
        return {
            LastActiveAt: this.lastActiveAt,
            ConnectedAt: this.connectedAt,
            Identity: {
                SourceIp: ws.ipAddress
            }
        }
    }
    this.disconnect = function (callback) {
        ws.close(callback);
    }
    return this
}



function findResource(stack, type, propertyName, propertyValue) {
    for (var i in stack.Resources) {
        let resource = stack.Resources[i]
        if (resource.Type == type && resource.Properties && resource.Properties[propertyName] && resource.Properties[propertyName] == propertyValue) {
            return resource
        }
    }
}
module.exports = { websocketAnswer }