const querystring = require('querystring')
const { loadTemplate } = require('./templateLoader')
const { resolve } = require('./resolveFunction')
var moduleAlias = require('module-alias')

var templateName


function getAnswerFunction(tn) {
    templateName = tn
    return answerFunction
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
            if (typeof (multiQSP) == 'String') {
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
    if (event.httpMethod == 'put' || event.httpMethod == 'post' || event.httpMethod == 'delete') {

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
        if (lambdaFunction[handler].constructor.name === 'AsyncFunction') {
            result = await lambdaFunction[handler](event, context)
        } else {
            let syncReply = await new Promise((resolve, reject) => {
                context.done = (error, reply) => {
                    resolve({ error, reply });
                }
                context.succeed = (reply) => {
                    resolve({ reply });
                }
                context.fail = (error) => {
                    if (!error) {
                        error = {}
                    }
                    resolve({ error });
                }
                lambdaFunction[handler](event, context, function (err, reply) {
                    context.done(err, reply);
                })
            })
            if (syncReply.reply && (syncReply.reply.body || syncReply.reply.statusCode)) {
                result = syncReply.reply;
                if (!result.statusCode) {
                    result.statusCode = 200;
                }
            } else if (syncReply.error) {
                let _body = typeof (syncReply.error) == 'object' ? JSON.stringify(syncReply.error) : syncReply.error;
                result = { body: _body };
                result.statusCode = 400;
            } else {
                let _body = typeof (syncReply.reply) == 'object' ? JSON.stringify(syncReply.reply) : syncReply.reply;
                result = { body: _body };
                result.statusCode = 200;
            }
        }
        if (result.headers) {
            let headers = Object.keys(result.headers)
            for (var i in headers) {
                let header = headers[i]
                let value = result.headers[header]
                response.setHeader(header, value);
            }
        }
        response.statusCode = result.statusCode
        if (result.body) {
            response.write(result.body)
        }
    } else {
        response.statusCode = 401
        response.write(JSON.stringify({ message: 'Unauthorized' }))
    }
    response.end()
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

module.exports = { answerFunction, getAnswerFunction }