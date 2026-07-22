const path = require('node:path');
const { spawn } = require('node:child_process');

const heapOption = '--max-old-space-size=4096';
const existingNodeOptions = process.env.NODE_OPTIONS || '';
process.env.NODE_OPTIONS = existingNodeOptions.includes('--max-old-space-size')
  ? existingNodeOptions
  : `${existingNodeOptions} ${heapOption}`.trim();

const bin = process.platform === 'win32'
  ? path.resolve(__dirname, '../../node_modules/.bin/ts-node-dev.cmd')
  : path.resolve(__dirname, '../../node_modules/.bin/ts-node-dev');

const child = spawn(
  bin,
  ['--respawn', '--transpile-only', 'src/server.ts'],
  {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

