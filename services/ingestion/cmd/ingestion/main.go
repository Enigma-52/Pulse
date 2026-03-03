package main

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pulse-observability/pulse/services/ingestion/internal/ingestion"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/v1/ingest", ingestion.HandleIngest).Methods(http.MethodPost)

	addr := ":8081"
	log.Printf("Pulse ingestion server listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

