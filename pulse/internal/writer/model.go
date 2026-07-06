package writer

type Span struct {
	TraceID                string
	SpanID                 string
	ParentSpanID           string
	Service                string
	Environment            string
	Route                  string
	Name                   string
	Kind                   string
	DurationMs             int64
	Status                 string
	StatusMessage          string
	StartTimeMs            int64
	EndTimeMs              int64
	AttributesJSON         string
	EventsJSON             string
	LinksJSON              string
	ResourceAttributesJSON string
	ScopeName              string
	ScopeVersion           string
}

type LogEntry struct {
	TimestampMs            int64
	Level                  string
	SeverityNumber         int32
	Body                   string
	Service                string
	Environment            string
	TraceID                string
	SpanID                 string
	AttributesJSON         string
	ResourceAttributesJSON string
	ScopeName              string
	ScopeVersion           string
}

type Exception struct {
	TimestampMs    int64
	Service        string
	Environment    string
	TraceID        string
	SpanID         string
	Route          string
	Type           string
	Message        string
	Stacktrace     string
	Fingerprint    string
	AttributesJSON string
}

type MetricPoint struct {
	Name                   string
	Type                   string
	Value                  float64
	Unit                   string
	TimestampMs            int64
	Service                string
	Environment            string
	AttributesJSON         string
	ResourceAttributesJSON string
	ScopeName              string
	ScopeVersion           string
}
