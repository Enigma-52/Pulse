package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleTraces(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	filters, err := ParseTraceFilters(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	traces, err := h.Store.GetTraces(ctx, filters)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query traces")
		return
	}
	total, err := h.Store.GetTracesCount(ctx, filters)
	if err != nil {
		total = uint64(len(traces))
	}
	writeJSON(w, http.StatusOK, model.TracesResponse{Items: traces, Total: total, Limit: filters.Limit, Offset: filters.Offset})
}

func (h *Handler) HandleTraceDetail(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	traceID := mux.Vars(r)["trace_id"]
	if strings.TrimSpace(traceID) == "" {
		writeJSONError(w, http.StatusBadRequest, "trace_id is required")
		return
	}

	spans, err := h.Store.GetTraceDetail(ctx, traceID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query trace detail")
		return
	}
	if len(spans) == 0 {
		writeJSONError(w, http.StatusNotFound, "trace not found")
		return
	}

	root := spans[0]
	for _, s := range spans {
		if s.ParentSpanID == "" {
			root = s
			break
		}
	}

	earliest := root.StartTime
	var totalDuration int64
	for _, s := range spans {
		if s.StartTime.Before(earliest) {
			earliest = s.StartTime
		}
		end := s.StartTime.Add(time.Duration(s.DurationMs) * time.Millisecond)
		dur := end.Sub(earliest).Milliseconds()
		if dur > totalDuration {
			totalDuration = dur
		}
	}
	if totalDuration == 0 {
		totalDuration = root.DurationMs
	}

	writeJSON(w, http.StatusOK, model.TraceDetailResponse{
		TraceID:   traceID,
		Name:      root.Name,
		Service:   root.Service,
		Duration:  totalDuration,
		Status:    root.Status,
		Timestamp: root.StartTime,
		SpanCount: len(spans),
		Spans:     spans,
	})
}

func ParseTraceFilters(r *http.Request) (model.TraceFilters, error) {
	q := r.URL.Query()
	filters := model.TraceFilters{
		Service: q.Get("service"), Route: q.Get("route"), Status: q.Get("status"),
		Environment: q.Get("environment"), Kind: q.Get("kind"), Query: q.Get("q"),
		TagKey: q.Get("tag_key"), TagValue: q.Get("tag_value"),
		Limit: model.DefaultLimit, Offset: 0,
	}
	if filters.Kind != "" {
		valid := map[string]bool{"server": true, "client": true, "producer": true, "consumer": true, "internal": true}
		if !valid[filters.Kind] {
			return filters, errors.New("invalid kind")
		}
	}

	if v := q.Get("error_only"); v != "" {
		parsed, err := strconv.ParseBool(v)
		if err != nil {
			return filters, errors.New("invalid error_only: expected true or false")
		}
		filters.ErrorOnly = parsed
	}
	if v := q.Get("min_duration_ms"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return filters, errors.New("invalid min_duration_ms")
		}
		filters.MinDurationMs = n
	}
	if v := q.Get("max_duration_ms"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return filters, errors.New("invalid max_duration_ms")
		}
		filters.MaxDurationMs = n
	}
	if filters.MaxDurationMs > 0 && filters.MinDurationMs > filters.MaxDurationMs {
		return filters, errors.New("min_duration_ms cannot be greater than max_duration_ms")
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

func ParseTimeParam(v string) (time.Time, error) {
	if n, err := strconv.ParseInt(v, 10, 64); err == nil {
		if n > 9999999999 {
			return time.UnixMilli(n), nil
		}
		return time.Unix(n, 0), nil
	}
	return time.Parse(time.RFC3339, v)
}
