package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/pulse-observability/pulse/services/query-api/internal/model"
)

func TestParseTraceFiltersDefaults(t *testing.T) {
	req := httptest.NewRequest("GET", "/traces", nil)
	f, err := ParseTraceFilters(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Limit != model.DefaultLimit {
		t.Fatalf("expected default limit %d, got %d", model.DefaultLimit, f.Limit)
	}
	if f.Offset != 0 {
		t.Fatalf("expected default offset 0, got %d", f.Offset)
	}
}

func TestParseTraceFiltersValidation(t *testing.T) {
	cases := []string{
		"/traces?min_duration_ms=x",
		"/traces?max_duration_ms=x",
		"/traces?min_duration_ms=100&max_duration_ms=10",
		"/traces?limit=0",
		"/traces?offset=-1",
		"/traces?error_only=nope",
		"/traces?start=2026-05-03T00:00:00Z&end=2026-05-02T00:00:00Z",
	}
	for _, path := range cases {
		req := httptest.NewRequest("GET", path, nil)
		_, err := ParseTraceFilters(req)
		if err == nil {
			t.Fatalf("expected error for case %s", path)
		}
	}
}

func TestParseTraceFiltersLimitCap(t *testing.T) {
	req := httptest.NewRequest("GET", "/traces?limit=9999", nil)
	f, err := ParseTraceFilters(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Limit != model.MaxLimit {
		t.Fatalf("expected capped limit %d, got %d", model.MaxLimit, f.Limit)
	}
}

func TestParseTimeParam(t *testing.T) {
	if _, err := ParseTimeParam("not-a-time"); err == nil {
		t.Fatal("expected parse error")
	}

	ts, err := ParseTimeParam("1746144000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ts.Year() != 2025 {
		t.Fatalf("unexpected year for unix seconds: %d", ts.Year())
	}

	ms, err := ParseTimeParam("1746144000000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ms.Year() != 2025 {
		t.Fatalf("unexpected year for unix millis: %d", ms.Year())
	}

	rfc, err := ParseTimeParam("2026-05-02T11:30:00Z")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rfc.Year() != 2026 {
		t.Fatalf("unexpected year for rfc3339: %d", rfc.Year())
	}
}
