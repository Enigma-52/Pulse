package store

import (
	"context"
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
