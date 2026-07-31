package server

import (
	"compress/gzip"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

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
	protected.HandleFunc("/logs/histogram", qh.HandleLogsHistogram).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services", qh.HandleServicesList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services/timeseries", qh.HandleServicesTimeseries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services/dependencies", qh.HandleServiceDependencies).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services/{service}/overview", qh.HandleServiceOverview).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/services/{service}/external", qh.HandleExternalCalls).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/external", qh.HandleExternalCalls).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/external/{host}/detail", qh.HandleExternalHostDetail).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics", qh.HandleMetricsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics/query", qh.HandleMetricsQuery).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics/{name}/series", qh.HandleMetricSeries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/metrics/{name}/attributes", qh.HandleMetricAttributes).Methods(http.MethodGet, http.MethodOptions)
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
	protected.HandleFunc("/search", qh.HandleSearch).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/environments", qh.HandleEnvironments).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/query/sql", qh.HandleRawSQL).Methods(http.MethodPost, http.MethodOptions)
	protected.HandleFunc("/exceptions", qh.HandleExceptionsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/exceptions/{fingerprint}", qh.HandleExceptionDetail).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/exceptions/{fingerprint}/timeseries", qh.HandleExceptionTimeseries).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts", qh.HandleAlertsList).Methods(http.MethodGet, http.MethodOptions)
	protected.HandleFunc("/alerts/{id}", qh.HandleAlertGet).Methods(http.MethodGet, http.MethodOptions)

	// gorilla/mux runs middleware in add order (first added = outermost), so:
	// access log (times everything) → cors → gzip → routes.
	if accessLogEnabled() {
		r.Use(accessLogMiddleware)
	}
	r.Use(corsMiddleware)
	r.Use(gzipMiddleware)
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

// gzipResponseWriter compresses the response body while keeping the
// http.ResponseWriter contract. Content-Length is dropped because the
// compressed size differs from what handlers may have set.
type gzipResponseWriter struct {
	http.ResponseWriter
	gz          *gzip.Writer
	wroteHeader bool
}

func (w *gzipResponseWriter) WriteHeader(status int) {
	w.wroteHeader = true
	w.Header().Del("Content-Length")
	w.ResponseWriter.WriteHeader(status)
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.gz.Write(b)
}

// gzipMiddleware compresses query API responses when the client advertises
// gzip support. OTLP ingest routes (/v1/*) are left untouched — their bodies
// are a trivial "{}" and the exporters do not negotiate response encoding.
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") || strings.HasPrefix(r.URL.Path, "/v1/") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Add("Vary", "Accept-Encoding")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		next.ServeHTTP(&gzipResponseWriter{ResponseWriter: w, gz: gz}, r)
	})
}

// statusRecorder captures the status code and byte count for access logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

func accessLogEnabled() bool { return os.Getenv("PULSE_ACCESS_LOG") != "0" }

// accessLogMiddleware emits one structured line per request. Health/readiness
// probes are skipped so orchestrator polling does not flood the log.
func accessLogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" {
			next.ServeHTTP(w, r)
			return
		}
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)
		log.Printf("method=%s path=%s status=%d dur_ms=%d bytes=%d",
			r.Method, r.URL.Path, rec.status, time.Since(start).Milliseconds(), rec.bytes)
	})
}
