package handler

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleMetricsList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	metrics, err := h.Store.GetMetricsList(ctx)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query metrics")
		return
	}
	if metrics == nil {
		metrics = []model.MetricMeta{}
	}
	writeJSON(w, http.StatusOK, model.MetricsListResponse{Items: metrics})
}

func (h *Handler) HandleMetricSeries(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := mux.Vars(r)["name"]
	if name == "" {
		writeJSONError(w, http.StatusBadRequest, "metric name is required")
		return
	}

	q := r.URL.Query()
	minutes := 15
	if v := q.Get("minutes"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid minutes parameter")
			return
		}
		minutes = n
	}
	interval := 30
	if v := q.Get("interval"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid interval parameter")
			return
		}
		interval = n
	}

	points, err := h.Store.GetMetricSeries(ctx, name, minutes, interval, q.Get("attr_key"), q.Get("attr_value"))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query metric series")
		return
	}
	if points == nil {
		points = []model.MetricSeriesPoint{}
	}

	unit := ""
	metrics, err := h.Store.GetMetricsList(ctx)
	if err == nil {
		for _, m := range metrics {
			if m.Name == name {
				unit = m.Unit
				break
			}
		}
	}

	writeJSON(w, http.StatusOK, model.MetricSeriesResponse{Name: name, Unit: unit, Points: points})
}

func (h *Handler) HandleDashboardSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	minutes := 15
	if v := r.URL.Query().Get("minutes"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid minutes parameter")
			return
		}
		minutes = n
	}

	summary, err := h.Store.GetDashboardSummary(ctx, minutes)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query dashboard summary")
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (h *Handler) HandleMetricsQuery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	minutes := 15
	if v := q.Get("minutes"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid minutes parameter")
			return
		}
		minutes = n
	}
	interval := 30
	if v := q.Get("interval"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid interval parameter")
			return
		}
		interval = n
	}

	series, err := h.Store.QueryMetrics(ctx, model.MetricQuery{
		Name: q.Get("name"), Service: q.Get("service"), Type: q.Get("type"),
		Minutes: minutes, Interval: interval,
	})
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query metrics")
		return
	}
	writeJSON(w, http.StatusOK, model.MetricQueryResponse{Series: series})
}

func (h *Handler) HandleMetricAttributes(w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["name"]
	if name == "" {
		writeJSONError(w, http.StatusBadRequest, "metric name is required")
		return
	}

	attrs, err := h.Store.GetMetricAttributes(r.Context(), name, parseMinutes(r, 60))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query metric attributes")
		return
	}
	if attrs == nil {
		attrs = []model.MetricAttribute{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": attrs})
}
