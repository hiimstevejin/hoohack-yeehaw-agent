import { describe, expect, it } from 'vitest';

import { inferDocumentFileType } from './upload';

describe('document upload helpers', () => {
  it('detects pdf uploads', () => {
    expect(inferDocumentFileType('application/pdf', 'quarterly-review.pdf')).toBe('pdf');
  });

  it('marks images as unsupported for ingestion in this milestone', () => {
    expect(inferDocumentFileType('image/png', 'screenshot.png')).toBe('image');
  });

  it('marks other file types as unsupported', () => {
    expect(inferDocumentFileType('text/plain', 'notes.txt')).toBe('unsupported');
  });
});
