package config

import "os"

type ClickHouseConfig struct {
	Addr     string
	Database string
	User     string
	Password string
}

type Config struct {
	Addr       string // single listen address for OTLP + API
	ClickHouse ClickHouseConfig
	PipelineCap int
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
		PipelineCap: 10000,
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
