/**
 * MetaPanel — Right panel showing OCR/transcript results and model metadata
 *
 * IMPORTANT: Do NOT use ink-spinner here. ink-spinner drives its own setInterval
 * which forces Ink to repaint the ENTIRE screen at ~10fps independently of any
 * React state change, causing the "flash on every tick" issue.
 * Instead we use a plain text spinner that only renders when activeOperation changes.
 */
import React, { memo, useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { OcrBlock } from '../../engine/ocr.js';
import type { TranscriptSegment } from '../../engine/transcribe.js';
import type { ChatStats } from '../../engine/chat.js';
import type { LoadState } from '../hooks/useQvac.js';
import { truncate, fmtDuration } from '../../utils/format.js';
import { subscribeToLogs } from '../launch.js';

interface Props {
  ocrBlocks: OcrBlock[];
  transcriptSegments: TranscriptSegment[];
  stats: ChatStats | null;
  activeOperation: string | null;
  modelsLoaded: LoadState;
  width: number;
  height: number;
}

// Static spinner frames — cycled in useEffect below (no external timer library)
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const MetaPanel = memo(function MetaPanel({
  ocrBlocks, transcriptSegments, stats, activeOperation, modelsLoaded, width, height,
}: Props) {
  const hasOCR = ocrBlocks.length > 0;
  const hasTranscript = transcriptSegments.length > 0;
  const maxLine = Math.max(width - 4, 10);

  // Transient Logs state
  const [recentLogs, setRecentLogs] = useState<{id: number, msg: string}[]>([]);

  useEffect(() => {
    let nextId = 0;
    const unsub = subscribeToLogs((msg) => {
      const id = ++nextId;
      setRecentLogs((prev) => [...prev, { id, msg }].slice(-3)); // keep last 3

      // Auto-remove after 3.5 seconds
      setTimeout(() => {
        setRecentLogs((prev) => prev.filter((l) => l.id !== id));
      }, 3500);
    });
    return () => { unsub(); };
  }, []);

  // Drive a local spinner frame counter ONLY when an operation is active.
  // We use a local state so this never causes App or siblings to re-render.
  const [spinFrame, setSpinFrame] = React.useState(0);
  React.useEffect(() => {
    if (!activeOperation) return;
    const t = setInterval(() => setSpinFrame((f) => (f + 1) % SPINNER_FRAMES.length), 120);
    return () => clearInterval(t);
  }, [activeOperation]);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Box flexDirection="column" height={Math.max(height - 2, 5)} overflow="hidden">
        {/* Active operation indicator — plain text spinner, no ink-spinner dependency */}
        {activeOperation && (
          <Box marginBottom={1}>
            <Text color="green">{SPINNER_FRAMES[spinFrame]} </Text>
            <Text color="green">{activeOperation}</Text>
          </Box>
        )}

        {/* Empty state */}
        {!activeOperation && (
          <Box flexDirection="column" paddingY={1}>
            <Text dimColor>Select a file to begin.</Text>
            <Text dimColor>Output will stream directly</Text>
            <Text dimColor>into the main conversation.</Text>
          </Box>
        )}

        {/* Stats */}
        {stats && (
          <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
            <Text bold color="cyan">STATS</Text>
            <Text dimColor>Tokens/s  {stats.tokensPerSecond.toFixed(1)}</Text>
            <Text dimColor>Tokens    {stats.totalTokens}</Text>
            <Text dimColor>Latency   {fmtDuration(stats.latencyMs)}</Text>
          </Box>
        )}

        {/* Model status */}
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
          <Text bold color="cyan">MODELS</Text>
          <ModelStatus label="LLM  " loaded={modelsLoaded.llm} />
          <ModelStatus label="Whisp" loaded={modelsLoaded.whisper} />
          <ModelStatus label="OCR  " loaded={modelsLoaded.ocr} />
          <ModelStatus label="TTS  " loaded={modelsLoaded.tts} />
        </Box>

        {/* Transient Background Logs */}
        {recentLogs.length > 0 && (
          <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
            <Text bold color="yellow">SYSTEM LOGS</Text>
            {recentLogs.map((log) => (
              <Text key={log.id} dimColor wrap="truncate">
                {log.msg}
              </Text>
            ))}
          </Box>
        )}

        {/* Footer */}
        <Box marginTop={1} flexGrow={1} justifyContent="flex-end">
          <Text dimColor>QVAC · offline · sovereign</Text>
        </Box>
      </Box>
    </Box>
  );
});

export default MetaPanel;

function ModelStatus({ label, loaded }: { label: string; loaded: boolean }) {
  return (
    <Box>
      <Text dimColor>{label} </Text>
      {loaded ? (
        <Text color="green">● ready</Text>
      ) : (
        <Text color="gray">○ not loaded</Text>
      )}
    </Box>
  );
}

function fmtSec(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
