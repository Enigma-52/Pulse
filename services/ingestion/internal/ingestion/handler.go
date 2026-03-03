package ingestion

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

type Envelope struct {
	ServiceName string          `json:"serviceName"`
	Environment string          `json:"environment"`
	Spans       json.RawMessage `json:"spans"`
	Logs        json.RawMessage `json:"logs"`
}

func HandleIngest(w http.ResponseWriter, r *http.Request) {
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

	w.WriteHeader(http.StatusAccepted)
}

