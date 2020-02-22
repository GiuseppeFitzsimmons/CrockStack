const fs = require('fs')
const yaml = require('js-yaml')

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

module.exports = {loadTemplate}