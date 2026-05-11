/**
 * FilePanel — Left panel showing the uploads/ directory browser
 */
import React, { useState, memo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { FileEntry } from '../hooks/useFileWatcher.js';
import { fileTypeColor, fileTypeIcon } from '../../utils/fileDetect.js';
import { fmtBytes, truncate } from '../../utils/format.js';

interface Props {
  files: FileEntry[];
  isActive: boolean;
  selectedFile: string | null;
  onSelect: (path: string) => void;
  width: number;
  height: number;
}

const FilePanel = memo(function FilePanel({ files, isActive, selectedFile, onSelect, width, height }: Props) {
  const [cursor, setCursor] = useState(0);
  const maxName = Math.max(width - 12, 10);

  useInput((_, key) => {
    if (!isActive) return;
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(files.length - 1, c + 1));
    if (key.return && files[cursor]) onSelect(files[cursor].path);
  });

  const borderColor = isActive ? 'cyan' : 'gray';

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
        <Text bold color="cyan">FILES</Text>
        {isActive && <Text dimColor>  ↑↓ Enter</Text>}
      </Box>

      <Box flexDirection="column" height={Math.max(height - 7, 5)} overflow="hidden">
        {files.length === 0 ? (
          <Box flexDirection="column" paddingY={1}>
            <Text dimColor>No files yet.</Text>
            <Text dimColor>Drop files into:</Text>
            <Text dimColor>  uploads/images/</Text>
            <Text dimColor>  uploads/audio/</Text>
            <Text dimColor>  uploads/docs/</Text>
          </Box>
        ) : (
          files.map((f, i) => {
            const isCursor = i === cursor;
            const isSelected = f.path === selectedFile;
            const color = fileTypeColor(f.category);
            const icon = fileTypeIcon(f.category);

            return (
              <Box key={f.path}>
                <Text color={isCursor ? 'white' : 'gray'} bold={isCursor}>
                  {isCursor ? '▶ ' : '  '}
                </Text>
                <Text color={isSelected ? 'yellow' : color}>
                  {icon}{truncate(f.name, maxName)}
                </Text>
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
        <Text dimColor>{files.length} file{files.length !== 1 ? 's' : ''}</Text>
      </Box>
    </Box>
  );
});

export default FilePanel;
