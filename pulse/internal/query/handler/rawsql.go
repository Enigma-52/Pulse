package handler

import (
	"encoding/json"
	"net/http"
)

func (h *Handler) HandleRawSQL(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	result, err := h.Store.RunReadOnlySQL(r.Context(), body.Query)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"columns":   result.Columns,
		"rows":      result.Rows,
		"row_count": len(result.Rows),
	})
}
