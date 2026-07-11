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
