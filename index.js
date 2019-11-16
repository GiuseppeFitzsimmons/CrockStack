const fs = require('fs')
const yaml = require('js-yaml')
const YAML = require('yaml')
const querystring = require('querystring')
var http = require('http')
var moduleAlias = require('module-alias')
const parameterOverrides = { 'AWS::StackName': 'CrockStack', 'AWS::Region': 'local' }

function startServer() {
    var templateName = 'template.yaml'
    var _port = 8080
    for (var i in process.argv) {
        if (process.argv[i] == '--port') {
            _port = process.argv[i * 1 + 1]
        } else if (process.argv[i] == '--template') {
            templateName = process.argv[i * 1 + 1]
        } else if (process.argv[i] == '--parameter-overrides') {
            let _string = process.argv[i * 1 + 1]
            let _splitted = _string.split(',')
            for (var i in _splitted) {
                var _splits = _splitted[i].split('=')
                parameterOverrides[_splits[0].trim()] = _splits[1].trim()
            }
        } else if (process.argv[i] == '--env-vars') {
            let fileName = process.argv[i * 1 + 1]
            let fileContents = fs.readFileSync(process.cwd() + '/' + fileName, 'utf8')
            let parsedContents = JSON.parse(fileContents)
            Object.assign(parameterOverrides, parsedContents.Parameters)
        }
    }
    var startStack = loadTemplate(templateName)
    for (i in startStack.Resources) {
        let resource = startStack.Resources[i]
        if (resource.Type == 'AWS::DynamoDB::Table') {
            if (parameterOverrides.DymamoDBEndpoint) {
                createTable(startStack, resource)
            }
        } else if (resource.Type == 'AWS::Serverless::SimpleTable') {
            if (parameterOverrides.DymamoDBEndpoint) {
                let primaryKey = resource.Properties.PrimaryKey
                resource.Properties.KeySchema = []
                resource.Properties.KeySchema.push({ AttributeName: primaryKey.Name, KeyType: 'HASH' })
                resource.Properties.AttributeDefinitions = []
                resource.Properties.AttributeDefinitions.push({ AttributeName: primaryKey.Name, AttributeType: primaryKey.Type.charAt(0) })
                delete resource.Properties.PrimaryKey
                createTable(startStack, resource)
            }
        }
    }
    var answerFunction = async function (request, response) {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Request-Method', '*');
        response.setHeader('Access-Control-Allow-Methods', '*');
        response.setHeader('Access-Control-Allow-Headers', '*');
        if (request.method === 'OPTIONS') {
            response.writeHead(200);
            response.end();
            return;
        }
        var _path = request.url
        var _queryString = request.url
        if (_path.indexOf('?') > -1) {
            _path = _path.substring(0, _path.indexOf('?'))
            _queryString = _queryString.substring(_queryString.indexOf('?') + 1)
        }
        multiQueryStringParameters = querystring.parse(_queryString)
        if (multiQueryStringParameters) {
            for (var i in multiQueryStringParameters) {
                multiQSP = multiQueryStringParameters[i]
                if (typeof(multiQSP)=='String'){
                    let multiQSPArray = []
                    multiQSPArray.push(multiQSP)
                    multiQueryStringParameters[i] = multiQSPArray
                }
            }
        }

        var event = {
            path: _path,
            httpMethod: request.method.toLowerCase(),
            queryStringParameters: querystring.parse(_queryString),
            multiQueryStringParameters: multiQueryStringParameters,
            headers: request.headers
        }
        if (event.httpMethod == 'put' || event.httpMethod == 'post') {

            var contents = await new Promise((resolve, reject) => {
                let byteArray = [];
                request.on('data', (chunk) => {
                    byteArray.push(chunk);
                }).on('end', () => {
                    _string = Buffer.concat(byteArray).toString();
                    resolve(_string);
                });
            })
            let contentType = event.headers['content-type']
            if (!contentType) {
                contentType = event.headers['Content-Type']
            }
            if (contentType && contentType.toLowerCase().indexOf('multipart/form-data') == 0) {
                event.body = Buffer.from(contents).toString('base64');
                event.isBase64Encoded = true
            } else {
                try {
                    event.body = JSON.parse(contents)
                } catch (err) {
                    event.body = querystring.parse(contents)
                }
            }

        }
        let stack = loadTemplate(templateName)
        let lambda = getLambda(stack, event)
        if (lambda) {
            let layers = getLayersforLambda(stack, lambda)
            if (layers) {
                for (var l in layers) {
                    let layer = layers[l]
                    let contentUri = layer.Properties.ContentUri
                    if (contentUri.charAt(0) == '/') {
                        contentUri = contentUri.substring(1)
                    }
                    if (contentUri.lastIndexOf('/') == contentUri.length) {
                        contentUri = contentUri.substring(0, contentUri.length - 1)
                    }
                    moduleAlias.addPath(process.cwd() + '/' + contentUri + '/nodejs')
                    moduleAlias.addPath(process.cwd() + '/' + contentUri + '/nodejs/node_modules')
                }
            }
            let variables = getEnvironmentVariablesforLambda(stack, lambda)
            if (variables) {
                for (var v in variables) {
                    let variable = variables[v]
                    for (var w in variable) {
                        process.env[w] = variable[w]
                    }
                }
            }
            let codeUri = lambda.Properties.CodeUri
            if (codeUri.charAt(0) == '/') {
                codeUri = codeUri.substring(1)
            }
            if (codeUri.lastIndexOf('/') == codeUri.length) {
                codeUri = codeUri.substring(0, codeUri.length - 1)
            }
            let lambdaFunction = require(process.cwd() + '/' + codeUri)
            let handler = getHandlerforLambda(stack, lambda)
            var context = {}
            let result;
            if (lambdaFunction[handler].constructor.name==='AsyncFunction') {
                result = await lambdaFunction[handler](event, context)
            } else {
                let syncReply = await new Promise( (resolve, reject)=>{
                    context.done=(error, reply)=>{
                        resolve({error, reply});
                    }
                    context.succeed=(reply)=>{
                        resolve({reply});
                    }
                    context.fail=(error)=>{
                        if (!error) {
                            error={}
                        }
                        resolve({error});
                    }
                    lambdaFunction[handler](event, context, function(err, reply) {
                        context.done(err, reply);
                    })
                })
                if (syncReply.reply && (syncReply.reply.body || syncReply.reply.statusCode)) {
                    result=syncReply.reply;
                    if (!result.statusCode) {
                        result.statusCode=200;
                    }
                } else if (syncReply.error) {
                    let _body=typeof(syncReply.error)=='object' ? JSON.stringify(syncReply.error) : syncReply.error;
                    result={body:_body};
                    result.statusCode=400;
                } else {
                    let _body=typeof(syncReply.reply)=='object' ? JSON.stringify(syncReply.reply) : syncReply.reply;
                    result={body:_body};
                    result.statusCode=200;
                }
            }
            if (result.headers){
                let headers = Object.keys(result.headers)
                for (var i in headers){
                    let header = headers[i]
                    let value = result.headers[header]
                    response.setHeader(header, value);
                }
            }
            response.statusCode = result.statusCode
            if (result.body){
                response.write(result.body)
            }
        } else {
            response.statusCode = 401
            response.write(JSON.stringify({ message: 'Unauthorized' }))
        }
        response.end()
    }
    var server = http.createServer(answerFunction)
    server.listen(_port)
    console.log('Server now listening on port ', _port)
}
function createTable(stack, resource) {
    delete resource.Properties.BillingMode;
    delete resource.Properties.PointInTimeRecoverySpecification;
    const { execSync } = require('child_process')
    resource.Properties.TableName = resolve(stack, resource.Properties.TableName)
    fs.writeFileSync(resource.Properties.TableName + '.JSON', JSON.stringify(resource.Properties))
    try {
        console.log(`Deleting ${resource.Properties.TableName}, 10 second timeout`)
        execSync('aws dynamodb delete-table --table-name ' + resource.Properties.TableName + ' --endpoint-url ' + parameterOverrides.DymamoDBEndpoint, { timeout: 10000 })
    } catch (err) {
    }
    try {
        console.log(`Creating ${resource.Properties.TableName}, 10 second timeout`)
        execSync('aws dynamodb create-table --cli-input-json file://' + resource.Properties.TableName + '.JSON --endpoint-url ' + parameterOverrides.DymamoDBEndpoint, { timeout: 10000 })
    } catch (err) {
        console.log(`Unable to contact server within 10 second timeout, do you have an instance of DynamoDB running?`)
    }
    fs.unlinkSync(resource.Properties.TableName + '.JSON')

}
function getLambda(stack, event) {
    for (var i in stack.Resources) {
        let resource = stack.Resources[i]
        if (resource.Type == 'AWS::Serverless::Function' && resource.Properties.CodeUri) {
            for (var j in resource.Properties.Events) {
                let resourceEvent = resource.Properties.Events[j]
                if (resourceEvent.Type == 'Api'
                    && (resourceEvent.Properties.Method == event.httpMethod
                        || resourceEvent.Properties.Method == 'any')
                ) {
                    let incomingPath = event.path.split('/')
                    let lambdaPath = resourceEvent.Properties.Path.split('/')
                    let pathMatch = true
                    if (incomingPath.length == lambdaPath.length) {
                        for (var _index in incomingPath) {
                            if (incomingPath[_index] != lambdaPath[_index] &&
                                (lambdaPath[_index].indexOf('{') != 0 ||
                                    lambdaPath[_index].lastIndexOf('}') != lambdaPath[_index].length - 1)) {
                                pathMatch = false
                                break
                            }
                        }
                    } else {
                        pathMatch = false
                    }
                    if (pathMatch) {
                        return resource
                    }
                }
            }
        }
    }
}
function getHandlerforLambda(stack, lambda) {
    let handler = lambda.Properties.Handler
    if (!handler && stack.Globals && stack.Globals.Function) {
        handler = stack.Globals.Function.Handler
    }
    if (handler && handler.indexOf('.') > -1) {
        handler = handler.substring(handler.indexOf('.') + 1)
    }
    return handler
}
function getLayersforLambda(stack, lambda) {
    let layerArray = []
    if (lambda.Properties.Layers) {
        for (var l in lambda.Properties.Layers) {
            let layerName = lambda.Properties.Layers[l]
            layerArray.push(resolve(stack, layerName))
        }
    }
    if (stack.Globals && stack.Globals.Function && stack.Globals.Function.Layers) {
        for (var l in stack.Globals.Function.Layers) {
            let layerName = stack.Globals.Function.Layers[l]
            layerArray.push(resolve(stack, layerName))
        }
    }
    return layerArray
}
function getEnvironmentVariablesforLambda(stack, lambda) {
    let lambdaVariables;
    let globalVariables;
    if (stack.Globals && stack.Globals.Function && stack.Globals.Function.Environment.Variables) {
        globalVariables = stack.Globals.Function.Environment.Variables
    }
    if (lambda.Properties.Environment && lambda.Properties.Environment.Variables) {
        lambdaVariables = lambda.Properties.Environment.Variables
    }
    var variablesObjects = []
    if (lambdaVariables) {
        for (var v in lambdaVariables) {
            let variablesName = lambdaVariables[v]
            let variable = {}
            variable[v] = resolve(stack, variablesName)
            variablesObjects.push(variable)
        }
    }
    if (globalVariables) {
        for (var v in globalVariables) {
            let variablesName = globalVariables[v]
            let variable = {}
            variable[v] = resolve(stack, variablesName)
            variablesObjects.push(variable)
        }
    }
    return variablesObjects
}

function processToYaml(input) {
    input = input.replace(new RegExp("Fn\:\:(.*?)\:(.*?)", "g"), "_____$1:");
    input = input.replace(new RegExp("\!(.*?) (.*?)", "g"), "_____$1: ");
    var inputLines = input.split('\n')
    var inputString = ''
    for (var i in inputLines) {
        var line = inputLines[i]
        var match = line.match(new RegExp(" *?.*?\: _____(.*?)"))
        if (match) {
            let totalSpaces = line.length - line.trimLeft().length
            let spaces = ''
            for (var i = 0; i < totalSpaces + 2; i++) {
                spaces += ' '
            }
            line = line.replace(':', ':\n' + spaces)
        }
        inputString += line + '\n'
    }
    return inputString
}

function loadTemplate(templateName) {
    let input = fs.readFileSync(process.cwd() + '/' + templateName, 'utf8')
    let stack;
    try {
        input = input.replace(new RegExp("\"Fn\:\:(.*?)\"", "g"), " \"_____$1\"");
        input = input.replace(new RegExp("\"(Ref)\"\:", "g"), " \"_____$1\":");
        stack = JSON.parse(input)
    }
    catch (err) {
        input = processToYaml(input)
        //input = input.replace(new RegExp("Fn\:\:(.*?)\:(.*?)", "g"), " _____$1:");
        //input = input.replace(new RegExp("\!(.*?) (.*?)", "g"), " _____$1: ");
        stack = yaml.load(input)
    }
    for (i in stack.Resources) {
        var resource = stack.Resources[i]
        if (resource.Type == 'AWS::Serverless::Api') {
            if (resource.Properties.DefinitionBody) {
                var paths = resource.Properties.DefinitionBody.Paths
                if (!paths && resource.Properties.DefinitionBody._____Transform &&
                    resource.Properties.DefinitionBody._____Transform.Parameters &&
                    resource.Properties.DefinitionBody._____Transform.Parameters.Location) {
                    swaggerString = fs.readFileSync(process.cwd() + '/' + resource.Properties.DefinitionBody._____Transform.Parameters.Location, 'utf8')
                    try {
                        paths = JSON.parse(swaggerString)
                    }
                    catch (err) {
                        paths = yaml.load(swaggerString)
                    }
                }
                if (paths) {
                    for (_p in paths) {
                        var pathObject = paths[_p]
                        for (path in pathObject) {
                            var methodObject = pathObject[path]
                            for (method in methodObject) {
                                var proxy = methodObject[method]
                                if (proxy['x-amazon-apigateway-integration']) {
                                    if (proxy['x-amazon-apigateway-integration'].type == 'aws_proxy') {
                                        var lambdaName = proxy['x-amazon-apigateway-integration'].uri
                                        lambdaName = JSON.stringify(lambdaName)
                                        lambdaName = lambdaName.substring(lambdaName.indexOf('functions/${') + 12)
                                        lambdaName = lambdaName.substring(0, lambdaName.indexOf('.Arn'))
                                        if (stack.Resources[lambdaName]) {
                                            var lambda = stack.Resources[lambdaName]
                                            if (!lambda.Properties.Events) {
                                                lambda.Properties.Events = {}
                                            }
                                            var event = {}
                                            lambda.Properties.Events[path.replace(new RegExp('\/', 'g'), '_') + method] = event
                                            event.Type = 'Api'
                                            event.Properties = {}
                                            event.Properties.Path = path
                                            event.Properties.Method = method
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return stack
}
function resolve(stack, reference) {
    if (typeof (reference) == 'object') {
        if (reference._____Ref) {
            if (parameterOverrides[reference._____Ref]) {
                return parameterOverrides[reference._____Ref]
            }
            if (stack.Parameters && stack.Parameters[reference._____Ref]) {
                return stack.Parameters[reference._____Ref].Default
            }
            return stack.Resources[reference._____Ref]
        } else if (reference._____Join) {
            if (typeof (reference._____Join) == 'object') {
                let newArray = []
                for (var i in reference._____Join[1]) {
                    let entry = reference._____Join[1][i]
                    if (typeof (entry) == 'object') {
                        let resolved = resolve(stack, entry)
                        newArray.push(resolved)
                    } else {
                        newArray.push(entry)
                    }
                }
                return newArray.join(reference._____Join[0])
            }
        } else if (reference._____FindInMap) {
            if (typeof (reference._____FindInMap) == 'object') {
                let newArray = []
                for (var i in reference._____FindInMap) {
                    let entry = reference._____FindInMap[i]
                    if (typeof (entry) == 'object') {
                        let resolved = resolve(stack, entry)
                        newArray.push(resolved)
                    } else {
                        newArray.push(entry)
                    }
                }
                return stack.Mappings[newArray[0]][newArray[1]][newArray[2]]
            }
        } else if (reference._____Sub) {
            var subValue = reference._____Sub
            var matches = subValue.match(new RegExp("(\\${.*?})", 'g'));
            for (var i in matches) {
                var match = matches[i]
                let variableNameToResolve = match.replace(new RegExp("\\${(.*?)}"), '$1')
                variableNameToResolve = resolve(stack, { _____Ref: variableNameToResolve })
                subValue = subValue.replace(match, variableNameToResolve)
            }
            return subValue
        }
    }
    return reference
}
//startServer()
module.exports = { startServer }