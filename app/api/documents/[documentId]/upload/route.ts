import { NextResponse } from 'next/server';

import { writeUploadedDocument } from '@/lib/document/upload';

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { documentId } = await context.params;
  const formData = await request.formData();
  const file = formData.get('file');
  const roomName = formData.get('roomName');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file upload is required.' }, { status: 400 });
  }

  if (typeof roomName !== 'string' || roomName.length === 0) {
    return NextResponse.json({ error: 'A roomName field is required.' }, { status: 400 });
  }

  const record = await writeUploadedDocument({
    bytes: await file.arrayBuffer(),
    documentId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    roomName,
  });

  return NextResponse.json({
    chunkCount: record.chunkCount,
    documentId: record.id,
    fileName: record.fileName,
    fileType: record.fileType,
    ingestionAttempts: record.ingestionAttempts,
    ingestionStatus: record.ingestionStatus,
    roomName: record.roomName,
  });
}
