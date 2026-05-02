package config

import "os"

type Config struct {
	KafkaBrokers string
	KafkaTopic   string
	ServerAddr   string
}

func Load() Config {
	return Config{
		KafkaBrokers: getEnv("PULSE_KAFKA_BROKERS", "localhost:9092"),
		KafkaTopic:   getEnv("PULSE_KAFKA_TOPIC", "traces_raw"),
		ServerAddr:   getEnv("PULSE_SERVER_ADDR", ":8081"),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
