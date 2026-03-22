import * as React from 'react';

type AiLoaderProps = {
  active?: boolean;
  accented?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

const BASE_PALETTE = {
  inner: '#4E3C2B',
  middle: '#B69777',
  outer: '#D8CAB6',
  glowA: 'rgba(182, 151, 119, 0.26)',
  glowB: 'rgba(78, 60, 43, 0.18)',
};

const ACCENT_PALETTE = {
  inner: '#D8CAB6',
  middle: '#D8CAB6',
  outer: '#B69777',
  glowA: 'rgba(216, 202, 182, 0.5)',
  glowB: 'rgba(182, 151, 119, 0.36)',
};

export function AiLoader({
  active = false,
  accented = false,
  className,
  style,
}: AiLoaderProps) {
  const palette = accented ? ACCENT_PALETTE : BASE_PALETTE;

  return (
    <>
      <div
        aria-hidden="true"
        className={className}
        style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '999px',
          pointerEvents: 'none',
          zIndex: 2,
          opacity: active ? 0.95 : 0,
          transform: 'scale(1)',
          transition: 'opacity 180ms ease, box-shadow 180ms ease, filter 180ms ease',
          animation: active ? 'ai-loader-spin 5.2s linear infinite' : 'none',
          filter: accented ? 'brightness(1.18) saturate(1.08)' : 'none',
          boxShadow: `
            0 8px 14px 0 ${palette.inner} inset,
            0 16px 20px 0 ${palette.middle} inset,
            0 40px 40px 0 ${palette.outer} inset,
            0 0 4px 1.2px ${palette.glowA},
            0 0 10px 2px ${palette.glowB}
          `,
          ...style,
        }}
      />
      <style jsx>{`
        @keyframes ai-loader-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}

export const Component = AiLoader;
