export type SharedScreenOverlayMetric = {
  label: string;
  value: string;
};

export type SharedScreenOverlayChartPoint = {
  label: string;
  value: number;
};

export type SharedScreenOverlayChart = {
  seriesLabel: string;
  lineColor?: string;
  fillColor?: string;
  points: SharedScreenOverlayChartPoint[];
};

export type SharedScreenOverlayCard = {
  id: string;
  surfaceId: string;
  kind: 'stock_quote' | 'stock_time_series';
  title: string;
  subtitle?: string;
  body?: string;
  source: string;
  createdAt: string;
  metrics: SharedScreenOverlayMetric[];
  chart?: SharedScreenOverlayChart;
};
