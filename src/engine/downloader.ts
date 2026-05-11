import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

export type ProgressCallback = (pct: number, label: string) => void;

/**
 * Downloads a model to ~/.qvac/models/ bypassing the 10s QVAC SDK timeout.
 * If the file exists and is not empty, skips the download.
 */
export async function ensureModelDownloaded(
  url: string,
  filename: string,
  label: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const qvacDir = path.join(os.homedir(), '.qvac', 'models');
  if (!fs.existsSync(qvacDir)) {
    fs.mkdirSync(qvacDir, { recursive: true });
  }

  const destPath = path.join(qvacDir, filename);

  // If the file already exists and is non-empty, assume it's downloaded
  // In a production scenario, we'd check hash/checksums here, but this works for bypassing the bug.
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 0) {
      onProgress?.(100, `${label} ready`);
      return destPath; // Return absolute path
    }
  }

  onProgress?.(0, `Downloading ${label}…`);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  let loadedBytes = 0;

  const fileStream = fs.createWriteStream(destPath);

  // We need to read the web stream chunk by chunk to update progress
  // Since we are on Node 22, we can convert Web stream to Node readable
  const nodeStream = Readable.fromWeb(response.body as any);

  nodeStream.on('data', (chunk) => {
    loadedBytes += chunk.length;
    if (totalBytes > 0) {
      const pct = Math.round((loadedBytes / totalBytes) * 100);
      onProgress?.(pct, `${label} — ${pct}%`);
    } else {
      // If no content-length, just show 0%
      onProgress?.(0, `${label} — 0%`);
    }
  });

  nodeStream.pipe(fileStream);

  await finished(fileStream);

  onProgress?.(100, `${label} ready`);
  return destPath;
}
