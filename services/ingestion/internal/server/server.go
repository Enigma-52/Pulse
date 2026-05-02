package server

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/services/ingestion/internal/ingestion"
)

func New(handler *ingestion.Handler) http.Handler {
	r := mux.NewRouter()
	r.HandleFunc("/healthz", handleHealth).Methods(http.MethodGet)
	r.HandleFunc("/v1/ingest", handler.HandleIngest).Methods(http.MethodPost)
	return r
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}
