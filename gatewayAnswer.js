const querystring = require('querystring');
var moduleAlias = require('module-alias')
//comment
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
    //To self - youtube.com/results?search_query=sasha+shulgin
    if (_path.indexOf('?') > -1) {
        _path = _path.substring(0, _path.indexOf('?'))
        //"youtube.com/results"+"?search_query=sasha+shulgin"
        _queryString = _queryString.substring(_queryString.indexOf('?') + 1)
        //?search_query=sasha+shulgin => search_query=sasha+shulgin
        //AFAIK, technically this would return search_query=["sasha+shulgin"]
        //(There might be a rule making this a multiqsp with the +, in which case it'd return search_query=["sasha", "shulgin"])
        //"youtube.com/results"+"?search_query=sasha&search_query=shulgin"
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
            //Review - So is the reason we're Base64 encoding because it's going to be a file?
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
       stack.prepareLambdaForExecution(lambda);
       let result=await stack.executeLambda(lambda, event);
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