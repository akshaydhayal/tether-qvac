/**
 * useQvac — Central state hook for all QVAC operations in the TUI
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { initLLM, initOCR, initWhisper, initTTS } from '../../engine/qvac.js';
import { streamChat } from '../../engine/chat.js';
import { streamOCR } from '../../engine/ocr.js';
import { transcribeFile } from '../../engine/transcribe.js';
import { runTTS } from '../../engine/tts.js';
import type { ChatMessage, ChatStats } from '../../engine/chat.js';
import type { OcrBlock } from '../../engine/ocr.js';
import type { TranscriptSegment } from '../../engine/transcribe.js';

export type Mode = 'chat' | 'ocr' | 'transcribe' | 'tts';

export interface TuiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  stats?: ChatStats;
}

export interface LoadState {
  llm: boolean;
  whisper: boolean;
  ocr: boolean;
  tts: boolean;
}

export interface QvacHook {
  // State
  messages: TuiMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  loadingLabel: string;
  loadingPct: number;
  modelsLoaded: LoadState;
  ocrBlocks: OcrBlock[];
  transcriptSegments: TranscriptSegment[];
  stats: ChatStats | null;
  activeOperation: string | null;
  // Actions
  sendMessage: (text: string, context?: string, mode?: Mode) => Promise<void>;
  runOCR: (imagePath: string) => Promise<void>;
  runTranscribe: (audioPath: string) => Promise<void>;
  initAll: () => Promise<void>;
  addSystemMessage: (content: string) => void;
}

let msgCounter = 0;
const uid = () => `msg-${++msgCounter}`;

export function useQvac(): QvacHook {
  const [messages, setMessages] = useState<TuiMessage[]>([
    {
      id: uid(),
      role: 'system',
      content: '⚡ Sovereign is ready. Select a file or type a message to begin.',
    },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [loadingPct, setLoadingPct] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState<LoadState>({ llm: false, whisper: false, ocr: false, tts: false });
  const [ocrBlocks, setOcrBlocks] = useState<OcrBlock[]>([]);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);

  const historyRef = useRef<ChatMessage[]>([]);
  const isStreamingRef = useRef(false);

  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  const initAll = useCallback(async () => {
    setIsLoading(true);

    let currentLabel = 'Initializing…';
    let currentPct = 0;
    let labelDirty = true;
    const progressInterval = setInterval(() => {
      if (labelDirty) {
        setLoadingLabel(currentLabel);
        setLoadingPct(currentPct);
        labelDirty = false;
      }
    }, 500);

    const onProgress = (pct: number, label: string) => {
      currentLabel = label;
      currentPct = pct;
      labelDirty = true;
    };

    try {
      await initLLM(onProgress);
      setModelsLoaded((s) => ({ ...s, llm: true }));
      
      await initWhisper(onProgress);
      setModelsLoaded((s) => ({ ...s, whisper: true }));

      await initTTS(onProgress);
      setModelsLoaded((s) => ({ ...s, tts: true }));

      try {
        await initOCR(onProgress);
        setModelsLoaded((s) => ({ ...s, ocr: true }));
      } catch (ocrErr) {
        setModelsLoaded((s) => ({ ...s, ocr: false }));
        onProgress(100, 'OCR skipped (missing models)');
      }

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'system', content: '✓ Models ready. Type a message or select a file.' },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'system', content: `✗ Core Load error: ${err.message}` },
      ]);
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
      setLoadingLabel('');
      setLoadingPct(0);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string, context?: string, mode: Mode = 'chat') => {
      // Guard via ref so this callback is NEVER recreated (stable reference always)
      if (isStreamingRef.current) return;

      const userMsg: TuiMessage = { id: uid(), role: 'user', content: text };
      setMessages((prev) => [...prev, userMsg]);
      historyRef.current.push({ role: 'user', content: text });

      const assistantId = uid();
      const assistantMsg: TuiMessage = { id: assistantId, role: 'assistant', content: '', streaming: true };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsStreaming(true);

      let fullReply = '';
      let pendingFlush = false;
      const flushInterval = setInterval(() => {
        if (pendingFlush) {
          const snapshot = fullReply;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: snapshot } : m
            )
          );
          pendingFlush = false;
        }
      }, 80);

      try {
        if (mode === 'tts') {
          // Send visual feedback immediately
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: '⠋ Synthesizing audio...' } : m
            )
          );
          
          const outputPath = await runTTS(text, process.cwd());
          fullReply = `🎙️ Audio synthesized and saved to:\n${outputPath}\n(Attempting to play in background)`;
          
          clearInterval(flushInterval);
          historyRef.current.push({ role: 'assistant', content: fullReply });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullReply, streaming: false } : m
            )
          );
        } else {
          // Default: Chat
          const systemPrompt = context
            ? `You are Sovereign, a local AI assistant. The user is working with this content:\n${context}\n\nAnswer helpfully and concisely.`
            : 'You are Sovereign, a helpful local AI assistant running fully offline via QVAC.';
            
          await streamChat(historyRef.current, {
            systemPrompt,
            onToken: (token) => {
              fullReply += token;
              pendingFlush = true; // Mark as dirty; the interval will flush
            },
            onDone: (_, s) => {
              clearInterval(flushInterval);
              setStats(s ?? null);
              historyRef.current.push({ role: 'assistant', content: fullReply });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullReply, streaming: false, stats: s } : m
                )
              );
            },
          });
        }
      } catch (err: any) {
        clearInterval(flushInterval);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${err.message}`, streaming: false }
              : m
          )
        );
      } finally {
        clearInterval(flushInterval);
        setIsStreaming(false);
      }
    },
    [] // No dependencies — isStreaming is read from ref, historyRef is a ref
  );

  const runOCR = useCallback(async (imagePath: string) => {
    setOcrBlocks([]);
    setActiveOperation('Running OCR…');

    const assistantId = uid();
    const assistantMsg: TuiMessage = { id: assistantId, role: 'assistant', content: '📸 Extracting text...', streaming: true };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsStreaming(true);

    let fullText = '';
    let pendingFlush = false;

    const flushInterval = setInterval(() => {
      if (pendingFlush) {
        const snapshot = fullText;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m))
        );
        pendingFlush = false;
      }
    }, 150);

    try {
      await streamOCR(imagePath, (chunk) => {
        setOcrBlocks((prev) => [...prev, ...chunk]);
        chunk.forEach(b => {
          if (b.text) fullText += b.text + '\n';
        });
        pendingFlush = true;
      });
      clearInterval(flushInterval);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullText || '(No text found in image)', streaming: false }
            : m
        )
      );
    } catch (err: any) {
      clearInterval(flushInterval);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `✗ OCR failed: ${err.message}`, streaming: false } : m
        )
      );
    } finally {
      clearInterval(flushInterval);
      setActiveOperation(null);
      setIsStreaming(false);
    }
  }, []);

  const runTranscribe = useCallback(async (audioPath: string) => {
    setTranscriptSegments([]);
    setActiveOperation('Transcribing audio…');

    const assistantId = uid();
    const assistantMsg: TuiMessage = { id: assistantId, role: 'assistant', content: '🎙 Transcribing audio...', streaming: true };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsStreaming(true);

    let fullText = '';
    let pendingFlush = false;

    const flushInterval = setInterval(() => {
      if (pendingFlush) {
        const snapshot = fullText;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m))
        );
        pendingFlush = false;
      }
    }, 150);

    try {
      await transcribeFile(audioPath, (seg) => {
        setTranscriptSegments((prev) => [...prev, seg]);
        fullText += `[${fmtSec(seg.start)} → ${fmtSec(seg.end)}] ${seg.text.trim()}\n`;
        pendingFlush = true;
      });
      clearInterval(flushInterval);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: fullText || '(No speech detected)', streaming: false }
            : m
        )
      );
    } catch (err: any) {
      clearInterval(flushInterval);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `✗ Transcription failed: ${err.message}`, streaming: false } : m
        )
      );
    } finally {
      clearInterval(flushInterval);
      setActiveOperation(null);
      setIsStreaming(false);
    }
  }, []);

  function fmtSec(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: uid(), role: 'system', content }]);
  }, []);

  return {
    messages,
    isStreaming,
    isLoading,
    loadingLabel,
    loadingPct,
    modelsLoaded,
    ocrBlocks,
    transcriptSegments,
    stats,
    activeOperation,
    sendMessage,
    runOCR,
    runTranscribe,
    initAll,
    addSystemMessage,
  };
}
