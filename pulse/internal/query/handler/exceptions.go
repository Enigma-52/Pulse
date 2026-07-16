package handler

import (
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func parseMinutes(r *http.Request, def int) int {
	if v := r.URL.Query().Get("minutes"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

func (h *Handler) HandleExceptionsList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := model.ExceptionFilters{
		Service: q.Get("service"),
		Search:  q.Get("q"),
		Minutes: parseMinutes(r, 15),
		Limit:   model.DefaultLimit,
	}
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		if n > model.MaxLimit {
			n = model.MaxLimit
		}
		f.Limit = n
	}
	if v := q.Get("offset"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid offset")
			return
		}
		f.Offset = n
	}

	groups, err := h.Store.ListExceptionGroups(r.Context(), f)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query exceptions")
		return
	}
	if groups == nil {
		groups = []model.ExceptionGroup{}
	}
	writeJSON(w, http.StatusOK, model.ExceptionsResponse{Items: groups, Limit: f.Limit, Offset: f.Offset})
}

func (h *Handler) HandleExceptionDetail(w http.ResponseWriter, r *http.Request) {
	fingerprint := mux.Vars(r)["fingerprint"]
	detail, err := h.Store.GetExceptionGroup(r.Context(), fingerprint, parseMinutes(r, 15))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query exception")
		return
	}
	if detail == nil {
		writeJSONError(w, http.StatusNotFound, "exception not found")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *Handler) HandleExceptionTimeseries(w http.ResponseWriter, r *http.Request) {
	fingerprint := mux.Vars(r)["fingerprint"]
	minutes := parseMinutes(r, 15)
	interval := 1
	if v := r.URL.Query().Get("interval"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			interval = n
		}
	}

	buckets, err := h.Store.ExceptionFrequency(r.Context(), fingerprint, minutes, interval)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query exception timeseries")
		return
	}
	if buckets == nil {
		buckets = []model.ExceptionBucket{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"points": buckets})
}
