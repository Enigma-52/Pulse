package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/services/query-api/internal/model"
)

func (h *Handler) HandleMetricsList(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

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
	ctx := context.Background()
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

	points, err := h.Store.GetMetricSeries(ctx, name, minutes, interval)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query metric series")
		return
	}

	if points == nil {
		points = []model.MetricSeriesPoint{}
	}

	// Look up unit from a quick query - use empty string as fallback
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

	writeJSON(w, http.StatusOK, model.MetricSeriesResponse{
		Name:   name,
		Unit:   unit,
		Points: points,
	})
}

func (h *Handler) HandleDashboardSummary(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	summary, err := h.Store.GetDashboardSummary(ctx)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query dashboard summary")
		return
	}

	writeJSON(w, http.StatusOK, summary)
}
