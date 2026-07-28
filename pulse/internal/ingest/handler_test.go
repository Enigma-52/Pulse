package ingest

import (
	"bytes"
	"compress/gzip"
	"net/http/httptest"
	"testing"

	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	collectorTrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"
)

func sampleTraceRequest() *collectorTrace.ExportTraceServiceRequest {
	return &collectorTrace.ExportTraceServiceRequest{
		ResourceSpans: []*tracepb.ResourceSpans{{
			Resource: &resourcepb.Resource{
				Attributes: []*commonpb.KeyValue{{
					Key:   "service.name",
					Value: &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "checkout"}},
				}},
			},
			ScopeSpans: []*tracepb.ScopeSpans{{
				Spans: []*tracepb.Span{{Name: "GET /cart", TraceId: []byte("0123456789abcdef")}},
			}},
		}},
	}
}

// The headline Round 7 fix: OTel exporters (and the Collector's otlphttp
// exporter) gzip payloads by default. readAndNormalize must transparently
// decompress a Content-Encoding: gzip body.
func TestReadAndNormalizeGzip(t *testing.T) {
	raw, err := proto.Marshal(sampleTraceRequest())
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write(raw); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	gz.Close()

	req := httptest.NewRequest("POST", "/v1/traces", &buf)
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Content-Encoding", "gzip")

	out, err := readAndNormalize(httptest.NewRecorder(), req, &collectorTrace.ExportTraceServiceRequest{})
	if err != nil {
		t.Fatalf("readAndNormalize gzip returned error: %v", err)
	}

	var got collectorTrace.ExportTraceServiceRequest
	if err := proto.Unmarshal(out, &got); err != nil {
		t.Fatalf("output not valid protobuf: %v", err)
	}
	if len(got.ResourceSpans) != 1 || got.ResourceSpans[0].ScopeSpans[0].Spans[0].Name != "GET /cart" {
		t.Fatalf("decoded payload mismatch: %+v", &got)
	}
}

// Uncompressed protobuf must still pass through unchanged.
func TestReadAndNormalizePlainProto(t *testing.T) {
	raw, _ := proto.Marshal(sampleTraceRequest())
	req := httptest.NewRequest("POST", "/v1/traces", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/x-protobuf")

	out, err := readAndNormalize(httptest.NewRecorder(), req, &collectorTrace.ExportTraceServiceRequest{})
	if err != nil {
		t.Fatalf("plain proto returned error: %v", err)
	}
	if !bytes.Equal(out, raw) {
		t.Fatalf("plain proto body was altered")
	}
}

// A body claiming gzip but not actually gzipped is a 400-class error, not a panic.
func TestReadAndNormalizeBadGzip(t *testing.T) {
	req := httptest.NewRequest("POST", "/v1/traces", bytes.NewReader([]byte("not gzip")))
	req.Header.Set("Content-Encoding", "gzip")

	if _, err := readAndNormalize(httptest.NewRecorder(), req, &collectorTrace.ExportTraceServiceRequest{}); err == nil {
		t.Fatalf("expected error for malformed gzip, got nil")
	}
}
