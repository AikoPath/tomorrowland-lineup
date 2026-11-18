import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_WORKER_URL } from '../urls.ts';

/** The URL of a file in the build output. A page URL ends with a slash, as in src/urls.ts. */
export function buildFileUrl(file: string): string {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

/** A new cache name for each change to a file, so the phone gets the new files. */
export function cacheName(files: { file: string; content: Buffer }[]): string {
  const hash = createHash('sha256');
  for (const { file, content } of files) {
    hash.update(file);
    hash.update(content);
  }
  return `lineup-${hash.digest('hex').slice(0, 12)}`;
}

/** Write the service worker into the build output, with the URLs of all other files in the output. */
export async function writeServiceWorker(outDir: URL, root: URL): Promise<void> {
  const outPath = fileURLToPath(outDir);
  const serviceWorkerFile = SERVICE_WORKER_URL.slice(1);
  const entries = await readdir(outPath, { recursive: true, withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(outPath, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .filter((file) => file !== serviceWorkerFile)
    .sort();
  const files = await Promise.all(
    fileNames.map(async (file) => ({ file, content: await readFile(path.join(outPath, file)) })),
  );
  const code = await readFile(new URL('src/pwa/sw.js', root));

  await writeFile(
    path.join(outPath, serviceWorkerFile),
    `const CACHE_NAME = ${JSON.stringify(cacheName([...files, { file: serviceWorkerFile, content: code }]))};\n` +
      `const PRECACHE_URLS = ${JSON.stringify(fileNames.map(buildFileUrl))};\n\n` +
      code,
  );
}
