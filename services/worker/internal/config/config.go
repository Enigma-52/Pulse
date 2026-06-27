package config

import "os"

type ClickHouseConfig struct {
	Addr     string
	Database string
	User     string
	Password string
}

type KafkaConfig struct {
	Brokers string
	Topic   string
	GroupID string
}

type Config struct {
	ClickHouse ClickHouseConfig
	Kafka      KafkaConfig
}

func Load() Config {
	return Config{
		ClickHouse: ClickHouseConfig{
			Addr:     getEnv("PULSE_CLICKHOUSE_ADDR", "localhost:9000"),
			Database: getEnv("PULSE_CLICKHOUSE_DB", "default"),
			User:     getEnv("PULSE_CLICKHOUSE_USER", "default"),
			Password: getEnv("PULSE_CLICKHOUSE_PASSWORD", "abcd"),
		},
		Kafka: KafkaConfig{
			Brokers: getEnv("PULSE_KAFKA_BROKERS", "localhost:9092"),
			Topic:   getEnv("PULSE_KAFKA_TOPIC", "otlp_raw"),
			GroupID: getEnv("PULSE_WORKER_GROUP", "pulse-worker"),
		},
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
