# CrockStack Readme #
CrockStack is for developers for whom the AWS-SAM start-local with a full-blown Docker image is impractical or impossible.
It replaces start-local by reading your template.yaml (and any associated openapi.yaml), and exposing your Lambdas on a local http server.

## Limitations ##
CrockStack has many limitations:

* It only supports Node (AWS supports Node, Java, Python and Go).
* It only supports yaml (I’ll be adding support for JSON shortly) and the syntax is very strict. In particular, if you ever see something like "incomplete explicit mapping pair", it probably means that you need to put your function, for instance !Ref, on the next line and indented.

This won't work

    RegionName: !Ref "AWS::Region"


But this will

    RegionName:
      !Ref
        "AWS::Region"


* It only implements three resource types: Lambda, Gateway and Layers (I’ll be adding DynamoDb and CustomAuthorizers next, and I'm open to suggestions)
* It only supports the !Ref function (more are pending shortly)

CrockStack is a work in progress and it's not by any means intended as a full replacement for SAM start-local, so please manage your expectations accordingly.

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
The current version is 1.0.5