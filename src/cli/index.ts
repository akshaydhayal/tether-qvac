#!/usr/bin/env node
/**
 * Sovereign CLI — Entry Point
 *
 * Usage:
 *   sovereign              Launch the interactive TUI workspace
 *   sovereign ocr <img>    Run OCR on an image file
 *   sovereign transcribe   Transcribe an audio file with Whisper
 *   sovereign chat <msg>   One-shot chat with the LLM
 *   sovereign tts <text>   Synthesize speech from text
 */
import { Command } from 'commander';
import { ocrCommand } from './commands/ocr.js';
import { transcribeCommand } from './commands/transcribe.js';

const program = new Command();

program
  .name('sovereign')
  .description('Local-first multimodal AI terminal — powered by QVAC (fully offline)')
  .version('0.1.0');

// ─── Default action: launch the TUI ──────────────────────────────────────────
// When no subcommand is given, drop straight into the Ink TUI workspace.
program
  .action(async () => {
    const { launchTUI } = await import('../tui/launch.js');
    await launchTUI();
  });

// ─── sovereign ocr <image> ────────────────────────────────────────────────────
program
  .command('ocr <image>')
  .description('Extract text from an image file using local OCR')
  .option('--json', 'Output raw JSON blocks instead of plain text')
  .action(async (image: string, opts: { json?: boolean }) => {
    await ocrCommand(image, opts);
  });

// ─── sovereign transcribe <audio> ────────────────────────────────────────────
program
  .command('transcribe <audio>')
  .description('Transcribe an audio file using local Whisper')
  .option('--timestamps', 'Include per-segment timestamps in output')
  .action(async (audio: string, opts: { timestamps?: boolean }) => {
    await transcribeCommand(audio, opts);
  });

// ─── sovereign chat <message> ─────────────────────────────────────────────────
program
  .command('chat <message>')
  .description('Send a single message to the local LLM and print the response')
  .option('--system <prompt>', 'Custom system prompt', 'You are Sovereign, a helpful local AI assistant running fully offline via QVAC.')
  .action(async (message: string, opts: { system: string }) => {
    const chalk = (await import('chalk')).default;
    const { initLLM } = await import('../engine/qvac.js');
    const { chatOnce } = await import('../engine/chat.js');

    process.stdout.write(chalk.dim('Loading LLM…\r'));
    await initLLM();
    process.stdout.write('\r' + ' '.repeat(20) + '\r');

    console.log(chalk.bold.magenta('\n⚡ Sovereign Chat\n'));
    console.log(chalk.cyan('You: ') + message);
    console.log(chalk.dim('─'.repeat(50)));
    process.stdout.write(chalk.white('AI: '));

    const history = [{ role: 'user' as const, content: message }];
    const { text, stats } = await chatOnce(history, opts.system);

    console.log(text);
    console.log();
    console.log(
      chalk.dim(
        `  ${stats.totalTokens} tokens · ${stats.tokensPerSecond.toFixed(1)} tok/s · ${stats.latencyMs}ms`
      )
    );
  });

// ─── sovereign tts <text> ────────────────────────────────────────────────────
program
  .command('tts <text>')
  .description('Synthesize speech from text using local TTS (Supertonic)')
  .option('--out <dir>', 'Output directory for the WAV file', '.')
  .action(async (text: string, opts: { out: string }) => {
    const chalk = (await import('chalk')).default;
    const { initTTS } = await import('../engine/qvac.js');
    const { runTTS } = await import('../engine/tts.js');

    process.stdout.write(chalk.dim('Loading TTS model…\r'));
    await initTTS();
    process.stdout.write('\r' + ' '.repeat(30) + '\r');

    console.log(chalk.bold.magenta('\n⚡ Sovereign TTS\n'));
    console.log(chalk.dim('Synthesizing: ') + text.slice(0, 80) + (text.length > 80 ? '…' : ''));
    process.stdout.write(chalk.dim('Generating audio… '));

    const outPath = await runTTS(text, opts.out);
    console.log(chalk.green('✓'));
    console.log(chalk.bold('Output: ') + chalk.yellow(outPath));
  });

// ─── Parse ───────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
