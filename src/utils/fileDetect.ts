/**
 * File type detection utilities.
 */
import * as path from 'path';

export type FileCategory = 'image' | 'audio' | 'text' | 'unknown';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.gif', '.tiff']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.webm', '.raw', '.pcm']);
const TEXT_EXTS = new Set(['.txt', '.md', '.json', '.yaml', '.yml', '.csv', '.log', '.ts', '.js', '.py', '.rs', '.go', '.pdf']);

export function detectFileType(filePath: string): FileCategory {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'unknown';
}

export function fileTypeIcon(category: FileCategory): string {
  switch (category) {
    case 'image': return '🖼 ';
    case 'audio': return '🎙 ';
    case 'text':  return '📄 ';
    default:      return '📎 ';
  }
}

export function fileTypeColor(category: FileCategory): string {
  switch (category) {
    case 'image': return 'magenta';
    case 'audio': return 'green';
    case 'text':  return 'cyan';
    default:      return 'gray';
  }
}
