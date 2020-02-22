function websocketAnswer(ws, apiGatewayV2, stack){
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        console.log('apiGatewayV2.Properties.RouteSelectionExpression', apiGatewayV2.Properties.RouteSelectionExpression)
        let key = apiGatewayV2.Properties.RouteSelectionExpression.replace('$request.body.', '')
        let request = JSON.parse(message)
        let route = request.body[key]
        console.log('route', route)
        let routeResource = findResource(stack, 'AWS::ApiGatewayV2::Route', 'OperationName', route)
        console.log('routeResource', routeResource)
        let integrationResourceName = routeResource.Properties.Target.split('/')
        integrationResourceName = integrationResourceName[integrationResourceName.length - 1]
        let integrationResource = stack.Resources[integrationResourceName]
        console.log('integrationResource', integrationResource)
        ws.send('MESSAGE')
    });
}
function findResource(stack, type, propertyName, propertyValue) {
    for (var i in stack.Resources) {
        let resource = stack.Resources[i]
        if (resource.Type == type && resource.Properties && resource.Properties[propertyName] && resource.Properties[propertyName] == propertyValue) {
            return resource
        }
    }
}
module.exports = {websocketAnswer}