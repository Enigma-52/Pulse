package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

type Store struct {
	conn driver.Conn
}

func New(conn driver.Conn) *Store {
	return &Store{conn: conn}
}

func (s *Store) Ping(ctx context.Context) error {
	return s.conn.Ping(ctx)
}

func (s *Store) GetTraces(ctx context.Context, filters model.TraceFilters) ([]model.Trace, error) {
	query, args := buildTraceQuery(filters)

	rows, err := s.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []model.Trace
	for rows.Next() {
		var t model.Trace
		if err := rows.Scan(&t.TraceID, &t.Service, &t.Name, &t.Route, &t.DurationMs, &t.Status, &t.Timestamp); err != nil {
			return nil, err
		}
		traces = append(traces, t)
	}
	return traces, nil
}

func (s *Store) GetTraceDetail(ctx context.Context, traceID string) ([]model.SpanDetail, error) {
	rows, err := s.conn.Query(ctx, `
SELECT
	trace_id, span_id, parent_span_id, service, environment, route, name, kind,
	duration_ms, status, error, start_time, end_time, attributes_json, events_json
FROM traces
WHERE trace_id = ?
ORDER BY start_time ASC
`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var spans []model.SpanDetail
	for rows.Next() {
		var sp model.SpanDetail
		var attrsJSON, eventsJSON string
		if err := rows.Scan(
			&sp.TraceID, &sp.SpanID, &sp.ParentSpanID, &sp.Service, &sp.Environment,
			&sp.Route, &sp.Name, &sp.Kind, &sp.DurationMs, &sp.Status, &sp.Error,
			&sp.StartTime, &sp.EndTime, &attrsJSON, &eventsJSON,
		); err != nil {
			return nil, err
		}

		if attrsJSON != "" {
			_ = json.Unmarshal([]byte(attrsJSON), &sp.Attributes)
		}
		if sp.Attributes == nil {
			sp.Attributes = map[string]interface{}{}
		}

		if eventsJSON != "" && eventsJSON != "[]" {
			_ = json.Unmarshal([]byte(eventsJSON), &sp.Events)
		}
		if sp.Events == nil {
			sp.Events = []model.SpanEvent{}
		}

		if sp.Kind == "" {
			sp.Kind = "internal"
		}
		spans = append(spans, sp)
	}
	return spans, nil
}

func (s *Store) GetServiceOverview(ctx context.Context, service string, start *time.Time) (*model.ServiceOverview, error) {
	query := `
SELECT
	service,
	count() AS trace_count,
	countIf(lower(status) = 'error' OR error != '') AS error_count,
	if(trace_count = 0, 0, (error_count / trace_count) * 100.0) AS error_rate,
	avg(duration_ms) AS avg_duration_ms,
	quantile(0.95)(duration_ms) AS p95_duration_ms
FROM traces
WHERE service = ?
`
	args := []any{service}
	if start != nil {
		query += " AND start_time >= ?"
		args = append(args, *start)
	}
	query += "\nGROUP BY service\nLIMIT 1"

	rows, err := s.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}

	var out model.ServiceOverview
	if err := rows.Scan(&out.Service, &out.TraceCount, &out.ErrorCount, &out.ErrorRate, &out.AvgDurationMs, &out.P95DurationMs); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) GetLogs(ctx context.Context, filters model.LogFilters) ([]model.LogEntry, error) {
	query, args := buildLogQuery(filters)

	rows, err := s.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []model.LogEntry
	for rows.Next() {
		var l model.LogEntry
		var fieldsJSON string
		if err := rows.Scan(&l.Timestamp, &l.Level, &l.Message, &l.Service, &l.Environment, &l.TraceID, &l.SpanID, &fieldsJSON); err != nil {
			return nil, err
		}
		if fieldsJSON != "" && fieldsJSON != "{}" {
			_ = json.Unmarshal([]byte(fieldsJSON), &l.Fields)
		}
		if l.Fields == nil {
			l.Fields = map[string]interface{}{}
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (s *Store) GetMetricsList(ctx context.Context) ([]model.MetricMeta, error) {
	rows, err := s.conn.Query(ctx, `
SELECT name, any(type) as type, any(unit) as unit, avg(value) as current_value
FROM metrics WHERE timestamp >= now() - INTERVAL 5 MINUTE
GROUP BY name ORDER BY name
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type current struct {
		Name, Type, Unit string
		Value            float64
	}
	var currents []current
	for rows.Next() {
		var c current
		if err := rows.Scan(&c.Name, &c.Type, &c.Unit, &c.Value); err != nil {
			return nil, err
		}
		currents = append(currents, c)
	}

	prevRows, err := s.conn.Query(ctx, `
SELECT name, avg(value) as prev_value
FROM metrics WHERE timestamp >= now() - INTERVAL 10 MINUTE AND timestamp < now() - INTERVAL 5 MINUTE
GROUP BY name
`)
	if err != nil {
		return nil, err
	}
	defer prevRows.Close()

	prevMap := make(map[string]float64)
	for prevRows.Next() {
		var name string
		var val float64
		if err := prevRows.Scan(&name, &val); err != nil {
			return nil, err
		}
		prevMap[name] = val
	}

	metrics := make([]model.MetricMeta, 0, len(currents))
	for _, c := range currents {
		m := model.MetricMeta{Name: c.Name, Type: c.Type, Unit: c.Unit, Value: c.Value}
		if prev, ok := prevMap[c.Name]; ok && prev != 0 {
			m.Delta = ((c.Value - prev) / prev) * 100.0
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}

func (s *Store) GetMetricSeries(ctx context.Context, name string, minutes int, intervalSeconds int) ([]model.MetricSeriesPoint, error) {
	rows, err := s.conn.Query(ctx, `
SELECT toStartOfInterval(timestamp, INTERVAL ? SECOND) as ts, avg(value) as value
FROM metrics WHERE name = ? AND timestamp >= now() - INTERVAL ? MINUTE
GROUP BY ts ORDER BY ts
`, intervalSeconds, name, minutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []model.MetricSeriesPoint
	for rows.Next() {
		var p model.MetricSeriesPoint
		if err := rows.Scan(&p.Timestamp, &p.Value); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	return points, nil
}

func (s *Store) GetDashboardSummary(ctx context.Context, minutes int) (*model.DashboardSummary, error) {
	if minutes <= 0 {
		minutes = 15
	}
	seconds := float64(minutes * 60)

	rows, err := s.conn.Query(ctx, fmt.Sprintf(`
SELECT
	count() / %f as request_rate,
	quantile(0.99)(duration_ms) as p99_latency,
	countIf(lower(status) = 'error' OR error != '') * 100.0 / count() as error_rate,
	count() as trace_count
FROM traces
WHERE parent_span_id = '' AND start_time >= now() - INTERVAL ? MINUTE
`, seconds), minutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return &model.DashboardSummary{}, nil
	}

	var out model.DashboardSummary
	if err := rows.Scan(&out.RequestRate, &out.P99Latency, &out.ErrorRate, &out.TraceCount); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) QueryMetrics(ctx context.Context, q model.MetricQuery) ([]model.MetricQuerySeries, error) {
	var sb strings.Builder
	args := make([]any, 0, 6)

	sb.WriteString(`
SELECT name, any(unit) as unit, toStartOfInterval(timestamp, INTERVAL ? SECOND) as ts, avg(value) as value
FROM metrics WHERE timestamp >= now() - INTERVAL ? MINUTE
`)
	args = append(args, q.Interval, q.Minutes)

	if q.Name != "" {
		sb.WriteString(" AND position(name, ?) > 0")
		args = append(args, q.Name)
	}
	if q.Service != "" {
		sb.WriteString(" AND service = ?")
		args = append(args, q.Service)
	}
	if q.Type != "" {
		sb.WriteString(" AND type = ?")
		args = append(args, q.Type)
	}

	sb.WriteString(" GROUP BY name, ts ORDER BY name, ts")

	rows, err := s.conn.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seriesMap := make(map[string]*model.MetricQuerySeries)
	var order []string

	for rows.Next() {
		var name, unit string
		var p model.MetricSeriesPoint
		if err := rows.Scan(&name, &unit, &p.Timestamp, &p.Value); err != nil {
			return nil, err
		}
		if _, ok := seriesMap[name]; !ok {
			seriesMap[name] = &model.MetricQuerySeries{Name: name, Unit: unit}
			order = append(order, name)
		}
		seriesMap[name].Points = append(seriesMap[name].Points, p)
	}

	result := make([]model.MetricQuerySeries, 0, len(order))
	for _, name := range order {
		result = append(result, *seriesMap[name])
	}
	return result, nil
}

func (s *Store) GetServicesList(ctx context.Context, minutes int) ([]model.ServiceSummary, error) {
	if minutes <= 0 {
		minutes = 15
	}
	rows, err := s.conn.Query(ctx, `
SELECT
	service, count() AS trace_count,
	countIf(lower(status) = 'error' OR error != '') AS error_count,
	if(trace_count = 0, 0, (error_count / trace_count) * 100.0) AS error_rate,
	avg(duration_ms) AS avg_duration_ms,
	quantile(0.5)(duration_ms) AS p50_duration_ms,
	quantile(0.95)(duration_ms) AS p95_duration_ms,
	quantile(0.99)(duration_ms) AS p99_duration_ms,
	max(start_time) AS last_seen
FROM traces WHERE start_time >= now() - INTERVAL ? MINUTE
GROUP BY service ORDER BY trace_count DESC
`, minutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []model.ServiceSummary
	for rows.Next() {
		var s model.ServiceSummary
		var lastSeen time.Time
		if err := rows.Scan(&s.Service, &s.TraceCount, &s.ErrorCount, &s.ErrorRate, &s.AvgDurationMs, &s.P50DurationMs, &s.P95DurationMs, &s.P99DurationMs, &lastSeen); err != nil {
			return nil, err
		}
		s.LastSeen = lastSeen.Format(time.RFC3339)
		services = append(services, s)
	}
	return services, nil
}

func buildLogQuery(filters model.LogFilters) (string, []any) {
	var sb strings.Builder
	args := make([]any, 0, 8)

	sb.WriteString(`
SELECT timestamp, level, message, service, environment, trace_id, span_id, attributes_json
FROM logs WHERE 1=1
`)

	if filters.Service != "" {
		sb.WriteString(" AND service = ?")
		args = append(args, filters.Service)
	}
	if len(filters.Levels) > 0 {
		placeholders := strings.TrimSuffix(strings.Repeat("?, ", len(filters.Levels)), ", ")
		sb.WriteString(" AND level IN (" + placeholders + ")")
		for _, lv := range filters.Levels {
			args = append(args, lv)
		}
	}
	if filters.Environment != "" {
		sb.WriteString(" AND environment = ?")
		args = append(args, filters.Environment)
	}
	if filters.Search != "" {
		sb.WriteString(" AND (position(message, ?) > 0 OR position(attributes_json, ?) > 0)")
		args = append(args, filters.Search, filters.Search)
	}
	if filters.TraceID != "" {
		sb.WriteString(" AND trace_id = ?")
		args = append(args, filters.TraceID)
	}
	if filters.HasStart {
		sb.WriteString(" AND timestamp >= ?")
		args = append(args, filters.Start)
	}
	if filters.HasEnd {
		sb.WriteString(" AND timestamp <= ?")
		args = append(args, filters.End)
	}

	sb.WriteString(" ORDER BY timestamp DESC LIMIT ? OFFSET ?")
	args = append(args, filters.Limit, filters.Offset)
	return sb.String(), args
}

func buildTraceQuery(filters model.TraceFilters) (string, []any) {
	var sb strings.Builder
	args := make([]any, 0, 12)

	sb.WriteString(`
SELECT trace_id, service, name, route, duration_ms, status, start_time
FROM traces WHERE parent_span_id = ''
`)

	if filters.Service != "" {
		sb.WriteString(" AND service = ?")
		args = append(args, filters.Service)
	}
	if filters.Route != "" {
		sb.WriteString(" AND route = ?")
		args = append(args, filters.Route)
	}
	if filters.Status != "" {
		sb.WriteString(" AND status = ?")
		args = append(args, filters.Status)
	}
	if filters.ErrorOnly {
		sb.WriteString(" AND (lower(status) = 'error' OR error != '')")
	}
	if filters.MinDurationMs > 0 {
		sb.WriteString(" AND duration_ms >= ?")
		args = append(args, filters.MinDurationMs)
	}
	if filters.MaxDurationMs > 0 {
		sb.WriteString(" AND duration_ms <= ?")
		args = append(args, filters.MaxDurationMs)
	}
	if filters.TagKey != "" && filters.TagValue != "" {
		sb.WriteString(" AND position(attributes_json, ?) > 0")
		args = append(args, fmt.Sprintf("\"%s\":\"%s\"", filters.TagKey, filters.TagValue))
	}
	if filters.HasStart {
		sb.WriteString(" AND start_time >= ?")
		args = append(args, filters.Start)
	}
	if filters.HasEnd {
		sb.WriteString(" AND start_time <= ?")
		args = append(args, filters.End)
	}

	sb.WriteString(" ORDER BY start_time DESC LIMIT ? OFFSET ?")
	args = append(args, filters.Limit, filters.Offset)
	return sb.String(), args
}

// GetLogsHistogram buckets log counts per level over time using the same
// filters as the log list (limit/offset ignored).
func (s *Store) GetLogsHistogram(ctx context.Context, filters model.LogFilters, intervalMinutes int) ([]model.LogHistogramPoint, error) {
	if intervalMinutes <= 0 {
		intervalMinutes = 1
	}

	var sb strings.Builder
	args := []any{intervalMinutes}
	sb.WriteString("SELECT toStartOfInterval(timestamp, INTERVAL ? MINUTE) AS bucket, level, count() AS c FROM logs WHERE 1=1")

	if filters.Service != "" {
		sb.WriteString(" AND service = ?")
		args = append(args, filters.Service)
	}
	if len(filters.Levels) > 0 {
		placeholders := strings.TrimSuffix(strings.Repeat("?, ", len(filters.Levels)), ", ")
		sb.WriteString(" AND level IN (" + placeholders + ")")
		for _, lv := range filters.Levels {
			args = append(args, lv)
		}
	}
	if filters.Environment != "" {
		sb.WriteString(" AND environment = ?")
		args = append(args, filters.Environment)
	}
	if filters.Search != "" {
		sb.WriteString(" AND (position(message, ?) > 0 OR position(attributes_json, ?) > 0)")
		args = append(args, filters.Search, filters.Search)
	}
	if filters.TraceID != "" {
		sb.WriteString(" AND trace_id = ?")
		args = append(args, filters.TraceID)
	}
	if filters.HasStart {
		sb.WriteString(" AND timestamp >= ?")
		args = append(args, filters.Start)
	}
	if filters.HasEnd {
		sb.WriteString(" AND timestamp <= ?")
		args = append(args, filters.End)
	}
	sb.WriteString(" GROUP BY bucket, level ORDER BY bucket")

	rows, err := s.conn.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []model.LogHistogramPoint
	for rows.Next() {
		var p model.LogHistogramPoint
		if err := rows.Scan(&p.Timestamp, &p.Level, &p.Count); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	return points, nil
}
