/**
 * TUI Launch entry point
 * Called by `sovereign` (no subcommand) to launch the Ink TUI.
 */
import util from 'util';
import React from 'react';
import { render } from 'ink';
import fs from 'fs';
import App from './App.js';
import { unloadAll } from '../engine/qvac.js';

// ─── Step 1: Capture original write functions ─────────────────────────────────
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

// ─── Global Log Intercept ──────────────────────────────────────────────────────
const logFile = fs.createWriteStream('qvac-tui.log', { flags: 'a' });

export type LogCallback = (msg: string) => void;
const logListeners = new Set<LogCallback>();

export function subscribeToLogs(cb: LogCallback) {
  logListeners.add(cb);
  return () => logListeners.delete(cb);
}

function broadcastLog(...a: any[]) {
  const msg = util.format(...a);
  logFile.write(msg + '\n');
  // Only broadcast short lines to UI, truncate if too long
  const uiMsg = msg.length > 80 ? msg.slice(0, 80) + '...' : msg;
  logListeners.forEach((cb) => cb(uiMsg));
}

// Silence console methods completely but broadcast them
console.log   = broadcastLog;
console.info  = broadcastLog;
console.warn  = broadcastLog;
console.error = broadcastLog;

// Filter ALL non-Ink output from stdout/stderr to prevent corruption of the TUI buffer.
const isInkOutput = (chunk: any): boolean => {
  if (typeof chunk !== 'string') return true; // Pass Buffer writes (Ink internals)
  // Ink always writes ANSI escape sequences. Plain text lines are SDK/native noise.
  return chunk.startsWith('\x1b') || chunk === '\n';
};

(process.stdout as any).write = (chunk: any, enc?: any, cb?: any): boolean => {
  if (!isInkOutput(chunk)) {
    logFile.write(typeof chunk === 'string' ? chunk : chunk.toString());
    if (typeof enc === 'function') enc();
    else if (typeof cb === 'function') cb();
    return true;
  }
  return originalStdoutWrite(chunk, enc, cb);
};

(process.stderr as any).write = (chunk: any, enc?: any, cb?: any): boolean => {
  logFile.write(typeof chunk === 'string' ? chunk : chunk.toString());
  if (typeof enc === 'function') enc();
  else if (typeof cb === 'function') cb();
  return true;
};

export async function launchTUI(): Promise<void> {
  // Enter Alternate Screen Buffer + clear + hide cursor
  originalStdoutWrite('\x1b[?1049h\x1b[2J\x1b[H\x1b[?25l');

  const { waitUntilExit } = render(<App />, {
    exitOnCtrlC: false,
    patchConsole: false, // Critical: stops Ink from intercepting console.log and flashing the screen
    stdout: process.stdout,
  });

  try {
    await waitUntilExit();
  } finally {
    await unloadAll();
    // Restore cursor and exit Alternate Screen Buffer
    originalStdoutWrite('\x1b[?25h\x1b[?1049l\n');
  }
}
