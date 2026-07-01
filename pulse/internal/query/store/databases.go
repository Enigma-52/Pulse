package store

import (
	"context"
	"time"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (s *Store) GetDatabasesList(ctx context.Context, minutes int) ([]model.DatabaseSummary, error) {
	if minutes <= 0 {
		minutes = 15
	}
	rows, err := s.conn.Query(ctx, `
SELECT
	JSONExtractString(attributes_json, 'db.system') AS db_system,
	count() AS query_count,
	countIf(lower(status) = 'error' OR error != '') AS error_count,
	if(query_count = 0, 0, (error_count / query_count) * 100.0) AS error_rate,
	avg(duration_ms) AS avg_duration_ms,
	quantile(0.5)(duration_ms) AS p50_duration_ms,
	quantile(0.95)(duration_ms) AS p95_duration_ms,
	quantile(0.99)(duration_ms) AS p99_duration_ms,
	max(start_time) AS last_seen
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE
  AND JSONExtractString(attributes_json, 'db.system') != ''
GROUP BY db_system
ORDER BY query_count DESC
`, minutes)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dbs []model.DatabaseSummary
	for rows.Next() {
		var d model.DatabaseSummary
		var lastSeen time.Time
		if err := rows.Scan(&d.System, &d.QueryCount, &d.ErrorCount, &d.ErrorRate,
			&d.AvgDurationMs, &d.P50DurationMs, &d.P95DurationMs, &d.P99DurationMs, &lastSeen); err != nil {
			return nil, err
		}
		d.LastSeen = lastSeen.Format(time.RFC3339)
		dbs = append(dbs, d)
	}
	return dbs, nil
}

func (s *Store) GetDatabaseOverview(ctx context.Context, system string, minutes int) (*model.DatabaseOverviewResponse, error) {
	if minutes <= 0 {
		minutes = 15
	}

	// Overview stats
	rows, err := s.conn.Query(ctx, `
SELECT
	JSONExtractString(attributes_json, 'db.system') AS db_system,
	count() AS query_count,
	countIf(lower(status) = 'error' OR error != '') AS error_count,
	if(query_count = 0, 0, (error_count / query_count) * 100.0) AS error_rate,
	avg(duration_ms) AS avg_duration_ms,
	quantile(0.5)(duration_ms) AS p50_duration_ms,
	quantile(0.95)(duration_ms) AS p95_duration_ms,
	quantile(0.99)(duration_ms) AS p99_duration_ms
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE
  AND JSONExtractString(attributes_json, 'db.system') = ?
GROUP BY db_system
`, minutes, system)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}

	var ov model.DatabaseOverview
	if err := rows.Scan(&ov.System, &ov.QueryCount, &ov.ErrorCount, &ov.ErrorRate,
		&ov.AvgDurationMs, &ov.P50DurationMs, &ov.P95DurationMs, &ov.P99DurationMs); err != nil {
		return nil, err
	}

	// Distinct database names
	nameRows, err := s.conn.Query(ctx, `
SELECT DISTINCT JSONExtractString(attributes_json, 'db.name') AS db_name
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE
  AND JSONExtractString(attributes_json, 'db.system') = ?
  AND db_name != ''
ORDER BY db_name
`, minutes, system)
	if err != nil {
		return nil, err
	}
	defer nameRows.Close()

	for nameRows.Next() {
		var name string
		if err := nameRows.Scan(&name); err != nil {
			return nil, err
		}
		ov.DatabaseNames = append(ov.DatabaseNames, name)
	}
	if ov.DatabaseNames == nil {
		ov.DatabaseNames = []string{}
	}

	// Throughput over time
	interval := 60
	if minutes > 60 {
		interval = 300
	}
	if minutes > 360 {
		interval = 900
	}

	tpRows, err := s.conn.Query(ctx, `
SELECT
	toStartOfInterval(start_time, INTERVAL ? SECOND) AS ts,
	count() AS cnt,
	countIf(lower(status) = 'error' OR error != '') AS errs,
	avg(duration_ms) AS avg_ms
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE
  AND JSONExtractString(attributes_json, 'db.system') = ?
GROUP BY ts
ORDER BY ts
`, interval, minutes, system)
	if err != nil {
		return nil, err
	}
	defer tpRows.Close()

	var throughput []model.DatabaseThroughputPoint
	for tpRows.Next() {
		var p model.DatabaseThroughputPoint
		if err := tpRows.Scan(&p.Timestamp, &p.Count, &p.Errors, &p.AvgMs); err != nil {
			return nil, err
		}
		throughput = append(throughput, p)
	}
	if throughput == nil {
		throughput = []model.DatabaseThroughputPoint{}
	}

	return &model.DatabaseOverviewResponse{
		Overview:   ov,
		Throughput: throughput,
	}, nil
}

func (s *Store) GetDatabaseQueries(ctx context.Context, system string, minutes, limit, offset int) ([]model.DatabaseOperation, error) {
	if minutes <= 0 {
		minutes = 15
	}
	if limit <= 0 {
		limit = model.DefaultLimit
	}
	if limit > model.MaxLimit {
		limit = model.MaxLimit
	}

	rows, err := s.conn.Query(ctx, `
SELECT
	trace_id, span_id, service,
	JSONExtractString(attributes_json, 'db.system') AS db_system,
	JSONExtractString(attributes_json, 'db.name') AS db_name,
	if(JSONExtractString(attributes_json, 'db.statement') != '', JSONExtractString(attributes_json, 'db.statement'), name) AS db_statement,
	duration_ms, status, start_time
FROM traces
WHERE start_time >= now() - INTERVAL ? MINUTE
  AND JSONExtractString(attributes_json, 'db.system') = ?
ORDER BY duration_ms DESC
LIMIT ? OFFSET ?
`, minutes, system, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ops []model.DatabaseOperation
	for rows.Next() {
		var op model.DatabaseOperation
		if err := rows.Scan(&op.TraceID, &op.SpanID, &op.Service,
			&op.DbSystem, &op.DbName, &op.DbStatement,
			&op.DurationMs, &op.Status, &op.Timestamp); err != nil {
			return nil, err
		}
		ops = append(ops, op)
	}
	return ops, nil
}
