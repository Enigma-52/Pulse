package model

import "time"

const (
	DefaultLimit = 100
	MaxLimit     = 500
)

type Trace struct {
	TraceID    string    `json:"trace_id"`
	Service    string    `json:"service"`
	Name       string    `json:"name"`
	Route      string    `json:"route"`
	DurationMs int64     `json:"duration_ms"`
	Status     string    `json:"status"`
	Timestamp  time.Time `json:"timestamp"`
}

type SpanEvent struct {
	Time  int64                  `json:"time"`
	Name  string                 `json:"name"`
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

type ServiceSummary struct {
	Service       string  `json:"service"`
	TraceCount    uint64  `json:"trace_count"`
	ErrorCount    uint64  `json:"error_count"`
	ErrorRate     float64 `json:"error_rate"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
	P50DurationMs float64 `json:"p50_duration_ms"`
	P95DurationMs float64 `json:"p95_duration_ms"`
	P99DurationMs float64 `json:"p99_duration_ms"`
	LastSeen      string  `json:"last_seen"`
}

type ServicesListResponse struct {
	Items []ServiceSummary `json:"items"`
}

type MetricQuery struct {
	Name     string
	Service  string
	Type     string
	Minutes  int
	Interval int
}

type MetricQuerySeries struct {
	Name   string              `json:"name"`
	Unit   string              `json:"unit"`
	Points []MetricSeriesPoint `json:"points"`
}

type MetricQueryResponse struct {
	Series []MetricQuerySeries `json:"series"`
}

// Database monitoring models

type DatabaseSummary struct {
	System       string  `json:"system"`
	QueryCount   uint64  `json:"query_count"`
	ErrorCount   uint64  `json:"error_count"`
	ErrorRate    float64 `json:"error_rate"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
	P50DurationMs float64 `json:"p50_duration_ms"`
	P95DurationMs float64 `json:"p95_duration_ms"`
	P99DurationMs float64 `json:"p99_duration_ms"`
	LastSeen     string  `json:"last_seen"`
}

type DatabasesListResponse struct {
	Items []DatabaseSummary `json:"items"`
}

type DatabaseOverview struct {
	System         string  `json:"system"`
	QueryCount     uint64  `json:"query_count"`
	ErrorCount     uint64  `json:"error_count"`
	ErrorRate      float64 `json:"error_rate"`
	AvgDurationMs  float64 `json:"avg_duration_ms"`
	P50DurationMs  float64 `json:"p50_duration_ms"`
	P95DurationMs  float64 `json:"p95_duration_ms"`
	P99DurationMs  float64 `json:"p99_duration_ms"`
	DatabaseNames  []string `json:"database_names"`
}

type DatabaseOperation struct {
	TraceID     string  `json:"trace_id"`
	SpanID      string  `json:"span_id"`
	Service     string  `json:"service"`
	DbSystem    string  `json:"db_system"`
	DbName      string  `json:"db_name"`
	DbStatement string  `json:"db_statement"`
	DurationMs  int64   `json:"duration_ms"`
	Status      string  `json:"status"`
	Timestamp   time.Time `json:"timestamp"`
}

type DatabaseQueriesResponse struct {
	Items  []DatabaseOperation `json:"items"`
	Limit  int                 `json:"limit"`
	Offset int                 `json:"offset"`
}

type DatabaseThroughputPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Count     uint64    `json:"count"`
	Errors    uint64    `json:"errors"`
	AvgMs     float64   `json:"avg_ms"`
}

type DatabaseOverviewResponse struct {
	Overview   DatabaseOverview          `json:"overview"`
	Throughput []DatabaseThroughputPoint `json:"throughput"`
}

// Exception models

type ExceptionGroup struct {
	Fingerprint string    `json:"fingerprint"`
	Type        string    `json:"type"`
	Message     string    `json:"message"`
	Service     string    `json:"service"`
	Occurrences uint64    `json:"occurrences"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
}

type ExceptionDetail struct {
	Fingerprint string    `json:"fingerprint"`
	Type        string    `json:"type"`
	Message     string    `json:"message"`
	Service     string    `json:"service"`
	Environment string    `json:"environment"`
	Route       string    `json:"route"`
	Occurrences uint64    `json:"occurrences"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	Stacktrace  string    `json:"stacktrace"`
	TraceIDs    []string  `json:"trace_ids"`
}

type ExceptionBucket struct {
	Timestamp time.Time `json:"timestamp"`
	Count     uint64    `json:"count"`
}

type ExceptionsResponse struct {
	Items  []ExceptionGroup `json:"items"`
	Limit  int              `json:"limit"`
	Offset int              `json:"offset"`
}

type ExceptionFilters struct {
	Service string
	Search  string
	Minutes int
	Limit   int
	Offset  int
}

// Alerting models

type AlertRule struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Signal         string    `json:"signal"`      // traces | logs | metrics
	MetricName     string    `json:"metric_name"` // metrics signal only
	Service        string    `json:"service"`     // optional filter, empty = all
	GroupByService bool      `json:"group_by_service"`
	Aggregation    string    `json:"aggregation"` // count | avg | p95 | p99 | error_rate | error_count | value_avg | value_max
	Operator       string    `json:"operator"`    // gt | gte | lt | lte
	Threshold      float64   `json:"threshold"`
	WindowMinutes  uint32    `json:"window_minutes"`
	ChannelIDs     []string  `json:"channel_ids"`
	Enabled        bool      `json:"enabled"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Alert struct {
	ID         string    `json:"id"`
	RuleID     string    `json:"rule_id"`
	RuleName   string    `json:"rule_name"`
	Service    string    `json:"service"`
	Status     string    `json:"status"` // firing | resolved
	Value      float64   `json:"value"`
	Threshold  float64   `json:"threshold"`
	Message    string    `json:"message"`
	FiredAt    time.Time `json:"fired_at"`
	ResolvedAt time.Time `json:"resolved_at"`
}

type NotificationChannel struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Type       string    `json:"type"` // webhook | slack | email
	ConfigJSON string    `json:"config_json"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type AlertRulesResponse struct {
	Items []AlertRule `json:"items"`
}

type AlertsResponse struct {
	Items  []Alert `json:"items"`
	Limit  int     `json:"limit"`
	Offset int     `json:"offset"`
}

type ChannelsResponse struct {
	Items []NotificationChannel `json:"items"`
}

type AlertFilters struct {
	Status   string
	RuleID   string
	Start    time.Time
	End      time.Time
	HasStart bool
	HasEnd   bool
	Limit    int
	Offset   int
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
