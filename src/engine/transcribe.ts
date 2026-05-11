/**
 * Transcription Engine
 * Wraps @qvac/sdk transcribe() for local Whisper speech-to-text.
 */
import { transcribe, transcribeStream } from '@qvac/sdk';
import { getModelId } from './qvac.js';
import { convertToS16le } from '../utils/audio.js';
import * as fs from 'fs';

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  fullText: string;
  durationMs: number;
}

/**
 * Transcribe an audio file.
 * Converts to s16le PCM if needed, then runs Whisper via QVAC SDK.
 */
export async function transcribeFile(
  audioPath: string,
  onSegment?: (segment: TranscriptSegment) => void
): Promise<TranscriptResult> {
  const modelId = getModelId('whisper');

  // Convert to PCM s16le that Whisper expects
  const pcmPath = await convertToS16le(audioPath);
  const startMs = Date.now();

  try {
    const audioBuffer = fs.readFileSync(pcmPath);
    const segments: TranscriptSegment[] = [];

    if (onSegment) {
      // Use the stream API
      const stream = transcribeStream({ modelId, audioChunk: audioBuffer, metadata: true });
      for await (const seg of stream) {
        const s: TranscriptSegment = {
          start: (seg.startMs ?? 0) / 1000,
          end: (seg.endMs ?? 0) / 1000,
          text: seg.text ?? '',
        };
        segments.push(s);
        onSegment(s);
      }
    } else {
      // Use the batch API
      const segs = await transcribe({ modelId, audioChunk: audioBuffer, metadata: true });
      segments.push(
        ...segs.map((s: { startMs?: number; endMs?: number; text?: string }) => ({
          start: (s.startMs ?? 0) / 1000,
          end: (s.endMs ?? 0) / 1000,
          text: s.text ?? '',
        }))
      );
    }

    const fullText = segments.map((s) => s.text).join(' ').trim();
    const durationMs = Date.now() - startMs;

    return { segments, fullText, durationMs };
  } finally {
    // Clean up temp PCM file if we created a conversion
    if (pcmPath !== audioPath && fs.existsSync(pcmPath)) {
      fs.unlinkSync(pcmPath);
    }
  }
}
