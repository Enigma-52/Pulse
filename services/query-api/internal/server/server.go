package server

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/services/query-api/internal/handler"
)

func New(h *handler.Handler) http.Handler {
	r := mux.NewRouter()
	r.HandleFunc("/healthz", h.HandleHealth).Methods(http.MethodGet)
	r.HandleFunc("/traces", h.HandleTraces).Methods(http.MethodGet, http.MethodOptions)
	r.HandleFunc("/traces/{trace_id}", h.HandleTraceDetail).Methods(http.MethodGet, http.MethodOptions)
	r.HandleFunc("/services/{service}/overview", h.HandleServiceOverview).Methods(http.MethodGet, http.MethodOptions)
	r.Use(corsMiddleware)
	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
