/**
 * `sovereign ocr <image>` — Extract text from an image
 */
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { initOCR } from '../../engine/qvac.js';
import { streamOCR } from '../../engine/ocr.js';
import { formatOcrBlocks } from '../../utils/format.js';
import { fmtDuration } from '../../utils/format.js';

interface OcrOptions {
  json?: boolean;
}

export async function ocrCommand(imagePath: string, opts: OcrOptions) {
  const abs = path.resolve(imagePath);
  if (!fs.existsSync(abs)) {
    console.error(chalk.red(`✗ File not found: ${abs}`));
    process.exit(1);
  }

  process.stdout.write(chalk.dim('Loading OCR model…\r'));
  await initOCR();
  process.stdout.write('\r' + ' '.repeat(30) + '\r');

  console.log(chalk.bold.magenta(`\n⚡ OCR: ${path.basename(abs)}\n`));
  process.stdout.write(chalk.dim('Scanning… '));

  const blocks: any[] = [];
  const result = await streamOCR(abs, (chunk) => {
    blocks.push(...chunk);
    process.stdout.write('.');
  });

  process.stdout.write('\n\n');

  if (opts.json) {
    console.log(JSON.stringify(result.blocks, null, 2));
    return;
  }

  if (!result.fullText) {
    console.log(chalk.yellow('  (no text detected)'));
  } else {
    console.log(chalk.bold('Extracted Text:'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(result.fullText);
  }

  console.log();
  if (result.stats) {
    const t = result.stats.totalTime ?? 0;
    console.log(
      chalk.dim(
        `  ${result.blocks.length} blocks · ${fmtDuration(t * 1000)} inference`
      )
    );
  }
}
