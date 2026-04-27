import fs from 'node:fs/promises';
import path from 'node:path';

import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

import { referencesDir } from './config.js';

function chunkText(text, maxChars = 1800, overlap = 300) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + maxChars);
    const chunk = text.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start += Math.max(1, maxChars - overlap);
  }

  return chunks;
}

async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  return parsed.text || '';
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

export async function scanReferenceFiles() {
  try {
    const entries = await fs.readdir(referencesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /\.(pdf|docx)$/i.test(name))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function extractReferenceText(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.pdf') {
    return extractPdfText(filePath);
  }

  if (extension === '.docx') {
    return extractDocxText(filePath);
  }

  return '';
}

function scoreChunk(chunk, query) {
  const queryTerms = new Set(query.toLowerCase().match(/\w+/g) || []);
  if (!queryTerms.size) {
    return 0;
  }

  const lower = chunk.content.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (lower.includes(term)) {
      score += 1;
    }
  }
  return score;
}

function selectRelevantChunks(query, chunks, topN = 4) {
  const scored = chunks
    .map((chunk) => ({ score: scoreChunk(chunk, query), chunk }))
    .sort((left, right) => right.score - left.score);

  return scored.filter((entry) => entry.score > 0).slice(0, topN).map((entry) => entry.chunk);
}

export async function loadReferenceChunks(selectedSources = null) {
  const availableFiles = await scanReferenceFiles();
  const selected = Array.isArray(selectedSources)
    ? availableFiles.filter((name) => selectedSources.includes(name))
    : availableFiles;

  const chunks = [];

  for (const fileName of selected) {
    const filePath = path.join(referencesDir, fileName);

    let text = '';
    try {
      text = await extractReferenceText(filePath);
    } catch {
      continue;
    }

    if (!text.trim()) {
      continue;
    }

    const fileChunks = chunkText(text).map((content, index) => ({
      source: fileName,
      index: index + 1,
      content
    }));
    chunks.push(...fileChunks);
  }

  return chunks;
}

export function buildReferenceContext(chunks) {
  return chunks
    .map((chunk) => `[${chunk.source} - part ${chunk.index}]:\n${chunk.content}`)
    .join('\n\n');
}

export function findRelevantChunks(query, chunks, topN = 3) {
  if (!query || !chunks.length) {
    return [];
  }

  return selectRelevantChunks(query, chunks, topN);
}

export async function loadReferenceTextByFileName(fileName) {
  const safeName = String(fileName || '').replace(/[\\/]/g, '').trim();
  if (!safeName || !/\.(pdf|docx)$/i.test(safeName)) {
    return '';
  }

  const filePath = path.join(referencesDir, safeName);
  return extractReferenceText(filePath);
}