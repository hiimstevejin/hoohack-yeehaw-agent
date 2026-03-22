const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
function getApiKey() {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY ?? '';
    if (!apiKey) {
        throw new Error('Alpha Vantage API key is required.');
    }
    return apiKey;
}
async function fetchAlphaVantage(params) {
    const url = new URL(ALPHA_VANTAGE_BASE_URL);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Alpha Vantage request failed with status ${response.status}.`);
    }
    return response.json();
}
async function resolveSymbol(companyName) {
    const payload = (await fetchAlphaVantage({
        function: 'SYMBOL_SEARCH',
        keywords: companyName,
        apikey: getApiKey(),
    }));
    const match = payload.bestMatches?.[0];
    if (!match?.['1. symbol']) {
        throw new Error(`No Alpha Vantage symbol match was found for ${companyName}.`);
    }
    return {
        companyName: match['2. name'] ?? companyName,
        symbol: match['1. symbol'],
    };
}
export async function lookupStockQuote({ symbol, companyName }) {
    const resolved = symbol && symbol.trim()
        ? {
            symbol: symbol.trim().toUpperCase(),
            companyName,
        }
        : companyName
            ? await resolveSymbol(companyName)
            : null;
    if (!resolved) {
        throw new Error('A ticker symbol or company name is required for stock lookup.');
    }
    const payload = (await fetchAlphaVantage({
        function: 'GLOBAL_QUOTE',
        symbol: resolved.symbol,
        apikey: getApiKey(),
    }));
    const quote = payload['Global Quote'];
    const price = Number.parseFloat(quote?.['05. price'] ?? '');
    if (!quote?.['01. symbol'] || !Number.isFinite(price)) {
        throw new Error(`No Alpha Vantage quote was available for ${resolved.symbol}.`);
    }
    const change = Number.parseFloat(quote['09. change'] ?? '');
    return {
        kind: 'stock_quote',
        symbol: quote['01. symbol'],
        companyName: resolved.companyName,
        price: Number(price.toFixed(2)),
        change: Number.isFinite(change) ? Number(change.toFixed(2)) : null,
        changePercent: quote['10. change percent'] ?? null,
        currency: 'USD',
        latestTradingDay: quote['07. latest trading day'] ?? null,
        source: 'Alpha Vantage',
        summary: `${quote['01. symbol']} is trading at $${price.toFixed(2)}${quote['10. change percent'] ? ` with a ${quote['10. change percent']} move on the day` : ''}.`,
    };
}
function formatWindowLabel(window) {
    switch (window) {
        case '1d':
            return '1 day';
        case '5d':
            return '5 days';
        case '1m':
            return '1 month';
    }
}
function formatSeriesPointLabel(timestamp, window) {
    const date = new Date(timestamp.includes('T') ? timestamp : `${timestamp}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }
    if (window === '1d') {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
    }
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    }).format(date);
}
function resolvePercentChange(current, previous) {
    if (previous === 0) {
        return '0.00%';
    }
    const value = ((current - previous) / previous) * 100;
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
function resolveTimeSeriesPoints(entries, window) {
    const limit = window === '1d' ? 10 : window === '5d' ? 5 : 20;
    return entries
        .slice(0, limit)
        .reverse()
        .map(([timestamp, values]) => {
        const close = Number.parseFloat(values['4. close'] ?? '');
        return Number.isFinite(close)
            ? {
                label: formatSeriesPointLabel(timestamp.replace(' ', 'T'), window),
                rawTimestamp: timestamp,
                value: Number(close.toFixed(2)),
            }
            : null;
    })
        .filter((point) => point !== null);
}
export function projectStockFromPoints(points) {
    if (points.length < 2) {
        throw new Error('At least two stock price points are required to build a projection.');
    }
    const tradingSteps = Math.max(5, Math.round(points.length / 4));
    const meanIndex = (points.length - 1) / 2;
    const meanValue = points.reduce((sum, point) => sum + point.value, 0) / points.length;
    let numerator = 0;
    let denominator = 0;
    for (let index = 0; index < points.length; index += 1) {
        const centeredIndex = index - meanIndex;
        numerator += centeredIndex * (points[index].value - meanValue);
        denominator += centeredIndex * centeredIndex;
    }
    const slopePerTradingStep = denominator === 0 ? 0 : numerator / denominator;
    const latestPrice = points[points.length - 1].value;
    const projectedPrice = Number(Math.max(0, latestPrice + slopePerTradingStep * tradingSteps).toFixed(2));
    const projectedAbsoluteChange = Number((projectedPrice - latestPrice).toFixed(2));
    return {
        projectedPrice,
        projectedAbsoluteChange,
        projectedPercentChange: resolvePercentChange(projectedPrice, latestPrice),
        slopePerTradingStep: Number(slopePerTradingStep.toFixed(4)),
        method: 'Linear regression extrapolation over the latest 1-month closing-price series.',
    };
}
export async function lookupStockTimeSeries({ symbol, companyName, window, }) {
    const resolvedWindow = window ?? '5d';
    const resolved = symbol && symbol.trim()
        ? {
            symbol: symbol.trim().toUpperCase(),
            companyName,
        }
        : companyName
            ? await resolveSymbol(companyName)
            : null;
    if (!resolved) {
        throw new Error('A ticker symbol or company name is required for stock time series lookup.');
    }
    if (resolvedWindow === '1d') {
        const payload = (await fetchAlphaVantage({
            function: 'TIME_SERIES_INTRADAY',
            symbol: resolved.symbol,
            interval: '30min',
            outputsize: 'compact',
            apikey: getApiKey(),
        }));
        const entries = Object.entries(payload['Time Series (30min)'] ?? {}).sort((left, right) => right[0].localeCompare(left[0]));
        const points = resolveTimeSeriesPoints(entries, resolvedWindow);
        if (points.length < 2) {
            throw new Error(`No intraday series was available for ${resolved.symbol}.`);
        }
        const latest = points[points.length - 1];
        const previous = points[0];
        const absoluteChange = Number((latest.value - previous.value).toFixed(2));
        return {
            kind: 'stock_time_series',
            symbol: resolved.symbol,
            companyName: resolved.companyName,
            window: resolvedWindow,
            latestPrice: latest.value,
            previousClose: previous.value,
            absoluteChange,
            percentChange: resolvePercentChange(latest.value, previous.value),
            currency: 'USD',
            latestTradingDay: latest.rawTimestamp.split(' ')[0] ?? null,
            source: 'Alpha Vantage',
            summary: `${resolved.symbol} is ${absoluteChange >= 0 ? 'up' : 'down'} ${Math.abs(absoluteChange).toFixed(2)} over the last ${formatWindowLabel(resolvedWindow)}.`,
            points: points.map(({ label, value }) => ({ label, value })),
        };
    }
    const payload = (await fetchAlphaVantage({
        function: 'TIME_SERIES_DAILY',
        symbol: resolved.symbol,
        outputsize: 'compact',
        apikey: getApiKey(),
    }));
    const entries = Object.entries(payload['Time Series (Daily)'] ?? {}).sort((left, right) => right[0].localeCompare(left[0]));
    const points = resolveTimeSeriesPoints(entries, resolvedWindow);
    if (points.length < 2) {
        throw new Error(`No daily time series was available for ${resolved.symbol}.`);
    }
    const latest = points[points.length - 1];
    const previous = points[0];
    const absoluteChange = Number((latest.value - previous.value).toFixed(2));
    return {
        kind: 'stock_time_series',
        symbol: resolved.symbol,
        companyName: resolved.companyName,
        window: resolvedWindow,
        latestPrice: latest.value,
        previousClose: previous.value,
        absoluteChange,
        percentChange: resolvePercentChange(latest.value, previous.value),
        currency: 'USD',
        latestTradingDay: latest.rawTimestamp ?? null,
        source: 'Alpha Vantage',
        summary: `${resolved.symbol} is ${absoluteChange >= 0 ? 'up' : 'down'} ${Math.abs(absoluteChange).toFixed(2)} over the last ${formatWindowLabel(resolvedWindow)}.`,
        points: points.map(({ label, value }) => ({ label, value })),
    };
}
export async function lookupStockProjection(args) {
    const series = await lookupStockTimeSeries({
        ...args,
        window: '1m',
    });
    const projection = projectStockFromPoints(series.points);
    return {
        kind: 'stock_projection',
        symbol: series.symbol,
        companyName: series.companyName,
        window: '1m',
        latestPrice: series.latestPrice,
        previousClose: series.previousClose,
        absoluteChange: series.absoluteChange,
        percentChange: series.percentChange,
        currency: series.currency,
        latestTradingDay: series.latestTradingDay,
        source: series.source,
        summary: `${series.symbol} moved ${series.percentChange} over the last month. A simple trend projection points to ${projection.projectedPrice.toFixed(2)} next, or ${projection.projectedPercentChange} from the latest close.`,
        points: series.points,
        timeSeries: series,
        projection,
    };
}
