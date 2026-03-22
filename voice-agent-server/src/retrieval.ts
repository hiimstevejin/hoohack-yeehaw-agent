type DocumentChunkRecord = {
  chunkIndex: number;
  embedding: number[];
  metadata: {
    page: number;
    startOffset: number;
    endOffset: number;
    tokenCount: number;
  };
  text: string;
};

const EMBEDDING_DIMENSIONS = 64;
const TOKEN_PATTERN = /[a-z0-9]{2,}/g;

function tokenizeText(value: string) {
  return value.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

function hashToken(token: string) {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
}

export function createTextEmbedding(value: string) {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const tokens = tokenizeText(value);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const slot = hashToken(token) % EMBEDDING_DIMENSIONS;
    vector[slot] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, entry) => sum + entry * entry, 0));

  if (!magnitude) {
    return vector;
  }

  return vector.map((entry) => entry / magnitude);
}

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let total = 0;

  for (let index = 0; index < length; index += 1) {
    total += left[index]! * right[index]!;
  }

  return total;
}

export function rankDocumentChunks(chunks: DocumentChunkRecord[], query: string, limit = 4) {
  const queryEmbedding = createTextEmbedding(query);

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: Number(cosineSimilarity(queryEmbedding, chunk.embedding).toFixed(4)),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
