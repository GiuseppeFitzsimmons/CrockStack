# CrockStack Readme #
CrockStack is for developers for whom the AWS-SAM start-api with a full-blown Docker image is impractical or impossible.
It replaces start-api by reading your template.yaml or template.json (and any associated openapi.yaml or openapi.json), and exposing your Lambdas on a local http server.

## Limitations ##
CrockStack has some limitations:

* It only supports Node (AWS supports Node, Java, Python and Go).
* It only implements four resource types: Lambda, Gateway, Layer and DynamoDB (I’ll be adding CustomAuthorizers next, and I'm open to suggestions)
    * For DynamoDB support, you need a local instance running, and need to pass a parameter called "DynamoDbEndpoint" using "--env-vars" or "--parameter-overrides".
* It supports the !Ref, !Join, !Transform, !Sub and !FindInMap functions.

CrockStack is a work in progress and it's not by any means intended as a full replacement for SAM start-api, so please manage your expectations accordingly.

As of version 1.1.1, CrockStack supports synchronous functions, including context (including the deprecated functions done, succeed and fail) and callbacks.

## Usage ##

    npm install crockstack


or globally

    npm install -g crockstack

Start from the location of your template.yaml, if you installed globally...

    crockstack

Or if you installed locally

    node node_modules/crockstack/cli.js

Crockstack supports most AWS start-local parameters, such as

    crockstack --port 3000 --env-vars yourfile.json --parameter-overrides "BuildVersion=v4,Greeting=hello" --template productiontemplate.yaml

The default port is 8080.
The default template is template.yaml.
After launching, you should be able to access your API at localhost:8080.


## Version ##
The current version is 1.1.5