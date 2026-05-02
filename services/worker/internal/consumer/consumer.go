package consumer

import (
	"strings"

	"github.com/pulse-observability/pulse/services/worker/internal/config"
	"github.com/segmentio/kafka-go"
)

func NewKafkaReader(cfg config.KafkaConfig) *kafka.Reader {
	return kafka.NewReader(kafka.ReaderConfig{
		Brokers: strings.Split(cfg.Brokers, ","),
		Topic:   cfg.Topic,
		GroupID: cfg.GroupID,
	})
}
