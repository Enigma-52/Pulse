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

	log.Println("Pulse worker starting (Kafka -> ClickHouse traces)")

	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			log.Printf("error reading from Kafka: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		if err := proc.Process(ctx, msg.Value); err != nil {
			log.Printf("failed to process message: %v", err)
		}
	}
}
