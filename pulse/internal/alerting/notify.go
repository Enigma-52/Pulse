package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
	"github.com/pulse-observability/pulse/pulse/internal/query/store"
)

// Notifier delivers alert transitions to the rule's notification channels.
// Delivery failures are logged and never block evaluation.
type Notifier struct {
	Store  *store.Store
	Client *http.Client
}

func NewNotifier(s *store.Store) *Notifier {
	return &Notifier{Store: s, Client: &http.Client{Timeout: 5 * time.Second}}
}

func (n *Notifier) Send(ctx context.Context, rule model.AlertRule, alert model.Alert) {
	if len(rule.ChannelIDs) == 0 {
		return
	}
	channels, err := n.Store.ListChannels(ctx)
	if err != nil {
		log.Printf("notifier: list channels: %v", err)
		return
	}
	byID := map[string]model.NotificationChannel{}
	for _, c := range channels {
		byID[c.ID] = c
	}

	for _, id := range rule.ChannelIDs {
		c, ok := byID[id]
		if !ok {
			continue
		}
		switch c.Type {
		case "webhook":
			n.sendWebhook(ctx, c, alert)
		case "slack":
			n.sendSlack(ctx, c, rule, alert)
		case "email":
			log.Printf("notifier: channel %q: email delivery not implemented, alert %s logged only", c.Name, alert.ID)
		}
	}
}

func channelURL(c model.NotificationChannel) string {
	var cfg struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal([]byte(c.ConfigJSON), &cfg)
	return cfg.URL
}

func (n *Notifier) sendWebhook(ctx context.Context, c model.NotificationChannel, alert model.Alert) {
	n.post(ctx, c, alert)
}

func (n *Notifier) sendSlack(ctx context.Context, c model.NotificationChannel, rule model.AlertRule, alert model.Alert) {
	icon, label := ":rotating_light:", "FIRING"
	if alert.Status == "resolved" {
		icon, label = ":white_check_mark:", "RESOLVED"
	}
	text := fmt.Sprintf("%s *[%s]* %s — %s %s %s %.2f, current %.2f",
		icon, label, rule.Name, rule.Aggregation, rule.Signal, rule.Operator, rule.Threshold, alert.Value)
	if alert.Service != "" {
		text += fmt.Sprintf(" (service `%s`)", alert.Service)
	}
	n.post(ctx, c, map[string]string{"text": text})
}

func (n *Notifier) post(ctx context.Context, c model.NotificationChannel, payload any) {
	url := channelURL(c)
	if url == "" {
		log.Printf("notifier: channel %q has no url configured", c.Name)
		return
	}
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("notifier: marshal payload: %v", err)
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		log.Printf("notifier: build request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.Client.Do(req)
	if err != nil {
		log.Printf("notifier: channel %q: %v", c.Name, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("notifier: channel %q: unexpected status %d", c.Name, resp.StatusCode)
	}
}
