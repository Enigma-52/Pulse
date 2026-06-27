package ingest

import (
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
	pipe chan<- pipeline.Batch
}

func NewHandler(pipe chan<- pipeline.Batch) *Handler {
	return &Handler{pipe: pipe}
}

func (h *Handler) HandleTraces(w http.ResponseWriter, r *http.Request) {
	data, err := readAndNormalize(r, &collectorTrace.ExportTraceServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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
	data, err := readAndNormalize(r, &collectorLogs.ExportLogsServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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
	data, err := readAndNormalize(r, &collectorMetrics.ExportMetricsServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if !h.send("metrics", data) {
		http.Error(w, "pipeline full", http.StatusTooManyRequests)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
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

func readAndNormalize(r *http.Request, msg proto.Message) ([]byte, error) {
	body, err := io.ReadAll(r.Body)
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
