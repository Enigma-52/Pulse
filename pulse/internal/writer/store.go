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

	const exceptionsDDL = `
CREATE TABLE IF NOT EXISTS exceptions (
	timestamp DateTime64(3),
	service String,
	environment String DEFAULT '',
	trace_id String DEFAULT '',
	span_id String DEFAULT '',
	route String DEFAULT '',
	exception_type String,
	exception_message String DEFAULT '',
	stacktrace String DEFAULT '',
	fingerprint FixedString(40),
	attributes_json String DEFAULT '{}'
) ENGINE = MergeTree
ORDER BY (service, fingerprint, timestamp)
`
	if err := s.conn.Exec(ctx, exceptionsDDL); err != nil {
		return err
	}

	// Alerting tables: tiny row counts, versioned rows via ReplacingMergeTree,
	// soft deletes via the deleted flag. Reads must use FINAL.
	const alertRulesDDL = `
CREATE TABLE IF NOT EXISTS pulse_alert_rules (
	id String,
	name String,
	signal String,
	metric_name String DEFAULT '',
	service String DEFAULT '',
	group_by_service UInt8 DEFAULT 0,
	aggregation String,
	operator String,
	threshold Float64,
	window_minutes UInt32,
	channel_ids Array(String) DEFAULT [],
	enabled UInt8 DEFAULT 1,
	deleted UInt8 DEFAULT 0,
	created_at DateTime64(3),
	updated_at DateTime64(3)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id)
`
	if err := s.conn.Exec(ctx, alertRulesDDL); err != nil {
		return err
	}

	const alertsDDL = `
CREATE TABLE IF NOT EXISTS pulse_alerts (
	id String,
	rule_id String,
	rule_name String,
	service String DEFAULT '',
	status String,
	value Float64,
	threshold Float64,
	message String DEFAULT '',
	fired_at DateTime64(3),
	resolved_at DateTime64(3) DEFAULT toDateTime64(0, 3),
	updated_at DateTime64(3)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id)
`
	if err := s.conn.Exec(ctx, alertsDDL); err != nil {
		return err
	}

	const channelsDDL = `
CREATE TABLE IF NOT EXISTS pulse_notification_channels (
	id String,
	name String,
	type String,
	config_json String DEFAULT '{}',
	deleted UInt8 DEFAULT 0,
	created_at DateTime64(3),
	updated_at DateTime64(3)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (id)
`
	if err := s.conn.Exec(ctx, channelsDDL); err != nil {
		return err
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
		if sp.Status == "error" {
			errStr = sp.StatusMessage
			if errStr == "" {
				errStr = "error"
			}
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

func (s *Store) InsertExceptions(ctx context.Context, excs []Exception) error {
	if len(excs) == 0 {
		return nil
	}

	batch, err := s.conn.PrepareBatch(ctx, `
INSERT INTO exceptions (
	timestamp, service, environment, trace_id, span_id, route,
	exception_type, exception_message, stacktrace, fingerprint, attributes_json
) VALUES
`)
	if err != nil {
		return err
	}

	for _, e := range excs {
		if err := batch.Append(
			time.UnixMilli(e.TimestampMs), e.Service, e.Environment,
			e.TraceID, e.SpanID, e.Route,
			e.Type, e.Message, e.Stacktrace, e.Fingerprint, e.AttributesJSON,
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
