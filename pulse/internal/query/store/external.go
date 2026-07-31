package store

import (
	"context"
	"strings"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

// hostExpr resolves the remote host of a client span from OTel attributes,
// preferring the stable semconv keys and falling back to the URL's domain.
const hostExpr = `coalesce(
	nullIf(JSONExtractString(attributes_json, 'server.address'), ''),
	nullIf(JSONExtractString(attributes_json, 'net.peer.name'), ''),
	nullIf(domain(JSONExtractString(attributes_json, 'url.full')), ''),
	nullIf(domain(JSONExtractString(attributes_json, 'http.url')), '')
)`

// GetExternalCalls aggregates outbound HTTP calls: client spans that are not
// database calls, grouped by remote host. Mirrors the databases derivation.
func (s *Store) GetExternalCalls(ctx context.Context, service string, minutes int) ([]model.ExternalCallSummary, error) {
	if minutes <= 0 {
		minutes = 15
	}

	var sb []string
	args := []any{}
	sb = append(sb, `
SELECT `+hostExpr+` AS host,
       count() AS call_count,
       countIf(lower(status) = 'error' OR error != '') AS error_count,
       avg(duration_ms) AS avg_ms,
       quantile(0.95)(duration_ms) AS p95_ms,
       max(start_time) AS last_seen
FROM traces
WHERE kind = 'client'
  AND JSONExtractString(attributes_json, 'db.system') = ''
  AND start_time >= now() - INTERVAL ? MINUTE`)
	args = append(args, minutes)
	if service != "" {
		sb = append(sb, "AND service = ?")
		args = append(args, service)
	}
	sb = append(sb, "GROUP BY host HAVING host IS NOT NULL AND host != '' ORDER BY call_count DESC LIMIT 50")

	rows, err := s.conn.Query(ctx, strings.Join(sb, " "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.ExternalCallSummary
	for rows.Next() {
		var e model.ExternalCallSummary
		var host *string
		if err := rows.Scan(&host, &e.CallCount, &e.ErrorCount, &e.AvgMs, &e.P95Ms, &e.LastSeen); err != nil {
			return nil, err
		}
		if host != nil {
			e.Host = *host
		}
		if e.CallCount > 0 {
			e.ErrorRate = float64(e.ErrorCount) / float64(e.CallCount) * 100
		}
		out = append(out, e)
	}
	return out, nil
}

// GetExternalHostOverview returns aggregate stats for a single remote host.
func (s *Store) GetExternalHostOverview(ctx context.Context, host string, minutes int) (*model.ExternalHostOverview, error) {
	if minutes <= 0 {
		minutes = 15
	}
	row := s.conn.QueryRow(ctx, `
SELECT count()                                        AS call_count,
       countIf(lower(status) = 'error' OR error != '') AS error_count,
       avg(duration_ms)                               AS avg_ms,
       quantile(0.5)(duration_ms)                     AS p50_ms,
       quantile(0.95)(duration_ms)                    AS p95_ms,
       quantile(0.99)(duration_ms)                    AS p99_ms,
       min(start_time)                                AS first_seen,
       max(start_time)                                AS last_seen
FROM traces
WHERE kind = 'client'
  AND JSONExtractString(attributes_json, 'db.system') = ''
  AND `+hostExpr+` = ?
  AND start_time >= now() - INTERVAL ? MINUTE`, host, minutes)

	var o model.ExternalHostOverview
	o.Host = host
	if err := row.Scan(&o.CallCount, &o.ErrorCount, &o.AvgMs, &o.P50Ms, &o.P95Ms, &o.P99Ms, &o.FirstSeen, &o.LastSeen); err != nil {
		return nil, err
	}
	if o.CallCount > 0 {
		o.ErrorRate = float64(o.ErrorCount) / float64(o.CallCount) * 100
	}
	return &o, nil
}

// GetExternalHostCallers breaks a host's traffic down by the calling service.
func (s *Store) GetExternalHostCallers(ctx context.Context, host string, minutes int) ([]model.ExternalCaller, error) {
	if minutes <= 0 {
		minutes = 15
	}
	rows, err := s.conn.Query(ctx, `
SELECT service,
       count()                                        AS call_count,
       countIf(lower(status) = 'error' OR error != '') AS error_count,
       quantile(0.95)(duration_ms)                    AS p95_ms
FROM traces
WHERE kind = 'client'
  AND JSONExtractString(attributes_json, 'db.system') = ''
  AND `+hostExpr+` = ?
  AND start_time >= now() - INTERVAL ? MINUTE
GROUP BY service ORDER BY call_count DESC LIMIT 50`, host, minutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.ExternalCaller
	for rows.Next() {
		var c model.ExternalCaller
		if err := rows.Scan(&c.Service, &c.CallCount, &c.ErrorCount, &c.P95Ms); err != nil {
			return nil, err
		}
		if c.CallCount > 0 {
			c.ErrorRate = float64(c.ErrorCount) / float64(c.CallCount) * 100
		}
		out = append(out, c)
	}
	return out, nil
}

// GetExternalHostTraces returns recent client spans to a host, each linking to
// its full trace.
func (s *Store) GetExternalHostTraces(ctx context.Context, host string, minutes, limit int) ([]model.ExternalHostTrace, error) {
	if minutes <= 0 {
		minutes = 15
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.conn.Query(ctx, `
SELECT trace_id, service, name, duration_ms, status, start_time
FROM traces
WHERE kind = 'client'
  AND JSONExtractString(attributes_json, 'db.system') = ''
  AND `+hostExpr+` = ?
  AND start_time >= now() - INTERVAL ? MINUTE
ORDER BY start_time DESC LIMIT ?`, host, minutes, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.ExternalHostTrace
	for rows.Next() {
		var t model.ExternalHostTrace
		if err := rows.Scan(&t.TraceID, &t.Service, &t.Name, &t.DurationMs, &t.Status, &t.Timestamp); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}
