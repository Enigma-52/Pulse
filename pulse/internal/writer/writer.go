package writer

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/pulse-observability/pulse/pulse/internal/pipeline"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	collectorLogs "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectorMetrics "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectorTrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/proto"
)

type Writer struct {
	store *Store
	pipe  <-chan pipeline.Batch
}

func New(store *Store, pipe <-chan pipeline.Batch) *Writer {
	return &Writer{store: store, pipe: pipe}
}

// Run drains the pipeline and writes to ClickHouse. Blocks until ctx is cancelled.
func (w *Writer) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case batch := <-w.pipe:
			if err := w.process(ctx, batch); err != nil {
				log.Printf("writer error (%s): %v", batch.Signal, err)
			}
		}
	}
}

func (w *Writer) process(ctx context.Context, b pipeline.Batch) error {
	switch b.Signal {
	case "traces":
		return w.processTraces(ctx, b.Data)
	case "logs":
		return w.processLogs(ctx, b.Data)
	case "metrics":
		return w.processMetrics(ctx, b.Data)
	default:
		return fmt.Errorf("unknown signal: %s", b.Signal)
	}
}

func (w *Writer) processTraces(ctx context.Context, data []byte) error {
	var req collectorTrace.ExportTraceServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return err
	}

	var spans []Span
	var exceptions []Exception
	for _, rs := range req.ResourceSpans {
		svc, env := extractResourceInfo(rs.Resource)
		resAttrs := marshalKVs(rs.Resource.GetAttributes())

		for _, ss := range rs.ScopeSpans {
			scopeName, scopeVer := scopeInfo(ss.Scope)
			for _, s := range ss.Spans {
				startMs := int64(s.StartTimeUnixNano / 1_000_000)
				endMs := int64(s.EndTimeUnixNano / 1_000_000)

				status, statusMsg := spanStatus(s.Status)
				attrs := kvListToMap(s.Attributes)
				route := extractRoute(attrs)

				span := Span{
					TraceID:                hex.EncodeToString(s.TraceId),
					SpanID:                 hex.EncodeToString(s.SpanId),
					ParentSpanID:           hex.EncodeToString(s.ParentSpanId),
					Service:                svc,
					Environment:            env,
					Route:                  route,
					Name:                   s.Name,
					Kind:                   spanKindStr(s.Kind),
					DurationMs:             endMs - startMs,
					Status:                 status,
					StatusMessage:          statusMsg,
					StartTimeMs:            startMs,
					EndTimeMs:              endMs,
					AttributesJSON:         marshalKVs(s.Attributes),
					EventsJSON:             marshalEvents(s.Events),
					LinksJSON:              marshalLinks(s.Links),
					ResourceAttributesJSON: resAttrs,
					ScopeName:              scopeName,
					ScopeVersion:           scopeVer,
				}
				spans = append(spans, span)
				exceptions = append(exceptions, extractExceptions(span, s.Events)...)
			}
		}
	}
	if err := w.store.InsertSpans(ctx, spans); err != nil {
		return err
	}
	return w.store.InsertExceptions(ctx, exceptions)
}

func (w *Writer) processLogs(ctx context.Context, data []byte) error {
	var req collectorLogs.ExportLogsServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return err
	}

	var logs []LogEntry
	for _, rl := range req.ResourceLogs {
		svc, env := extractResourceInfo(rl.Resource)
		resAttrs := marshalKVs(rl.Resource.GetAttributes())

		for _, sl := range rl.ScopeLogs {
			scopeName, scopeVer := scopeInfo(sl.Scope)
			for _, lr := range sl.LogRecords {
				body := ""
				if lr.Body != nil {
					body = anyValueString(lr.Body)
				}
				logs = append(logs, LogEntry{
					TimestampMs:            int64(lr.TimeUnixNano / 1_000_000),
					Level:                  severityToLevel(lr.SeverityNumber, lr.SeverityText),
					SeverityNumber:         int32(lr.SeverityNumber),
					Body:                   body,
					Service:                svc,
					Environment:            env,
					TraceID:                hex.EncodeToString(lr.TraceId),
					SpanID:                 hex.EncodeToString(lr.SpanId),
					AttributesJSON:         marshalKVs(lr.Attributes),
					ResourceAttributesJSON: resAttrs,
					ScopeName:              scopeName,
					ScopeVersion:           scopeVer,
				})
			}
		}
	}
	return w.store.InsertLogs(ctx, logs)
}

func (w *Writer) processMetrics(ctx context.Context, data []byte) error {
	var req collectorMetrics.ExportMetricsServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return err
	}

	var points []MetricPoint
	for _, rm := range req.ResourceMetrics {
		svc, env := extractResourceInfo(rm.Resource)
		resAttrs := marshalKVs(rm.Resource.GetAttributes())

		for _, sm := range rm.ScopeMetrics {
			scopeName, scopeVer := scopeInfo(sm.Scope)
			for _, m := range sm.Metrics {
				pts := extractMetricPoints(m)
				for i := range pts {
					pts[i].Service = svc
					pts[i].Environment = env
					pts[i].ResourceAttributesJSON = resAttrs
					pts[i].ScopeName = scopeName
					pts[i].ScopeVersion = scopeVer
				}
				points = append(points, pts...)
			}
		}
	}
	return w.store.InsertMetrics(ctx, points)
}

// --- helpers ---

type instrumentationScope interface {
	GetName() string
	GetVersion() string
}

func scopeInfo(scope instrumentationScope) (string, string) {
	if scope == nil {
		return "", ""
	}
	return scope.GetName(), scope.GetVersion()
}

func extractResourceInfo(res *resourcepb.Resource) (service, env string) {
	if res == nil {
		return "unknown", ""
	}
	for _, kv := range res.Attributes {
		switch kv.Key {
		case "service.name":
			service = kv.Value.GetStringValue()
		case "deployment.environment", "deployment.environment.name":
			env = kv.Value.GetStringValue()
		}
	}
	if service == "" {
		service = "unknown"
	}
	return
}

func extractRoute(attrs map[string]interface{}) string {
	// Prefer explicit route first
	for _, key := range []string{"http.route", "url.path", "http.path"} {
		if v, ok := attrs[key].(string); ok && v != "" {
			return v
		}
	}
	// Fall back to http.target (strip query string)
	if target, ok := attrs["http.target"].(string); ok && target != "" {
		if idx := strings.IndexByte(target, '?'); idx != -1 {
			target = target[:idx]
		}
		return target
	}
	// Fall back to url.full (parse path, strip query)
	if urlFull, ok := attrs["http.url"].(string); ok && urlFull != "" {
		// Extract path from full URL
		if idx := strings.Index(urlFull, "://"); idx != -1 {
			rest := urlFull[idx+3:]
			if pathIdx := strings.IndexByte(rest, '/'); pathIdx != -1 {
				path := rest[pathIdx:]
				if qIdx := strings.IndexByte(path, '?'); qIdx != -1 {
					path = path[:qIdx]
				}
				return path
			}
		}
	}
	return ""
}

func kvListToMap(kvs []*commonpb.KeyValue) map[string]interface{} {
	m := make(map[string]interface{}, len(kvs))
	for _, kv := range kvs {
		m[kv.Key] = anyValueToInterface(kv.Value)
	}
	return m
}

func anyValueToInterface(v *commonpb.AnyValue) interface{} {
	if v == nil {
		return nil
	}
	switch val := v.Value.(type) {
	case *commonpb.AnyValue_StringValue:
		return val.StringValue
	case *commonpb.AnyValue_IntValue:
		return val.IntValue
	case *commonpb.AnyValue_DoubleValue:
		return val.DoubleValue
	case *commonpb.AnyValue_BoolValue:
		return val.BoolValue
	case *commonpb.AnyValue_ArrayValue:
		arr := make([]interface{}, 0, len(val.ArrayValue.Values))
		for _, item := range val.ArrayValue.Values {
			arr = append(arr, anyValueToInterface(item))
		}
		return arr
	case *commonpb.AnyValue_KvlistValue:
		return kvListToMap(val.KvlistValue.Values)
	case *commonpb.AnyValue_BytesValue:
		return hex.EncodeToString(val.BytesValue)
	}
	return nil
}

func anyValueString(v *commonpb.AnyValue) string {
	if s, ok := v.Value.(*commonpb.AnyValue_StringValue); ok {
		return s.StringValue
	}
	b, _ := json.Marshal(anyValueToInterface(v))
	return string(b)
}

func marshalKVs(kvs []*commonpb.KeyValue) string {
	if len(kvs) == 0 {
		return "{}"
	}
	b, _ := json.Marshal(kvListToMap(kvs))
	return string(b)
}

func marshalEvents(events []*tracepb.Span_Event) string {
	if len(events) == 0 {
		return "[]"
	}
	type ev struct {
		TimeMs int64                  `json:"time"`
		Name   string                 `json:"name"`
		Attrs  map[string]interface{} `json:"attrs,omitempty"`
	}
	out := make([]ev, len(events))
	for i, e := range events {
		out[i] = ev{TimeMs: int64(e.TimeUnixNano / 1_000_000), Name: e.Name, Attrs: kvListToMap(e.Attributes)}
	}
	b, _ := json.Marshal(out)
	return string(b)
}

func marshalLinks(links []*tracepb.Span_Link) string {
	if len(links) == 0 {
		return "[]"
	}
	type lk struct {
		TraceID string                 `json:"traceId"`
		SpanID  string                 `json:"spanId"`
		Attrs   map[string]interface{} `json:"attrs,omitempty"`
	}
	out := make([]lk, len(links))
	for i, l := range links {
		out[i] = lk{TraceID: hex.EncodeToString(l.TraceId), SpanID: hex.EncodeToString(l.SpanId), Attrs: kvListToMap(l.Attributes)}
	}
	b, _ := json.Marshal(out)
	return string(b)
}

func spanKindStr(k tracepb.Span_SpanKind) string {
	switch k {
	case tracepb.Span_SPAN_KIND_SERVER:
		return "server"
	case tracepb.Span_SPAN_KIND_CLIENT:
		return "client"
	case tracepb.Span_SPAN_KIND_PRODUCER:
		return "producer"
	case tracepb.Span_SPAN_KIND_CONSUMER:
		return "consumer"
	default:
		return "internal"
	}
}

func spanStatus(s *tracepb.Status) (string, string) {
	if s == nil {
		return "ok", ""
	}
	switch s.Code {
	case tracepb.Status_STATUS_CODE_OK:
		return "ok", s.Message
	case tracepb.Status_STATUS_CODE_ERROR:
		return "error", s.Message
	default:
		return "ok", s.Message
	}
}

func severityToLevel(sn logspb.SeverityNumber, text string) string {
	if text != "" {
		return strings.ToLower(text)
	}
	switch {
	case sn >= logspb.SeverityNumber_SEVERITY_NUMBER_FATAL:
		return "fatal"
	case sn >= logspb.SeverityNumber_SEVERITY_NUMBER_ERROR:
		return "error"
	case sn >= logspb.SeverityNumber_SEVERITY_NUMBER_WARN:
		return "warn"
	case sn >= logspb.SeverityNumber_SEVERITY_NUMBER_INFO:
		return "info"
	case sn >= logspb.SeverityNumber_SEVERITY_NUMBER_DEBUG:
		return "debug"
	default:
		return "trace"
	}
}

func extractMetricPoints(m *metricspb.Metric) []MetricPoint {
	var points []MetricPoint
	unit := m.Unit

	switch d := m.Data.(type) {
	case *metricspb.Metric_Gauge:
		for _, dp := range d.Gauge.DataPoints {
			points = append(points, MetricPoint{Name: m.Name, Type: "gauge", Value: numberVal(dp), Unit: unit, TimestampMs: int64(dp.TimeUnixNano / 1_000_000), AttributesJSON: marshalKVs(dp.Attributes)})
		}
	case *metricspb.Metric_Sum:
		for _, dp := range d.Sum.DataPoints {
			points = append(points, MetricPoint{Name: m.Name, Type: "sum", Value: numberVal(dp), Unit: unit, TimestampMs: int64(dp.TimeUnixNano / 1_000_000), AttributesJSON: marshalKVs(dp.Attributes)})
		}
	case *metricspb.Metric_Histogram:
		for _, dp := range d.Histogram.DataPoints {
			points = append(points, MetricPoint{Name: m.Name, Type: "histogram", Value: dp.GetSum(), Unit: unit, TimestampMs: int64(dp.TimeUnixNano / 1_000_000), AttributesJSON: marshalKVs(dp.Attributes)})
		}
	case *metricspb.Metric_Summary:
		for _, dp := range d.Summary.DataPoints {
			points = append(points, MetricPoint{Name: m.Name, Type: "summary", Value: dp.Sum, Unit: unit, TimestampMs: int64(dp.TimeUnixNano / 1_000_000), AttributesJSON: marshalKVs(dp.Attributes)})
		}
	}
	return points
}

func numberVal(dp *metricspb.NumberDataPoint) float64 {
	switch v := dp.Value.(type) {
	case *metricspb.NumberDataPoint_AsDouble:
		return v.AsDouble
	case *metricspb.NumberDataPoint_AsInt:
		return float64(v.AsInt)
	}
	return 0
}
