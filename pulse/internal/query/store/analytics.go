package store

import (
	"context"
	"fmt"
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

// GetServicesTimeseries returns request-count buckets for the top-N services
// by volume in one query, for sparklines on the services and overview pages.
// GetServiceDependencies derives the service call graph from spans: a child
// span whose parent span belongs to a different service is one call from the
// parent's service to the child's. Aggregated per (from,to) edge with call
// count, latency, and error rate of the callee side.
func (s *Store) GetServiceDependencies(ctx context.Context, minutes int, environment string) ([]model.ServiceDependency, error) {
	if minutes <= 0 {
		minutes = 15
	}

	envFilter := ""
	args := []any{minutes, minutes}
	if environment != "" {
		envFilter = " AND child.environment = ? AND parent.environment = ?"
		args = append(args, environment, environment)
	}

	rows, err := s.conn.Query(ctx, fmt.Sprintf(`
SELECT parent.service AS from_service,
       child.service  AS to_service,
       count()        AS calls,
       countIf(lower(child.status) = 'error' OR child.error != '') AS error_count,
       avg(child.duration_ms)              AS avg_ms,
       quantile(0.95)(child.duration_ms)   AS p95_ms
FROM traces AS child
INNER JOIN traces AS parent
  ON child.trace_id = parent.trace_id AND child.parent_span_id = parent.span_id
WHERE child.parent_span_id != ''
  AND child.service != parent.service
  AND child.start_time  >= now() - INTERVAL ? MINUTE
  AND parent.start_time >= now() - INTERVAL ? MINUTE%s
GROUP BY from_service, to_service
ORDER BY calls DESC
LIMIT 200
`, envFilter), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.ServiceDependency
	for rows.Next() {
		var d model.ServiceDependency
		if err := rows.Scan(&d.FromService, &d.ToService, &d.Calls, &d.ErrorCount, &d.AvgMs, &d.P95Ms); err != nil {
			return nil, err
		}
		if d.Calls > 0 {
			d.ErrorRate = float64(d.ErrorCount) / float64(d.Calls) * 100
		}
		out = append(out, d)
	}
	return out, nil
}

func (s *Store) GetServicesTimeseries(ctx context.Context, minutes, intervalMinutes, topN int, environment string) ([]model.TraceAnalyticsPoint, error) {
	if minutes <= 0 {
		minutes = 15
	}
	if intervalMinutes <= 0 {
		intervalMinutes = 1
	}
	if topN <= 0 || topN > 20 {
		topN = 10
	}

	// envFilter is applied to both the outer scan and the top-N subquery so a
	// selected environment narrows the series consistently.
	envFilter := ""
	if environment != "" {
		envFilter = " AND environment = ?"
	}

	args := []any{intervalMinutes, minutes}
	if environment != "" {
		args = append(args, environment)
	}
	args = append(args, minutes)
	if environment != "" {
		args = append(args, environment)
	}
	args = append(args, topN)

	rows, err := s.conn.Query(ctx, fmt.Sprintf(`
SELECT toStartOfInterval(start_time, INTERVAL ? MINUTE) AS bucket,
       service AS grp,
       toFloat64(count()) AS value
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE%s
  AND service IN (
    SELECT service FROM traces WHERE start_time >= now() - INTERVAL ? MINUTE%s GROUP BY service ORDER BY count() DESC LIMIT ?
  )
GROUP BY bucket, grp
ORDER BY bucket
`, envFilter, envFilter), args...)
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
