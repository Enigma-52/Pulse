package model

type SpanEvent struct {
	Time int64                  `json:"time"`
	Name string                 `json:"name"`
	Attrs map[string]interface{} `json:"attrs,omitempty"`
}

type Span struct {
	TraceID      string                 `json:"traceId"`
	SpanID       string                 `json:"spanId"`
	ParentSpanID string                 `json:"parentSpanId"`
	Name         string                 `json:"name"`
	Kind         string                 `json:"kind"`
	StartTime    int64                  `json:"startTime"`
	EndTime      int64                  `json:"endTime"`
	DurationMs   int64                  `json:"durationMs"`
	Status       string                 `json:"status"`
	Error        string                 `json:"error"`
	Attributes   map[string]interface{} `json:"attributes"`
	Events       []SpanEvent            `json:"events"`
}

type Envelope struct {
	ServiceName string `json:"serviceName"`
	Environment string `json:"environment"`
	Spans       []Span `json:"spans"`
}
