const fs = require('fs');
var http = require('http');
const parameterOverrides = { 'AWS::StackName': 'CrockStack', 'AWS::Region': 'local' };
const { getAnswerFunction } = require('./gatewayAnswer');
const { loadTemplate } = require('./templateLoader');
const { websocketAnswer } = require('./websocketAnswer');
const WebSocket = require('ws');

function startServer() {
    var templateName = 'template.yaml'
    var _port = 8080;
    var _wsport = 9090;
    var _skipDb=false;
    for (var i in process.argv) {
        if (process.argv[i] == '--port') {
            _port = process.argv[i * 1 + 1]
        } else if (process.argv[i] == '--template') {
            //Side note, --template-file is supported by Cloudformation
            templateName = process.argv[i * 1 + 1]
        } else if (process.argv[i] == '--parameter-overrides') {
            let _string = process.argv[i * 1 + 1]
            let _splitted = _string.split(' ')
            for (var i in _splitted) {
                var _splits = _splitted[i].split('=')
                parameterOverrides[_splits[0].trim()] = _splits[1].trim()
            }
        } else if (process.argv[i] == '--env-vars') {
            let fileName = process.argv[i * 1 + 1]
            let fileContents = fs.readFileSync(process.cwd() + '/' + fileName, 'utf8')
            let parsedContents = JSON.parse(fileContents);
            Object.assign(parameterOverrides, parsedContents.Parameters);
            if (parameterOverrides.DymamoDbEndpoint) {
                parameterOverrides.DynamoDbEndpoint = parameterOverrides.DymamoDbEndpoint
            }
        } else if (process.argv[i] == '--wsport') {
            _wsport = process.argv[i * 1 + 1]
        } else if (process.argv[i] == '--skipdb') {
            //Review - We assign a value to _skipDb, but we never read it and skip any db creation if the argument is present. Why? Also, what's up with indexOf('t')?
            _skipDb = process.argv[i * 1 + 1].toLowerCase().indexOf('t')>-1;
        }
    }
    var stack = loadTemplate(templateName, parameterOverrides)
    for (i in stack.Resources) {
        let resource = stack.Resources[i]
        if (resource.Type == 'AWS::DynamoDB::Table') {
            if (parameterOverrides.DynamoDbEndpoint && !_skipDb) {
                createTable(stack, resource)
            }
        } else if (resource.Type == 'AWS::Serverless::SimpleTable') {
            //To self - SimpleTable is just a DDB table where only a primary key is needed (simple, fast)
            if (parameterOverrides.DynamoDbEndpoint && !_skipDb) {
                let primaryKey = resource.Properties.PrimaryKey
                resource.Properties.KeySchema = []
                resource.Properties.KeySchema.push({ AttributeName: primaryKey.Name, KeyType: 'HASH' })
                //To self - See documentation for details, but we're doing this because SimpleTable can't have a KeySchema or AttributeDefinitions in the template
                //as opposed to a DynamoDB::Table resource.
                resource.Properties.AttributeDefinitions = []
                resource.Properties.AttributeDefinitions.push({ AttributeName: primaryKey.Name, AttributeType: primaryKey.Type.charAt(0) })
                delete resource.Properties.PrimaryKey
                createTable(stack, resource)
            }
        }
    }
    if (stack.Resources) {
        for (var i in stack.Resources) {
            if (stack.Resources[i].Type == 'AWS::ApiGatewayV2::Api') {
                startWebSocket(stack.Resources[i], stack, _wsport);
                //TODO support multipled instances of AWS::ApiGatewayV2::Api
                _wsport=(_wsport*1+1);
            }
        }
    }
    let answerFunction = getAnswerFunction(stack);
    //To self - getAnswerFunction (in gatewayAnswer) returns its local function, answerFunction (named identically here).
    var server = http.createServer(answerFunction);
    //To self - And then we pass that intelligence to the server!
    //TODO support multipled instances of AWS::ApiGateway::Api
    server.listen(_port);
    console.log(`Server listening on port ${_port}`);

}
function createTable(stack, resource) {
    //To self - Deleting AWS-specific properties
    delete resource.Properties.BillingMode;
    delete resource.Properties.PointInTimeRecoverySpecification;
    const { execSync } = require('child_process')
    //To self - I'm surprised we need to use this as I assumed it'd be a given we can use nodejs modules,
    //plus child_process looks to be too low-level to need to be specifically required
    resource.Properties.TableName = stack.resolveParameter(resource.Properties.TableName)
    fs.writeFileSync(resource.Properties.TableName + '.JSON', JSON.stringify(resource.Properties))
    try {
        console.log(`Deleting ${resource.Properties.TableName}, 10 second timeout`)
        execSync('aws dynamodb delete-table --table-name ' + resource.Properties.TableName + ' --endpoint-url ' + parameterOverrides.DynamoDbEndpoint, { timeout: 10000 })
    } catch (err) {
    }
    try {
        console.log(`Creating ${resource.Properties.TableName}, 10 second timeout`)
        execSync('aws dynamodb create-table --cli-input-json file://' + resource.Properties.TableName + '.JSON --endpoint-url ' + parameterOverrides.DynamoDbEndpoint, { timeout: 10000 })
    } catch (err) {
        console.log(`Unable to contact server within 10 second timeout, do you have an instance of DynamoDB running?`)
    }
    fs.unlinkSync(resource.Properties.TableName + '.JSON')

}

function makeUID(){
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function startWebSocket(apiGatewayV2, stack, wsport) {
    console.log('Starting WebSocket')

    const wss = new WebSocket.Server({ port: wsport ? wsport : 9090 });
    stack.connections = {}
    wss.on('connection', function connection(ws, request) {
        let uniqueId = makeUID();
        ws.ipAddress=request.connection.remoteAddress;
        stack.connections[uniqueId]=new websocketAnswer(ws, apiGatewayV2, stack, uniqueId)
    });
    console.log(`Websocket server listening on ${wsport}`);
}
module.exports = { startServer }