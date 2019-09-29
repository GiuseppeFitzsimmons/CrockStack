const childProcess = require('child_process')
const fetch = require('node-fetch')

async function setUp() {
    return new Promise((resolve, reject) => {
        var executed = childProcess.exec('node ../cli.js --env-vars devvariables.json')
        executed.stdout.on('data', (data) => {
            console.log(data)
        })
        executed.stderr.on('data', (data) => {
            console.log(data)
        })
        setTimeout(function () {
            resolve()
        }, 2000)
    })
}
async function tearDown() {
    childProcess.exec("netstat -ano -p tcp | find \"8080\"", function (err, stdout, stderror) {
        //console.log(err, stdout, stderror);
        if (stdout && stdout.indexOf("LISTENING") > -1) {
            pid = stdout.substr(stdout.indexOf("LISTENING") + 9).trim();
            console.log("Killing PID", pid);
            childProcess.exec("taskkill /F /PID " + pid);
        }

    });
}
async function testEnvVars() {
    const response = await fetch('http://localhost:8080/hello')
    const json = await response.json()
    if (json.version != 'V4'){
        throw new Error()
    } else {
        console.log('testEnvVars passed')
    }
    return
}
async function runTests() {
    await setUp()
    await testEnvVars()
    tearDown()
}

runTests()