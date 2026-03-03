package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/services/ingestion/internal/ingestion"
	"github.com/segmentio/kafka-go"
)

func main() {
	brokers := os.Getenv("PULSE_KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}
	writer := &kafka.Writer{
		Addr:     kafka.TCP(strings.Split(brokers, ",")...),
		Topic:    "traces_raw",
		Balancer: &kafka.LeastBytes{},
	}
	defer writer.Close()

	r := mux.NewRouter()
	handler := ingestion.NewHandler(writer)
	r.HandleFunc("/v1/ingest", handler.HandleIngest).Methods(http.MethodPost)

	addr := ":8081"
	log.Printf("Pulse ingestion server listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

