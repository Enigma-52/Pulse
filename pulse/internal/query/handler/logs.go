package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleLogs(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
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
		Service: q.Get("service"), Level: q.Get("level"),
		Search: q.Get("search"), TraceID: q.Get("trace_id"),
		Limit: model.DefaultLimit, Offset: 0,
	}

	if filters.Level != "" {
		valid := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
		if !valid[filters.Level] {
			return filters, errors.New("invalid level: must be debug, info, warn, or error")
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
