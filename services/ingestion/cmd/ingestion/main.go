package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/pulse-observability/pulse/services/ingestion/internal/config"
	"github.com/pulse-observability/pulse/services/ingestion/internal/ingestion"
	"github.com/pulse-observability/pulse/services/ingestion/internal/server"
	"github.com/segmentio/kafka-go"
)

func main() {
	cfg := config.Load()

	writer := &kafka.Writer{
		Addr:     kafka.TCP(strings.Split(cfg.KafkaBrokers, ",")...),
		Topic:    cfg.KafkaTopic,
		Balancer: &kafka.LeastBytes{},
	}
	defer writer.Close()

	handler := ingestion.NewHandler(writer)
	srv := server.New(handler)

	log.Printf("Pulse ingestion server listening on %s", cfg.ServerAddr)
	if err := http.ListenAndServe(cfg.ServerAddr, srv); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
