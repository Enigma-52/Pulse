package store

import (
	"context"
	"encoding/json"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/pulse-observability/pulse/services/worker/internal/config"
	"github.com/pulse-observability/pulse/services/worker/internal/model"
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

func (s *Store) EnsureTables(ctx context.Context) error {
	const ddl = `
CREATE TABLE IF NOT EXISTS traces (
	trace_id String,
	span_id String,
	parent_span_id String,
	service String,
	environment String,
	route String,
	name String,
	kind String DEFAULT '',
	duration_ms Int64,
	status String,
	error String,
	start_time DateTime64(3),
	end_time DateTime64(3),
	attributes_json String,
	events_json String DEFAULT '[]'
) ENGINE = MergeTree
ORDER BY (service, start_time)
`
	if err := s.conn.Exec(ctx, ddl); err != nil {
		return err
	}

	// Add columns if table already existed without them
	migrations := []string{
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS kind String DEFAULT ''",
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS events_json String DEFAULT '[]'",
	}
	for _, m := range migrations {
		_ = s.conn.Exec(ctx, m)
	}

	const logsDDL = `
CREATE TABLE IF NOT EXISTS logs (
	timestamp DateTime64(3),
	level String,
	message String,
	service String,
	environment String,
	trace_id String DEFAULT '',
	span_id String DEFAULT '',
	fields_json String DEFAULT '{}'
) ENGINE = MergeTree
ORDER BY (service, timestamp)
`
	if err := s.conn.Exec(ctx, logsDDL); err != nil {
		return err
	}

	const metricsDDL = `
CREATE TABLE IF NOT EXISTS metrics (
	name String,
	type String,
	value Float64,
	unit String,
	timestamp DateTime64(3),
	service String,
	environment String,
	attributes_json String DEFAULT '{}'
) ENGINE = MergeTree
ORDER BY (service, name, timestamp)
`
	if err := s.conn.Exec(ctx, metricsDDL); err != nil {
		return err
	}

	return nil
}

func (s *Store) InsertSpans(ctx context.Context, env model.Envelope) error {
	if len(env.Spans) == 0 {
		return nil
	}

	batch, err := s.conn.PrepareBatch(ctx, `
INSERT INTO traces (
	trace_id, span_id, parent_span_id, service, environment, route, name, kind,
	duration_ms, status, error, start_time, end_time, attributes_json, events_json
) VALUES
`)
	if err != nil {
		return err
	}

	for _, span := range env.Spans {
		start := time.UnixMilli(span.StartTime)
		end := time.UnixMilli(span.EndTime)

		route := ""
		if v, ok := span.Attributes["http.path"].(string); ok {
			route = v
		}
		if route == "" {
			if v, ok := span.Attributes["http.route"].(string); ok {
				route = v
			}
		}

		kind := span.Kind
		if kind == "" {
			kind = "internal"
		}

		attrsJSON, err := json.Marshal(span.Attributes)
		if err != nil {
			return err
		}

		eventsJSON := "[]"
		if len(span.Events) > 0 {
			b, err := json.Marshal(span.Events)
			if err != nil {
				return err
			}
			eventsJSON = string(b)
		}

		if err := batch.Append(
			span.TraceID, span.SpanID, span.ParentSpanID,
			env.ServiceName, env.Environment, route, span.Name, kind,
			span.DurationMs, span.Status, span.Error,
			start, end, string(attrsJSON), eventsJSON,
		); err != nil {
			return err
		}
	}

	return batch.Send()
}

func (s *Store) InsertLogs(ctx context.Context, env model.Envelope) error {
	if len(env.Logs) == 0 {
		return nil
	}

	batch, err := s.conn.PrepareBatch(ctx, `
INSERT INTO logs (
	timestamp, level, message, service, environment, trace_id, span_id, fields_json
) VALUES
`)
	if err != nil {
		return err
	}

	for _, l := range env.Logs {
		ts := time.UnixMilli(l.Timestamp)

		fieldsJSON := "{}"
		if len(l.Fields) > 0 {
			b, err := json.Marshal(l.Fields)
			if err != nil {
				return err
			}
			fieldsJSON = string(b)
		}

		if err := batch.Append(
			ts, l.Level, l.Message,
			env.ServiceName, env.Environment,
			l.TraceID, l.SpanID, fieldsJSON,
		); err != nil {
			return err
		}
	}

	return batch.Send()
}

func (s *Store) InsertMetrics(ctx context.Context, env model.Envelope) error {
	if len(env.Metrics) == 0 {
		return nil
	}

	batch, err := s.conn.PrepareBatch(ctx, `
INSERT INTO metrics (
	name, type, value, unit, timestamp, service, environment, attributes_json
) VALUES
`)
	if err != nil {
		return err
	}

	for _, m := range env.Metrics {
		ts := time.UnixMilli(m.Timestamp)

		attrsJSON := "{}"
		if len(m.Attributes) > 0 {
			b, err := json.Marshal(m.Attributes)
			if err != nil {
				return err
			}
			attrsJSON = string(b)
		}

		if err := batch.Append(
			m.Name, m.Type, m.Value, m.Unit, ts,
			env.ServiceName, env.Environment, attrsJSON,
		); err != nil {
			return err
		}
	}

	return batch.Send()
}
