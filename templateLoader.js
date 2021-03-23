const fs = require('fs');
const yaml = require('js-yaml');
var moduleAlias = require('module-alias');

function loadTemplate(templateName, parameterOverrides) {
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
        //Review - After getting to the end of this loop, I do not understand why we do it.
        var resource = stack.Resources[i]
        if (resource.Type == 'AWS::Serverless::Api') {
            //To self - We're going through the gateway resource type to find where openapi.yaml is (if Paths isn't already present)
            if (resource.Properties.DefinitionBody) {
                var paths = resource.Properties.DefinitionBody.Paths
                //Review - Why does _____Transform work? I thought the RegExp would replace Fn::Transform with _____Fn::Transform
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
                                        //At this point we end up with WwddLambda
                                        if (stack.Resources[lambdaName]) {
                                            var lambda = stack.Resources[lambdaName]
                                            if (!lambda.Properties.Events) {
                                                lambda.Properties.Events = {}
                                            }
                                            var event = {}
                                            //Review - I don't know if this RegExp does anything
                                            lambda.Properties.Events[path.replace(new RegExp('\/', 'g'), '_') + method] = event
                                            //Empty out the events of the lambda, populate with the path & methods found in openapi.yaml.
                                            //In this case, the lambda already had the right values.
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
    stack.getLambda = getLambda;
    stack.getHandlerforLambda = getHandlerforLambda;
    stack.getLayersforLambda = getLayersforLambda;
    stack.getEnvironmentVariablesforLambda = getEnvironmentVariablesforLambda;
    stack.resolveParameter = resolveParameter;
    stack.prepareLambdaForExecution = prepareLambdaForExecution;
    stack.executeLambda = executeLambda;
    stack.parameterOverrides = parameterOverrides;
    return stack
}

function getLambda(event) {
    for (var i in this.Resources) {
        let resource = this.Resources[i]
        if (resource.Type == 'AWS::Serverless::Function' && resource.Properties.CodeUri) {
            for (var j in resource.Properties.Events) {
                let resourceEvent = resource.Properties.Events[j]
                if (resourceEvent.Type == 'Api'
                //To self - We're checking the method because you could have multiple lambdas responding to the same path, but not the same method
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
function prepareLambdaForExecution(lambda) {

    let layers = this.getLayersforLambda(lambda);
    if (layers) {
        for (var l in layers) {
            let layer = layers[l];
            //c - What is the format of what's returned by getLayersforLambda? I didn't think layers[l] would be a string.
            if (typeof layer==='string') {
                layer=this.Resources[layer];
            }
            let contentUri = layer.Properties.ContentUri
            if (contentUri.charAt(0) == '/') {
                contentUri = contentUri.substring(1)
            }
            if (contentUri.lastIndexOf('/') == contentUri.length) {
                contentUri = contentUri.substring(0, contentUri.length - 1)
            }
            moduleAlias.addPath(process.cwd() + '/' + contentUri + '/nodejs')
            //So in this case, you've got sharedlayer defined as the only layer in Globals
            //It's got the contenturi sharedlayer/, it gets truncated then moduleAlias.addPath points towards the sharedlayer/nodejs you can see in the workspace
            moduleAlias.addPath(process.cwd() + '/' + contentUri + '/nodejs/node_modules')
        }
    }
    let variables = this.getEnvironmentVariablesforLambda(lambda)
    if (variables) {
        for (var v in variables) {
            let variable = variables[v]
            for (var w in variable) {
                process.env[w] = variable[w]
            }
        }
    }
    /*
    Most AWS functions can or may as well be called from the real aws-sdk - a call to DynamoDB or S3, for example,
    but in the context of CrockStack there are some that won't work - such as invoking another lambda or leveraging
    websockets. So the following replaces the AWS sdk with a mocked version, which delegates everything to the real
    AWS SDK except that which we can execute within CrockStack.
    */
    moduleAlias.addPath(`${__dirname}/crock_node_modules`);
    moduleAlias.addAlias("real-aws-sdk", "aws-sdk");
    moduleAlias.addAlias("aws-sdk", "crock-aws-sdk");
    //Our fake AWS SDK is going to need to call back into the stack, for instance to send a message
    //to a websocket and the only way I can think to do that is to expose it globally.
    global.stack=this;
}
async function executeLambda(lambda, event) {

    let codeUri = lambda.Properties.CodeUri
    if (codeUri.charAt(0) == '/') {
        codeUri = codeUri.substring(1)
    }
    if (codeUri.lastIndexOf('/') == codeUri.length) {
        codeUri = codeUri.substring(0, codeUri.length - 1)
    }
    let result;
    let lambdaFunction;
    try {
        lambdaFunction = require(process.cwd() + '/' + codeUri);
    } catch (err) {
        return {statusCode:500};
    }
    let handler = stack.getHandlerforLambda(lambda)
    var context = {}
    if (lambdaFunction[handler].constructor.name === 'AsyncFunction') {
        try {
            result = await lambdaFunction[handler](event, context)
        } catch(err) {
            return {statusCode:500};
        }
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
            try {
                lambdaFunction[handler](event, context, function (err, reply) {
                    context.done(err, reply);
                })
            } catch (err) {
                context.fail({statusCode:500});
            }
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
    return result;
} 
function getHandlerforLambda(lambda) {
    let handler = lambda.Properties.Handler
    if (!handler && this.Globals && this.Globals.Function) {
        handler = this.Globals.Function.Handler
    }
    if (handler && handler.indexOf('.') > -1) {
        handler = handler.substring(handler.indexOf('.') + 1)
    }
    return handler;
}
function getLayersforLambda(lambda) {
    let layerArray = []
    if (lambda.Properties.Layers) {
        for (var l in lambda.Properties.Layers) {
            //To self - Doesn't run in our case, the only Layers are Globals for us
            //Review - Linked to line 127
            let layerName = lambda.Properties.Layers[l]
            layerArray.push(this.resolveParameter(layerName))
        }
    }
    if (this.Globals && this.Globals.Function && this.Globals.Function.Layers) {
        for (var l in this.Globals.Function.Layers) {
            let layerName = this.Globals.Function.Layers[l]
            layerArray.push(this.resolveParameter(layerName))
        }
    }
    return layerArray
}
function getEnvironmentVariablesforLambda(lambda) {
    let lambdaVariables;
    let globalVariables;
    if (this.Globals && this.Globals.Function && this.Globals.Function.Environment.Variables) {
        //To self - Again in our case we only have Global envvars
        globalVariables = this.Globals.Function.Environment.Variables
    }
    if (lambda.Properties.Environment && lambda.Properties.Environment.Variables) {
        lambdaVariables = lambda.Properties.Environment.Variables
    }
    var variablesObjects = []
    if (lambdaVariables) {
        for (var v in lambdaVariables) {
            let variablesName = lambdaVariables[v]
            let variable = {}
            variable[v] = this.resolveParameter(variablesName)
            variablesObjects.push(variable)
        }
    }
    if (globalVariables) {
        for (var v in globalVariables) {
            //Review - I'd like to go over the format of globalVariables, I thought globalVariables[0] would be {MAP_TEST: 'X'} (where X is the parsed string for the !findInMap)
            let variablesName = globalVariables[v]
            let variable = {}
            variable[v] = this.resolveParameter(variablesName)
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
function resolveParameter(reference) {
    //Review - I don't understand why parameterOverrides[reference._____Ref] would exist
    if (typeof (reference) == 'object') {
        if (reference._____Ref) {
            if (this.parameterOverrides[reference._____Ref]) {
                return this.parameterOverrides[reference._____Ref]
            }
            if (this.Parameters && this.Parameters[reference._____Ref]) {
                return this.Parameters[reference._____Ref].Default
            }
            if (reference._____Ref.indexOf('.Arn')>-1){
                return reference._____Ref.replace('.Arn', '')
            }
            let _reference=this.Resources[reference._____Ref];
            if (typeof _reference==='object') {
                //Really, this should be an Arn or an ID or whatever's appropriate to Ref Resource type
                return reference._____Ref
            }
            return this.Resources[reference._____Ref];;
        } else if (reference._____Join) {
            if (typeof (reference._____Join) == 'object') {
                let newArray = []
                for (var i in reference._____Join[1]) {
                    let entry = reference._____Join[1][i]
                    if (typeof (entry) == 'object') {
                        let resolved = this.resolveParameter(entry)
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
                        let resolved = this.resolveParameter(entry)
                        newArray.push(resolved)
                    } else {
                        newArray.push(entry)
                    }
                }
                return this.Mappings[newArray[0]][newArray[1]][newArray[2]]
            }
        } else if (reference._____Sub) {
            var subValue = reference._____Sub
            var matches = subValue.match(new RegExp("(\\${.*?})", 'g'));
            for (var i in matches) {
                var match = matches[i]
                let variableNameToResolve = match.replace(new RegExp("\\${(.*?)}"), '$1')
                variableNameToResolve = this.resolveParameter({ _____Ref: variableNameToResolve })
                subValue = subValue.replace(match, variableNameToResolve)
            }
            return subValue
        }
    }
    return reference
}

module.exports = { loadTemplate }