module github.com/pulse-observability/pulse/services/ingestion

go 1.23.0

toolchain go1.24.0

require (
	github.com/gorilla/mux v1.8.1
	github.com/segmentio/kafka-go v0.4.47
	go.opentelemetry.io/proto/otlp v1.5.0
	google.golang.org/protobuf v1.36.6
)

require (
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.25.1 // indirect
	github.com/klauspost/compress v1.15.9 // indirect
	github.com/pierrec/lz4/v4 v4.1.15 // indirect
	golang.org/x/net v0.39.0 // indirect
	golang.org/x/sys v0.32.0 // indirect
	golang.org/x/text v0.24.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20250218202821-56aae31c358a // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250218202821-56aae31c358a // indirect
	google.golang.org/grpc v1.72.2 // indirect
)
