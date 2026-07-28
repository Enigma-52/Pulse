package ingest

import (
	"compress/gzip"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/pulse-observability/pulse/pulse/internal/pipeline"
	collectorLogs "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectorMetrics "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectorTrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type Handler struct {
	pipe    chan<- pipeline.Batch
	limiter *rateLimiter
}

func NewHandler(pipe chan<- pipeline.Batch) *Handler {
	return &Handler{pipe: pipe}
}

// NewHandlerWithLimit creates a handler that rejects ingest requests above rps
// requests per second. rps <= 0 disables limiting.
func NewHandlerWithLimit(pipe chan<- pipeline.Batch, rps int) *Handler {
	return &Handler{pipe: pipe, limiter: newRateLimiter(rps)}
}

func (h *Handler) throttled(w http.ResponseWriter) bool {
	if h.limiter.allow() {
		return false
	}
	w.Header().Set("Retry-After", "1")
	http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
	return true
}

func (h *Handler) HandleTraces(w http.ResponseWriter, r *http.Request) {
	if h.throttled(w) {
		return
	}
	data, err := readAndNormalize(w, r, &collectorTrace.ExportTraceServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), payloadErrStatus(err))
		return
	}
	if !h.send("traces", data) {
		http.Error(w, "pipeline full", http.StatusTooManyRequests)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

func (h *Handler) HandleLogs(w http.ResponseWriter, r *http.Request) {
	if h.throttled(w) {
		return
	}
	data, err := readAndNormalize(w, r, &collectorLogs.ExportLogsServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), payloadErrStatus(err))
		return
	}
	if !h.send("logs", data) {
		http.Error(w, "pipeline full", http.StatusTooManyRequests)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

func (h *Handler) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	if h.throttled(w) {
		return
	}
	data, err := readAndNormalize(w, r, &collectorMetrics.ExportMetricsServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), payloadErrStatus(err))
		return
	}
	if !h.send("metrics", data) {
		http.Error(w, "pipeline full", http.StatusTooManyRequests)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

func payloadErrStatus(err error) int {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return http.StatusRequestEntityTooLarge
	}
	return http.StatusBadRequest
}

func (h *Handler) send(signal string, data []byte) bool {
	select {
	case h.pipe <- pipeline.Batch{Signal: signal, Data: data}:
		return true
	default:
		log.Printf("pipeline full, dropping %s batch", signal)
		return false
	}
}

// maxBodyBytes caps OTLP payloads (32 MB — generous for batched exports)
// so a single oversized POST cannot exhaust memory.
const maxBodyBytes = 32 << 20

func readAndNormalize(w http.ResponseWriter, r *http.Request, msg proto.Message) ([]byte, error) {
	// The body cap is enforced on the wire (compressed) stream so a small
	// gzip payload can still not decompress into an unbounded amount of memory
	// past what MaxBytesReader already read.
	var reader io.Reader = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	// OTel exporters (notably the Collector's otlphttp exporter) gzip payloads
	// by default — decode Content-Encoding before unmarshalling.
	if strings.Contains(strings.ToLower(r.Header.Get("Content-Encoding")), "gzip") {
		gz, err := gzip.NewReader(reader)
		if err != nil {
			return nil, err
		}
		defer gz.Close()
		reader = gz
	}
	body, err := io.ReadAll(reader)
	r.Body.Close()
	if err != nil {
		return nil, err
	}

	ct := r.Header.Get("Content-Type")
	if strings.Contains(ct, "application/json") {
		if err := protojson.Unmarshal(body, msg); err != nil {
			return nil, err
		}
		return proto.Marshal(msg)
	}

	if err := proto.Unmarshal(body, msg); err != nil {
		return nil, err
	}
	return body, nil
}
