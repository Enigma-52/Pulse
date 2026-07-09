package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/pulse-observability/pulse/pulse/internal/alerting"
	"github.com/pulse-observability/pulse/pulse/internal/config"
	"github.com/pulse-observability/pulse/pulse/internal/ingest"
	"github.com/pulse-observability/pulse/pulse/internal/pipeline"
	queryhandler "github.com/pulse-observability/pulse/pulse/internal/query/handler"
	querystore "github.com/pulse-observability/pulse/pulse/internal/query/store"
	"github.com/pulse-observability/pulse/pulse/internal/server"
	"github.com/pulse-observability/pulse/pulse/internal/writer"
)

func main() {
	ctx := context.Background()
	cfg := config.Load()

	// ClickHouse
	ws, err := writer.ConnectStore(cfg.ClickHouse)
	if err != nil {
		log.Fatalf("clickhouse connect: %v", err)
	}
	ws.Retention = cfg.Retention
	if err := ws.EnsureTables(ctx); err != nil {
		log.Fatalf("clickhouse tables: %v", err)
	}

	qs := querystore.New(ws.Conn())
	if err := qs.EnsureUsersTable(ctx); err != nil {
		log.Fatalf("users table: %v", err)
	}

	// Pipeline: in-process channel replaces Kafka/Redpanda.
	// Buffered events are lost on crash — acceptable for v1.
	pipe := pipeline.New(cfg.PipelineCap)

	// Writer goroutine: drains pipeline → ClickHouse
	w := writer.New(ws, pipe)
	go w.Run(ctx)

	// Alert evaluator goroutine: evaluates rules, records firing/resolved
	evaluator := alerting.New(qs, time.Duration(cfg.AlertEvalIntervalSeconds)*time.Second)
	evaluator.Notify = alerting.NewNotifier(qs).Send
	go evaluator.Run(ctx)

	// HTTP server: OTLP ingest + query API on a single port
	ih := ingest.NewHandlerWithLimit(pipe, cfg.IngestRPS)
	qh := queryhandler.New(qs)
	qh.Retention = cfg.Retention
	srv := server.New(ih, qh)

	log.Printf("pulse listening on %s (OTLP ingest + query API)", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, srv); err != nil {
		log.Fatalf("server: %v", err)
	}
}
