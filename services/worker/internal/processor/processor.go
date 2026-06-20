package processor

import (
	"context"
	"encoding/json"

	"github.com/pulse-observability/pulse/services/worker/internal/model"
	"github.com/pulse-observability/pulse/services/worker/internal/store"
)

type Processor struct {
	store *store.Store
}

func New(s *store.Store) *Processor {
	return &Processor{store: s}
}

func (p *Processor) Process(ctx context.Context, value []byte) error {
	var env model.Envelope
	if err := json.Unmarshal(value, &env); err != nil {
		return err
	}
	if err := p.store.InsertSpans(ctx, env); err != nil {
		return err
	}
	if err := p.store.InsertLogs(ctx, env); err != nil {
		return err
	}
	return p.store.InsertMetrics(ctx, env)
}
