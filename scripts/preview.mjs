import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { connect } from 'node:net';

// Run independently of a single agent tool session; no login/startup service is installed.
const root = fileURLToPath(new URL('../', import.meta.url));
const available = await new Promise(resolve => {
  const socket = connect({ host: '127.0.0.1', port: 3000 });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
if (available) {
  console.log('A preview is already listening at http://127.0.0.1:3000');
} else {
  const cli = resolve(root, 'node_modules/vinext/dist/cli.js');
  const logDirectory = resolve(root, '.preview');
  await mkdir(logDirectory, { recursive: true });
  const log = await open(resolve(logDirectory, 'server.log'), 'a');
  const child = spawn(process.execPath, [cli, 'dev', '--host', '127.0.0.1', '--port', '3000'], {
    cwd: root, env: process.env, detached: true, stdio: ['ignore', log.fd, log.fd],
  });
  child.unref();
  await log.close();
  console.log(`Started local preview (process ${child.pid}). Logs: .preview/server.log`);
}
