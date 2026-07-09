package handler

import (
	"github.com/pulse-observability/pulse/pulse/internal/config"
	"github.com/pulse-observability/pulse/pulse/internal/query/store"
)

type Handler struct {
	Store     *store.Store
	Retention config.RetentionConfig
}

func New(s *store.Store) *Handler {
	return &Handler{Store: s}
}
