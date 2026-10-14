export const FARM_CLUSTERS = [
  { x: 599, y: 195, columns: 8, count: 24, start: 0, stride: 48 },
  { x: 365, y: 450, columns: 4, count: 8, start: 24, stride: 44 },
  { x: 599, y: 450, columns: 4, count: 8, start: 32, stride: 44 },
  { x: 833, y: 450, columns: 4, count: 8, start: 40, stride: 44 },
  // Append new rows so existing saved plot numbers retain their positions.
  { x: 365, y: 570, columns: 4, count: 4, start: 48, stride: 44 },
  { x: 599, y: 570, columns: 4, count: 4, start: 52, stride: 44 },
  { x: 833, y: 570, columns: 4, count: 4, start: 56, stride: 44 },
] as const;
export const FARM_PLOT_LIMIT = FARM_CLUSTERS.reduce((total, cluster) => total + cluster.count, 0);
