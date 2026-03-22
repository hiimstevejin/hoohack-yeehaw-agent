'use client';

import * as React from 'react';
import type { DocumentChunkRecord, DocumentIngestionStatus } from '@/lib/ai/types';

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function DocumentUploadForm(props: { roomName: string }) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [documentState, setDocumentState] = React.useState<{
    chunkCount: number;
    chunks: DocumentChunkRecord[];
    createdAt?: string;
    documentId: string;
    fileName: string;
    fileSize?: number;
    fileType: string;
    ingestedAt?: string | null;
    ingestionAttempts?: number;
    ingestionError: string | null;
    ingestionStatus: DocumentIngestionStatus;
    lastIngestionAttemptAt?: string | null;
    roomName?: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadLatestDocument() {
      try {
        const response = await fetch(
          `/api/documents/latest?roomName=${encodeURIComponent(props.roomName)}`,
        );
        const payload = (await response.json()) as {
          document?: typeof documentState;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load latest document state.');
        }

        if (!cancelled) {
          setDocumentState(payload.document ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load latest document state.',
          );
        }
      }
    }

    void loadLatestDocument();

    return () => {
      cancelled = true;
    };
  }, [props.roomName]);

  async function handleUploadAndIngest() {
    if (!selectedFile) {
      setError('Choose a file before uploading.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const documentId = crypto.randomUUID();
      const formData = new FormData();
      formData.set('file', selectedFile);
      formData.set('roomName', props.roomName);

      const uploadResponse = await fetch(`/api/documents/${documentId}/upload`, {
        method: 'POST',
        body: formData,
      });
      const uploadPayload = (await uploadResponse.json()) as {
        error?: string;
      };

      if (!uploadResponse.ok) {
        throw new Error(uploadPayload.error ?? 'Document upload failed.');
      }

      const ingestionResponse = await fetch(`/api/documents/${documentId}/ingest`, {
        method: 'POST',
      });
      const ingestionPayload = (await ingestionResponse.json()) as {
        error?: string;
        ingestionStatus?: DocumentIngestionStatus;
      };

      if (!ingestionResponse.ok && ingestionResponse.status !== 422) {
        throw new Error(ingestionPayload.error ?? 'Document ingestion failed.');
      }

      const statusResponse = await fetch(`/api/documents/${documentId}`);
      const statusPayload = (await statusResponse.json()) as typeof documentState;

      if (!statusResponse.ok || !statusPayload) {
        throw new Error('Unable to read document ingestion status.');
      }

      setDocumentState(statusPayload);
      setError(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Document upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section
      style={{
        border: '1px solid rgba(255, 240, 214, 0.08)',
        borderRadius: '18px',
        background:
          'linear-gradient(180deg, rgba(88, 66, 49, 0.4) 0%, rgba(45, 32, 23, 0.42) 100%)',
        padding: '0.85rem',
        boxShadow: 'inset 0 1px 0 rgba(255, 245, 225, 0.04)',
        overflow: 'visible',
        display: 'grid',
        gap: '0.75rem',
        minHeight: 0,
      }}
    >
      {/*<div style={{ display: 'grid', gap: '0.35rem' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '0.95rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.78,
          }}
        >
          Shared File
        </h2>
      </div>*/}

      <label
        style={{
          display: 'grid',
          gap: '0.55rem',
          padding: '0.85rem',
          borderRadius: '14px',
          border: '1px dashed rgba(243, 209, 155, 0.18)',
          background: 'rgba(255, 248, 230, 0.03)',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '0.83rem', color: 'rgba(255, 240, 214, 0.82)' }}>
          Choose PDF, image, or meeting file
        </span>
        <input
          type="file"
          accept=".pdf,image/*,.doc,.docx,.ppt,.pptx,.txt"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
          }}
          style={{
            width: '100%',
            fontSize: '0.8rem',
            color: 'rgba(255, 240, 214, 0.68)',
          }}
        />
      </label>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void handleUploadAndIngest()}
          disabled={!selectedFile || isUploading}
          style={{
            borderRadius: '999px',
            border: '1px solid rgba(255, 248, 230, 0.12)',
            background: isUploading
              ? 'rgba(255, 248, 230, 0.12)'
              : 'linear-gradient(180deg, #dbbf81 0%, #c8a763 100%)',
            color: '#1f160e',
            padding: '0.55rem 0.88rem',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {isUploading ? 'Uploading...' : 'Upload + Ingest'}
        </button>
      </div>

      {error ? (
        <p
          style={{
            margin: 0,
            color: '#ffb4a0',
            lineHeight: 1.45,
            fontSize: '0.82rem',
          }}
        >
          {error}
        </p>
      ) : null}

      {documentState ? (
        <div
          style={{
            display: 'grid',
            gap: '0.65rem',
            borderRadius: '14px',
            padding: '0.8rem',
            background:
              documentState.ingestionStatus === 'ready'
                ? 'rgba(110, 191, 148, 0.1)'
                : 'rgba(255, 248, 230, 0.03)',
            border:
              documentState.ingestionStatus === 'ready'
                ? '1px solid rgba(110, 191, 148, 0.26)'
                : '1px solid rgba(255, 240, 214, 0.08)',
            color: 'rgba(255, 240, 214, 0.82)',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <strong style={{ fontSize: '0.88rem' }}>Ingestion Result</strong>
            <div style={{ color: 'rgba(255, 240, 214, 0.68)' }}>
              {documentState.ingestionStatus === 'ready'
                ? 'The uploaded file was ingested successfully.'
                : 'The upload completed, but ingestion did not return extracted PDF chunks.'}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.45rem',
              padding: '0.72rem',
              borderRadius: '12px',
              background: 'rgba(20, 14, 10, 0.3)',
            }}
          >
            <div style={{ overflowWrap: 'anywhere' }}>
              <strong>Document ID:</strong> {documentState.documentId}
            </div>
            <div style={{ overflowWrap: 'anywhere' }}>
              <strong>Uploaded file:</strong> {documentState.fileName}
            </div>
            <div>
              <strong>File type:</strong> {documentState.fileType}
            </div>
            <div>
              <strong>Chunk count:</strong> {documentState.chunkCount}
            </div>
            <div>
              <strong>Ingestion attempts:</strong> {documentState.ingestionAttempts ?? 0}
            </div>
            <div>
              <strong>Processed at:</strong> {documentState.ingestedAt ?? 'Not completed'}
            </div>
            <div>
              <strong>Last attempt:</strong>{' '}
              {documentState.lastIngestionAttemptAt ?? 'Not attempted'}
            </div>
            <div style={{ overflowWrap: 'anywhere' }}>
              <strong>Ingestion error:</strong> {documentState.ingestionError ?? 'None'}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.35rem',
            }}
          >
            <strong>Chunk preview</strong>
            <div
              style={{
                maxHeight: '128px',
                overflow: 'auto',
                borderRadius: '12px',
                padding: '0.72rem',
                background: 'rgba(20, 14, 10, 0.3)',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {documentState.chunks[0]?.text ?? 'No extracted text'}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
