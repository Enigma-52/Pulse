package ingestion

import (
	"context"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/segmentio/kafka-go"
	collectorLogs "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectorMetrics "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectorTrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type Handler struct {
	writer *kafka.Writer
}

func NewHandler(writer *kafka.Writer) *Handler {
	return &Handler{writer: writer}
}

// HandleTraces accepts OTLP/HTTP traces (protobuf or JSON) and forwards raw proto to Kafka.
func (h *Handler) HandleTraces(w http.ResponseWriter, r *http.Request) {
	data, err := readAndNormalize(r, &collectorTrace.ExportTraceServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.forward("traces", data); err != nil {
		log.Printf("kafka write error (traces): %v", err)
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

// HandleLogs accepts OTLP/HTTP logs (protobuf or JSON) and forwards raw proto to Kafka.
func (h *Handler) HandleLogs(w http.ResponseWriter, r *http.Request) {
	data, err := readAndNormalize(r, &collectorLogs.ExportLogsServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.forward("logs", data); err != nil {
		log.Printf("kafka write error (logs): %v", err)
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

// HandleMetrics accepts OTLP/HTTP metrics (protobuf or JSON) and forwards raw proto to Kafka.
func (h *Handler) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	data, err := readAndNormalize(r, &collectorMetrics.ExportMetricsServiceRequest{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.forward("metrics", data); err != nil {
		log.Printf("kafka write error (metrics): %v", err)
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("{}"))
}

// forward writes raw protobuf bytes to Kafka with a signal-type header.
func (h *Handler) forward(signal string, data []byte) error {
	if h.writer == nil {
		return nil
	}
	return h.writer.WriteMessages(context.Background(), kafka.Message{
		Headers: []kafka.Header{{Key: "signal", Value: []byte(signal)}},
		Value:   data,
	})
}

// readAndNormalize reads the request body and normalises it to protobuf bytes.
// If the request is JSON, it unmarshals via protojson then re-marshals to proto wire format.
// If the request is already protobuf (or unspecified content-type), the raw bytes are returned.
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

	// Validate that it's valid protobuf
	if err := proto.Unmarshal(body, msg); err != nil {
		return nil, err
	}
	return body, nil
}
