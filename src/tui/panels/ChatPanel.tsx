/**
 * ChatPanel — Center panel for conversation output and text input
 *
 * KEY DESIGN:
 * 1. ChatInput is memo'd and isolated so keystrokes don't re-render MessageList.
 * 2. ALL text is pre-wrapped manually (wrapText) before being handed to Ink.
 *    This is CRITICAL: Ink's wrap="wrap" measures width in characters, but the
 *    terminal measures in display-cells. Wide chars / emoji cause a 1-line
 *    discrepancy that makes Ink move the cursor up by the wrong amount on each
 *    re-render → every keystroke shifts ALL content 1 row down then snaps back.
 *    Pre-wrapping gives Ink exact line counts, eliminating the flash entirely.
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import type { TuiMessage } from '../hooks/useQvac.js';
import type { Mode } from '../hooks/useQvac.js';

interface Props {
  messages: TuiMessage[];
  isStreaming: boolean;
  isActive: boolean;
  onSend: (text: string) => void;
  mode: Mode;
  width: number;
  height: number;
}

const MODE_HINTS: Record<Mode, string> = {
  chat: 'Type a message to chat…',
  ocr: 'Drag & drop an image or paste its path…',
  transcribe: 'Drag & drop an audio file or paste its path…',
  tts: 'Type text to synthesize speech…',
};

const MSG_COLORS: Record<string, string> = {
  user:      'cyan',
  assistant: 'white',
  system:    'yellow',
};

// ─── Text pre-wrapper ──────────────────────────────────────────────────────────
// Splits a single logical line into physical lines of at most `maxW` chars.
// We count display width: ASCII = 1 cell, other (CJK/emoji) = 2 cells.
function displayWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  // Ranges that are typically double-width in terminals
  if (
    (code >= 0x1100 && code <= 0x115f) ||   // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) ||   // CJK Radicals
    (code >= 0x3041 && code <= 0x33bf) ||   // Japanese / CJK
    (code >= 0x33ff && code <= 0xa4cf) ||   // CJK Unified
    (code >= 0xa960 && code <= 0xa97f) ||   // Hangul Jamo Extended-A
    (code >= 0xac00 && code <= 0xd7ff) ||   // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) ||   // CJK Compat Ideographs
    (code >= 0xfe10 && code <= 0xfe19) ||   // Vertical Forms
    (code >= 0xfe30 && code <= 0xfe6f) ||   // CJK Compat Forms
    (code >= 0xff00 && code <= 0xff60) ||   // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) ||   // Fullwidth Signs
    (code >= 0x1f300 && code <= 0x1f9ff) || // Emoji / Misc Symbols
    (code >= 0x20000 && code <= 0x2a6df) || // CJK Extension B
    (code >= 0x2a700 && code <= 0x2ceaf)    // CJK Extension C-E
  ) return 2;
  return 1;
}

function wrapText(text: string, maxW: number): string[] {
  if (maxW <= 0) return [text];
  const result: string[] = [];
  // Process word by word to avoid splitting mid-word where possible
  const words = text.split(' ');
  let currentLine = '';
  let currentW = 0;

  for (const word of words) {
    // Measure word display width
    let wordW = 0;
    for (const ch of [...word]) wordW += displayWidth(ch);

    if (currentW === 0) {
      // Start of a new line — if word itself exceeds maxW, hard-break it
      if (wordW > maxW) {
        let chunk = '';
        let chunkW = 0;
        for (const ch of [...word]) {
          const cw = displayWidth(ch);
          if (chunkW + cw > maxW) {
            result.push(chunk);
            chunk = '';
            chunkW = 0;
          }
          chunk += ch;
          chunkW += cw;
        }
        currentLine = chunk;
        currentW = chunkW;
      } else {
        currentLine = word;
        currentW = wordW;
      }
    } else {
      // Try appending " word" to current line
      const spaceW = 1;
      if (currentW + spaceW + wordW <= maxW) {
        currentLine += ' ' + word;
        currentW += spaceW + wordW;
      } else {
        result.push(currentLine);
        // If word itself exceeds maxW, hard-break it
        if (wordW > maxW) {
          let chunk = '';
          let chunkW = 0;
          for (const ch of [...word]) {
            const cw = displayWidth(ch);
            if (chunkW + cw > maxW) {
              result.push(chunk);
              chunk = '';
              chunkW = 0;
            }
            chunk += ch;
            chunkW += cw;
          }
          currentLine = chunk;
          currentW = chunkW;
        } else {
          currentLine = word;
          currentW = wordW;
        }
      }
    }
  }
  result.push(currentLine);
  return result;
}

// ─── Isolated input component ──────────────────────────────────────────────────
interface ChatInputProps {
  isActive: boolean;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onScroll: (dir: number) => void;
}

const ChatInput = memo(function ChatInput({ isActive, isStreaming, onSend, onScroll }: ChatInputProps) {
  const [input, setInput] = useState('');

  useInput((ch, key) => {
    if (!isActive) return;

    if (key.pageUp)   { onScroll(15);  return; }
    if (key.pageDown) { onScroll(-15); return; }

    if (isStreaming) return;

    if (key.return) {
      if (!input.trim()) return;
      onSend(input.trim());
      setInput('');
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (ch && !key.ctrl && !key.meta && ch.length === 1 && ch.charCodeAt(0) >= 32) {
      setInput((prev) => prev + ch);
    }
  });

  // Single flat <Text> — NO child <Box> elements.
  // Multiple sibling <Box>es inside a row Box can cause Yoga to miscalculate
  // height when the content changes, which manifests as a 1-row layout bounce.
  return (
    <Box
      borderStyle="single"
      borderColor={isActive ? 'cyan' : 'gray'}
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text>
        <Text color="cyan">{'› '}</Text>
        {isStreaming ? (
          <Text color="gray">Generating…</Text>
        ) : (
          <>
            <Text color={input ? 'white' : undefined} dimColor={!input}>
              {input || 'Type a message…'}
            </Text>
            {isActive ? <Text color="white">█</Text> : null}
          </>
        )}
      </Text>
    </Box>
  );
});

// ─── Message list ──────────────────────────────────────────────────────────────
interface MessageListProps {
  messages: TuiMessage[];
  isStreaming: boolean;
  maxWidth: number;
  maxLines: number;
  scrollOffset: number;
}

interface RenderLine {
  id: string;
  msg: TuiMessage;
  text: string;
  isFirstLine: boolean;
  isStats?: boolean;
}

const PREFIX_W = 6; // "You │ " or "AI  │ " — 6 chars wide

const MessageList = memo(function MessageList({ messages, isStreaming, maxWidth, maxLines, scrollOffset }: MessageListProps) {
  const textW = Math.max(maxWidth - PREFIX_W, 20);

  // Build a flat array of physical lines — pre-wrapped so Ink knows exact count.
  const allLines: RenderLine[] = [];

  for (const msg of messages) {
    const logicalLines = msg.content.split('\n');

    logicalLines.forEach((logical, li) => {
      // Wrap each logical line into 1+ physical lines
      const physical = wrapText(logical, textW);
      physical.forEach((physLine, pi) => {
        allLines.push({
          id: `${msg.id}-${li}-${pi}`,
          msg,
          text: physLine,
          isFirstLine: li === 0 && pi === 0,
        });
      });
    });

    if (msg.stats) {
      allLines.push({
        id: `${msg.id}-stats`,
        msg,
        text: `${msg.stats.tokensPerSecond.toFixed(1)} tok/s · ${msg.stats.totalTokens} tokens`,
        isFirstLine: false,
        isStats: true,
      });
    }

    // Blank spacer between messages
    allLines.push({ id: `${msg.id}-sep`, msg, text: '', isFirstLine: false });
  }

  // Viewport: show EXACTLY maxLines to prevent Ink flex-end overflow bugs
  const count = maxLines;
  const maxScroll = Math.max(0, allLines.length - count);
  const actualOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
  const start = Math.max(0, allLines.length - count - actualOffset);
  const end   = allLines.length - actualOffset;
  const visibleLines = allLines.slice(start, end);

  const lastId = allLines[allLines.length - 1]?.id;

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      <Box flexDirection="column" justifyContent="flex-end" flexGrow={1}>
        {visibleLines.map((line) => {
          const color = MSG_COLORS[line.msg.role] ?? 'white';
          const prefix =
            line.msg.role === 'user'      ? 'You │ ' :
            line.msg.role === 'assistant' ? 'AI  │ ' :
                                           '─── ';

          // Streaming cursor: inline on the last physical line, no extra Box row
          const showCursor = isStreaming && scrollOffset === 0 && line.id === lastId;

          return (
            <Box key={line.id}>
              {line.isFirstLine ? (
                <Text color={color} bold={line.msg.role === 'user'}>{prefix}</Text>
              ) : (
                <Text>{'      '}</Text>
              )}
              {/* No wrap="wrap" — text is already pre-wrapped above */}
              {line.isStats ? (
                <Text dimColor>{line.text}</Text>
              ) : (
                <Text
                  color={line.msg.role === 'system' ? 'yellow' : color}
                  dimColor={line.msg.role === 'system'}
                >
                  {line.text}{showCursor ? ' ▌' : ''}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});

// ─── ChatPanel ─────────────────────────────────────────────────────────────────
const ChatPanel = memo(function ChatPanel({
  messages, isStreaming, isActive, onSend, mode, width, height,
}: Props) {
  const borderColor = isActive ? 'magenta' : 'gray';
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setScrollOffset(0);
  }, [messages.length]);

  const handleScroll = useCallback((delta: number) => {
    setScrollOffset((prev) => Math.max(0, prev + delta));
  }, []);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="magenta">CONVERSATION</Text>
        <Text dimColor>  {MODE_HINTS[mode]}</Text>
        {scrollOffset > 0 && <Text color="yellow">  (scrolled — PgDn to bottom)</Text>}
      </Box>

      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        maxWidth={width - 4}
        maxLines={Math.max(10, height - 6)}
        scrollOffset={scrollOffset}
      />

      <ChatInput
        isActive={isActive}
        isStreaming={isStreaming}
        onSend={onSend}
        onScroll={handleScroll}
      />
    </Box>
  );
});

export default ChatPanel;
