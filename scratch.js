const WebSocket = require('ws');
 
const ws = new WebSocket('ws://localhost:9090');
 
ws.on('open', function open() {
  let message = {body: {action: 'message'}}
  ws.send(JSON.stringify(message));
});
 
ws.on('message', function incoming(data) {
  console.log(data);
});

setTimeout(()=>{ws.close()}, 2000)