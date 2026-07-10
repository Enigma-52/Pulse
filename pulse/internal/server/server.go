package server

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/ingest"
	"github.com/pulse-observability/pulse/pulse/internal/query/handler"
)

func New(ih *ingest.Handler, qh *handler.Handler) http.Handler {
	r := mux.NewRouter()

	// Health
	r.HandleFunc("/healthz", qh.HandleHealth).Methods(http.MethodGet)
	r.HandleFunc("/readyz", qh.HandleReady).Methods(http.MethodGet)

	// OTLP ingest
	r.HandleFunc("/v1/traces", ih.HandleTraces).Methods(http.MethodPost)
	r.HandleFunc("/v1/logs", ih.HandleLogs).Methods(http.MethodPost)
	r.HandleFunc("/v1/metrics", ih.HandleMetrics).Methods(http.MethodPost)

	// Auth (public)
	r.HandleFunc("/auth/setup-status", qh.HandleSetupStatus).Methods(http.MethodGet, http.MethodOptions)
	r.HandleFunc("/auth/setup", qh.HandleSetup).Methods(http.MethodPost, http.MethodOptions)
	r.HandleFunc("/auth/login", qh.HandleLogin).Methods(http.MethodPost, http.MethodOptions)

	// Query API (protected)
	protected := r.PathPrefix("/").Subrouter()
	protected.Use(handler.AuthMiddleware)
	protected.HandleFunc("/traces", qh.HandleTraces).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/traces/analytics", qh.HandleTraceAnalytics).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/traces/analytics/timeseries", qh.HandleTraceAnalyticsTimeseries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/traces/slowest", qh.HandleSlowestTraces).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/traces/{trace_id}", qh.HandleTraceDetail).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/logs", qh.HandleLogs).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services", qh.HandleServicesList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services/{service}/overview", qh.HandleServiceOverview).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics", qh.HandleMetricsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics/query", qh.HandleMetricsQuery).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics/{name}/series", qh.HandleMetricSeries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/databases", qh.HandleDatabasesList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/databases/{system}/overview", qh.HandleDatabaseOverview).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/databases/{system}/queries", qh.HandleDatabaseQueries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/dashboard/summary", qh.HandleDashboardSummary).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts/rules", qh.HandleAlertRulesList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts/rules", qh.HandleAlertRuleCreate).Methods(http.MethodPost)
	protected.HandleFunc("/alerts/rules/{id}", qh.HandleAlertRuleGet).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts/rules/{id}", qh.HandleAlertRuleUpdate).Methods(http.MethodPut)
	protected.HandleFunc("/alerts/rules/{id}", qh.HandleAlertRuleDelete).Methods(http.MethodDelete)
	protected.HandleFunc("/alerts/channels", qh.HandleChannelsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts/channels", qh.HandleChannelCreate).Methods(http.MethodPost)
	protected.HandleFunc("/alerts/channels/{id}", qh.HandleChannelUpdate).Methods(http.MethodPut, http.MethodOptions)
	protected.HandleFunc("/alerts/channels/{id}", qh.HandleChannelDelete).Methods(http.MethodDelete)
	protected.HandleFunc("/usage", qh.HandleUsage).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/exceptions", qh.HandleExceptionsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/exceptions/{fingerprint}", qh.HandleExceptionDetail).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/exceptions/{fingerprint}/timeseries", qh.HandleExceptionTimeseries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts", qh.HandleAlertsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts/{id}", qh.HandleAlertGet).Methods(http.MethodGet, http.MethodOptions)

	r.Use(corsMiddleware)
	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
