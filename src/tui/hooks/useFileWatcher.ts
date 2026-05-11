/**
 * useFileWatcher — React hook that watches ./uploads/ for file changes
 */
import { useState, useEffect } from 'react';
import chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { detectFileType, type FileCategory } from '../../utils/fileDetect.js';

export interface FileEntry {
  name: string;
  path: string;
  category: FileCategory;
  size: number;
}

const UPLOADS_DIR = path.resolve('./uploads');

function scanUploads(): FileEntry[] {
  const entries: FileEntry[] = [];
  const subdirs = ['images', 'audio', 'docs'];
  for (const sub of subdirs) {
    const dir = path.join(UPLOADS_DIR, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const fullPath = path.join(dir, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          entries.push({
            name: f,
            path: fullPath,
            category: detectFileType(fullPath),
            size: stat.size,
          });
        }
      } catch {}
    }
  }
  return entries;
}

export function useFileWatcher(): FileEntry[] {
  const [files, setFiles] = useState<FileEntry[]>(scanUploads);

  useEffect(() => {
    const watcher = chokidar.watch(UPLOADS_DIR, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
      depth: 2,
    });

    const refresh = () => setFiles(scanUploads());
    watcher.on('add', refresh).on('unlink', refresh).on('change', refresh);

    return () => { watcher.close(); };
  }, []);

  return files;
}
