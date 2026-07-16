package store

import (
	"context"
	"strings"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (s *Store) ListExceptionGroups(ctx context.Context, f model.ExceptionFilters) ([]model.ExceptionGroup, error) {
	var sb []string
	args := []any{}
	sb = append(sb, `
SELECT fingerprint,
       any(exception_type) AS type,
       any(exception_message) AS message,
       any(service) AS service,
       count() AS occurrences,
       min(timestamp) AS first_seen,
       max(timestamp) AS last_seen
FROM exceptions
WHERE timestamp >= now() - INTERVAL ? MINUTE`)
	minutes := f.Minutes
	if minutes <= 0 {
		minutes = 15
	}
	args = append(args, minutes)
	if f.Service != "" {
		sb = append(sb, "AND service = ?")
		args = append(args, f.Service)
	}
	if f.Search != "" {
		sb = append(sb, "AND (exception_type ILIKE ? OR exception_message ILIKE ?)")
		pattern := "%" + f.Search + "%"
		args = append(args, pattern, pattern)
	}
	sb = append(sb, "GROUP BY fingerprint ORDER BY last_seen DESC LIMIT ? OFFSET ?")
	args = append(args, f.Limit, f.Offset)

	rows, err := s.conn.Query(ctx, strings.Join(sb, " "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []model.ExceptionGroup
	for rows.Next() {
		var g model.ExceptionGroup
		if err := rows.Scan(&g.Fingerprint, &g.Type, &g.Message, &g.Service,
			&g.Occurrences, &g.FirstSeen, &g.LastSeen); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, nil
}

func (s *Store) GetExceptionGroup(ctx context.Context, fingerprint string, minutes int) (*model.ExceptionDetail, error) {
	if minutes <= 0 {
		minutes = 15
	}

	rows, err := s.conn.Query(ctx, `
SELECT fingerprint,
       any(exception_type) AS type,
       any(exception_message) AS message,
       any(service) AS service,
       count() AS occurrences,
       min(timestamp) AS first_seen,
       max(timestamp) AS last_seen
FROM exceptions
WHERE fingerprint = ? AND timestamp >= now() - INTERVAL ? MINUTE
GROUP BY fingerprint
`, fingerprint, minutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}
	var d model.ExceptionDetail
	if err := rows.Scan(&d.Fingerprint, &d.Type, &d.Message, &d.Service,
		&d.Occurrences, &d.FirstSeen, &d.LastSeen); err != nil {
		return nil, err
	}
	rows.Close()

	// Latest occurrence for the stacktrace + environment/route context.
	latest, err := s.conn.Query(ctx, `
SELECT stacktrace, environment, route
FROM exceptions
WHERE fingerprint = ?
ORDER BY timestamp DESC
LIMIT 1
`, fingerprint)
	if err != nil {
		return nil, err
	}
	defer latest.Close()
	if latest.Next() {
		if err := latest.Scan(&d.Stacktrace, &d.Environment, &d.Route); err != nil {
			return nil, err
		}
	}

	// Recent distinct traces containing this exception, newest first.
	traces, err := s.conn.Query(ctx, `
SELECT trace_id
FROM exceptions
WHERE fingerprint = ? AND trace_id != ''
GROUP BY trace_id
ORDER BY max(timestamp) DESC
LIMIT 20
`, fingerprint)
	if err != nil {
		return nil, err
	}
	defer traces.Close()
	for traces.Next() {
		var tid string
		if err := traces.Scan(&tid); err != nil {
			return nil, err
		}
		d.TraceIDs = append(d.TraceIDs, tid)
	}
	if d.TraceIDs == nil {
		d.TraceIDs = []string{}
	}
	return &d, nil
}

func (s *Store) ExceptionFrequency(ctx context.Context, fingerprint string, minutes, intervalMinutes int) ([]model.ExceptionBucket, error) {
	if minutes <= 0 {
		minutes = 15
	}
	if intervalMinutes <= 0 {
		intervalMinutes = 1
	}

	rows, err := s.conn.Query(ctx, `
SELECT toStartOfInterval(timestamp, INTERVAL ? MINUTE) AS bucket, count() AS c
FROM exceptions
WHERE fingerprint = ? AND timestamp >= now() - INTERVAL ? MINUTE
GROUP BY bucket
ORDER BY bucket
`, intervalMinutes, fingerprint, minutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buckets []model.ExceptionBucket
	for rows.Next() {
		var b model.ExceptionBucket
		if err := rows.Scan(&b.Timestamp, &b.Count); err != nil {
			return nil, err
		}
		buckets = append(buckets, b)
	}
	return buckets, nil
}
