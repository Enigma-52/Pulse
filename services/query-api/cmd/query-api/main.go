package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

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

func main() {
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
	traces := []Trace{
		{
			TraceID:    "mock-trace-1",
			Service:    "demo-backend-node",
			Route:      "/ok",
			DurationMs: 42,
			Status:     "ok",
			Timestamp:  time.Now(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(traces); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

