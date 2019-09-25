const fs = require('fs')
const yaml = require('js-yaml')
const querystring = require('querystring')
var http = require('http')
var moduleAlias = require('module-alias')

function startServer() {
    var templateName = 'template.yaml'
    var _port = 8080
    for (var i in process.argv) {
        if (process.argv[i] == '--port') {
            _port = process.argv[i * 1 + 1]
        } else if (process.argv[i] == '--template') {
            templateName = process.argv[i * 1 + 1]
        }
    }
    var answerFunction = async function (request, response) {
        var _path = request.url
        var _queryString = request.url
        if (_path.indexOf('?') > -1) {
            _path = _path.substring(0, _path.indexOf('?'))
            _queryString = _queryString.substring(_queryString.indexOf('?') + 1)
        }
        var event = {
            path: _path,
            httpMethod: request.method.toLowerCase(),
            queryStringParameters: querystring.parse(_queryString),
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
            if (contentType.toLowerCase().indexOf('multipart/form-data') == 0) {
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
                    moduleAlias.addPath(process.cwd() + '/' + layer.Properties.ContentUri + 'nodejs')
                }
            }
            let lambdaFunction = require(process.cwd() + '/' + lambda.Properties.CodeUri)
            let handler = getHandlerforLambda(stack, lambda)
            let result = await lambdaFunction[handler](event)
            response.statusCode = result.statusCode
            response.write(result.body)
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

function getLambda(stack, event) {
    for (var i in stack.Resources) {
        let resource = stack.Resources[i]
        if (resource.Type == 'AWS::Serverless::Function' && resource.Properties.CodeUri) {
            for (var j in resource.Properties.Events) {
                let resourceEvent = resource.Properties.Events[j]
                if (resourceEvent.Type == 'Api'
                    && (resourceEvent.Properties.Method == event.httpMethod
                        || resourceEvent.Properties.Method == 'any')
                    && resourceEvent.Properties.Path == event.path) {
                    return resource
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
    let layers = lambda.Properties.Layers
    if (!layers && stack.Globals && stack.Globals.Function) {
        layers = stack.Globals.Function.Layers
    }
    if (layers) {
        var layerObjects = []
        for (var l in layers) {
            let layerName = layers[l]
            layerObjects.push(resolve(stack, layerName))
        }
        return layerObjects
    }
}
function loadTemplate(templateName) {
    let input = fs.readFileSync(process.cwd() + '/' + templateName, 'utf8')
    input = input.replace(new RegExp("Fn\:\:Transform\:", "g"), "_____Transform\:");
    input = input.replace(new RegExp("\!Transform", "g"), "_____Transform\:");
    input = input.replace(new RegExp("\: \!(.*?)", "g"), ": _____");
    input = input.replace(new RegExp("\: Fn\:\:(.*?)\:(.*?)", "g"), ": _____$1");
    input = input.replace(new RegExp("\- \!(.*?)", "g"), "- _____");
    input = input.replace(new RegExp("\- Fn\:\:(.*?)\:(.*?)", "g"), "- _____$1");
    input = input.replace(new RegExp("Fn\:\:(.*?)\:", "g"), "- _____$1");
    let stack = yaml.load(input)
    for (i in stack.Resources) {
        var resource = stack.Resources[i]
        if (resource.Type == 'AWS::Serverless::Api') {
            if (resource.Properties.DefinitionBody) {
                var paths = resource.Properties.DefinitionBody.Paths
                if (!paths && resource.Properties.DefinitionBody._____Transform &&
                    resource.Properties.DefinitionBody._____Transform.Parameters &&
                    resource.Properties.DefinitionBody._____Transform.Parameters.Location) {
                    swaggerString = fs.readFileSync(process.cwd() + '/' + resource.Properties.DefinitionBody._____Transform.Parameters.Location, 'utf8')
                    paths = yaml.load(swaggerString)
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
    if (reference.indexOf('_____Ref ') > -1) {
        reference = reference.substring(reference.indexOf('_____Ref ') + 9)
    }
    console.log('reference', reference)
    return stack.Resources[reference]
}
startServer()