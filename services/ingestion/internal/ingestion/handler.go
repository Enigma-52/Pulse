package ingestion

import (
	"encoding/json"
	"io"
	"context"
	"log"
	"net/http"

	"github.com/segmentio/kafka-go"
)

type Envelope struct {
	ServiceName string          `json:"serviceName"`
	Environment string          `json:"environment"`
	Spans       json.RawMessage `json:"spans"`
	Logs        json.RawMessage `json:"logs"`
}

type Handler struct {
	writer *kafka.Writer
}

func NewHandler(writer *kafka.Writer) *Handler {
	return &Handler{writer: writer}
}

func (h *Handler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}

	var env Envelope
	if err := json.Unmarshal(body, &env); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if env.ServiceName == "" {
		http.Error(w, "serviceName is required", http.StatusBadRequest)
		return
	}

	log.Printf("received telemetry from service=%s env=%s", env.ServiceName, env.Environment)

	if h.writer != nil {
		msg := kafka.Message{
			Value: body,
		}
		if err := h.writer.WriteMessages(context.Background(), msg); err != nil {
			log.Printf("failed to write to Kafka: %v", err)
		}
	}

	w.WriteHeader(http.StatusAccepted)
}

