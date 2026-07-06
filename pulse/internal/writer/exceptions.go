package writer

import (
	"crypto/sha1"
	"encoding/hex"
	"regexp"
	"strings"

	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

// OTel SDKs record exceptions as span events named "exception" with
// exception.type / exception.message / exception.stacktrace attributes.
// extractExceptions pulls those into dedicated rows at write time so the
// exceptions table can be grouped and indexed without scanning events_json.
func extractExceptions(span Span, events []*tracepb.Span_Event) []Exception {
	var out []Exception
	for _, e := range events {
		if e.Name != "exception" {
			continue
		}
		attrs := kvListToMap(e.Attributes)
		excType, _ := attrs["exception.type"].(string)
		excMsg, _ := attrs["exception.message"].(string)
		stack, _ := attrs["exception.stacktrace"].(string)
		if excType == "" && excMsg == "" {
			continue
		}
		if excType == "" {
			excType = "UnknownException"
		}
		out = append(out, Exception{
			TimestampMs:    int64(e.TimeUnixNano / 1_000_000),
			Service:        span.Service,
			Environment:    span.Environment,
			TraceID:        span.TraceID,
			SpanID:         span.SpanID,
			Route:          span.Route,
			Type:           excType,
			Message:        excMsg,
			Stacktrace:     stack,
			Fingerprint:    exceptionFingerprint(excType, excMsg, stack),
			AttributesJSON: span.AttributesJSON,
		})
	}
	return out
}

var variableTokens = regexp.MustCompile(`(0x[0-9a-fA-F]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\d+)`)

// exceptionFingerprint groups occurrences of the same logical error:
// sha1(type + normalized message + top stack frame). Digits, hex addresses,
// and UUIDs in the message are masked so "timeout after 31ms" and
// "timeout after 88ms" share a fingerprint.
func exceptionFingerprint(excType, message, stacktrace string) string {
	normalized := variableTokens.ReplaceAllString(message, "#")
	h := sha1.New()
	h.Write([]byte(excType))
	h.Write([]byte{0})
	h.Write([]byte(normalized))
	h.Write([]byte{0})
	h.Write([]byte(topFrame(stacktrace)))
	return hex.EncodeToString(h.Sum(nil))
}

// topFrame returns the first frame-looking line of the stacktrace (skipping
// the header line that usually repeats type/message).
func topFrame(stacktrace string) string {
	lines := strings.Split(stacktrace, "\n")
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || i == 0 {
			continue
		}
		return variableTokens.ReplaceAllString(line, "#")
	}
	return ""
}
