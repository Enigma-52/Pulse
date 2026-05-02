package store

import (
	"strings"
	"testing"
	"time"

	"github.com/pulse-observability/pulse/services/query-api/internal/model"
)

func TestBuildTraceQueryIncludesFilters(t *testing.T) {
	start := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 5, 2, 0, 0, 0, 0, time.UTC)
	q, args := buildTraceQuery(model.TraceFilters{
		Service:       "api",
		Route:         "/slow",
		Status:        "error",
		ErrorOnly:     true,
		TagKey:        "region",
		TagValue:      "us-east-1",
		MinDurationMs: 100,
		MaxDurationMs: 5000,
		Start:         start,
		End:           end,
		HasStart:      true,
		HasEnd:        true,
		Limit:         50,
		Offset:        20,
	})

	fragments := []string{
		"AND service = ?",
		"AND route = ?",
		"AND status = ?",
		"AND (status = 'error' OR error != '')",
		"AND duration_ms >= ?",
		"AND duration_ms <= ?",
		"AND position(attributes_json, ?) > 0",
		"AND start_time >= ?",
		"AND start_time <= ?",
		"LIMIT ? OFFSET ?",
	}
	for _, f := range fragments {
		if !strings.Contains(q, f) {
			t.Fatalf("query missing fragment %q\n%s", f, q)
		}
	}

	if len(args) != 10 {
		t.Fatalf("expected 10 args, got %d", len(args))
	}
}
