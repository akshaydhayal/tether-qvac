/**
 * OCR Engine
 * Wraps @qvac/sdk ocr() for image text extraction.
 */
import { ocr } from '@qvac/sdk';
import { getModelId } from './qvac.js';

export interface OcrBlock {
  text: string;
  bbox?: [number, number, number, number];
  confidence?: number;
}

export interface OcrResult {
  blocks: OcrBlock[];
  fullText: string;
  stats?: { detectionTime?: number; recognitionTime?: number; totalTime?: number };
}

/**
 * Run OCR on an image file path or Buffer.
 * Returns structured blocks and concatenated full text.
 */
export async function runOCR(imagePath: string): Promise<OcrResult> {
  const modelId = getModelId('ocr');

  const result = ocr({ modelId, image: imagePath });
  const [blocks, stats] = await Promise.all([result.blocks, result.stats]);

  const fullText = blocks.map((b: OcrBlock) => b.text).join('\n').trim();

  return { blocks, fullText, stats: stats ?? undefined };
}

/**
 * Stream OCR blocks as they arrive (for large images / real-time display).
 */
export async function streamOCR(
  imagePath: string,
  onBlocks: (blocks: OcrBlock[]) => void
): Promise<OcrResult> {
  const modelId = getModelId('ocr');

  const result = ocr({ modelId, image: imagePath, stream: true });
  const allBlocks: OcrBlock[] = [];

  for await (const chunk of result.blockStream) {
    allBlocks.push(...chunk);
    onBlocks(chunk);
  }

  const stats = await result.stats;
  const fullText = allBlocks.map((b) => b.text).join('\n').trim();

  return { blocks: allBlocks, fullText, stats: stats ?? undefined };
}
