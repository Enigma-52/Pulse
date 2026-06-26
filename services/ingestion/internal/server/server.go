package server

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/services/ingestion/internal/ingestion"
)

func New(handler *ingestion.Handler) http.Handler {
	r := mux.NewRouter()
	r.HandleFunc("/healthz", handleHealth).Methods(http.MethodGet)
	r.HandleFunc("/v1/traces", handler.HandleTraces).Methods(http.MethodPost)
	r.HandleFunc("/v1/logs", handler.HandleLogs).Methods(http.MethodPost)
	r.HandleFunc("/v1/metrics", handler.HandleMetrics).Methods(http.MethodPost)
	return r
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}
