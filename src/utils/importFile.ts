import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { detectFileType } from './fileDetect.js';

/**
 * Imports an external file into the workspace uploads/ directory.
 * Automatically handles Windows paths if running under WSL.
 * @returns The absolute path of the copied file inside the workspace.
 */
export function importFileToWorkspace(sourcePath: string): string {
  let resolvedPath = sourcePath.trim();

  // Remove surrounding quotes if any
  if (resolvedPath.startsWith('"') && resolvedPath.endsWith('"')) {
    resolvedPath = resolvedPath.slice(1, -1);
  }
  if (resolvedPath.startsWith("'") && resolvedPath.endsWith("'")) {
    resolvedPath = resolvedPath.slice(1, -1);
  }

  // Handle Windows paths if running in WSL
  if (resolvedPath.match(/^[a-zA-Z]:\\/) || resolvedPath.match(/^[a-zA-Z]:\//)) {
    try {
      resolvedPath = execSync(`wslpath -a "${resolvedPath}"`).toString().trim();
    } catch (e) {
      throw new Error('Failed to convert Windows path to WSL path');
    }
  }

  // Expand ~ to homedir
  if (resolvedPath.startsWith('~/')) {
    resolvedPath = path.join(os.homedir(), resolvedPath.slice(2));
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${resolvedPath}`);
  }

  const category = detectFileType(resolvedPath);
  const subfolder = category === 'image' ? 'images' : category === 'audio' ? 'audio' : 'docs';
  
  const targetDir = path.resolve('./uploads', subfolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const fileName = path.basename(resolvedPath);
  const targetPath = path.join(targetDir, fileName);

  fs.copyFileSync(resolvedPath, targetPath);
  return targetPath;
}
