import { createRequire } from 'node:module';

import { createChunksFromPageText } from './chunking';
import type { DocumentChunkRecord, DocumentIngestionResult } from './types';

type LegacyPdfParseResult = {
  numpages?: number;
  text?: string;
};

type LegacyPdfParse = (
  dataBuffer: Buffer,
) => Promise<LegacyPdfParseResult>;

const require = createRequire(import.meta.url);

let pdfParsePromise: Promise<LegacyPdfParse> | null = null;

async function loadPdfParse() {
  if (!pdfParsePromise) {
    pdfParsePromise = Promise.resolve().then(() => {
      return require('pdf-parse/lib/pdf-parse.js') as LegacyPdfParse;
    });
  }

  return pdfParsePromise;
}

export async function extractDocumentChunks({
  bytes,
  fileType,
}: {
  bytes: ArrayBuffer;
  fileType: 'pdf' | 'image' | 'unsupported';
}): Promise<DocumentIngestionResult> {
  if (fileType !== 'pdf') {
    return {
      chunks: [],
      status: 'unsupported',
      statusMessage: 'Only PDF ingestion is supported in this milestone.',
    };
  }

  const pdfParse = await loadPdfParse();
  const parsed = await pdfParse(Buffer.from(bytes));

  const normalizedPages = (parsed.text ?? '')
    .split(/\n\s*\n+/)
    .map((pageText) => pageText.trim())
    .filter(Boolean);

  const chunks: DocumentChunkRecord[] = [];
  let nextChunkIndex = 0;

  normalizedPages.forEach((pageText, index) => {
    const pageNumber = index + 1;
    const pageChunks = createChunksFromPageText(pageText, pageNumber).map((chunk) => ({
      ...chunk,
      chunkIndex: nextChunkIndex + chunk.chunkIndex,
    }));

    nextChunkIndex += pageChunks.length;
    chunks.push(...pageChunks);
  });

  if (chunks.length === 0) {
    return {
      chunks: [],
      status: 'failed',
      statusMessage: 'No extractable text was found in the uploaded PDF.',
    };
  }

  return {
    chunks,
    status: 'ready',
    statusMessage: null,
  };
}
