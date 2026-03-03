package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/segmentio/kafka-go"
)

type Span struct {
	TraceID      string                 `json:"traceId"`
	SpanID       string                 `json:"spanId"`
	ParentSpanID string                 `json:"parentSpanId"`
	Name         string                 `json:"name"`
	StartTime    int64                  `json:"startTime"`
	EndTime      int64                  `json:"endTime"`
	DurationMs   int64                  `json:"durationMs"`
	Status       string                 `json:"status"`
	Error        string                 `json:"error"`
	Attributes   map[string]interface{} `json:"attributes"`
}

type Envelope struct {
	ServiceName string `json:"serviceName"`
	Environment string `json:"environment"`
	Spans       []Span `json:"spans"`
}

func main() {
	ctx := context.Background()

	chConn, err := connectClickHouse(ctx)
	if err != nil {
		log.Fatalf("failed to connect to ClickHouse: %v", err)
	}

	if err := ensureTracesTable(ctx, chConn); err != nil {
		log.Fatalf("failed to ensure traces table: %v", err)
	}

	reader := newKafkaReader()
	defer reader.Close()

	log.Println("Pulse worker starting (Kafka -> ClickHouse traces)")

	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			log.Printf("error reading from Kafka: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		if err := processMessage(ctx, chConn, msg.Value); err != nil {
			log.Printf("failed to process message: %v", err)
		}
	}
}

func connectClickHouse(ctx context.Context) (driver.Conn, error) {
	addr := getEnv("PULSE_CLICKHOUSE_ADDR", "localhost:9000")
	db := getEnv("PULSE_CLICKHOUSE_DB", "default")
	user := getEnv("PULSE_CLICKHOUSE_USER", "default")
	pass := getEnv("PULSE_CLICKHOUSE_PASSWORD", "abcd")

	return clickhouse.Open(&clickhouse.Options{
		Addr: []string{addr},
		Auth: clickhouse.Auth{
			Database: db,
			Username: user,
			Password: pass,
		},
	})
}

func ensureTracesTable(ctx context.Context, conn driver.Conn) error {
	const ddl = `
CREATE TABLE IF NOT EXISTS traces (
	trace_id String,
	span_id String,
	parent_span_id String,
	service String,
	environment String,
	route String,
	name String,
	duration_ms Int64,
	status String,
	error String,
	start_time DateTime64(3),
	end_time DateTime64(3),
	attributes_json String
) ENGINE = MergeTree
ORDER BY (service, start_time)
`
	return conn.Exec(ctx, ddl)
}

func newKafkaReader() *kafka.Reader {
	brokers := getEnv("PULSE_KAFKA_BROKERS", "localhost:9092")
	topic := getEnv("PULSE_TRACES_TOPIC", "traces_raw")
	groupID := getEnv("PULSE_WORKER_GROUP", "pulse-worker")

	return kafka.NewReader(kafka.ReaderConfig{
		Brokers: strings.Split(brokers, ","),
		Topic:   topic,
		GroupID: groupID,
	})
}

func processMessage(ctx context.Context, conn driver.Conn, value []byte) error {
	var env Envelope
	if err := json.Unmarshal(value, &env); err != nil {
		return err
	}

	if len(env.Spans) == 0 {
		return nil
	}

	batch, err := conn.PrepareBatch(ctx, `
INSERT INTO traces (
	trace_id,
	span_id,
	parent_span_id,
	service,
	environment,
	route,
	name,
	duration_ms,
	status,
	error,
	start_time,
	end_time,
	attributes_json
) VALUES
`)
	if err != nil {
		return err
	}

	for _, span := range env.Spans {
		start := time.UnixMilli(span.StartTime)
		end := time.UnixMilli(span.EndTime)

		route := ""
		if v, ok := span.Attributes["http.path"].(string); ok {
			route = v
		}

		attrsJSON, err := json.Marshal(span.Attributes)
		if err != nil {
			return err
		}

		if err := batch.Append(
			span.TraceID,
			span.SpanID,
			span.ParentSpanID,
			env.ServiceName,
			env.Environment,
			route,
			span.Name,
			span.DurationMs,
			span.Status,
			span.Error,
			start,
			end,
			string(attrsJSON),
		); err != nil {
			return err
		}
	}

	return batch.Send()
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

