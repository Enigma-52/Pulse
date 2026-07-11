package store

import (
	"context"
	"errors"
	"reflect"
	"regexp"
	"strings"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
)

type RawQueryResult struct {
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"`
}

var (
	lineComments  = regexp.MustCompile(`--[^\n]*`)
	blockComments = regexp.MustCompile(`(?s)/\*.*?\*/`)
)

// ValidateReadOnlySQL rejects anything that is not a single SELECT/WITH
// statement. Execution additionally runs with readonly=1 so ClickHouse
// itself refuses writes and DDL — this check just gives friendlier errors.
func ValidateReadOnlySQL(query string) error {
	stripped := blockComments.ReplaceAllString(query, " ")
	stripped = lineComments.ReplaceAllString(stripped, " ")
	stripped = strings.TrimSpace(stripped)
	if stripped == "" {
		return errors.New("query is empty")
	}
	if semi := strings.Index(stripped, ";"); semi != -1 && strings.TrimSpace(stripped[semi+1:]) != "" {
		return errors.New("only a single statement is allowed")
	}
	upper := strings.ToUpper(stripped)
	if !strings.HasPrefix(upper, "SELECT") && !strings.HasPrefix(upper, "WITH") {
		return errors.New("only SELECT queries are allowed")
	}
	if strings.Contains(upper, "INTO OUTFILE") {
		return errors.New("INTO OUTFILE is not allowed")
	}
	return nil
}

// RunReadOnlySQL executes a validated query with ClickHouse-side guards:
// readonly mode, row cap, and a 10s execution timeout.
func (s *Store) RunReadOnlySQL(ctx context.Context, query string) (*RawQueryResult, error) {
	if err := ValidateReadOnlySQL(query); err != nil {
		return nil, err
	}

	ctx = clickhouse.Context(ctx, clickhouse.WithSettings(clickhouse.Settings{
		"readonly":              1,
		"max_result_rows":       1000,
		"result_overflow_mode":  "break",
		"max_execution_time":    10,
		"timeout_overflow_mode": "break",
	}))

	rows, err := s.conn.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := rows.Columns()
	types := rows.ColumnTypes()
	result := &RawQueryResult{Columns: columns, Rows: [][]any{}}

	for rows.Next() {
		values := make([]any, len(columns))
		for i, t := range types {
			values[i] = reflect.New(t.ScanType()).Interface()
		}
		if err := rows.Scan(values...); err != nil {
			return nil, err
		}
		row := make([]any, len(values))
		for i, v := range values {
			row[i] = reflect.ValueOf(v).Elem().Interface()
		}
		result.Rows = append(result.Rows, row)
		if len(result.Rows) >= 1000 {
			break
		}
	}
	return result, nil
}
