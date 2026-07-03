package config

import (
	"os"
	"strconv"
)

type ClickHouseConfig struct {
	Addr     string
	Database string
	User     string
	Password string
}

type Config struct {
	Addr        string // single listen address for OTLP + API
	ClickHouse  ClickHouseConfig
	PipelineCap int
	IngestRPS   int // max ingest requests/sec, 0 = unlimited
}

func Load() Config {
	return Config{
		Addr: getEnv("PULSE_ADDR", ":4321"),
		ClickHouse: ClickHouseConfig{
			Addr:     getEnv("PULSE_CLICKHOUSE_ADDR", "localhost:9000"),
			Database: getEnv("PULSE_CLICKHOUSE_DB", "default"),
			User:     getEnv("PULSE_CLICKHOUSE_USER", "default"),
			Password: getEnv("PULSE_CLICKHOUSE_PASSWORD", ""),
		},
		PipelineCap: getEnvInt("PULSE_PIPELINE_CAP", 10000),
		IngestRPS:   getEnvInt("PULSE_INGEST_RPS", 0),
	}
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
