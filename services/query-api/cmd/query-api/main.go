package main

import (
	"context"
	"log"
	"net/http"

	"github.com/pulse-observability/pulse/services/query-api/internal/config"
	"github.com/pulse-observability/pulse/services/query-api/internal/handler"
	"github.com/pulse-observability/pulse/services/query-api/internal/server"
	"github.com/pulse-observability/pulse/services/query-api/internal/store"
)

func main() {
	cfg := config.Load()

	s, err := store.Connect(cfg.ClickHouse)
	if err != nil {
		log.Fatalf("failed to connect to ClickHouse: %v", err)
	}

	if err := s.EnsureUsersTable(context.Background()); err != nil {
		log.Fatalf("failed to create users table: %v", err)
	}

	h := handler.New(s)
	srv := server.New(h)

	log.Printf("Pulse query API listening on %s", cfg.ServerAddr)
	if err := http.ListenAndServe(cfg.ServerAddr, srv); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
