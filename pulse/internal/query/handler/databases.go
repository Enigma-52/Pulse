package handler

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/pulse/internal/query/model"
)

func (h *Handler) HandleDatabasesList(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	minutes := 15
	if v := r.URL.Query().Get("minutes"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			minutes = n
		}
	}

	dbs, err := h.Store.GetDatabasesList(ctx, minutes)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query databases")
		return
	}
	if dbs == nil {
		dbs = []model.DatabaseSummary{}
	}
	writeJSON(w, http.StatusOK, model.DatabasesListResponse{Items: dbs})
}

func (h *Handler) HandleDatabaseOverview(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	system := mux.Vars(r)["system"]
	if strings.TrimSpace(system) == "" {
		writeJSONError(w, http.StatusBadRequest, "system is required")
		return
	}

	minutes := 15
	if v := r.URL.Query().Get("minutes"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			minutes = n
		}
	}

	overview, err := h.Store.GetDatabaseOverview(ctx, system, minutes)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query database overview")
		return
	}
	if overview == nil {
		writeJSONError(w, http.StatusNotFound, fmt.Sprintf("database system %q not found", system))
		return
	}
	writeJSON(w, http.StatusOK, overview)
}

func (h *Handler) HandleDatabaseQueries(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	system := mux.Vars(r)["system"]
	if strings.TrimSpace(system) == "" {
		writeJSONError(w, http.StatusBadRequest, "system is required")
		return
	}

	minutes := 15
	limit := model.DefaultLimit
	offset := 0
	q := r.URL.Query()
	if v := q.Get("minutes"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			minutes = n
		}
	}
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := q.Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	ops, err := h.Store.GetDatabaseQueries(ctx, system, minutes, limit, offset)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to query database operations")
		return
	}
	if ops == nil {
		ops = []model.DatabaseOperation{}
	}
	writeJSON(w, http.StatusOK, model.DatabaseQueriesResponse{Items: ops, Limit: limit, Offset: offset})
}
