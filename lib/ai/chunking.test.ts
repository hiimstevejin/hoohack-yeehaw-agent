import { describe, expect, it } from 'vitest';

import { createChunksFromPageText, createTextEmbedding } from './chunking';

describe('ai chunking', () => {
  it('creates deterministic embeddings', () => {
    expect(createTextEmbedding('Revenue growth expanded this quarter')).toEqual(
      createTextEmbedding('Revenue growth expanded this quarter'),
    );
  });

  it('creates chunks with page metadata', () => {
    const chunks = createChunksFromPageText(
      'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.',
      3,
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.metadata.page).toBe(3);
    expect(chunks[0]?.metadata.tokenCount).toBeGreaterThan(0);
  });
});
