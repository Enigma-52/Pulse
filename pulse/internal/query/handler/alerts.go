package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

var (
	validSignals      = map[string]bool{"traces": true, "logs": true, "metrics": true}
	validOperators    = map[string]bool{"gt": true, "gte": true, "lt": true, "lte": true}
	validAggregations = map[string]map[string]bool{
		"traces":  {"count": true, "avg": true, "p95": true, "p99": true, "error_rate": true, "error_count": true},
		"logs":    {"count": true, "error_count": true},
		"metrics": {"value_avg": true, "value_max": true},
	}
)

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

type alertRulePayload struct {
	Name           string   `json:"name"`
	Signal         string   `json:"signal"`
	MetricName     string   `json:"metric_name"`
	Service        string   `json:"service"`
	GroupByService bool     `json:"group_by_service"`
	Aggregation    string   `json:"aggregation"`
	Operator       string   `json:"operator"`
	Threshold      float64  `json:"threshold"`
	WindowMinutes  uint32   `json:"window_minutes"`
	ChannelIDs     []string `json:"channel_ids"`
	Enabled        *bool    `json:"enabled"`
}

func (p alertRulePayload) validate() string {
	if strings.TrimSpace(p.Name) == "" {
		return "name is required"
	}
	if !validSignals[p.Signal] {
		return "signal must be one of traces, logs, metrics"
	}
	if !validAggregations[p.Signal][p.Aggregation] {
		return "invalid aggregation for signal " + p.Signal
	}
	if !validOperators[p.Operator] {
		return "operator must be one of gt, gte, lt, lte"
	}
	if math.IsNaN(p.Threshold) || math.IsInf(p.Threshold, 0) {
		return "threshold must be a finite number"
	}
	if p.WindowMinutes < 1 || p.WindowMinutes > 1440 {
		return "window_minutes must be between 1 and 1440"
	}
	if p.Signal == "metrics" && strings.TrimSpace(p.MetricName) == "" {
		return "metric_name is required for metrics rules"
	}
	return ""
}

func (p alertRulePayload) toRule(id string, createdAt time.Time) model.AlertRule {
	enabled := true
	if p.Enabled != nil {
		enabled = *p.Enabled
	}
	channels := p.ChannelIDs
	if channels == nil {
		channels = []string{}
	}
	return model.AlertRule{
		ID: id, Name: strings.TrimSpace(p.Name), Signal: p.Signal,
		MetricName: strings.TrimSpace(p.MetricName), Service: strings.TrimSpace(p.Service),
		GroupByService: p.GroupByService, Aggregation: p.Aggregation, Operator: p.Operator,
		Threshold: p.Threshold, WindowMinutes: p.WindowMinutes, ChannelIDs: channels,
		Enabled: enabled, CreatedAt: createdAt,
	}
}

func (h *Handler) HandleAlertRulesList(w http.ResponseWriter, _ *http.Request) {
	rules, err := h.Store.ListAlertRules(context.Background())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query alert rules")
		return
	}
	if rules == nil {
		rules = []model.AlertRule{}
	}
	writeJSON(w, http.StatusOK, model.AlertRulesResponse{Items: rules})
}

func (h *Handler) HandleAlertRuleCreate(w http.ResponseWriter, r *http.Request) {
	var p alertRulePayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if msg := p.validate(); msg != "" {
		writeJSONError(w, http.StatusBadRequest, msg)
		return
	}
	rule := p.toRule(newID(), time.Now().UTC())
	if err := h.Store.UpsertAlertRule(context.Background(), rule); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create alert rule")
		return
	}
	writeJSON(w, http.StatusCreated, rule)
}

func (h *Handler) HandleAlertRuleGet(w http.ResponseWriter, r *http.Request) {
	rule, err := h.Store.GetAlertRule(context.Background(), mux.Vars(r)["id"])
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query alert rule")
		return
	}
	if rule == nil {
		writeJSONError(w, http.StatusNotFound, "alert rule not found")
		return
	}
	writeJSON(w, http.StatusOK, rule)
}

func (h *Handler) HandleAlertRuleUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	existing, err := h.Store.GetAlertRule(ctx, mux.Vars(r)["id"])
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query alert rule")
		return
	}
	if existing == nil {
		writeJSONError(w, http.StatusNotFound, "alert rule not found")
		return
	}

	var p alertRulePayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if msg := p.validate(); msg != "" {
		writeJSONError(w, http.StatusBadRequest, msg)
		return
	}
	rule := p.toRule(existing.ID, existing.CreatedAt)
	if err := h.Store.UpsertAlertRule(ctx, rule); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to update alert rule")
		return
	}
	writeJSON(w, http.StatusOK, rule)
}

func (h *Handler) HandleAlertRuleDelete(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	existing, err := h.Store.GetAlertRule(ctx, mux.Vars(r)["id"])
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query alert rule")
		return
	}
	if existing == nil {
		writeJSONError(w, http.StatusNotFound, "alert rule not found")
		return
	}
	if err := h.Store.DeleteAlertRule(ctx, *existing); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to delete alert rule")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
