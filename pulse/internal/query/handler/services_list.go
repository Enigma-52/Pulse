package handler

import (
	"net/http"
	"strconv"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleServicesList(w http.ResponseWriter, r *http.Request) {
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

	services, err := h.Store.GetServicesList(ctx, minutes)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query services")
		return
	}
	if services == nil {
		services = []model.ServiceSummary{}
	}
	writeJSON(w, http.StatusOK, model.ServicesListResponse{Items: services})
}

func (h *Handler) HandleServicesTimeseries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	interval := 1
	if v := q.Get("interval"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			interval = n
		}
	}
	topN := 10
	if v := q.Get("top"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			topN = n
		}
	}

	points, err := h.Store.GetServicesTimeseries(r.Context(), parseMinutes(r, 15), interval, topN, q.Get("environment"))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query services timeseries")
		return
	}
	if points == nil {
		points = []model.TraceAnalyticsPoint{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"points": points})
}

func (h *Handler) HandleServiceDependencies(w http.ResponseWriter, r *http.Request) {
	deps, err := h.Store.GetServiceDependencies(r.Context(), parseMinutes(r, 15), r.URL.Query().Get("environment"))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query service dependencies")
		return
	}
	if deps == nil {
		deps = []model.ServiceDependency{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": deps})
}
