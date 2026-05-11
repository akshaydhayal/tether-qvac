/**
 * Audio Utilities
 * Converts any audio format to s16le PCM (required by Whisper).
 */
import ffmpeg from 'fluent-ffmpeg';
import { createRequire } from 'module';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Attempt to use @ffmpeg-installer/ffmpeg if available; fall back to system ffmpeg
try {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const installer = require('@ffmpeg-installer/ffmpeg');
  ffmpeg.setFfmpegPath(installer.path);
} catch {
  // System ffmpeg must be available in PATH
}

/**
 * Convert an audio file to raw 16kHz mono s16le PCM.
 * Returns the path to the temporary PCM file.
 * Caller is responsible for deleting it.
 */
export function convertToS16le(inputPath: string): Promise<string> {
  const ext = path.extname(inputPath).toLowerCase();
  // Already raw s16le — pass through
  if (ext === '.raw' || ext === '.pcm') return Promise.resolve(inputPath);

  const tmpFile = path.join(os.tmpdir(), `sovereign_audio_${Date.now()}.raw`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('s16le')
      .on('error', reject)
      .on('end', () => resolve(tmpFile))
      .save(tmpFile);
  });
}

/**
 * Get audio duration in seconds (for display).
 */
export function getAudioDuration(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) resolve(0);
      else resolve(metadata?.format?.duration ?? 0);
    });
  });
}

/**
 * Returns true if the file appears to be a valid audio file ffmpeg can handle.
 */
export function isSupportedAudio(filePath: string): boolean {
  const supported = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.webm', '.raw', '.pcm'];
  return supported.includes(path.extname(filePath).toLowerCase());
}
