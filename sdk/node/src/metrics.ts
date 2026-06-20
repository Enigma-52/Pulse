export type MetricType = "counter" | "gauge" | "histogram";

export interface MetricPoint {
  name: string;
  type: MetricType;
  value: number;
  unit: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}
