/**
 * QVAC Engine Singleton
 * Manages model lifecycle for LLM, Whisper, and OCR models.
 * All QVAC SDK calls go through here.
 */
import {
  loadModel,
  unloadModel,
  modelRegistrySearch,
  downloadAsset,
} from '@qvac/sdk';
import { ensureModelDownloaded } from './downloader.js';

export type ModelType = 'llm' | 'whisper' | 'ocr' | 'tts';

export type ProgressCallback = (pct: number, label: string) => void;

interface LoadedModels {
  llm: string | null;
  whisper: string | null;
  ocr: string | null;
  tts: string | null;
}

const models: LoadedModels = { llm: null, whisper: null, ocr: null, tts: null };

// ─── LLM ────────────────────────────────────────────────────────────────────

export async function initLLM(onProgress?: ProgressCallback): Promise<string> {
  if (models.llm) return models.llm;

  onProgress?.(0, 'Loading LLM…');
  let modelSrc = '';
  
  // Try using cached Llama 3.2 1B Instruct first
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');
  const cachedLlama = path.join(os.homedir(), '.qvac', 'models', 'f2bade0bc5cd4a8c_Llama-3.2-1B-Instruct-Q4_0.gguf');
  
  if (fs.existsSync(cachedLlama)) {
    modelSrc = cachedLlama;
  } else {
    try {
      const entries = await modelRegistrySearch({ addon: 'llm' });
      const e = entries.find((e: { name: string; registrySource: string; registryPath: string }) => e.name === 'LLAMA_3_2_1B_INST_Q4_0') || entries[0];
      if (e) modelSrc = `registry://${e.registrySource}/${e.registryPath}`;
    } catch (err) {
      console.warn('LLM registry search failed.');
    }
  }

  if (!modelSrc) {
    onProgress?.(100, 'LLM skipped (model unavailable)');
    return '';
  }

  const id = await loadModel({
    modelSrc,
    modelType: 'llm',
    modelConfig: { verbosity: 0, ctx_size: 8192 }, // Silence native llama.cpp logs and increase context to 8k
    onProgress: (p: { loaded: number; total: number }) => {
      const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
      onProgress?.(pct, `LLM — ${pct}%`);
    },
  });
  models.llm = id;
  onProgress?.(100, 'LLM ready');
  return id;
}

// ─── WHISPER ─────────────────────────────────────────────────────────────────

export async function initWhisper(onProgress?: ProgressCallback): Promise<string> {
  if (models.whisper) return models.whisper;

  onProgress?.(0, 'Loading Whisper Tiny…');

  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');
  
  let whisperSrc = path.join(os.homedir(), '.qvac', 'models', 'ggml-tiny.bin');
  
  if (!fs.existsSync(whisperSrc)) {
    // Check fallback named download
    whisperSrc = path.join(os.homedir(), '.qvac', 'models', 'e5757f1893313397_ggml-tiny.bin');
  }

  if (!fs.existsSync(whisperSrc)) {
    // Use our robust custom downloader for Whisper to avoid SDK timeouts
    const whisperUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin';
    whisperSrc = await ensureModelDownloaded(whisperUrl, 'ggml-tiny.bin', 'Whisper Tiny', onProgress);
  }

  const id = await loadModel({
    modelSrc: whisperSrc,
    modelType: 'whisper',
    modelConfig: { print_progress: false, print_realtime: false, print_timestamps: false }, // Silence native whisper.cpp logs
    onProgress: (p: { loaded: number; total: number }) => {
      const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
      onProgress?.(pct, `Whisper Tiny — ${pct}%`);
    },
  });
  models.whisper = id;
  onProgress?.(100, 'Whisper ready');
  return id;
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

export async function initOCR(onProgress?: ProgressCallback): Promise<string> {
  if (models.ocr) return models.ocr;

  onProgress?.(0, 'Resolving OCR models…');

  let detectorSrc = '';
  let recognizerSrc = '';

  try {
    const entries = await modelRegistrySearch({ addon: 'ocr' });
    const d = entries.find((e: { name: string; registrySource: string; registryPath: string }) => e.name.includes('db_resnet') || e.name.includes('craft'));
    const r = entries.find((e: { name: string; registrySource: string; registryPath: string }) => e.name.includes('parseq') || e.name.includes('crnn'));
    if (d) detectorSrc = `registry://${d.registrySource}/${d.registryPath}`;
    if (r) recognizerSrc = `registry://${r.registrySource}/${r.registryPath}`;
  } catch (err) {
    console.warn('OCR registry search failed, skipping OCR setup.');
  }

  if (!detectorSrc || !recognizerSrc) {
    onProgress?.(100, 'OCR skipped (models unavailable in registry)');
    return '';
  }

  let localDetector = '';
  let localRecognizer = '';

  onProgress?.(10, 'Downloading OCR detector…');
  try {
    // Explicitly download the models via the registry to ensure they exist on disk
    // downloadAsset returns the absolute local path to the downloaded file
    localDetector = await downloadAsset({ assetSrc: detectorSrc });
    onProgress?.(40, 'Downloading OCR recognizer…');
    localRecognizer = await downloadAsset({ assetSrc: recognizerSrc });
  } catch (err) {
    console.warn('Failed to download OCR models via registry', err);
    throw new Error('Failed to download OCR models');
  }

  onProgress?.(80, 'Loading OCR engines…');

  const id = await loadModel({
    modelSrc: localRecognizer, // Use the physically downloaded path
    modelType: 'onnx-ocr',
    modelConfig: {
      detectorModelSrc: localDetector, // Use the physically downloaded path
    },
    onProgress: (p: { loaded: number; total: number }) => {
      const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
      onProgress?.(pct, `OCR — ${pct}%`);
    },
  });
  models.ocr = id;
  onProgress?.(100, 'OCR ready');
  return id;
}

// ─── TEXT-TO-SPEECH (TTS) ────────────────────────────────────────────────────

// Supertonic-2 registry src paths (pinned to commit 75e672…)
const SUPERTONIC2_BASE = 'registry://hf/Supertone/supertonic-2/resolve/75e6727618a02f323c720cba9478152d4bc16ca4';
const TTS_SRCS = {
  textEncoder:       `${SUPERTONIC2_BASE}/onnx/text_encoder.onnx`,
  durationPredictor: `${SUPERTONIC2_BASE}/onnx/duration_predictor.onnx`,
  vectorEstimator:   `${SUPERTONIC2_BASE}/onnx/vector_estimator.onnx`,
  vocoder:           `${SUPERTONIC2_BASE}/onnx/vocoder.onnx`,
  unicodeIndexer:    `${SUPERTONIC2_BASE}/onnx/unicode_indexer.json`,
  ttsConfig:         `${SUPERTONIC2_BASE}/onnx/tts.json`,
  // F5 = highly stable and natural female voice; M5 is the male equivalent
  voiceStyle:        `${SUPERTONIC2_BASE}/voice_styles/F5.json`,
};

export async function initTTS(onProgress?: ProgressCallback): Promise<string> {
  if (models.tts) return models.tts;

  onProgress?.(0, 'Loading TTS (Supertonic)…');

  try {
    const id = await loadModel({
      modelSrc: TTS_SRCS.textEncoder,
      modelType: 'onnx-tts',
      modelConfig: {
        ttsEngine: 'supertonic',
        language: 'en',
        ttsSpeed: 1.05,              // decisive pacing helps prevent stutter
        ttsNumInferenceSteps: 15,    // 15 is the professional sweet spot for this ONNX build
        ttsSupertonicMultilingual: true, // true = uses the more robust 'v2' model path
        ttsTextEncoderSrc:       TTS_SRCS.textEncoder,
        ttsDurationPredictorSrc: TTS_SRCS.durationPredictor,
        ttsVectorEstimatorSrc:   TTS_SRCS.vectorEstimator,
        ttsVocoderSrc:           TTS_SRCS.vocoder,
        ttsUnicodeIndexerSrc:    TTS_SRCS.unicodeIndexer,
        ttsTtsConfigSrc:         TTS_SRCS.ttsConfig,
        ttsVoiceStyleSrc:        TTS_SRCS.voiceStyle,
      } as any,
      onProgress: (p: { loaded: number; total: number }) => {
        const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
        onProgress?.(pct, `TTS — ${pct}%`);
      },
    });
    models.tts = id;
    onProgress?.(100, 'TTS ready');
    return id;
  } catch (err) {
    onProgress?.(100, 'TTS skipped (load failed)');
    console.warn('TTS load failed:', err);
    return '';
  }
}

// ─── ACCESSORS ───────────────────────────────────────────────────────────────

export function getModelId(type: ModelType): string {
  const id = models[type];
  if (!id) throw new Error(`Model '${type}' is not loaded. Run 'sovereign setup' first.`);
  return id;
}

export function getLoadedState(): Readonly<LoadedModels> {
  return models;
}

// ─── CLEANUP ─────────────────────────────────────────────────────────────────

export async function unloadAll(): Promise<void> {
  const unloads: Promise<void>[] = [];
  for (const [key, id] of Object.entries(models)) {
    if (id) {
      unloads.push(unloadModel({ modelId: id }));
      (models as unknown as Record<string, string | null>)[key] = null;
    }
  }
  await Promise.allSettled(unloads);
}
