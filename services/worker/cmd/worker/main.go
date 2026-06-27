package main

import (
	"context"
	"log"
	"time"

	"github.com/pulse-observability/pulse/services/worker/internal/config"
	"github.com/pulse-observability/pulse/services/worker/internal/consumer"
	"github.com/pulse-observability/pulse/services/worker/internal/processor"
	"github.com/pulse-observability/pulse/services/worker/internal/store"
)

func main() {
	ctx := context.Background()
	cfg := config.Load()

	s, err := store.Connect(cfg.ClickHouse)
	if err != nil {
		log.Fatalf("failed to connect to ClickHouse: %v", err)
	}

	if err := s.EnsureTables(ctx); err != nil {
		log.Fatalf("failed to ensure tables: %v", err)
	}

	reader := consumer.NewKafkaReader(cfg.Kafka)
	defer reader.Close()

	proc := processor.New(s)

	log.Println("Pulse worker starting (Kafka OTLP -> ClickHouse)")

	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			log.Printf("error reading from Kafka: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		signal := "traces"
		for _, h := range msg.Headers {
			if h.Key == "signal" {
				signal = string(h.Value)
				break
			}
		}

		if err := proc.Process(ctx, signal, msg.Value); err != nil {
			log.Printf("failed to process %s message: %v", signal, err)
		}
	}
}
