package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	filters, err := parseLogFilters(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	logs, err := h.Store.GetLogs(ctx, filters)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query logs")
		return
	}
	if logs == nil {
		logs = []model.LogEntry{}
	}
	writeJSON(w, http.StatusOK, model.LogsResponse{Items: logs, Limit: filters.Limit, Offset: filters.Offset})
}

func parseLogFilters(r *http.Request) (model.LogFilters, error) {
	q := r.URL.Query()
	filters := model.LogFilters{
		Service: cleanFilter(q.Get("service")), Environment: cleanFilter(q.Get("environment")),
		Search: cleanFilter(q.Get("search")), TraceID: cleanFilter(q.Get("trace_id")),
		Limit: model.DefaultLimit, Offset: 0,
	}

	// level accepts a comma-separated list, e.g. level=error,warn
	if raw := q.Get("level"); raw != "" {
		valid := map[string]bool{"trace": true, "debug": true, "info": true, "warn": true, "error": true, "fatal": true}
		for _, lv := range strings.Split(raw, ",") {
			lv = strings.TrimSpace(lv)
			if lv == "" {
				continue
			}
			if !valid[lv] {
				return filters, errors.New("invalid level: must be trace, debug, info, warn, error, or fatal")
			}
			filters.Levels = append(filters.Levels, lv)
		}
	}
	if v := q.Get("start"); v != "" {
		t, err := ParseTimeParam(v)
		if err != nil {
			return filters, errors.New("invalid start time")
		}
		filters.Start = t
		filters.HasStart = true
	}
	if v := q.Get("end"); v != "" {
		t, err := ParseTimeParam(v)
		if err != nil {
			return filters, errors.New("invalid end time")
		}
		filters.End = t
		filters.HasEnd = true
	}
	if filters.HasStart && filters.HasEnd && filters.Start.After(filters.End) {
		return filters, errors.New("start cannot be after end")
	}
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return filters, errors.New("invalid limit")
		}
		if n > model.MaxLimit {
			n = model.MaxLimit
		}
		filters.Limit = n
	}
	if v := q.Get("offset"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			return filters, errors.New("invalid offset")
		}
		filters.Offset = n
	}
	return filters, nil
}

func (h *Handler) HandleLogsHistogram(w http.ResponseWriter, r *http.Request) {
	filters, err := parseLogFilters(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	interval := 1
	if v := r.URL.Query().Get("interval"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			interval = n
		}
	}

	points, err := h.Store.GetLogsHistogram(r.Context(), filters, interval)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query logs histogram")
		return
	}
	if points == nil {
		points = []model.LogHistogramPoint{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"points": points})
}
