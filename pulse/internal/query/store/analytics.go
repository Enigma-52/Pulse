package store

import (
	"context"
	"strings"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

// analyticsGroupCols whitelists group_by values — never interpolate raw input.
var analyticsGroupCols = map[string]string{
	"service": "service",
	"route":   "route",
	"name":    "name",
}

func AnalyticsGroupValid(groupBy string) bool {
	_, ok := analyticsGroupCols[groupBy]
	return ok
}

func (s *Store) GetTraceAnalytics(ctx context.Context, groupBy, service string, minutes int) ([]model.TraceAnalyticsRow, error) {
	col := analyticsGroupCols[groupBy]
	if minutes <= 0 {
		minutes = 15
	}

	var sb []string
	args := []any{}
	sb = append(sb, `
SELECT `+col+` AS grp,
       count() AS trace_count,
       avg(duration_ms) AS avg_ms,
       quantile(0.95)(duration_ms) AS p95_ms,
       quantile(0.99)(duration_ms) AS p99_ms,
       countIf(lower(status) = 'error' OR error != '') AS error_count
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE`)
	args = append(args, minutes)
	if service != "" {
		sb = append(sb, "AND service = ?")
		args = append(args, service)
	}
	if col == "route" {
		sb = append(sb, "AND route != ''")
	}
	sb = append(sb, "GROUP BY grp ORDER BY trace_count DESC LIMIT 50")

	rows, err := s.conn.Query(ctx, strings.Join(sb, " "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.TraceAnalyticsRow
	for rows.Next() {
		var r model.TraceAnalyticsRow
		if err := rows.Scan(&r.Group, &r.TraceCount, &r.AvgMs, &r.P95Ms, &r.P99Ms, &r.ErrorCount); err != nil {
			return nil, err
		}
		if r.TraceCount > 0 {
			r.ErrorRate = float64(r.ErrorCount) / float64(r.TraceCount) * 100
		}
		out = append(out, r)
	}
	return out, nil
}

// analyticsMetrics whitelists the timeseries metric expressions.
var analyticsMetrics = map[string]string{
	"count":      "toFloat64(count())",
	"p95":        "quantile(0.95)(duration_ms)",
	"error_rate": "if(count() = 0, 0, countIf(lower(status) = 'error' OR error != '') / count() * 100)",
}

func AnalyticsMetricValid(metric string) bool {
	_, ok := analyticsMetrics[metric]
	return ok
}

// GetTraceAnalyticsTimeseries returns bucketed values per group for the
// top-8 groups by volume in the window.
func (s *Store) GetTraceAnalyticsTimeseries(ctx context.Context, metric, groupBy, service string, minutes, intervalMinutes int) ([]model.TraceAnalyticsPoint, error) {
	col := analyticsGroupCols[groupBy]
	expr := analyticsMetrics[metric]
	if minutes <= 0 {
		minutes = 15
	}
	if intervalMinutes <= 0 {
		intervalMinutes = 1
	}

	var sb []string
	args := []any{}
	sb = append(sb, `
SELECT toStartOfInterval(start_time, INTERVAL ? MINUTE) AS bucket,
       `+col+` AS grp,
       `+expr+` AS value
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE`)
	args = append(args, intervalMinutes, minutes)
	if service != "" {
		sb = append(sb, "AND service = ?")
		args = append(args, service)
	}
	sb = append(sb, `AND `+col+` IN (
  SELECT `+col+` FROM traces WHERE start_time >= now() - INTERVAL ? MINUTE GROUP BY `+col+` ORDER BY count() DESC LIMIT 8
)`)
	args = append(args, minutes)
	sb = append(sb, "GROUP BY bucket, grp ORDER BY bucket")

	rows, err := s.conn.Query(ctx, strings.Join(sb, " "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.TraceAnalyticsPoint
	for rows.Next() {
		var p model.TraceAnalyticsPoint
		if err := rows.Scan(&p.Timestamp, &p.Group, &p.Value); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

func (s *Store) GetSlowestTraces(ctx context.Context, service string, minutes, limit int) ([]model.Trace, error) {
	if minutes <= 0 {
		minutes = 15
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	var sb []string
	args := []any{}
	sb = append(sb, `
SELECT trace_id, service, name, route, duration_ms, status, start_time
FROM traces
WHERE parent_span_id = '' AND start_time >= now() - INTERVAL ? MINUTE`)
	args = append(args, minutes)
	if service != "" {
		sb = append(sb, "AND service = ?")
		args = append(args, service)
	}
	sb = append(sb, "ORDER BY duration_ms DESC LIMIT ?")
	args = append(args, limit)

	rows, err := s.conn.Query(ctx, strings.Join(sb, " "), args...)
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
