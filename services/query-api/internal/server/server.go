package server

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/services/query-api/internal/handler"
)

func New(h *handler.Handler) http.Handler {
	r := mux.NewRouter()

	// Public routes
	r.HandleFunc("/healthz", h.HandleHealth).Methods(http.MethodGet)
	r.HandleFunc("/auth/setup-status", h.HandleSetupStatus).Methods(http.MethodGet, http.MethodOptions)
	r.HandleFunc("/auth/setup", h.HandleSetup).Methods(http.MethodPost, http.MethodOptions)
	r.HandleFunc("/auth/login", h.HandleLogin).Methods(http.MethodPost, http.MethodOptions)

	// Protected routes
	protected := r.PathPrefix("/").Subrouter()
	protected.Use(handler.AuthMiddleware)
	protected.HandleFunc("/traces", h.HandleTraces).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/traces/{trace_id}", h.HandleTraceDetail).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/logs", h.HandleLogs).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services/{service}/overview", h.HandleServiceOverview).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics", h.HandleMetricsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics/{name}/series", h.HandleMetricSeries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/dashboard/summary", h.HandleDashboardSummary).Methods(http.MethodGet, http.MethodOptions)

	r.Use(corsMiddleware)
	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
