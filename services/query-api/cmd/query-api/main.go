package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/gorilla/mux"
)

type Trace struct {
	TraceID    string    `json:"trace_id"`
	Service    string    `json:"service"`
	Route      string    `json:"route"`
	DurationMs int64     `json:"duration_ms"`
	Status     string    `json:"status"`
	Timestamp  time.Time `json:"timestamp"`
}

type SpanDetail struct {
	TraceID      string    `json:"trace_id"`
	SpanID       string    `json:"span_id"`
	ParentSpanID string    `json:"parent_span_id"`
	Service      string    `json:"service"`
	Environment  string    `json:"environment"`
	Route        string    `json:"route"`
	Name         string    `json:"name"`
	DurationMs   int64     `json:"duration_ms"`
	Status       string    `json:"status"`
	Error        string    `json:"error"`
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
}

type TracesResponse struct {
	Items  []Trace `json:"items"`
	Limit  int     `json:"limit"`
	Offset int     `json:"offset"`
}

type ServiceOverview struct {
	Service       string  `json:"service"`
	TraceCount    uint64  `json:"trace_count"`
	ErrorCount    uint64  `json:"error_count"`
	ErrorRate     float64 `json:"error_rate"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
	P95DurationMs float64 `json:"p95_duration_ms"`
}

type traceFilters struct {
	Service       string
	Route         string
	Status        string
	ErrorOnly     bool
	TagKey        string
	TagValue      string
	MinDurationMs int64
	MaxDurationMs int64
	Start         time.Time
	End           time.Time
	HasStart      bool
	HasEnd        bool
	Limit         int
	Offset        int
}

const (
	defaultLimit = 100
	maxLimit     = 500
)

var chConn driver.Conn

func main() {
	var err error
	chConn, err = connectClickHouse(context.Background())
	if err != nil {
		log.Fatalf("failed to connect to ClickHouse: %v", err)
	}

	r := mux.NewRouter()
	r.HandleFunc("/healthz", handleHealth).Methods(http.MethodGet)
	r.HandleFunc("/traces", handleTraces).Methods(http.MethodGet)
	r.HandleFunc("/traces/{trace_id}", handleTraceDetail).Methods(http.MethodGet)
	r.HandleFunc("/services/{service}/overview", handleServiceOverview).Methods(http.MethodGet)

	addr := ":8082"
	log.Printf("Pulse query API listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func handleTraces(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	filters, err := parseTraceFilters(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	query, args := buildTraceQuery(filters)

	rows, err := chConn.Query(ctx, query, args...)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query traces")
		return
	}
	defer rows.Close()

	var traces []Trace
	for rows.Next() {
		var t Trace
		if err := rows.Scan(
			&t.TraceID,
			&t.Service,
			&t.Route,
			&t.DurationMs,
			&t.Status,
			&t.Timestamp,
		); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to scan row")
			return
		}
		traces = append(traces, t)
	}

	writeJSON(w, http.StatusOK, TracesResponse{Items: traces, Limit: filters.Limit, Offset: filters.Offset})
}

func handleTraceDetail(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	traceID := mux.Vars(r)["trace_id"]
	if strings.TrimSpace(traceID) == "" {
		writeJSONError(w, http.StatusBadRequest, "trace_id is required")
		return
	}

	rows, err := chConn.Query(ctx, `
SELECT
	trace_id,
	span_id,
	parent_span_id,
	service,
	environment,
	route,
	name,
	duration_ms,
	status,
	error,
	start_time,
	end_time
FROM traces
WHERE trace_id = ?
ORDER BY start_time ASC
`, traceID)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query trace detail")
		return
	}
	defer rows.Close()

	var spans []SpanDetail
	for rows.Next() {
		var s SpanDetail
		if err := rows.Scan(
			&s.TraceID,
			&s.SpanID,
			&s.ParentSpanID,
			&s.Service,
			&s.Environment,
			&s.Route,
			&s.Name,
			&s.DurationMs,
			&s.Status,
			&s.Error,
			&s.StartTime,
			&s.EndTime,
		); err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to scan trace detail")
			return
		}
		spans = append(spans, s)
	}

	if len(spans) == 0 {
		writeJSONError(w, http.StatusNotFound, "trace not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"trace_id": traceID,
		"spans":    spans,
	})
}

func handleServiceOverview(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	service := mux.Vars(r)["service"]
	if strings.TrimSpace(service) == "" {
		writeJSONError(w, http.StatusBadRequest, "service is required")
		return
	}

	query := `
SELECT
	service,
	count() AS trace_count,
	countIf(status = 'error' OR error != '') AS error_count,
	if(trace_count = 0, 0, (error_count / trace_count) * 100.0) AS error_rate,
	avg(duration_ms) AS avg_duration_ms,
	quantile(0.95)(duration_ms) AS p95_duration_ms
FROM traces
WHERE service = ?
GROUP BY service
LIMIT 1
`

	if startRaw := r.URL.Query().Get("start"); startRaw != "" {
		start, err := parseTimeParam(startRaw)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid start time")
			return
		}
		query = strings.Replace(query, "WHERE service = ?", "WHERE service = ? AND start_time >= ?", 1)
		rows, err := chConn.Query(ctx, query, service, start)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to query service overview")
			return
		}
		defer rows.Close()
		writeServiceOverviewRows(w, rows, service)
		return
	}

	rows, err := chConn.Query(ctx, query, service)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query service overview")
		return
	}
	defer rows.Close()

	writeServiceOverviewRows(w, rows, service)
}

func writeServiceOverviewRows(w http.ResponseWriter, rows driver.Rows, service string) {
	if !rows.Next() {
		writeJSONError(w, http.StatusNotFound, fmt.Sprintf("service %q not found", service))
		return
	}

	var out ServiceOverview
	if err := rows.Scan(
		&out.Service,
		&out.TraceCount,
		&out.ErrorCount,
		&out.ErrorRate,
		&out.AvgDurationMs,
		&out.P95DurationMs,
	); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to scan service overview")
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func parseTraceFilters(r *http.Request) (traceFilters, error) {
	q := r.URL.Query()
	filters := traceFilters{
		Service: q.Get("service"),
		Route:   q.Get("route"),
		Status:  q.Get("status"),
		TagKey:  q.Get("tag_key"),
		TagValue:q.Get("tag_value"),
		Limit:   defaultLimit,
		Offset:  0,
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
		t, err := parseTimeParam(v)
		if err != nil {
			return filters, errors.New("invalid start time")
		}
		filters.Start = t
		filters.HasStart = true
	}

	if v := q.Get("end"); v != "" {
		t, err := parseTimeParam(v)
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
		if n > maxLimit {
			n = maxLimit
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

func buildTraceQuery(filters traceFilters) (string, []any) {
	var sb strings.Builder
	args := make([]any, 0, 12)

	sb.WriteString(`
SELECT
	trace_id,
	service,
	route,
	duration_ms,
	status,
	start_time
FROM traces
WHERE 1=1
`)

	if filters.Service != "" {
		sb.WriteString(" AND service = ?")
		args = append(args, filters.Service)
	}
	if filters.Route != "" {
		sb.WriteString(" AND route = ?")
		args = append(args, filters.Route)
	}
	if filters.Status != "" {
		sb.WriteString(" AND status = ?")
		args = append(args, filters.Status)
	}
	if filters.ErrorOnly {
		sb.WriteString(" AND (status = 'error' OR error != '')")
	}
	if filters.MinDurationMs > 0 {
		sb.WriteString(" AND duration_ms >= ?")
		args = append(args, filters.MinDurationMs)
	}
	if filters.MaxDurationMs > 0 {
		sb.WriteString(" AND duration_ms <= ?")
		args = append(args, filters.MaxDurationMs)
	}
	if filters.TagKey != "" && filters.TagValue != "" {
		sb.WriteString(" AND position(attributes_json, ?) > 0")
		args = append(args, fmt.Sprintf("\"%s\":\"%s\"", filters.TagKey, filters.TagValue))
	}
	if filters.HasStart {
		sb.WriteString(" AND start_time >= ?")
		args = append(args, filters.Start)
	}
	if filters.HasEnd {
		sb.WriteString(" AND start_time <= ?")
		args = append(args, filters.End)
	}

	sb.WriteString(" ORDER BY start_time DESC LIMIT ? OFFSET ?")
	args = append(args, filters.Limit, filters.Offset)

	return sb.String(), args
}

func parseTimeParam(v string) (time.Time, error) {
	if n, err := strconv.ParseInt(v, 10, 64); err == nil {
		if n > 9999999999 {
			return time.UnixMilli(n), nil
		}
		return time.Unix(n, 0), nil
	}
	return time.Parse(time.RFC3339, v)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

func connectClickHouse(ctx context.Context) (driver.Conn, error) {
	addr := getEnv("PULSE_CLICKHOUSE_ADDR", "localhost:9000")
	db := getEnv("PULSE_CLICKHOUSE_DB", "default")
	user := getEnv("PULSE_CLICKHOUSE_USER", "default")
	pass := getEnv("PULSE_CLICKHOUSE_PASSWORD", "")

	return clickhouse.Open(&clickhouse.Options{
		Addr: []string{addr},
		Auth: clickhouse.Auth{
			Database: db,
			Username: user,
			Password: pass,
		},
	})
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
