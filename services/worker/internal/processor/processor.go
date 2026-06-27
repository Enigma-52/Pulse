package processor

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pulse-observability/pulse/services/worker/internal/model"
	"github.com/pulse-observability/pulse/services/worker/internal/store"
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

type Processor struct {
	store *store.Store
}

func New(s *store.Store) *Processor {
	return &Processor{store: s}
}

// Process dispatches a Kafka message to the correct handler based on the signal type.
func (p *Processor) Process(ctx context.Context, signal string, data []byte) error {
	switch signal {
	case "traces":
		return p.processTraces(ctx, data)
	case "logs":
		return p.processLogs(ctx, data)
	case "metrics":
		return p.processMetrics(ctx, data)
	default:
		return fmt.Errorf("unknown signal type: %s", signal)
	}
}

func (p *Processor) processTraces(ctx context.Context, data []byte) error {
	var req collectorTrace.ExportTraceServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return fmt.Errorf("unmarshal traces: %w", err)
	}

	var spans []model.Span
	for _, rs := range req.ResourceSpans {
		svc, env := extractResourceInfo(rs.Resource)
		resAttrs := marshalKVs(rs.Resource.GetAttributes())

		for _, ss := range rs.ScopeSpans {
			scopeName := ""
			scopeVer := ""
			if ss.Scope != nil {
				scopeName = ss.Scope.Name
				scopeVer = ss.Scope.Version
			}

			for _, s := range ss.Spans {
				startMs := int64(s.StartTimeUnixNano / 1_000_000)
				endMs := int64(s.EndTimeUnixNano / 1_000_000)

				status := "UNSET"
				statusMsg := ""
				if s.Status != nil {
					switch s.Status.Code {
					case tracepb.Status_STATUS_CODE_OK:
						status = "OK"
					case tracepb.Status_STATUS_CODE_ERROR:
						status = "ERROR"
					}
					statusMsg = s.Status.Message
				}

				attrs := kvListToMap(s.Attributes)
				route := ""
				if v, ok := attrs["http.route"].(string); ok {
					route = v
				} else if v, ok := attrs["http.path"].(string); ok {
					route = v
				} else if v, ok := attrs["url.path"].(string); ok {
					route = v
				}

				spans = append(spans, model.Span{
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
				})
			}
		}
	}

	if len(spans) == 0 {
		return nil
	}
	return p.store.InsertSpans(ctx, spans)
}

func (p *Processor) processLogs(ctx context.Context, data []byte) error {
	var req collectorLogs.ExportLogsServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return fmt.Errorf("unmarshal logs: %w", err)
	}

	var logs []model.LogEntry
	for _, rl := range req.ResourceLogs {
		svc, env := extractResourceInfo(rl.Resource)
		resAttrs := marshalKVs(rl.Resource.GetAttributes())

		for _, sl := range rl.ScopeLogs {
			scopeName := ""
			scopeVer := ""
			if sl.Scope != nil {
				scopeName = sl.Scope.Name
				scopeVer = sl.Scope.Version
			}

			for _, lr := range sl.LogRecords {
				body := ""
				if lr.Body != nil {
					body = anyValueString(lr.Body)
				}

				logs = append(logs, model.LogEntry{
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

	if len(logs) == 0 {
		return nil
	}
	return p.store.InsertLogs(ctx, logs)
}

func (p *Processor) processMetrics(ctx context.Context, data []byte) error {
	var req collectorMetrics.ExportMetricsServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return fmt.Errorf("unmarshal metrics: %w", err)
	}

	var points []model.MetricPoint
	for _, rm := range req.ResourceMetrics {
		svc, env := extractResourceInfo(rm.Resource)
		resAttrs := marshalKVs(rm.Resource.GetAttributes())

		for _, sm := range rm.ScopeMetrics {
			scopeName := ""
			scopeVer := ""
			if sm.Scope != nil {
				scopeName = sm.Scope.Name
				scopeVer = sm.Scope.Version
			}

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

	if len(points) == 0 {
		return nil
	}
	return p.store.InsertMetrics(ctx, points)
}

// --- helpers ---

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
	if v == nil {
		return ""
	}
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
		out[i] = ev{
			TimeMs: int64(e.TimeUnixNano / 1_000_000),
			Name:   e.Name,
			Attrs:  kvListToMap(e.Attributes),
		}
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
		out[i] = lk{
			TraceID: hex.EncodeToString(l.TraceId),
			SpanID:  hex.EncodeToString(l.SpanId),
			Attrs:   kvListToMap(l.Attributes),
		}
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

func extractMetricPoints(m *metricspb.Metric) []model.MetricPoint {
	var points []model.MetricPoint
	unit := m.Unit

	switch d := m.Data.(type) {
	case *metricspb.Metric_Gauge:
		for _, dp := range d.Gauge.DataPoints {
			points = append(points, model.MetricPoint{
				Name:           m.Name,
				Type:           "gauge",
				Value:          numberDataPointValue(dp),
				Unit:           unit,
				TimestampMs:    int64(dp.TimeUnixNano / 1_000_000),
				AttributesJSON: marshalKVs(dp.Attributes),
			})
		}
	case *metricspb.Metric_Sum:
		for _, dp := range d.Sum.DataPoints {
			points = append(points, model.MetricPoint{
				Name:           m.Name,
				Type:           "sum",
				Value:          numberDataPointValue(dp),
				Unit:           unit,
				TimestampMs:    int64(dp.TimeUnixNano / 1_000_000),
				AttributesJSON: marshalKVs(dp.Attributes),
			})
		}
	case *metricspb.Metric_Histogram:
		for _, dp := range d.Histogram.DataPoints {
			points = append(points, model.MetricPoint{
				Name:           m.Name,
				Type:           "histogram",
				Value:          dp.GetSum(),
				Unit:           unit,
				TimestampMs:    int64(dp.TimeUnixNano / 1_000_000),
				AttributesJSON: marshalKVs(dp.Attributes),
			})
		}
	case *metricspb.Metric_Summary:
		for _, dp := range d.Summary.DataPoints {
			points = append(points, model.MetricPoint{
				Name:           m.Name,
				Type:           "summary",
				Value:          dp.Sum,
				Unit:           unit,
				TimestampMs:    int64(dp.TimeUnixNano / 1_000_000),
				AttributesJSON: marshalKVs(dp.Attributes),
			})
		}
	}
	return points
}

func numberDataPointValue(dp *metricspb.NumberDataPoint) float64 {
	switch v := dp.Value.(type) {
	case *metricspb.NumberDataPoint_AsDouble:
		return v.AsDouble
	case *metricspb.NumberDataPoint_AsInt:
		return float64(v.AsInt)
	}
	return 0
}
