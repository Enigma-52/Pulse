package handler

import (
	"context"
	"net/http"
	"time"
)

type usageItem struct {
	Signal        string    `json:"signal"`
	Rows          uint64    `json:"rows"`
	Bytes         uint64    `json:"bytes"`
	Oldest        time.Time `json:"oldest"`
	Newest        time.Time `json:"newest"`
	RetentionDays int       `json:"retention_days"`
}

func (h *Handler) HandleUsage(w http.ResponseWriter, _ *http.Request) {
	usage, err := h.Store.GetUsage(context.Background())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query usage")
		return
	}

	retention := map[string]int{
		"traces":     h.Retention.TracesDays,
		"logs":       h.Retention.LogsDays,
		"metrics":    h.Retention.MetricsDays,
		"exceptions": h.Retention.ExceptionsDays,
	}

	items := make([]usageItem, 0, len(usage))
	for _, u := range usage {
		items = append(items, usageItem{
			Signal: u.Table, Rows: u.Rows, Bytes: u.Bytes,
			Oldest: u.Oldest, Newest: u.Newest,
			RetentionDays: retention[u.Table],
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
