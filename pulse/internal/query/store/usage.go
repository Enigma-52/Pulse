package store

import (
	"context"
	"time"
)

type TableUsage struct {
	Table  string    `json:"table"`
	Rows   uint64    `json:"rows"`
	Bytes  uint64    `json:"bytes"`
	Oldest time.Time `json:"oldest"`
	Newest time.Time `json:"newest"`
}

// GetUsage reports on-disk size per signal table from system.parts.
func (s *Store) GetUsage(ctx context.Context) ([]TableUsage, error) {
	rows, err := s.conn.Query(ctx, `
SELECT table,
       sum(rows) AS row_count,
       sum(bytes_on_disk) AS bytes,
       min(min_time) AS oldest,
       max(max_time) AS newest
FROM system.parts
WHERE database = currentDatabase()
  AND active
  AND table IN ('traces', 'logs', 'metrics', 'exceptions')
GROUP BY table
ORDER BY table
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var usage []TableUsage
	for rows.Next() {
		var u TableUsage
		if err := rows.Scan(&u.Table, &u.Rows, &u.Bytes, &u.Oldest, &u.Newest); err != nil {
			return nil, err
		}
		usage = append(usage, u)
	}
	return usage, nil
}
