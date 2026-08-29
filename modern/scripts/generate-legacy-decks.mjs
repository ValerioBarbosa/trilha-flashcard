import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const modernRoot = path.resolve(here, '..');
const sourcePath = path.resolve(modernRoot, '..', 'decks.js');
const outputDir = path.resolve(modernRoot, 'src', 'generated');
const outputPath = path.join(outputDir, 'legacy-decks.json');

const source = await fs.readFile(sourcePath, 'utf8');
const sandbox = { __decks: [] };
vm.createContext(sandbox);
vm.runInContext(`${source}\n;globalThis.__decks = trt4Decks;`, sandbox, { filename: sourcePath });

if (!Array.isArray(sandbox.__decks)) {
  throw new Error('legacy-decks-not-found');
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(sandbox.__decks, null, 2)}\n`, 'utf8');
console.log(`Generated ${sandbox.__decks.length} legacy decks -> ${path.relative(modernRoot, outputPath)}`);
