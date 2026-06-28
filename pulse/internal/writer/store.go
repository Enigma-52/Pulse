package writer

import (
	"context"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/pulse-observability/pulse/pulse/internal/config"
)

type Store struct {
	conn driver.Conn
}

func ConnectStore(cfg config.ClickHouseConfig) (*Store, error) {
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

func (s *Store) Conn() driver.Conn { return s.conn }

func (s *Store) EnsureTables(ctx context.Context) error {
	const tracesDDL = `
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
	status_message String DEFAULT '',
	error String DEFAULT '',
	start_time DateTime64(3),
	end_time DateTime64(3),
	attributes_json String,
	events_json String DEFAULT '[]',
	links_json String DEFAULT '[]',
	resource_attributes_json String DEFAULT '{}',
	scope_name String DEFAULT '',
	scope_version String DEFAULT ''
) ENGINE = MergeTree
ORDER BY (service, start_time)
`
	if err := s.conn.Exec(ctx, tracesDDL); err != nil {
		return err
	}

	migrations := []string{
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS kind String DEFAULT ''",
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS events_json String DEFAULT '[]'",
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS links_json String DEFAULT '[]'",
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS resource_attributes_json String DEFAULT '{}'",
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS scope_name String DEFAULT ''",
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS scope_version String DEFAULT ''",
		"ALTER TABLE traces ADD COLUMN IF NOT EXISTS status_message String DEFAULT ''",
	}
	for _, m := range migrations {
		_ = s.conn.Exec(ctx, m)
	}

	const logsDDL = `
CREATE TABLE IF NOT EXISTS logs (
	timestamp DateTime64(3),
	level String,
	severity_number Int32 DEFAULT 0,
	message String,
	service String,
	environment String,
	trace_id String DEFAULT '',
	span_id String DEFAULT '',
	attributes_json String DEFAULT '{}',
	resource_attributes_json String DEFAULT '{}',
	scope_name String DEFAULT '',
	scope_version String DEFAULT ''
) ENGINE = MergeTree
ORDER BY (service, timestamp)
`
	if err := s.conn.Exec(ctx, logsDDL); err != nil {
		return err
	}

	logsMigrations := []string{
		"ALTER TABLE logs ADD COLUMN IF NOT EXISTS severity_number Int32 DEFAULT 0",
		"ALTER TABLE logs ADD COLUMN IF NOT EXISTS attributes_json String DEFAULT '{}'",
		"ALTER TABLE logs ADD COLUMN IF NOT EXISTS resource_attributes_json String DEFAULT '{}'",
		"ALTER TABLE logs ADD COLUMN IF NOT EXISTS scope_name String DEFAULT ''",
		"ALTER TABLE logs ADD COLUMN IF NOT EXISTS scope_version String DEFAULT ''",
	}
	for _, m := range logsMigrations {
		_ = s.conn.Exec(ctx, m)
	}

	_ = s.conn.Exec(ctx, "ALTER TABLE logs RENAME COLUMN IF EXISTS fields_json TO attributes_json")

	const metricsDDL = `
CREATE TABLE IF NOT EXISTS metrics (
	name String,
	type String,
	value Float64,
	unit String,
	timestamp DateTime64(3),
	service String,
	environment String,
	attributes_json String DEFAULT '{}',
	resource_attributes_json String DEFAULT '{}',
	scope_name String DEFAULT '',
	scope_version String DEFAULT ''
) ENGINE = MergeTree
ORDER BY (service, name, timestamp)
`
	if err := s.conn.Exec(ctx, metricsDDL); err != nil {
		return err
	}

	metricsMigrations := []string{
		"ALTER TABLE metrics ADD COLUMN IF NOT EXISTS resource_attributes_json String DEFAULT '{}'",
		"ALTER TABLE metrics ADD COLUMN IF NOT EXISTS scope_name String DEFAULT ''",
		"ALTER TABLE metrics ADD COLUMN IF NOT EXISTS scope_version String DEFAULT ''",
	}
	for _, m := range metricsMigrations {
		_ = s.conn.Exec(ctx, m)
	}

	return nil
}

func (s *Store) InsertSpans(ctx context.Context, spans []Span) error {
	if len(spans) == 0 {
		return nil
	}

	batch, err := s.conn.PrepareBatch(ctx, `
INSERT INTO traces (
	trace_id, span_id, parent_span_id, service, environment, route, name, kind,
	duration_ms, status, status_message, error, start_time, end_time,
	attributes_json, events_json, links_json,
	resource_attributes_json, scope_name, scope_version
) VALUES
`)
	if err != nil {
		return err
	}

	for _, sp := range spans {
		errStr := ""
		if sp.Status == "ERROR" {
			errStr = sp.StatusMessage
		}

		if err := batch.Append(
			sp.TraceID, sp.SpanID, sp.ParentSpanID,
			sp.Service, sp.Environment, sp.Route, sp.Name, sp.Kind,
			sp.DurationMs, sp.Status, sp.StatusMessage, errStr,
			time.UnixMilli(sp.StartTimeMs), time.UnixMilli(sp.EndTimeMs),
			sp.AttributesJSON, sp.EventsJSON, sp.LinksJSON,
			sp.ResourceAttributesJSON, sp.ScopeName, sp.ScopeVersion,
		); err != nil {
			return err
		}
	}

	return batch.Send()
}

func (s *Store) InsertLogs(ctx context.Context, logs []LogEntry) error {
	if len(logs) == 0 {
		return nil
	}

	batch, err := s.conn.PrepareBatch(ctx, `
INSERT INTO logs (
	timestamp, level, severity_number, message, service, environment,
	trace_id, span_id, attributes_json,
	resource_attributes_json, scope_name, scope_version
) VALUES
`)
	if err != nil {
		return err
	}

	for _, l := range logs {
		if err := batch.Append(
			time.UnixMilli(l.TimestampMs), l.Level, l.SeverityNumber, l.Body,
			l.Service, l.Environment,
			l.TraceID, l.SpanID, l.AttributesJSON,
			l.ResourceAttributesJSON, l.ScopeName, l.ScopeVersion,
		); err != nil {
			return err
		}
	}

	return batch.Send()
}

func (s *Store) InsertMetrics(ctx context.Context, points []MetricPoint) error {
	if len(points) == 0 {
		return nil
	}

	batch, err := s.conn.PrepareBatch(ctx, `
INSERT INTO metrics (
	name, type, value, unit, timestamp, service, environment,
	attributes_json, resource_attributes_json, scope_name, scope_version
) VALUES
`)
	if err != nil {
		return err
	}

	for _, m := range points {
		if err := batch.Append(
			m.Name, m.Type, m.Value, m.Unit,
			time.UnixMilli(m.TimestampMs),
			m.Service, m.Environment,
			m.AttributesJSON, m.ResourceAttributesJSON,
			m.ScopeName, m.ScopeVersion,
		); err != nil {
			return err
		}
	}

	return batch.Send()
}
