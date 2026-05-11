/**
 * `sovereign transcribe <audio>` — Transcribe an audio file with Whisper
 */
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { initWhisper } from '../../engine/qvac.js';
import { transcribeFile } from '../../engine/transcribe.js';
import { fmtDuration } from '../../utils/format.js';
import { isSupportedAudio } from '../../utils/audio.js';

interface TranscribeOptions {
  timestamps?: boolean;
}

export async function transcribeCommand(audioPath: string, opts: TranscribeOptions) {
  const abs = path.resolve(audioPath);
  if (!fs.existsSync(abs)) {
    console.error(chalk.red(`✗ File not found: ${abs}`));
    process.exit(1);
  }
  if (!isSupportedAudio(abs)) {
    console.error(chalk.red(`✗ Unsupported audio format: ${path.extname(abs)}`));
    console.error(chalk.dim('  Supported: mp3, wav, m4a, ogg, flac, aac, webm'));
    process.exit(1);
  }

  process.stdout.write(chalk.dim('Loading Whisper…\r'));
  await initWhisper();
  process.stdout.write('\r' + ' '.repeat(30) + '\r');

  console.log(chalk.bold.magenta(`\n⚡ Transcribe: ${path.basename(abs)}\n`));
  console.log(chalk.dim('─'.repeat(50)));

  const result = await transcribeFile(abs, (seg) => {
    if (opts.timestamps) {
      const ts = chalk.dim(`[${fmtSec(seg.start)} → ${fmtSec(seg.end)}]`);
      console.log(`${ts} ${seg.text.trim()}`);
    } else {
      process.stdout.write(seg.text);
    }
  });

  if (!opts.timestamps) {
    console.log('\n');
    console.log(chalk.dim('─'.repeat(50)));
    console.log(chalk.bold('Full transcript:'));
    console.log(result.fullText);
  }

  console.log();
  console.log(
    chalk.dim(
      `  ${result.segments.length} segments · completed in ${fmtDuration(result.durationMs)}`
    )
  );
}

function fmtSec(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
