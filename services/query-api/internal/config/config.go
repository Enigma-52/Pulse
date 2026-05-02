package config

import "os"

type ClickHouseConfig struct {
	Addr     string
	Database string
	User     string
	Password string
}

type Config struct {
	ServerAddr string
	ClickHouse ClickHouseConfig
}

func Load() Config {
	return Config{
		ServerAddr: getEnv("PULSE_SERVER_ADDR", ":8082"),
		ClickHouse: ClickHouseConfig{
			Addr:     getEnv("PULSE_CLICKHOUSE_ADDR", "localhost:9000"),
			Database: getEnv("PULSE_CLICKHOUSE_DB", "default"),
			User:     getEnv("PULSE_CLICKHOUSE_USER", "default"),
			Password: getEnv("PULSE_CLICKHOUSE_PASSWORD", ""),
		},
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
