package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/pulse-observability/pulse/pulse/internal/query/store"
)

func (h *Handler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 {
		writeJSON(w, http.StatusOK, map[string]any{"results": []store.SearchResult{}})
		return
	}

	results, err := h.Store.Search(context.Background(), q, parseMinutes(r, 60))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "search failed")
		return
	}
	if results == nil {
		results = []store.SearchResult{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (h *Handler) HandleEnvironments(w http.ResponseWriter, r *http.Request) {
	envs, err := h.Store.ListEnvironments(context.Background(), parseMinutes(r, 1440))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query environments")
		return
	}
	if envs == nil {
		envs = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": envs})
}
