type SupabaseServerConfig = {
  serviceRoleKey: string;
  storageBucket: string;
  url: string;
};

type PostgrestQueryValue = string | number | boolean | null | undefined;

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required Supabase environment variable: ${name}`);
  }

  return value;
}

function getConfig(): SupabaseServerConfig {
  return {
    url: readRequiredEnv('SUPABASE_URL'),
    serviceRoleKey: readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    storageBucket: process.env.SUPABASE_DOCUMENT_BUCKET ?? 'meet-documents',
  };
}

function buildHeaders(init?: HeadersInit, contentType?: string) {
  const { serviceRoleKey } = getConfig();
  const headers = new Headers(init);

  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);

  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  return headers;
}

async function parseError(response: Response) {
  const body = await response.text();
  return body || `${response.status} ${response.statusText}`;
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const { url } = getConfig();
  const response = await fetch(`${url}${path}`, init);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response;
}

function withFilters(path: string, filters?: Record<string, PostgrestQueryValue | `eq.${string}` | `is.${string}`>) {
  if (!filters) {
    return path;
  }

  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
}

export async function supabaseSelect<T>(
  path: string,
  filters?: Record<string, PostgrestQueryValue | `eq.${string}` | `is.${string}`>,
): Promise<T> {
  const response = await supabaseFetch(withFilters(path, filters), {
    headers: buildHeaders(),
    method: 'GET',
  });
  return (await response.json()) as T;
}

export async function supabaseInsert<T>(path: string, body: unknown, prefer = 'return=representation') {
  const response = await supabaseFetch(path, {
    method: 'POST',
    headers: buildHeaders(
      {
        Prefer: prefer,
      },
      'application/json',
    ),
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

export async function supabasePatch<T>(
  path: string,
  body: unknown,
  filters: Record<string, PostgrestQueryValue | `eq.${string}` | `is.${string}`>,
  prefer = 'return=representation',
) {
  const response = await supabaseFetch(withFilters(path, filters), {
    method: 'PATCH',
    headers: buildHeaders(
      {
        Prefer: prefer,
      },
      'application/json',
    ),
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

export async function supabaseDelete(
  path: string,
  filters: Record<string, PostgrestQueryValue | `eq.${string}` | `is.${string}`>,
) {
  await supabaseFetch(withFilters(path, filters), {
    method: 'DELETE',
    headers: buildHeaders(),
  });
}

function encodeStoragePath(path: string) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function uploadStorageObject(params: {
  body: ArrayBuffer | Uint8Array;
  contentType: string;
  objectPath: string;
  upsert?: boolean;
}) {
  const { storageBucket } = getConfig();

  await supabaseFetch(`/storage/v1/object/${encodeURIComponent(storageBucket)}/${encodeStoragePath(params.objectPath)}`, {
    method: 'POST',
    headers: buildHeaders(
      {
        'x-upsert': params.upsert ? 'true' : 'false',
      },
      params.contentType,
    ),
    body: Buffer.from(params.body instanceof Uint8Array ? params.body : new Uint8Array(params.body)),
  });
}

export async function downloadStorageObject(objectPath: string) {
  const { storageBucket } = getConfig();
  const response = await supabaseFetch(
    `/storage/v1/object/${encodeURIComponent(storageBucket)}/${encodeStoragePath(objectPath)}`,
    {
      method: 'GET',
      headers: buildHeaders(),
    },
  );
  return response.arrayBuffer();
}
