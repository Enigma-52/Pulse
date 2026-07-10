package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
	"github.com/pulse-observability/pulse/pulse/internal/query/store"
)

func (h *Handler) HandleTraceAnalytics(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	groupBy := q.Get("group_by")
	if groupBy == "" {
		groupBy = "service"
	}
	if !store.AnalyticsGroupValid(groupBy) {
		writeJSONError(w, http.StatusBadRequest, "group_by must be one of service, route, name")
		return
	}

	rows, err := h.Store.GetTraceAnalytics(context.Background(), groupBy, q.Get("service"), parseMinutes(r, 15))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query trace analytics")
		return
	}
	if rows == nil {
		rows = []model.TraceAnalyticsRow{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"group_by": groupBy, "items": rows})
}

func (h *Handler) HandleTraceAnalyticsTimeseries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	metric := q.Get("metric")
	if metric == "" {
		metric = "count"
	}
	if !store.AnalyticsMetricValid(metric) {
		writeJSONError(w, http.StatusBadRequest, "metric must be one of count, p95, error_rate")
		return
	}
	groupBy := q.Get("group_by")
	if groupBy == "" {
		groupBy = "service"
	}
	if !store.AnalyticsGroupValid(groupBy) {
		writeJSONError(w, http.StatusBadRequest, "group_by must be one of service, route, name")
		return
	}
	interval := 1
	if v := q.Get("interval"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			interval = n
		}
	}

	points, err := h.Store.GetTraceAnalyticsTimeseries(context.Background(), metric, groupBy, q.Get("service"), parseMinutes(r, 15), interval)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query analytics timeseries")
		return
	}
	if points == nil {
		points = []model.TraceAnalyticsPoint{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"metric": metric, "group_by": groupBy, "points": points})
}

func (h *Handler) HandleSlowestTraces(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := 10
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	traces, err := h.Store.GetSlowestTraces(context.Background(), q.Get("service"), parseMinutes(r, 15), limit)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query slowest traces")
		return
	}
	if traces == nil {
		traces = []model.Trace{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": traces})
}
