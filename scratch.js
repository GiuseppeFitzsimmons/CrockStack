const WebSocket = require('ws');
 
const ws = new WebSocket('ws://localhost:9090');
 
ws.on('open', function open() {
  let message = {body: {message: 'ConnectRoute'}}
  ws.send(JSON.stringify(message));
});
 
ws.on('message', function incoming(data) {
  console.log(data);
});