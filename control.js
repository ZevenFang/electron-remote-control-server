const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8010 });
const code2ws = new Map()

const listCodes = () => {
    const arr = Array.from(code2ws.keys())
    const res = arr.map(v => (
        {code: v, time: code2ws.get(v).time}
    ))
    console.log(res)
    return res;
}

const broadcastCodes = (event, data) => {
    const codes = listCodes();
    codes.map(v => {
        code2ws.get(v.code).ws.sendData('broadcast-codes', codes);
    })
}

wss.on('connection', function connection(ws, request) {

    ws.sendData = (event, data) => {
        ws.send(JSON.stringify({event, data}));
    };
    ws.sendError = msg => {
        ws.sendData('error', {msg})
    };

    let code =  Math.floor(Math.random()*(999999-100000)) + 100000;
    const match = request.url.match(/code=(\d+)/);
    if (request.url.match(/code=(\d+)/)) {
        code = match[1];
    }
    // let ip = request.connection.remoteAddress.replace('::ffff:', '');
    // console.log('ip is connected', ip)
    // console.log('ws',ws.sendData)
    code2ws.set(code, {
        ws, time: new Date(),
    })
    ws.on('message', function incoming(message) {
        // console.log('imcoming message',message.toString())
        let parsedMessage = {}
        try {
            parsedMessage = JSON.parse(message);
        } catch (e) {
            // console.log('parse error', e)
            ws.sendError('message not valid')
            return
        }
        let {event, data} = parsedMessage

        if (event === 'login') {
            ws.sendData( 'logined', {code})
	        broadcastCodes()
        } else if(event === 'control'){
            let remote = +data.remote
            if (code2ws.has(remote)) {
                ws.sendData('controlled', {remote})
                let remoteWS = code2ws.get(remote).ws
                // 把彼此的 sendData 方法赋值给对方的 sendRemote
                ws.sendRemote = remoteWS.sendData
                remoteWS.sendRemote = ws.sendData
                ws.sendRemote('be-controlled', {remote: code})
            } else {
                ws.sendError('user not found')
           }
        } else if (event === 'forward'){
            ws.sendRemote(data.event, data.data)
        } else if (event === 'listCodes') {
            ws.sendRemote('listCodes', listCodes())
        } else if (event === 'ping') {
            ws.sendData('pong', parsedMessage)
        } else {
            ws.sendError('message not handle', message)
        }
    });

    ws.on('close', () => {
        code2ws.delete(code)
        delete ws.sendRemote
        clearTimeout(ws._closeTimeout);
	    broadcastCodes()
    })

    ws._closeTimeout = setTimeout(() => {
        ws.terminate();
    }, 600000);
});
