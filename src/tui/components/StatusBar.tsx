/**
 * StatusBar — Single-line bottom bar: mode · file · streaming state
 */
import React from 'react';
import { Box, Text } from 'ink';
import type { Mode } from '../hooks/useQvac.js';

interface Props {
  mode: Mode;
  activePanel: 'files' | 'chat';
  selectedFile: string | null;
  isStreaming: boolean;
}

const MODE_COLORS: Record<Mode, string> = {
  chat: 'green',
  ocr: 'magenta',
  transcribe: 'cyan',
  tts: 'blue',
};

const MODE_LABELS: Record<Mode, string> = {
  chat: 'CHAT',
  ocr: 'VISION',
  transcribe: 'AUDIO',
  tts: 'SPEECH',
};

export default function StatusBar({ mode, activePanel, selectedFile, isStreaming }: Props) {
  const modeColor = MODE_COLORS[mode];

  return (
    <Box borderStyle="single" borderColor="gray" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      {/* Mode pill */}
      <Text bold color={modeColor}>[{MODE_LABELS[mode]}]</Text>

      {/* Selected file */}
      {selectedFile && (
        <>
          <Text dimColor>  file: </Text>
          <Text color="yellow">{selectedFile.split('/').pop()}</Text>
        </>
      )}

      {/* Streaming indicator */}
      {isStreaming && <Text color="green">  ● generating</Text>}

      {/* Spacer */}
      <Box flexGrow={1} />

      {/* Minimal key hints */}
      <Text dimColor>PgUp/PgDn scroll  Tab mode  Ctrl+F files  Ctrl+C quit</Text>
    </Box>
  );
}
