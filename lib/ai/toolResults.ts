import type { VoiceToolResultEvent } from '@/lib/ai/types';
import type { SharedScreenOverlayCard } from '@/lib/overlay/types';

type StockQuoteToolResult = {
  kind: 'stock_quote';
  symbol: string;
  companyName?: string;
  price: number;
  change?: number | null;
  changePercent?: string | null;
  currency?: string;
  latestTradingDay?: string | null;
  source: string;
  summary: string;
};

type StockTimeSeriesPoint = {
  label: string;
  value: number;
};

type StockTimeSeriesToolResult = {
  kind: 'stock_time_series';
  symbol: string;
  companyName?: string;
  window: '1d' | '5d' | '1m';
  latestPrice: number;
  previousClose: number;
  absoluteChange: number;
  percentChange: string;
  currency?: string;
  latestTradingDay?: string | null;
  source: string;
  summary: string;
  points: StockTimeSeriesPoint[];
};

export type VoiceOverlayRequest = Omit<SharedScreenOverlayCard, 'surfaceId'>;

function formatPrice(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function parseStockQuotePayload(result: string) {
  try {
    const parsed = JSON.parse(result) as StockQuoteToolResult;

    if (
      parsed.kind !== 'stock_quote' ||
      typeof parsed.symbol !== 'string' ||
      typeof parsed.price !== 'number' ||
      typeof parsed.summary !== 'string' ||
      typeof parsed.source !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function parseStockTimeSeriesPayload(result: string) {
  try {
    const parsed = JSON.parse(result) as StockTimeSeriesToolResult;

    if (
      parsed.kind !== 'stock_time_series' ||
      typeof parsed.symbol !== 'string' ||
      typeof parsed.latestPrice !== 'number' ||
      typeof parsed.previousClose !== 'number' ||
      typeof parsed.absoluteChange !== 'number' ||
      typeof parsed.percentChange !== 'string' ||
      typeof parsed.summary !== 'string' ||
      typeof parsed.source !== 'string' ||
      !Array.isArray(parsed.points)
    ) {
      return null;
    }

    const points = parsed.points.filter(
      (point): point is StockTimeSeriesPoint =>
        typeof point?.label === 'string' && typeof point?.value === 'number',
    );

    if (points.length < 2) {
      return null;
    }

    return {
      ...parsed,
      points,
    };
  } catch {
    return null;
  }
}

export function parseVoiceOverlayRequest(event: VoiceToolResultEvent): VoiceOverlayRequest | null {
  if (event.name === 'get_stock_quote') {
    const stock = parseStockQuotePayload(event.result);

    if (!stock) {
      return null;
    }

    const directionLabel =
      typeof stock.change === 'number'
        ? stock.change > 0
          ? 'Up'
          : stock.change < 0
            ? 'Down'
            : 'Flat'
        : 'Move';

    return {
      id: `${event.toolCallId || event.sessionId}:${event.ts}:stock_quote`,
      kind: 'stock_quote',
      title: `${stock.symbol} Stock Data`,
      subtitle: stock.companyName ?? 'Live market snapshot',
      body: stock.summary,
      source: stock.source,
      createdAt: new Date(event.ts).toISOString(),
      metrics: [
        {
          label: 'Price',
          value: formatPrice(stock.price, stock.currency ?? 'USD'),
        },
        {
          label: directionLabel,
          value:
            typeof stock.change === 'number'
              ? `${stock.change > 0 ? '+' : ''}${stock.change.toFixed(2)}${
                  stock.changePercent ? ` (${stock.changePercent})` : ''
                }`
              : stock.changePercent ?? 'Unavailable',
        },
        {
          label: 'Currency',
          value: stock.currency ?? 'USD',
        },
        {
          label: 'Trading Day',
          value: stock.latestTradingDay ?? 'Unavailable',
        },
      ],
    };
  }

  if (event.name === 'get_stock_time_series') {
    const series = parseStockTimeSeriesPayload(event.result);

    if (!series) {
      return null;
    }

    return {
      id: `${event.toolCallId || event.sessionId}:${event.ts}:stock_time_series`,
      kind: 'stock_time_series',
      title: `${series.symbol} ${series.window.toUpperCase()} Trend`,
      subtitle: series.companyName ?? 'Recent price action',
      body: series.summary,
      source: series.source,
      createdAt: new Date(event.ts).toISOString(),
      metrics: [
        {
          label: 'Latest',
          value: formatPrice(series.latestPrice, series.currency ?? 'USD'),
        },
        {
          label: 'Change',
          value: `${series.absoluteChange > 0 ? '+' : ''}${series.absoluteChange.toFixed(2)} (${series.percentChange})`,
        },
        {
          label: 'Window',
          value: series.window.toUpperCase(),
        },
        {
          label: 'Trading Day',
          value: series.latestTradingDay ?? 'Unavailable',
        },
      ],
      chart: {
        seriesLabel: `${series.window.toUpperCase()} price series`,
        points: series.points,
      },
    };
  }

  return null;
}

export function summarizeDocumentToolResult(result: string) {
  try {
    const parsed = JSON.parse(result) as {
      documentId?: string;
      fileName?: string;
      results?: Array<{ page?: number; text?: string; score?: number }>;
    };

    if (!Array.isArray(parsed.results)) {
      return null;
    }

    return {
      documentId: parsed.documentId ?? '',
      fileName: parsed.fileName ?? '',
      matchCount: parsed.results.length,
      pageNumbers: parsed.results
        .map((result) => result.page)
        .filter((page): page is number => typeof page === 'number')
        .map((page) => formatNumber(page)),
    };
  } catch {
    return null;
  }
}
