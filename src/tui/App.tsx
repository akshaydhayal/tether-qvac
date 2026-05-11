/**
 * App — Root Ink TUI component
 * Three-panel layout: File Browser | Conversation | Metadata
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';

import FilePanel from './panels/FilePanel.js';
import ChatPanel from './panels/ChatPanel.js';
import MetaPanel from './panels/MetaPanel.js';
import StatusBar from './components/StatusBar.js';
import { useQvac, type Mode } from './hooks/useQvac.js';
import { useFileWatcher } from './hooks/useFileWatcher.js';
import { detectFileType } from '../utils/fileDetect.js';
import { formatOcrBlocks, formatTranscript } from '../utils/format.js';
import { importFileToWorkspace } from '../utils/importFile.js';

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // ── Terminal dimensions: stored in state, only updated on actual resize.
  // Previously these were computed inline on EVERY render (stdout.columns each time),
  // which triggered downstream prop changes on every keystroke/state update.
  const [termSize, setTermSize] = useState(() => ({
    cols: stdout?.columns ?? 120,
    rows: stdout?.rows ?? 40,
  }));

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => setTermSize({ cols: stdout.columns ?? 120, rows: stdout.rows ?? 40 });
    stdout.on('resize', onResize);
    return () => { stdout.off('resize', onResize); };
  }, [stdout]);

  const { cols, rows } = termSize;
  // Subtract 4 rows: 1 header + 1 statusbar + 2 safety margin for Windows Terminal
  const bodyH = Math.max(rows - 6, 10);

  // Panel widths in columns (avoids percentage string type mismatch with panels)
  const filePanelW = Math.floor(cols * 0.15);
  const metaPanelW = Math.floor(cols * 0.20);
  const chatPanelW = cols - filePanelW - metaPanelW;

  const qvac = useQvac();
  const files = useFileWatcher();

  // Destructure stable callbacks from qvac (these are useCallback'd with [] deps in useQvac)
  const { sendMessage, runOCR, runTranscribe, addSystemMessage, initAll } = qvac;

  // Store mutable data in refs so handleFileSelect/handleSend don't need to
  // declare them as useCallback deps (which would recreate the functions every render).
  const ocrBlocksRef = useRef(qvac.ocrBlocks);
  const transcriptRef = useRef(qvac.transcriptSegments);
  ocrBlocksRef.current = qvac.ocrBlocks;
  transcriptRef.current = qvac.transcriptSegments;

  const [mode, setMode] = useState<Mode>('chat');
  const modeRef = useRef<Mode>('chat'); // ref so handleSend (stable callback) can read current mode
  const [activePanel, setActivePanel] = useState<'files' | 'chat'>('chat');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Keep modeRef in sync with mode state
  modeRef.current = mode;

  // Initialize models on mount
  useEffect(() => { initAll(); }, []);

  // Global key bindings
  useInput((input, key) => {
    if (key.ctrl && input === 'c') { exit(); return; }
    if (key.tab) {
      setMode((m) => {
        if (m === 'chat') return 'ocr';
        if (m === 'ocr') return 'transcribe';
        if (m === 'transcribe') return 'tts';
        if (m === 'tts') return 'chat';
        return 'chat';
      });
      return;
    }
    if (key.ctrl && input === 'f') {
      setActivePanel((p) => p === 'files' ? 'chat' : 'files');
    }
  });

  const handleFileSelect = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    const category = detectFileType(filePath);

    if (category === 'image') {
      await runOCR(filePath);
    } else if (category === 'audio') {
      await runTranscribe(filePath);
    } else if (category === 'text') {
      const { default: fs } = await import('fs');
      try {
        const content = fs.readFileSync(filePath, 'utf-8').slice(0, 4000);
        await sendMessage(
          `I've loaded a text file: ${filePath.split('/').pop()}. Here's its content:\n\n${content}\n\nHow can I help you with this?`,
        );
      } catch {}
    }
  // runOCR, runTranscribe, sendMessage are all stable ([] deps in useQvac)
  }, [runOCR, runTranscribe, sendMessage]);

  const buildContext = useCallback((): string | undefined => {
    if (ocrBlocksRef.current.length > 0)
      return `OCR text from image:\n${formatOcrBlocks(ocrBlocksRef.current)}`;
    if (transcriptRef.current.length > 0)
      return `Audio transcript:\n${formatTranscript(transcriptRef.current)}`;
    return undefined;
  // Reads from refs, no deps needed
  }, []);

  const handleSend = useCallback((text: string) => {
    if (text.startsWith('/import ') || text.startsWith('/load ')) {
      const sourcePath = text.replace(/^\/(import|load) /, '').trim();
      try {
        const newPath = importFileToWorkspace(sourcePath);
        handleFileSelect(newPath);
        addSystemMessage(`✓ Imported file into workspace: ${newPath.split('/').pop()}`);
      } catch (err: any) {
        addSystemMessage(`✗ Failed to import file: ${err.message}`);
      }
      return;
    }
    sendMessage(text, buildContext(), modeRef.current);
  // All deps are stable callbacks; modeRef is a ref so no dep needed
  }, [sendMessage, buildContext, handleFileSelect, addSystemMessage]);

  // Build a one-line loading label — avoids the Spinner component which re-renders at 10fps
  const loadingText = qvac.isLoading
    ? `  ⟳ ${qvac.loadingLabel}${qvac.loadingPct > 0 ? ` ${qvac.loadingPct}%` : ''}`
    : '';

  return (
    <Box flexDirection="column" width={cols}>
      {/* ── Header (single line, no Spinner component) ── */}
      <Box paddingX={2}>
        <Text bold color="magenta">SOVEREIGN</Text>
        <Text dimColor>  Local Multimodal AI  ·  Powered by QVAC  ·  Fully Offline</Text>
        {qvac.isLoading && <Text color="green">{loadingText}</Text>}
      </Box>

      {/* ── Three-panel body ── */}
      <Box flexDirection="row" height={bodyH}>
        <FilePanel
          files={files}
          isActive={activePanel === 'files'}
          selectedFile={selectedFile}
          onSelect={handleFileSelect}
          width={filePanelW}
          height={bodyH}
        />
        <ChatPanel
          messages={qvac.messages}
          isStreaming={qvac.isStreaming}
          isActive={activePanel === 'chat'}
          onSend={handleSend}
          mode={mode}
          width={chatPanelW}
          height={bodyH}
        />
        <MetaPanel
          ocrBlocks={qvac.ocrBlocks}
          transcriptSegments={qvac.transcriptSegments}
          stats={qvac.stats}
          activeOperation={qvac.activeOperation}
          modelsLoaded={qvac.modelsLoaded}
          width={metaPanelW}
          height={bodyH}
        />
      </Box>

      {/* ── Status bar ── */}
      <StatusBar
        mode={mode}
        activePanel={activePanel}
        selectedFile={selectedFile}
        isStreaming={qvac.isStreaming}
      />
    </Box>
  );
}
