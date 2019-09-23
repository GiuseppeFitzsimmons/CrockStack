const fs = require('fs')
const yaml = require('js-yaml')
const querystring = require('querystring')
var http = require('http')

async function makeEvent(req) {
    event = {}
    event.resource = req.url
    event.path = req.url
    event.headers = req.headers
    event.httpMethod = req.method
    event.queryStringParameters = querystring.parse(req.url)
    if (event.path.indexOf('?') > -1) {
        event.path = event.path.substring(0, event.path.indexOf('?'))
    }
    return event
}

function startServer(configuration) {
    var stack = configuration.stack
    if (!configuration.port) {
        configuration.port = 8080
    }
    http.createServer(function (req, res) {
        console.log(req.method, req.url)
        var lambda = stack.getLambda(req);
        if (lambda) {
            makeEvent(req).then(event => {
                var reply = lambda.function.handler(event)
                console.log(reply)
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.write(JSON.stringify(reply));
                res.end();
            })
        } else {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.write(JSON.stringify({ message: 'Unauthorized' }));
            res.end();
        }
    }).listen(configuration.port);
};
function readTemplate() {
    let input = fs.readFileSync('./template.yaml', 'utf8')
    let stack = yaml.load(input)
    for (var i in stack.Resources) {
        let resource = stack.Resources[i]
        if (resource.Type == 'AWS::Serverless::Function' && resource.Properties.CodeUri) {
            resource.function = require('./' + resource.Properties.CodeUri)
            resource.matchRequest = function (request) {
                var requestMethod = request.method.toLowerCase()
                var requestPath = request.url
                if (requestPath.indexOf('?') > -1) {
                    requestPath = requestPath.substring(0, requestPath.indexOf('?'))
                }
                for (var j in this.Properties.Events) {
                    let event = this.Properties.Events[j]
                    if (event.Type == 'Api') {
                        var eventMethod = event.Properties.Method.toLowerCase()
                        if (eventMethod == requestMethod || eventMethod == 'any') {
                            var eventPath = event.Properties.Path.toLowerCase()
                            if (eventPath == requestPath) {
                                return true
                            }
                        }
                    }
                }
                return false
            }
        }
    }
    stack.getLambda = function (request) {
        for (var i in stack.Resources) {
            let resource = stack.Resources[i]
            if (resource.Type == 'AWS::Serverless::Function' && resource.matchRequest(request)) {
                return resource;
            }
        }
    }
    return stack
};

function start() {
    var stack = readTemplate()
    var configuration = { port: 3000, stack: stack }
    startServer(configuration)
}

exports = { start }

//var stack = readTemplate();
//var lambda = stack.getLambda({ method: 'get', url: '/askdonald' })
start()
//console.log(lambda)