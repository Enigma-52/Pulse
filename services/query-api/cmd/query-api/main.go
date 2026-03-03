package main

import (
	"encoding/json"
	"log"
	"context"
	"net/http"
	"os"
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

func handleTraces(w http.ResponseWriter, _ *http.Request) {
	ctx := context.Background()

	rows, err := chConn.Query(ctx, `
SELECT
	trace_id,
	service,
	route,
	duration_ms,
	status,
	start_time
FROM traces
ORDER BY start_time DESC
LIMIT 100
`)
	if err != nil {
		http.Error(w, "failed to query traces", http.StatusInternalServerError)
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
			http.Error(w, "failed to scan row", http.StatusInternalServerError)
			return
		}
		traces = append(traces, t)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(traces); err != nil {
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


