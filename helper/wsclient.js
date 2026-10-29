// A small WebSocket client (RFC 6455) for the service, which must run on Node 8 where Node has none: one connection to a ws:// or
// wss:// address, text messages only, answers the server's pings, ends on its own when the server goes quiet past idleMs. Used by
// disney.js while a TV code waits (Disney tells the TV over its socket that the code was entered).
//   open(url, {protocol, origin, timeoutMs, idleMs})  -> an EventEmitter: 'open', 'message' (text), 'close' (code, reason), 'error';
//                                                      .send(text), .close()
const net = require('net'),
  tls = require('tls'),
  crypto = require('crypto'),
  EventEmitter = require('events');
const { URL } = require('./netcompat');

const MAX = 4 * 1024 * 1024; // one message at most

// one frame from the client: always masked (RFC 6455 5.3)
function frame(opcode, payload) {
  const len = payload.length,
    mask = crypto.randomBytes(4);
  let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, 0x80 | len]);
  else if (len < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode;
    head[1] = 0x80 | 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode;
    head[1] = 0x80 | 127;
    head.writeUInt32BE(0, 2);
    head.writeUInt32BE(len, 6);
  }
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([head, mask, out]);
}

function open(address, o) {
  o = o || {};
  const ws = /** @type {any} */ (new EventEmitter());
  const u = new URL(address),
    secure = u.protocol === 'wss:',
    port = Number(u.port) || (secure ? 443 : 80),
    key = crypto.randomBytes(16).toString('base64');
  let sock = /** @type {any} */ (null),
    buf = Buffer.alloc(0),
    upgraded = false,
    ended = false,
    parts = /** @type {Buffer[]} */ ([]),
    idle = /** @type {any} */ (null);
  function end(code, reason, err) {
    if (ended) return;
    ended = true;
    clearTimeout(idle);
    if (sock) sock.destroy();
    if (err) ws.emit('error', err);
    ws.emit('close', code, reason || '');
  }
  const quiet = () => {
    clearTimeout(idle);
    idle = setTimeout(() => end(1006, 'no answer', new Error('timed out')), upgraded ? o.idleMs || 120000 : o.timeoutMs || 15000);
  };
  ws.send = text => {
    if (upgraded && !ended) sock.write(frame(1, Buffer.from(String(text), 'utf8')));
  };
  ws.close = () => {
    if (upgraded && !ended) sock.write(frame(8, Buffer.from([0x03, 0xe8])));
    end(1000, '');
  };
  function frames() {
    while (buf.length >= 2) {
      const b0 = buf[0],
        b1 = buf[1];
      let len = b1 & 0x7f,
        off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = buf.readUInt32BE(2) * 4294967296 + buf.readUInt32BE(6);
        off = 10;
      }
      if (len > MAX) return end(1009, 'too big', new Error('message too big'));
      const masked = !!(b1 & 0x80);
      if (buf.length < off + (masked ? 4 : 0) + len) return;
      let p = buf.slice(off + (masked ? 4 : 0), off + (masked ? 4 : 0) + len);
      if (masked) {
        const m = buf.slice(off, off + 4),
          q = Buffer.alloc(len);
        for (let i = 0; i < len; i++) q[i] = p[i] ^ m[i % 4];
        p = q;
      }
      buf = buf.slice(off + (masked ? 4 : 0) + len);
      const op = b0 & 0x0f,
        fin = !!(b0 & 0x80);
      if (op === 9) sock.write(frame(10, p));
      else if (op === 8) {
        sock.write(frame(8, p.slice(0, 2)));
        return end(p.length >= 2 ? p.readUInt16BE(0) : 1005, p.slice(2).toString('utf8'));
      } else if (op === 1 || op === 0) {
        parts.push(p);
        if (parts.reduce((n, x) => n + x.length, 0) > MAX) return end(1009, 'too big', new Error('message too big'));
        if (fin) {
          const text = Buffer.concat(parts).toString('utf8');
          parts = [];
          ws.emit('message', text);
        }
      }
    }
  }
  const go = () => {
    sock.write(
      'GET ' +
        (u.pathname + u.search || '/') +
        ' HTTP/1.1\r\nHost: ' +
        u.host +
        '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' +
        key +
        '\r\nSec-WebSocket-Version: 13\r\n' +
        (o.protocol ? 'Sec-WebSocket-Protocol: ' + o.protocol + '\r\n' : '') +
        (o.origin ? 'Origin: ' + o.origin + '\r\n' : '') +
        '\r\n'
    );
  };
  quiet();
  sock = secure ? tls.connect({ host: u.hostname, port, servername: u.hostname }, go) : net.connect({ host: u.hostname, port }, go);
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    quiet();
    if (!upgraded) {
      const i = buf.indexOf('\r\n\r\n');
      if (i < 0) return buf.length > 16384 ? end(1002, 'bad answer', new Error('bad answer')) : undefined;
      const head = buf.slice(0, i).toString('latin1'),
        accept = crypto
          .createHash('sha1')
          .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64');
      const got = (/\r\nsec-websocket-accept:[ \t]*([^\r\n]*)/i.exec(head) || [])[1];
      if (!/^HTTP\/1\.1 101 /.test(head) || String(got).trim() !== accept)
        return end(1002, 'refused', new Error('the server refused: ' + head.split('\r\n')[0]));
      buf = buf.slice(i + 4);
      upgraded = true;
      ws.emit('open');
    }
    frames();
  });
  sock.on('error', e => end(1006, '', e));
  sock.on('close', () => end(1006, ''));
  return ws;
}

module.exports = { open };
