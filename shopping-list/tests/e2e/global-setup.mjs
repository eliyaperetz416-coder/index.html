import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default async function globalSetup() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  mkdirSync(path.join(dir, '.cache'), { recursive: true });
  await build({
    entryPoints: [path.join(dir, 'fb-entry.js')],
    outfile: path.join(dir, '.cache/fb-all.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    logLevel: 'warning',
  });
}
