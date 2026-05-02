package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestParseTraceFiltersDefaults(t *testing.T) {
	req := httptest.NewRequest("GET", "/traces", nil)
	f, err := parseTraceFilters(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Limit != defaultLimit {
		t.Fatalf("expected default limit %d, got %d", defaultLimit, f.Limit)
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
		_, err := parseTraceFilters(req)
		if err == nil {
			t.Fatalf("expected error for case %s", path)
		}
	}
}

func TestParseTraceFiltersLimitCap(t *testing.T) {
	req := httptest.NewRequest("GET", "/traces?limit=9999", nil)
	f, err := parseTraceFilters(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.Limit != maxLimit {
		t.Fatalf("expected capped limit %d, got %d", maxLimit, f.Limit)
	}
}

func TestBuildTraceQueryIncludesFilters(t *testing.T) {
	start := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 5, 2, 0, 0, 0, 0, time.UTC)
	q, args := buildTraceQuery(traceFilters{
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

func TestParseTimeParam(t *testing.T) {
	if _, err := parseTimeParam("not-a-time"); err == nil {
		t.Fatal("expected parse error")
	}

	ts, err := parseTimeParam("1746144000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ts.Year() != 2025 {
		t.Fatalf("unexpected year for unix seconds: %d", ts.Year())
	}

	ms, err := parseTimeParam("1746144000000")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ms.Year() != 2025 {
		t.Fatalf("unexpected year for unix millis: %d", ms.Year())
	}

	rfc, err := parseTimeParam("2026-05-02T11:30:00Z")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rfc.Year() != 2026 {
		t.Fatalf("unexpected year for rfc3339: %d", rfc.Year())
	}
}
