const querystring = require('querystring');
var moduleAlias = require('module-alias')

var stack


function getAnswerFunction(s) {
    stack=s;
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
    let lambda = stack.getLambda(event);
    if (lambda) {
        let layers = stack.getLayersforLambda(lambda)
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
        let variables = stack.getEnvironmentVariablesforLambda(lambda)
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
        let handler = stack.getHandlerforLambda(lambda)
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


module.exports = { answerFunction, getAnswerFunction }