const childProcess = require('child_process');
const http = require('http');
const fetch = require('node-fetch');

const startUp = async () => {
    console.log("THIS TEST IS RUNNING");
    return new Promise( ( resolve, reject ) => {
        var startServer=childProcess.exec("cd.. && cd teststack && node ../index.js")
        startServer.stdout.on('data', (data) => {
            console.log(`stdout: ${data} pid ${startServer.pid}`);
          });
          
          startServer.stderr.on('data', (data) => {
            console.error(`stderr: ${data} pid ${startServer.pid}`);
          });
          
          startServer.on('close', (code) => {
            console.log(`child process exited with code ${code} pid ${startServer.pid}`);
          });
          setTimeout(function(){
              resolve();
          },3000);
    })
}
const tearDown = () => {
    console.log("Teardown")
    childProcess.exec("netstat -ano -p tcp | find \"8080\"", function(err, stdout, stderror) {
        //console.log(err, stdout, stderror);
        if (stdout && stdout.indexOf("LISTENING")>-1) {
            pid=stdout.substr(stdout.indexOf("LISTENING")+9).trim();
            console.log("Killing PID", pid);
            childProcess.exec("taskkill /F /PID "+pid);
        }

    });
}
const simpleGet = async () => {
    console.log("running simple get")
    const response=await fetch('http://localhost:8080/hello');
    const text=await response.json().then(json=>json);
    
    console.log(text);
    return;
}
async function runTests() {
    await startUp();
    await simpleGet();
    tearDown();
}
runTests();