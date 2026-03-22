import { describe, expect, it } from 'vitest';

import { parseVoiceOverlayRequest } from './toolResults';
import type { VoiceToolResultEvent } from '@/lib/ai/types';

function createToolResultEvent(name: string, result: string): VoiceToolResultEvent {
  return {
    type: 'tool_result',
    toolCallId: 'call-1',
    name,
    result,
    roomName: 'room-a',
    sessionId: 'session-a',
    ts: 1_763_524_800_000,
  };
}

describe('tool result parsing', () => {
  it('builds a shared-screen overlay request from stock quote JSON', () => {
    const overlay = parseVoiceOverlayRequest(
      createToolResultEvent(
        'get_stock_quote',
        JSON.stringify({
          kind: 'stock_quote',
          symbol: 'MSFT',
          companyName: 'Microsoft Corporation',
          price: 428.13,
          change: 3.42,
          changePercent: '0.81%',
          currency: 'USD',
          latestTradingDay: '2026-03-20',
          source: 'Alpha Vantage',
          summary: 'Microsoft is trading at $428.13, up 0.81% on the day.',
        }),
      ),
    );

    expect(overlay).toEqual(
      expect.objectContaining({
        id: 'call-1:1763524800000:stock_quote',
        kind: 'stock_quote',
        title: 'MSFT Stock Data',
        subtitle: 'Microsoft Corporation',
      }),
    );
    expect(overlay?.metrics[0]?.label).toBe('Price');
  });

  it('builds a chart overlay request from stock time series JSON', () => {
    const overlay = parseVoiceOverlayRequest(
      createToolResultEvent(
        'get_stock_time_series',
        JSON.stringify({
          kind: 'stock_time_series',
          symbol: 'MSFT',
          companyName: 'Microsoft Corporation',
          window: '5d',
          latestPrice: 432.18,
          previousClose: 420.05,
          absoluteChange: 12.13,
          percentChange: '2.89%',
          currency: 'USD',
          latestTradingDay: '2026-03-20',
          source: 'Alpha Vantage',
          summary: 'MSFT is up 2.89% over the last 5 trading days.',
          points: [
            { label: 'Mon', value: 420.05 },
            { label: 'Tue', value: 424.1 },
            { label: 'Wed', value: 427.4 },
            { label: 'Thu', value: 430.22 },
            { label: 'Fri', value: 432.18 },
          ],
        }),
      ),
    );

    expect(overlay).toEqual(
      expect.objectContaining({
        id: 'call-1:1763524800000:stock_time_series',
        kind: 'stock_time_series',
        title: 'MSFT 5D Trend',
      }),
    );
    expect(overlay?.chart?.points).toHaveLength(5);
  });

  it('ignores malformed tool payloads', () => {
    expect(parseVoiceOverlayRequest(createToolResultEvent('get_stock_quote', 'not-json'))).toBeNull();
  });
});
