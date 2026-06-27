package pipeline

// Batch represents a single OTLP payload moving through the in-process pipeline.
type Batch struct {
	Signal string // "traces", "logs", "metrics"
	Data   []byte // raw OTLP protobuf bytes
}

// New creates a buffered pipeline channel.
// Capacity controls how many batches can be buffered before backpressure kicks in.
func New(capacity int) chan Batch {
	return make(chan Batch, capacity)
}
