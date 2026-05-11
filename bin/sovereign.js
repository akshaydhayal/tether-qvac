#!/usr/bin/env node
// Sovereign CLI entry shim — requires Node.js >= 22.17
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = join(__dirname, '../src/cli/index.ts');

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx/esm', entry, ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 0);
