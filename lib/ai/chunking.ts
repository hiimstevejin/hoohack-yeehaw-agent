import type { DocumentChunkRecord } from './types';

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 180;
const EMBEDDING_DIMENSIONS = 64;
const TOKEN_PATTERN = /[a-z0-9]{2,}/g;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function hashToken(token: string) {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

export function tokenizeText(value: string) {
  return value.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

export function createTextEmbedding(value: string) {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const tokens = tokenizeText(value);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const hash = hashToken(token);
    const slot = hash % EMBEDDING_DIMENSIONS;
    vector[slot] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, entry) => sum + entry * entry, 0));

  if (!magnitude) {
    return vector;
  }

  return vector.map((entry) => Number((entry / magnitude).toFixed(6)));
}

export function createChunksFromPageText(pageText: string, pageNumber: number) {
  const normalized = normalizeWhitespace(pageText);

  if (!normalized) {
    return [] as DocumentChunkRecord[];
  }

  const chunks: DocumentChunkRecord[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < normalized.length) {
    const maxEnd = Math.min(normalized.length, startIndex + CHUNK_SIZE);
    let endIndex = maxEnd;

    if (maxEnd < normalized.length) {
      const nextBoundary = normalized.lastIndexOf(' ', maxEnd);

      if (nextBoundary > startIndex + Math.floor(CHUNK_SIZE * 0.6)) {
        endIndex = nextBoundary;
      }
    }

    const text = normalized.slice(startIndex, endIndex).trim();

    if (text) {
      chunks.push({
        chunkIndex,
        embedding: createTextEmbedding(text),
        metadata: {
          page: pageNumber,
          startOffset: startIndex,
          endOffset: endIndex,
          tokenCount: tokenizeText(text).length,
        },
        text,
      });
      chunkIndex += 1;
    }

    if (endIndex >= normalized.length) {
      break;
    }

    startIndex = Math.max(endIndex - CHUNK_OVERLAP, startIndex + 1);
  }

  return chunks;
}
