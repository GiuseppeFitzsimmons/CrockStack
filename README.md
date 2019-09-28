# CrockStack Readme #
CrockStack is for developers for whom the AWS-SAM start-local with a full-blown Docker image is impractical, or impossible.
It replaces start-local by reading your template.yaml (and any associated openapi.yaml), and exposing your functions on a local http server.

## Limitations ##
CrockStack has many limitations:
* It only supports node (AWS supports Node, Java, Python and Go).
* It only supports yaml (we’ll be adding support for JSON shortly)
* It only implements three resource types: Lambda, Gateway and Layers (we’ll be adding DynamoDb and CustomAuthorizers next, and are open to suggestions)
* It only supports the !Ref function (more are pending shortly)

## Usage ##

Start from the location of your template.yaml
```javascript
node CrockStack/index.js
```
Crockstack supports may start-local parameters, such as
```javascript
node CrockStack/index.js --port 3000 --env-vars yourfile.json --parameter-overrides "BuildVersion=v4,Greeting=hello" --template productiontemplate.yaml
```
The default port is 8080, the default template is template.yaml.
After launching, you should be able to access your API at localhost:8080.
## Installation ##

```javascript
npm install crock-stack
```