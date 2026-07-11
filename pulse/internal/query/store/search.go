package store

import (
	"context"
	"time"
)

type SearchResult struct {
	Type      string    `json:"type"` // trace | service | log | metric | exception
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Subtitle  string    `json:"subtitle"`
	Timestamp time.Time `json:"timestamp"`
}

// Search runs cross-signal lookups: exact trace id, service names, trace
// routes/operations, log messages, metric names, and exception types/messages.
// Each source is capped at 5 rows; exact trace-id matches rank first.
func (s *Store) Search(ctx context.Context, q string, minutes int) ([]SearchResult, error) {
	if minutes <= 0 {
		minutes = 60
	}
	pattern := "%" + q + "%"
	var results []SearchResult

	collect := func(query string, mapper func(scan func(...any) error) (SearchResult, error), args ...any) error {
		rows, err := s.conn.Query(ctx, query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			r, err := mapper(rows.Scan)
			if err != nil {
				return err
			}
			results = append(results, r)
		}
		return nil
	}

	// Exact trace id match (any window — ids are unique enough).
	if err := collect(`
SELECT trace_id, any(name), any(service), max(start_time)
FROM traces WHERE trace_id = ? GROUP BY trace_id LIMIT 1
`, func(scan func(...any) error) (SearchResult, error) {
		var r SearchResult
		r.Type = "trace"
		err := scan(&r.ID, &r.Title, &r.Subtitle, &r.Timestamp)
		return r, err
	}, q); err != nil {
		return nil, err
	}

	// Service names.
	if err := collect(`
SELECT service, count(), max(start_time)
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE AND service ILIKE ?
GROUP BY service ORDER BY count() DESC LIMIT 5
`, func(scan func(...any) error) (SearchResult, error) {
		var r SearchResult
		var cnt uint64
		r.Type = "service"
		err := scan(&r.ID, &cnt, &r.Timestamp)
		r.Title = r.ID
		r.Subtitle = "service"
		return r, err
	}, minutes, pattern); err != nil {
		return nil, err
	}

	// Trace routes / operation names.
	if err := collect(`
SELECT trace_id, name, service, start_time
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE AND (route ILIKE ? OR name ILIKE ?)
ORDER BY start_time DESC LIMIT 5
`, func(scan func(...any) error) (SearchResult, error) {
		var r SearchResult
		r.Type = "trace"
		err := scan(&r.ID, &r.Title, &r.Subtitle, &r.Timestamp)
		return r, err
	}, minutes, pattern, pattern); err != nil {
		return nil, err
	}

	// Log messages.
	if err := collect(`
SELECT trace_id, message, service, timestamp
FROM logs
WHERE timestamp >= now() - INTERVAL ? MINUTE AND message ILIKE ?
ORDER BY timestamp DESC LIMIT 5
`, func(scan func(...any) error) (SearchResult, error) {
		var r SearchResult
		r.Type = "log"
		err := scan(&r.ID, &r.Title, &r.Subtitle, &r.Timestamp)
		return r, err
	}, minutes, pattern); err != nil {
		return nil, err
	}

	// Metric names.
	if err := collect(`
SELECT name, any(service), max(timestamp)
FROM metrics
WHERE timestamp >= now() - INTERVAL ? MINUTE AND name ILIKE ?
GROUP BY name ORDER BY max(timestamp) DESC LIMIT 5
`, func(scan func(...any) error) (SearchResult, error) {
		var r SearchResult
		r.Type = "metric"
		err := scan(&r.ID, &r.Subtitle, &r.Timestamp)
		r.Title = r.ID
		return r, err
	}, minutes, pattern); err != nil {
		return nil, err
	}

	// Exceptions.
	if err := collect(`
SELECT fingerprint, any(exception_type), any(exception_message), max(timestamp)
FROM exceptions
WHERE timestamp >= now() - INTERVAL ? MINUTE AND (exception_type ILIKE ? OR exception_message ILIKE ?)
GROUP BY fingerprint ORDER BY max(timestamp) DESC LIMIT 5
`, func(scan func(...any) error) (SearchResult, error) {
		var r SearchResult
		r.Type = "exception"
		err := scan(&r.ID, &r.Title, &r.Subtitle, &r.Timestamp)
		return r, err
	}, minutes, pattern, pattern); err != nil {
		return nil, err
	}

	return results, nil
}
