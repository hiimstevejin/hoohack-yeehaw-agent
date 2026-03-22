function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for document retrieval.');
    }
    return {
        serviceRoleKey,
        url,
    };
}
async function supabaseSelect(path) {
    const { url, serviceRoleKey } = getSupabaseConfig();
    const response = await fetch(`${url}${path}`, {
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
        },
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    return (await response.json());
}
export async function readLatestReadyDocument(roomName) {
    const documents = await supabaseSelect(`/rest/v1/meet_documents?select=*&room_name=eq.${encodeURIComponent(roomName)}&ingestion_status=eq.ready&order=created_at.desc&limit=1`);
    const record = documents[0];
    if (!record) {
        return null;
    }
    const chunks = await supabaseSelect(`/rest/v1/meet_document_chunks?select=chunk_index,embedding,metadata,text&document_id=eq.${encodeURIComponent(record.id)}&order=chunk_index.asc`);
    return {
        record: {
            id: record.id,
            createdAt: record.created_at,
            roomName: record.room_name,
            fileName: record.file_name,
            fileSize: record.file_size,
            mimeType: record.mime_type,
            fileType: record.file_type,
            storageBucket: record.storage_bucket,
            storageObjectPath: record.storage_object_path,
            ingestionStatus: record.ingestion_status,
            ingestionError: record.ingestion_error,
            chunkCount: record.chunk_count,
            ingestedAt: record.ingested_at,
            ingestionAttempts: record.ingestion_attempts,
            lastIngestionAttemptAt: record.last_ingestion_attempt_at,
        },
        chunks: chunks.map((chunk) => ({
            chunkIndex: chunk.chunk_index,
            embedding: chunk.embedding,
            metadata: chunk.metadata,
            text: chunk.text,
        })),
    };
}
