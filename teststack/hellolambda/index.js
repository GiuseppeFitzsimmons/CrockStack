const {helper} = require ('helper')

exports.requestHandler = async (event, context) => {
    let returnObject = {}
    returnObject.statusCode = 200
    returnObject.body = JSON.stringify({body:'returnobject body'})
    console.log('called helper'+helper())
    return returnObject
}