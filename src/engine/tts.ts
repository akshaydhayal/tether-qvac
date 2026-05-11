import { textToSpeech as sdkTts } from '@qvac/sdk';
import { getModelId } from './qvac.js';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const SAMPLE_RATE = 44100; // Supertonic outputs 44.1kHz mono int16 PCM

/** Build a 44-byte WAV header for 16-bit mono PCM */
function makeWavHeader(numSamples: number): Buffer {
  const dataBytes = numSamples * 2; // 16-bit = 2 bytes per sample
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // fmt chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(1, 22);            // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32);            // block align
  header.writeUInt16LE(16, 34);           // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

/** Normalize text before sending to TTS to prevent echo artifacts */
function normalizeTTSText(raw: string): string {
  return raw
    // Normalize smart/curly quotes to straight ones
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Strip markdown bold/italic/code
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    // Strip URLs
    .replace(/https?:\/\/\S+/g, '')
    // Collapse multiple spaces/newlines to a single space
    .replace(/\s+/g, ' ')
    .trim()
    // Ensure sentence ends with punctuation — prevents the model from echoing the last word
    + ((/[.!?]$/).test(raw.trim()) ? '' : '.');
}

export async function runTTS(text: string, workspacePath: string): Promise<string> {
  const modelId = getModelId('tts');
  const normalizedText = normalizeTTSText(text);

  const { buffer, done } = sdkTts({
    modelId,
    text: normalizedText,
    stream: false,
    sentenceStream: false
  });

  // SDK returns number[] of int16 PCM scalars (range -32768..32767) at 24kHz mono
  const pcmSamples: number[] = await buffer;
  await done;

  // Convert number[] → s16le Buffer
  const dataBuffer = Buffer.alloc(pcmSamples.length * 2);
  for (let i = 0; i < pcmSamples.length; i++) {
    const clamped = Math.max(-32768, Math.min(32767, Math.round(pcmSamples[i] ?? 0)));
    dataBuffer.writeInt16LE(clamped, i * 2);
  }

  // Write WAV = header + PCM data (no ffmpeg needed)
  const outputPath = path.join(workspacePath, `speech_${Date.now()}.wav`);
  const wavFile = Buffer.concat([makeWavHeader(pcmSamples.length), dataBuffer]);
  fs.writeFileSync(outputPath, wavFile);

  // Play with ffplay (detached, no window)
  try {
    const child = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', outputPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // Ignore playback errors — file is still saved
  }

  return outputPath;
}

