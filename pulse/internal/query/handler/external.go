package handler

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleExternalCalls(w http.ResponseWriter, r *http.Request) {
	service := r.URL.Query().Get("service")
	if v := mux.Vars(r)["service"]; v != "" {
		service = v
	}

	calls, err := h.Store.GetExternalCalls(r.Context(), service, parseMinutes(r, 15))
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query external calls")
		return
	}
	if calls == nil {
		calls = []model.ExternalCallSummary{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": calls})
}

// HandleExternalHostDetail returns aggregate stats, per-service callers, and
// recent traces for a single external host.
func (h *Handler) HandleExternalHostDetail(w http.ResponseWriter, r *http.Request) {
	host := mux.Vars(r)["host"]
	if host == "" {
		writeJSONError(w, http.StatusBadRequest, "host is required")
		return
	}
	minutes := parseMinutes(r, 15)

	overview, err := h.Store.GetExternalHostOverview(r.Context(), host, minutes)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query host overview")
		return
	}
	callers, err := h.Store.GetExternalHostCallers(r.Context(), host, minutes)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query host callers")
		return
	}
	recent, err := h.Store.GetExternalHostTraces(r.Context(), host, minutes, 50)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query host traces")
		return
	}
	if callers == nil {
		callers = []model.ExternalCaller{}
	}
	if recent == nil {
		recent = []model.ExternalHostTrace{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"overview": overview, "callers": callers, "recent": recent})
}
