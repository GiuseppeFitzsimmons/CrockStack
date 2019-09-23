const fs = require('fs')
const yaml = require('js-yaml')
const querystring = require('querystring')
var http = require('http')

function startServer() {
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
        console.log('event', event)
        let input = fs.readFileSync('./template.yaml', 'utf8')
        let stack = yaml.load(input)
        let lambda = getLambda(stack, event)
        if (lambda) {
            let lambdaFunction = require('./' + lambda.Properties.CodeUri)
            let handler = lambda.Properties.Handler
            if (handler.indexOf('.') > -1) {
                handler = handler.substring(handler.indexOf('.') + 1)
            }
            let result = await lambdaFunction[handler](event)
            response.statusCode = result.statusCode
            response.write(result.body)
            console.log('result', result)
        } else {
            response.statusCode = 401
            response.write(JSON.stringify({ message: 'Unauthorized' }))
        }
        response.end()
    }
    var server = http.createServer(answerFunction)
    server.listen(8080)
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
startServer()