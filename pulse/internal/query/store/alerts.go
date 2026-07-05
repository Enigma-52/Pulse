package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (s *Store) ListAlertRules(ctx context.Context) ([]model.AlertRule, error) {
	rows, err := s.conn.Query(ctx, `
SELECT id, name, signal, metric_name, service, group_by_service, aggregation,
       operator, threshold, window_minutes, channel_ids, enabled, created_at, updated_at
FROM pulse_alert_rules FINAL
WHERE deleted = 0
ORDER BY created_at DESC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []model.AlertRule
	for rows.Next() {
		r, err := scanAlertRule(rows)
		if err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, nil
}

func (s *Store) ListEnabledAlertRules(ctx context.Context) ([]model.AlertRule, error) {
	rules, err := s.ListAlertRules(ctx)
	if err != nil {
		return nil, err
	}
	enabled := rules[:0]
	for _, r := range rules {
		if r.Enabled {
			enabled = append(enabled, r)
		}
	}
	return enabled, nil
}

func (s *Store) GetAlertRule(ctx context.Context, id string) (*model.AlertRule, error) {
	rows, err := s.conn.Query(ctx, `
SELECT id, name, signal, metric_name, service, group_by_service, aggregation,
       operator, threshold, window_minutes, channel_ids, enabled, created_at, updated_at
FROM pulse_alert_rules FINAL
WHERE deleted = 0 AND id = ?
LIMIT 1
`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}
	r, err := scanAlertRule(rows)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanAlertRule(rows rowScanner) (model.AlertRule, error) {
	var r model.AlertRule
	var groupBy, enabled uint8
	err := rows.Scan(&r.ID, &r.Name, &r.Signal, &r.MetricName, &r.Service, &groupBy,
		&r.Aggregation, &r.Operator, &r.Threshold, &r.WindowMinutes, &r.ChannelIDs,
		&enabled, &r.CreatedAt, &r.UpdatedAt)
	r.GroupByService = groupBy == 1
	r.Enabled = enabled == 1
	if r.ChannelIDs == nil {
		r.ChannelIDs = []string{}
	}
	return r, err
}

// UpsertAlertRule inserts a new version row; ReplacingMergeTree keeps the
// latest by updated_at.
func (s *Store) UpsertAlertRule(ctx context.Context, r model.AlertRule) error {
	return s.insertAlertRuleRow(ctx, r, 0)
}

func (s *Store) DeleteAlertRule(ctx context.Context, r model.AlertRule) error {
	return s.insertAlertRuleRow(ctx, r, 1)
}

func (s *Store) insertAlertRuleRow(ctx context.Context, r model.AlertRule, deleted uint8) error {
	return s.conn.Exec(ctx, `
INSERT INTO pulse_alert_rules
(id, name, signal, metric_name, service, group_by_service, aggregation, operator,
 threshold, window_minutes, channel_ids, enabled, deleted, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, r.ID, r.Name, r.Signal, r.MetricName, r.Service, boolToUint8(r.GroupByService),
		r.Aggregation, r.Operator, r.Threshold, r.WindowMinutes, r.ChannelIDs,
		boolToUint8(r.Enabled), deleted, r.CreatedAt, time.Now().UTC())
}

func boolToUint8(b bool) uint8 {
	if b {
		return 1
	}
	return 0
}

// --- Rule evaluation ---

type RuleResult struct {
	Service string
	Value   float64
}

// EvaluateRule runs the rule's aggregation over its trailing window.
// Returns one result, or one per service when GroupByService is set.
func (s *Store) EvaluateRule(ctx context.Context, r model.AlertRule) ([]RuleResult, error) {
	agg, table, timeCol := "", "", ""
	args := []any{}

	switch r.Signal {
	case "traces":
		table, timeCol = "traces", "start_time"
		switch r.Aggregation {
		case "count":
			agg = "toFloat64(count())"
		case "avg":
			agg = "avg(duration_ms)"
		case "p95":
			agg = "quantile(0.95)(duration_ms)"
		case "p99":
			agg = "quantile(0.99)(duration_ms)"
		case "error_count":
			agg = "toFloat64(countIf(lower(status) = 'error' OR error != ''))"
		case "error_rate":
			agg = "if(count() = 0, 0, countIf(lower(status) = 'error' OR error != '') / count() * 100)"
		}
	case "logs":
		table, timeCol = "logs", "timestamp"
		switch r.Aggregation {
		case "count":
			agg = "toFloat64(count())"
		case "error_count":
			agg = "toFloat64(countIf(lower(level) IN ('error', 'fatal')))"
		}
	case "metrics":
		table, timeCol = "metrics", "timestamp"
		switch r.Aggregation {
		case "value_avg":
			agg = "avg(value)"
		case "value_max":
			agg = "max(value)"
		}
	}
	if agg == "" || table == "" {
		return nil, fmt.Errorf("unsupported rule: signal=%q aggregation=%q", r.Signal, r.Aggregation)
	}

	selectCols := "'' AS service, " + agg + " AS value"
	groupBy := ""
	if r.GroupByService {
		selectCols = "service, " + agg + " AS value"
		groupBy = "GROUP BY service"
	}

	query := "SELECT " + selectCols + " FROM " + table +
		" WHERE " + timeCol + " >= now() - INTERVAL ? MINUTE"
	args = append(args, r.WindowMinutes)

	if r.Signal == "metrics" {
		query += " AND name = ?"
		args = append(args, r.MetricName)
	}
	if r.Service != "" {
		query += " AND service = ?"
		args = append(args, r.Service)
	}
	if groupBy != "" {
		query += " " + groupBy
	}

	rows, err := s.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []RuleResult
	for rows.Next() {
		var res RuleResult
		if err := rows.Scan(&res.Service, &res.Value); err != nil {
			return nil, err
		}
		results = append(results, res)
	}
	return results, nil
}

// --- Alerts (history) ---

func buildAlertQuery(f model.AlertFilters) (string, []any) {
	var sb []string
	args := []any{}
	sb = append(sb, `
SELECT id, rule_id, rule_name, service, status, value, threshold, message, fired_at, resolved_at
FROM pulse_alerts FINAL
WHERE 1=1`)
	if f.Status != "" {
		sb = append(sb, "AND status = ?")
		args = append(args, f.Status)
	}
	if f.RuleID != "" {
		sb = append(sb, "AND rule_id = ?")
		args = append(args, f.RuleID)
	}
	if f.HasStart {
		sb = append(sb, "AND fired_at >= ?")
		args = append(args, f.Start)
	}
	if f.HasEnd {
		sb = append(sb, "AND fired_at <= ?")
		args = append(args, f.End)
	}
	sb = append(sb, "ORDER BY fired_at DESC LIMIT ? OFFSET ?")
	args = append(args, f.Limit, f.Offset)
	return strings.Join(sb, " "), args
}

func (s *Store) ListAlerts(ctx context.Context, f model.AlertFilters) ([]model.Alert, error) {
	query, args := buildAlertQuery(f)
	rows, err := s.conn.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []model.Alert
	for rows.Next() {
		var a model.Alert
		if err := rows.Scan(&a.ID, &a.RuleID, &a.RuleName, &a.Service, &a.Status,
			&a.Value, &a.Threshold, &a.Message, &a.FiredAt, &a.ResolvedAt); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, nil
}

func (s *Store) GetAlert(ctx context.Context, id string) (*model.Alert, error) {
	rows, err := s.conn.Query(ctx, `
SELECT id, rule_id, rule_name, service, status, value, threshold, message, fired_at, resolved_at
FROM pulse_alerts FINAL
WHERE id = ?
LIMIT 1
`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}
	var a model.Alert
	if err := rows.Scan(&a.ID, &a.RuleID, &a.RuleName, &a.Service, &a.Status,
		&a.Value, &a.Threshold, &a.Message, &a.FiredAt, &a.ResolvedAt); err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *Store) InsertAlert(ctx context.Context, a model.Alert) error {
	return s.conn.Exec(ctx, `
INSERT INTO pulse_alerts
(id, rule_id, rule_name, service, status, value, threshold, message, fired_at, resolved_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, a.ID, a.RuleID, a.RuleName, a.Service, a.Status, a.Value, a.Threshold, a.Message,
		a.FiredAt, a.ResolvedAt, time.Now().UTC())
}

// --- Notification channels ---

func (s *Store) ListChannels(ctx context.Context) ([]model.NotificationChannel, error) {
	rows, err := s.conn.Query(ctx, `
SELECT id, name, type, config_json, created_at, updated_at
FROM pulse_notification_channels FINAL
WHERE deleted = 0
ORDER BY created_at DESC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []model.NotificationChannel
	for rows.Next() {
		var c model.NotificationChannel
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.ConfigJSON, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		channels = append(channels, c)
	}
	return channels, nil
}

func (s *Store) GetChannel(ctx context.Context, id string) (*model.NotificationChannel, error) {
	rows, err := s.conn.Query(ctx, `
SELECT id, name, type, config_json, created_at, updated_at
FROM pulse_notification_channels FINAL
WHERE deleted = 0 AND id = ?
LIMIT 1
`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}
	var c model.NotificationChannel
	if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.ConfigJSON, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) UpsertChannel(ctx context.Context, c model.NotificationChannel) error {
	return s.insertChannelRow(ctx, c, 0)
}

func (s *Store) DeleteChannel(ctx context.Context, c model.NotificationChannel) error {
	return s.insertChannelRow(ctx, c, 1)
}

func (s *Store) insertChannelRow(ctx context.Context, c model.NotificationChannel, deleted uint8) error {
	return s.conn.Exec(ctx, `
INSERT INTO pulse_notification_channels
(id, name, type, config_json, deleted, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
`, c.ID, c.Name, c.Type, c.ConfigJSON, deleted, c.CreatedAt, time.Now().UTC())
}
