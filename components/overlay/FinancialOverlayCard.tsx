'use client';

import * as React from 'react';

import type { SharedScreenOverlayCard } from '@/lib/overlay/types';

function buildChartPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return '';
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, height: number) {
  if (points.length === 0) {
    return '';
  }

  const linePath = buildChartPath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint) {
    return '';
  }

  return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
}

function OverlayChart({
  overlay,
  compact = false,
}: {
  overlay: SharedScreenOverlayCard;
  compact?: boolean;
}) {
  const chart = overlay.chart;

  if (!chart || chart.points.length < 2) {
    return null;
  }

  const width = 420;
  const height = compact ? 120 : 144;
  const paddingX = 10;
  const paddingY = 12;
  const values = chart.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.max(max * 0.01, 1);

  const normalizedPoints = chart.points.map((point, index) => {
    const x = paddingX + (index / Math.max(chart.points.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((point.value - min) / range) * (height - paddingY * 2);

    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });

  const lineColor = chart.lineColor ?? '#8fe3c0';
  const fillColor = chart.fillColor ?? 'rgba(143, 227, 192, 0.16)';
  const latestPoint = chart.points[chart.points.length - 1];
  const midPointLabel = chart.points[Math.floor(chart.points.length / 2)]?.label ?? '';

  return (
    <div
      style={{
        display: 'grid',
        gap: compact ? '0.4rem' : '0.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          color: 'rgba(255, 255, 255, 0.68)',
          fontSize: compact ? '0.68rem' : '0.78rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <span>{chart.seriesLabel}</span>
        <span>{latestPoint?.label ?? ''}</span>
      </div>

      <div
        style={{
          borderRadius: compact ? '14px' : '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: compact ? '0.4rem' : '0.5rem',
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', width: '100%', height: compact ? '120px' : '144px' }}
          role="img"
          aria-label={`${overlay.title} time series chart`}
        >
          <defs>
            <linearGradient id={`overlay-fill-${overlay.id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={fillColor} />
              <stop offset="100%" stopColor="rgba(143, 227, 192, 0.02)" />
            </linearGradient>
          </defs>
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1"
          />
          <path
            d={buildAreaPath(normalizedPoints, height - paddingY)}
            fill={`url(#overlay-fill-${overlay.id})`}
            stroke="none"
          />
          <path
            d={buildChartPath(normalizedPoints)}
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {normalizedPoints.map((point, index) =>
            index === normalizedPoints.length - 1 ? (
              <circle
                key={`${overlay.id}:${index}`}
                cx={point.x}
                cy={point.y}
                r="4.5"
                fill={lineColor}
                stroke="rgba(7, 12, 18, 0.9)"
                strokeWidth="2"
              />
            ) : null,
          )}
        </svg>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.5rem',
          color: 'rgba(255, 255, 255, 0.58)',
          fontSize: compact ? '0.66rem' : '0.74rem',
        }}
      >
        <span>{chart.points[0]?.label ?? ''}</span>
        <span style={{ textAlign: 'center' }}>{midPointLabel}</span>
        <span style={{ textAlign: 'right' }}>{latestPoint?.label ?? ''}</span>
      </div>
    </div>
  );
}

export function FinancialOverlayCard(props: {
  overlay: SharedScreenOverlayCard;
  compact?: boolean;
  onDismiss?: (overlayId: string) => void;
}) {
  const { overlay, compact = false, onDismiss } = props;

  return (
    <section
      style={{
        borderRadius: compact ? '16px' : '18px',
        border: '1px solid rgba(143, 227, 192, 0.24)',
        background: 'rgba(7, 12, 18, 0.88)',
        boxShadow: compact ? '0 12px 28px rgba(0, 0, 0, 0.26)' : '0 18px 44px rgba(0, 0, 0, 0.28)',
        backdropFilter: 'blur(16px)',
        padding: compact ? '0.75rem' : '0.95rem',
        color: 'white',
        display: 'grid',
        gap: compact ? '0.55rem' : '0.7rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ minWidth: 0, display: 'grid', gap: '0.2rem' }}>
          <strong style={{ fontSize: compact ? '0.86rem' : '1rem' }}>{overlay.title}</strong>
          {overlay.subtitle ? (
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: compact ? '0.72rem' : '0.84rem',
              }}
            >
              {overlay.subtitle}
            </div>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={() => onDismiss(overlay.id)}
            style={{
              border: 'none',
              width: compact ? '24px' : '28px',
              height: compact ? '24px' : '28px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.12)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label="Dismiss overlay"
          >
            ×
          </button>
        ) : null}
      </div>

      {overlay.body ? (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: compact ? '0.74rem' : '0.86rem',
            lineHeight: 1.45,
          }}
        >
          {overlay.body}
        </div>
      ) : null}

      <OverlayChart overlay={overlay} compact={compact} />

      <div
        style={{
          display: 'grid',
          gap: compact ? '0.4rem' : '0.55rem',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        {overlay.metrics.map((metric) => (
          <div
            key={`${overlay.id}:${metric.label}`}
            style={{
              minWidth: 0,
              borderRadius: '14px',
              padding: compact ? '0.55rem' : '0.7rem',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'grid',
              gap: '0.18rem',
            }}
          >
            <span
              style={{
                fontSize: compact ? '0.62rem' : '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.58)',
              }}
            >
              {metric.label}
            </span>
            <strong style={{ overflowWrap: 'anywhere', fontSize: compact ? '0.78rem' : '0.92rem' }}>
              {metric.value}
            </strong>
          </div>
        ))}
      </div>

      <div
        style={{ color: 'rgba(255, 255, 255, 0.58)', fontSize: compact ? '0.68rem' : '0.78rem' }}
      >
        Source: {overlay.source}
      </div>
    </section>
  );
}
