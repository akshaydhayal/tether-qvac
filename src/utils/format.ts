/**
 * Display formatting helpers.
 */
import type { OcrBlock } from '../engine/ocr.js';
import type { TranscriptSegment } from '../engine/transcribe.js';

/** Format OCR blocks into readable text with confidence scores */
export function formatOcrBlocks(blocks: OcrBlock[]): string {
  if (blocks.length === 0) return '(no text detected)';
  return blocks
    .filter((b) => b.text.trim())
    .map((b) => {
      const conf = b.confidence != null ? ` [${Math.round(b.confidence * 100)}%]` : '';
      return b.text.trim() + conf;
    })
    .join('\n');
}

/** Format transcript segments with timestamps */
export function formatTranscript(segments: TranscriptSegment[]): string {
  if (segments.length === 0) return '(no speech detected)';
  return segments
    .map((s) => `[${fmtTime(s.start)} → ${fmtTime(s.end)}] ${s.text.trim()}`)
    .join('\n');
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Format bytes to human-readable size */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Format milliseconds to human-readable duration */
export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Truncate a string to max length with ellipsis */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}
