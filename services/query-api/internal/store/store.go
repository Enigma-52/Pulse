package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/pulse-observability/pulse/services/query-api/internal/config"
	"github.com/pulse-observability/pulse/services/query-api/internal/model"
)

type Store struct {
	conn driver.Conn
}

func Connect(cfg config.ClickHouseConfig) (*Store, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{cfg.Addr},
		Auth: clickhouse.Auth{
			Database: cfg.Database,
			Username: cfg.User,
			Password: cfg.Password,
		},
	})
	if err != nil {
		return nil, err
	}
	return &Store{conn: conn}, nil
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
		if err := rows.Scan(
			&t.TraceID,
			&t.Service,
			&t.Route,
			&t.DurationMs,
			&t.Status,
			&t.Timestamp,
		); err != nil {
			return nil, err
		}
		traces = append(traces, t)
	}
	return traces, nil
}

func (s *Store) GetTraceDetail(ctx context.Context, traceID string) ([]model.SpanDetail, error) {
	rows, err := s.conn.Query(ctx, `
SELECT
	trace_id,
	span_id,
	parent_span_id,
	service,
	environment,
	route,
	name,
	kind,
	duration_ms,
	status,
	error,
	start_time,
	end_time,
	attributes_json,
	events_json
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
			&sp.TraceID,
			&sp.SpanID,
			&sp.ParentSpanID,
			&sp.Service,
			&sp.Environment,
			&sp.Route,
			&sp.Name,
			&sp.Kind,
			&sp.DurationMs,
			&sp.Status,
			&sp.Error,
			&sp.StartTime,
			&sp.EndTime,
			&attrsJSON,
			&eventsJSON,
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
	countIf(status = 'error' OR error != '') AS error_count,
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
	if err := rows.Scan(
		&out.Service,
		&out.TraceCount,
		&out.ErrorCount,
		&out.ErrorRate,
		&out.AvgDurationMs,
		&out.P95DurationMs,
	); err != nil {
		return nil, err
	}
	return &out, nil
}

func buildTraceQuery(filters model.TraceFilters) (string, []any) {
	var sb strings.Builder
	args := make([]any, 0, 12)

	sb.WriteString(`
SELECT
	trace_id,
	service,
	route,
	duration_ms,
	status,
	start_time
FROM traces
WHERE 1=1
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
		sb.WriteString(" AND (status = 'error' OR error != '')")
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
