const NEWSDATA_BASE_URL = 'https://newsdata.io/api/1/latest';

type LookupNewsArgs = {
  symbol?: string;
  companyName?: string;
  query?: string;
};

type NewsDataResult = {
  title?: string;
  link?: string;
  image_url?: string | null;
  description?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  pubDate?: string | null;
};

type NewsDataResponse = {
  results?: NewsDataResult[];
};

function getNewsDataApiKey() {
  const apiKey =
    process.env.NEWSDATA_API_KEY ??
    process.env.NEWSDATAIO_API_KEY ??
    process.env.NEWDATA_API_KEY ??
    '';

  if (!apiKey) {
    throw new Error('NewsData.io API key is required.');
  }

  return apiKey;
}

function buildNewsQuery({ symbol, companyName, query }: LookupNewsArgs) {
  const parts = [companyName, symbol, query]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    throw new Error('A query, ticker symbol, or company name is required for news lookup.');
  }

  return parts.join(' ');
}

async function fetchNewsData(query: string) {
  const url = new URL(NEWSDATA_BASE_URL);
  url.searchParams.set('apikey', getNewsDataApiKey());
  url.searchParams.set('q', query);
  url.searchParams.set('language', 'en');
  url.searchParams.set('country', 'us');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`NewsData.io request failed with status ${response.status}.`);
  }

  return (await response.json()) as NewsDataResponse;
}

export async function lookupNewsArticle(args: LookupNewsArgs) {
  const resolvedQuery = buildNewsQuery(args);
  const payload = await fetchNewsData(resolvedQuery);
  const article = payload.results?.find(
    (entry) => typeof entry?.title === 'string' && typeof entry?.link === 'string',
  );

  if (!article?.title || !article.link) {
    throw new Error(`No NewsData.io article was available for ${resolvedQuery}.`);
  }

  return {
    kind: 'news_article' as const,
    query: resolvedQuery,
    title: article.title,
    link: article.link,
    image_url: article.image_url ?? null,
    description: article.description ?? null,
    source_id: article.source_id ?? null,
    source_name: article.source_name ?? null,
    pubDate: article.pubDate ?? null,
  };
}
