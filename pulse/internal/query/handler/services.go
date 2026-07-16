package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

func (h *Handler) HandleServiceOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	service := mux.Vars(r)["service"]
	if strings.TrimSpace(service) == "" {
		writeJSONError(w, http.StatusBadRequest, "service is required")
		return
	}

	var start *time.Time
	if startRaw := r.URL.Query().Get("start"); startRaw != "" {
		t, err := ParseTimeParam(startRaw)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid start time")
			return
		}
		start = &t
	}

	overview, err := h.Store.GetServiceOverview(ctx, service, start)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query service overview")
		return
	}
	if overview == nil {
		writeJSONError(w, http.StatusNotFound, fmt.Sprintf("service %q not found", service))
		return
	}
	writeJSON(w, http.StatusOK, overview)
}
