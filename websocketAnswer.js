/*

*/

function websocketAnswer(ws, apiGatewayV2, stack){
    //first thing we want to do is call the lambda associated with a connection.
    //The way that works in AWS APIGateWayV2, is there must be a resource of type AWS::ApiGatewayV2::Route,
    //which has a parameter called RouteKey which is equal to "$connect".
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        console.log('apiGatewayV2.Properties.RouteSelectionExpression', apiGatewayV2.Properties.RouteSelectionExpression);
        //The apiGateWayV2 will have a property called RouteSelectionExpression, the value of which is something like $request.body.action
        //We want to isolate whatever is after $request.body.
        let key = apiGatewayV2.Properties.RouteSelectionExpression.replace('$request.body.', '');
        //Now we've got our routeKey. If, for example, the RouteSelectionExpression was $request.body.message, then the key is "action"
        //So that would mean we'd want to find the value of "action" in the incoming message from the user.
        //If, for example, the message from the client was {body: {action:'update'}},
        //then the action would be "update". 
        let request = JSON.parse(message);
        let route = request.body[key];
        //Sticking with the example, the value of route should be 'update'.
        console.log('route', route)
        //So to direct this message to the right lambda, first we find a Route the RouteKey of which is equal to 'update'.
        let routeResource = findResource(stack, 'AWS::ApiGatewayV2::Route', 'RouteKey', route)
        console.log('routeResource', routeResource);
        //Once we have the Route, then we have to get its Target, and parse it to find the name of the integration resource
        //Let's assume that the Target is '/integrations/ConnectIntegration'.
        let integrationResourceName = routeResource.Properties.Target.split('/')
        integrationResourceName = integrationResourceName[integrationResourceName.length - 1];
        //With the above example, we should have identified the name of the resource of type AWS::ApiGatewayV2::Integration
        //So we can get it by just asking the stack for it by name
        let integrationResource = stack.Resources[integrationResourceName]
        console.log('integrationResource', integrationResource);
        //Now we've got the integration resource, which has a property called IntegrationUri, in which we'll find the name
        //of the Lambda which is configured to answer this message.
        ws.send('MESSAGE')
    });
    ws.on('close', function() {
        //This is like connect, except it's disconnect. We want to do the same thing as with connect
        //except we're looking for a $routeKey the value of which is '$disconnnect'
    })
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