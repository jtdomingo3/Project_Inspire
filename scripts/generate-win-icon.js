import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourcePng = path.join(repoRoot, 'frontend', 'public', 'icon.png');
const targetIco = path.join(repoRoot, 'frontend', 'public', 'icon-taskbar.ico');
const targetSizes = [16, 24, 32, 48, 64, 128, 256];

async function ensureSourceIcon() {
  const exists = await fs.access(sourcePng).then(() => true).catch(() => false);
  if (!exists) {
    throw new Error(`Source icon not found: ${sourcePng}`);
  }
}

async function buildPngBuffers() {
  const input = sharp(sourcePng).ensureAlpha();
  const metadata = await input.metadata();
  const sourceWidth = metadata.width || 0;
  const sourceHeight = metadata.height || 0;

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Unable to read source icon dimensions.');
  }

  return Promise.all(
    targetSizes.map((size) =>
      sharp(sourcePng)
        .ensureAlpha()
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          withoutEnlargement: false
        })
        .png()
        .toBuffer()
    )
  );
}

async function main() {
  await ensureSourceIcon();
  const pngBuffers = await buildPngBuffers();
  const icoBuffer = await pngToIco(pngBuffers);

  await fs.writeFile(targetIco, icoBuffer);
  process.stdout.write(`Generated Windows icon: ${targetIco}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
