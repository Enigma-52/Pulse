package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleServicesList(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	minutes := 15
	if v := r.URL.Query().Get("minutes"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid minutes parameter")
			return
		}
		minutes = n
	}

	services, err := h.Store.GetServicesList(ctx, minutes)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query services")
		return
	}
	if services == nil {
		services = []model.ServiceSummary{}
	}
	writeJSON(w, http.StatusOK, model.ServicesListResponse{Items: services})
}
