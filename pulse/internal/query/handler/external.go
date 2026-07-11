package handler

import (
	"context"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleExternalCalls(w http.ResponseWriter, r *http.Request) {
	service := r.URL.Query().Get("service")
	if v := mux.Vars(r)["service"]; v != "" {
		service = v
	}

	calls, err := h.Store.GetExternalCalls(context.Background(), service, parseMinutes(r, 15))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query external calls")
		return
	}
	if calls == nil {
		calls = []model.ExternalCallSummary{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": calls})
}
