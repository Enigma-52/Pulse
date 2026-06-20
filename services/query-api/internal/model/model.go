package model

import "time"

const (
	DefaultLimit = 100
	MaxLimit     = 500
)

type Trace struct {
	TraceID    string    `json:"trace_id"`
	Service    string    `json:"service"`
	Route      string    `json:"route"`
	DurationMs int64     `json:"duration_ms"`
	Status     string    `json:"status"`
	Timestamp  time.Time `json:"timestamp"`
}

type SpanEvent struct {
	Time int64                  `json:"time"`
	Name string                 `json:"name"`
	Attrs map[string]interface{} `json:"attrs,omitempty"`
}

type SpanDetail struct {
	TraceID      string                 `json:"trace_id"`
	SpanID       string                 `json:"span_id"`
	ParentSpanID string                 `json:"parent_span_id"`
	Service      string                 `json:"service"`
	Environment  string                 `json:"environment"`
	Route        string                 `json:"route"`
	Name         string                 `json:"name"`
	Kind         string                 `json:"kind"`
	DurationMs   int64                  `json:"duration_ms"`
	Status       string                 `json:"status"`
	Error        string                 `json:"error"`
	StartTime    time.Time              `json:"start_time"`
	EndTime      time.Time              `json:"end_time"`
	Attributes   map[string]interface{} `json:"attributes"`
	Events       []SpanEvent            `json:"events"`
}

type TraceDetailResponse struct {
	TraceID   string       `json:"trace_id"`
	Name      string       `json:"name"`
	Service   string       `json:"service"`
	Duration  int64        `json:"duration"`
	Status    string       `json:"status"`
	Timestamp time.Time    `json:"timestamp"`
	SpanCount int          `json:"span_count"`
	Spans     []SpanDetail `json:"spans"`
}

type TracesResponse struct {
	Items  []Trace `json:"items"`
	Limit  int     `json:"limit"`
	Offset int     `json:"offset"`
}

type ServiceOverview struct {
	Service       string  `json:"service"`
	TraceCount    uint64  `json:"trace_count"`
	ErrorCount    uint64  `json:"error_count"`
	ErrorRate     float64 `json:"error_rate"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
	P95DurationMs float64 `json:"p95_duration_ms"`
}

type LogEntry struct {
	Timestamp   time.Time              `json:"timestamp"`
	Level       string                 `json:"level"`
	Message     string                 `json:"message"`
	Service     string                 `json:"service"`
	Environment string                 `json:"environment"`
	TraceID     string                 `json:"trace_id"`
	SpanID      string                 `json:"span_id"`
	Fields      map[string]interface{} `json:"fields"`
}

type LogsResponse struct {
	Items  []LogEntry `json:"items"`
	Limit  int        `json:"limit"`
	Offset int        `json:"offset"`
}

type LogFilters struct {
	Service  string
	Level    string
	Search   string
	TraceID  string
	Start    time.Time
	End      time.Time
	HasStart bool
	HasEnd   bool
	Limit    int
	Offset   int
}

type MetricMeta struct {
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Unit        string  `json:"unit"`
	Value       float64 `json:"value"`
	Delta       float64 `json:"delta"`
	Description string  `json:"description"`
}

type MetricSeriesPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

type MetricsListResponse struct {
	Items []MetricMeta `json:"items"`
}

type MetricSeriesResponse struct {
	Name   string              `json:"name"`
	Unit   string              `json:"unit"`
	Points []MetricSeriesPoint `json:"points"`
}

type DashboardSummary struct {
	RequestRate float64 `json:"request_rate"`
	P99Latency  float64 `json:"p99_latency"`
	ErrorRate   float64 `json:"error_rate"`
	TraceCount  uint64  `json:"trace_count"`
}

type TraceFilters struct {
	Service       string
	Route         string
	Status        string
	ErrorOnly     bool
	TagKey        string
	TagValue      string
	MinDurationMs int64
	MaxDurationMs int64
	Start         time.Time
	End           time.Time
	HasStart      bool
	HasEnd        bool
	Limit         int
	Offset        int
}
