const parameterOverrides = { 'AWS::StackName': 'CrockStack', 'AWS::Region': 'local' }

function resolve(stack, reference) {
    if (typeof (reference) == 'object') {
        if (reference._____Ref) {
            if (parameterOverrides[reference._____Ref]) {
                return parameterOverrides[reference._____Ref]
            }
            if (stack.Parameters && stack.Parameters[reference._____Ref]) {
                return stack.Parameters[reference._____Ref].Default
            }
            return stack.Resources[reference._____Ref]
        } else if (reference._____Join) {
            if (typeof (reference._____Join) == 'object') {
                let newArray = []
                for (var i in reference._____Join[1]) {
                    let entry = reference._____Join[1][i]
                    if (typeof (entry) == 'object') {
                        let resolved = resolve(stack, entry)
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
                        let resolved = resolve(stack, entry)
                        newArray.push(resolved)
                    } else {
                        newArray.push(entry)
                    }
                }
                return stack.Mappings[newArray[0]][newArray[1]][newArray[2]]
            }
        } else if (reference._____Sub) {
            var subValue = reference._____Sub
            var matches = subValue.match(new RegExp("(\\${.*?})", 'g'));
            for (var i in matches) {
                var match = matches[i]
                let variableNameToResolve = match.replace(new RegExp("\\${(.*?)}"), '$1')
                variableNameToResolve = resolve(stack, { _____Ref: variableNameToResolve })
                subValue = subValue.replace(match, variableNameToResolve)
            }
            return subValue
        }
    }
    return reference
}

module.exports = {resolve}