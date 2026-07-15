package alerting

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
	"github.com/pulse-observability/pulse/pulse/internal/query/store"
)

// Evaluator periodically evaluates enabled alert rules and records
// firing/resolved transitions in pulse_alerts. State is in-memory only:
// after a restart a still-breaching rule simply re-fires.
type Evaluator struct {
	Store    *store.Store
	Interval time.Duration
	Notify   func(ctx context.Context, rule model.AlertRule, alert model.Alert)

	state map[string]*instanceState // key: ruleID|service
}

type instanceState struct {
	alertID string
	firedAt time.Time
	rule    model.AlertRule
	service string
}

func New(s *store.Store, interval time.Duration) *Evaluator {
	return &Evaluator{Store: s, Interval: interval, state: map[string]*instanceState{}}
}

func (e *Evaluator) Run(ctx context.Context) {
	if e.Interval <= 0 {
		log.Printf("alert evaluator disabled")
		return
	}
	log.Printf("alert evaluator running every %s", e.Interval)
	ticker := time.NewTicker(e.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.tick(ctx)
		}
	}
}

func (e *Evaluator) tick(ctx context.Context) {
	rules, err := e.Store.ListEnabledAlertRules(ctx)
	if err != nil {
		log.Printf("alert evaluator: list rules: %v", err)
		return
	}

	seen := map[string]model.AlertRule{}
	for _, rule := range rules {
		results, err := e.Store.EvaluateRule(ctx, rule)
		if err != nil {
			log.Printf("alert evaluator: rule %q: %v", rule.Name, err)
			continue
		}
		for _, res := range results {
			key := rule.ID + "|" + res.Service
			seen[key] = rule
			if breaches(res.Value, rule.Operator, rule.Threshold) {
				e.fire(ctx, rule, res.Service, res.Value, key)
			} else {
				e.resolve(ctx, rule, res.Service, res.Value, key)
			}
		}
	}

	// Instances whose rule no longer produced a result (service went quiet on
	// a group-by rule, or rule deleted/disabled) must still be resolved —
	// otherwise their pulse_alerts rows stay "firing" forever.
	for key, st := range e.state {
		if _, ok := seen[key]; ok {
			continue
		}
		alert := model.Alert{
			ID: st.alertID, RuleID: st.rule.ID, RuleName: st.rule.Name, Service: st.service,
			Status: "resolved", Value: 0, Threshold: st.rule.Threshold,
			Message: st.rule.Name + ": no longer evaluated (rule removed, disabled, or instance went quiet)",
			FiredAt: st.firedAt, ResolvedAt: time.Now().UTC(),
		}
		if err := e.Store.InsertAlert(ctx, alert); err != nil {
			log.Printf("alert evaluator: resolve stale alert: %v", err)
			continue // keep state so we retry next tick
		}
		log.Printf("alert resolved (stale): %s", st.rule.Name)
		if e.Notify != nil {
			e.Notify(ctx, st.rule, alert)
		}
		delete(e.state, key)
	}
}

func breaches(value float64, operator string, threshold float64) bool {
	switch operator {
	case "gt":
		return value > threshold
	case "gte":
		return value >= threshold
	case "lt":
		return value < threshold
	case "lte":
		return value <= threshold
	}
	return false
}

func (e *Evaluator) fire(ctx context.Context, rule model.AlertRule, service string, value float64, key string) {
	if _, alreadyFiring := e.state[key]; alreadyFiring {
		return // no re-notification while continuously firing
	}
	now := time.Now().UTC()
	alert := model.Alert{
		ID: newID(), RuleID: rule.ID, RuleName: rule.Name, Service: service,
		Status: "firing", Value: value, Threshold: rule.Threshold,
		Message: alertMessage(rule, service, value), FiredAt: now,
	}
	if err := e.Store.InsertAlert(ctx, alert); err != nil {
		log.Printf("alert evaluator: insert alert: %v", err)
		return
	}
	e.state[key] = &instanceState{alertID: alert.ID, firedAt: now, rule: rule, service: service}
	log.Printf("alert firing: %s", alert.Message)
	if e.Notify != nil {
		e.Notify(ctx, rule, alert)
	}
}

func (e *Evaluator) resolve(ctx context.Context, rule model.AlertRule, service string, value float64, key string) {
	st, wasFiring := e.state[key]
	if !wasFiring {
		return
	}
	delete(e.state, key)

	alert := model.Alert{
		ID: st.alertID, RuleID: rule.ID, RuleName: rule.Name, Service: service,
		Status: "resolved", Value: value, Threshold: rule.Threshold,
		Message: alertMessage(rule, service, value), FiredAt: st.firedAt,
		ResolvedAt: time.Now().UTC(),
	}
	if err := e.Store.InsertAlert(ctx, alert); err != nil {
		log.Printf("alert evaluator: resolve alert: %v", err)
		return
	}
	log.Printf("alert resolved: %s", rule.Name)
	if e.Notify != nil {
		e.Notify(ctx, rule, alert)
	}
}

func alertMessage(rule model.AlertRule, service string, value float64) string {
	msg := fmt.Sprintf("%s: %s %s %s %.2f (current %.2f, window %dm)",
		rule.Name, rule.Aggregation, rule.Signal, rule.Operator, rule.Threshold, value, rule.WindowMinutes)
	if service != "" {
		msg += " service=" + service
	}
	return msg
}

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
