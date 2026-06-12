/**
 * Direct client for the BlenderMCP addon socket (default port 9876).
 *
 * The addon (tools/blender/addon.py) speaks plain JSON over TCP:
 *   request  {"type": "<command>", "params": {...}}
 *   response {"status": "success", "result": {...}} | {"status": "error", ...}
 *
 * Long operations (bakes) block Blender's main thread - the client
 * simply waits (default timeout 10 min, override BL_TIMEOUT_MS).
 *
 * Payload MUST be pure ASCII: the addon decodes its buffer chunkwise
 * as UTF-8, and a chunk boundary inside a multibyte char raises an
 * uncaught UnicodeDecodeError that kills the connection (ECONNRESET).
 * Non-ASCII is therefore JSON-escaped to \uXXXX before sending.
 *
 * Usage:
 *   node scripts/blender/bl.mjs info                      scene summary
 *   node scripts/blender/bl.mjs exec <script.py>          run python in Blender
 *   node scripts/blender/bl.mjs shot <out.png> [maxSize]  viewport screenshot
 *   node scripts/blender/bl.mjs cmd <type> ['<json>']     raw command
 */
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.BL_PORT ?? 9876);
const TIMEOUT = Number(process.env.BL_TIMEOUT_MS ?? 600_000);

function send(type, params = {}) {
  return new Promise((resolveP, rejectP) => {
    const sock = net.createConnection({ host: '127.0.0.1', port: PORT });
    let buf = '';
    const timer = setTimeout(() => {
      sock.destroy();
      rejectP(new Error(`timeout after ${TIMEOUT} ms waiting for ${type}`));
    }, TIMEOUT);

    sock.on('connect', () => {
      const ascii = JSON.stringify({ type, params }).replace(
        /[^\x00-\x7f]/g,
        (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
      );
      sock.write(ascii);
    });
    sock.on('data', (d) => {
      buf += d.toString('utf8');
      try {
        const parsed = JSON.parse(buf);
        clearTimeout(timer);
        sock.end();
        resolveP(parsed);
      } catch {
        /* incomplete json - keep reading */
      }
    });
    sock.on('error', (e) => {
      clearTimeout(timer);
      rejectP(e);
    });
  });
}

const [mode, ...rest] = process.argv.slice(2);

let res;
switch (mode) {
  case 'info':
    res = await send('get_scene_info');
    break;
  case 'exec': {
    const code = readFileSync(resolve(rest[0]), 'utf8');
    res = await send('execute_code', { code });
    break;
  }
  case 'shot': {
    const filepath = resolve(rest[0] ?? 'verify-out/blender-viewport.png');
    res = await send('get_viewport_screenshot', {
      filepath,
      max_size: Number(rest[1] ?? 1200),
      format: 'png',
    });
    break;
  }
  case 'cmd':
    res = await send(rest[0], rest[1] ? JSON.parse(rest[1]) : {});
    break;
  default:
    console.error('usage: bl.mjs info | exec <file.py> | shot <out.png> [max] | cmd <type> [json]');
    process.exit(2);
}

const out = JSON.stringify(res, null, 2);
// execute_code returns captured stdout in result.result - print it readably
if (res?.status === 'success' && typeof res.result?.result === 'string') {
  console.log('--- blender stdout ---');
  console.log(res.result.result);
  console.log('--- status: success ---');
} else {
  console.log(out);
}
process.exit(res?.status === 'success' ? 0 : 1);
