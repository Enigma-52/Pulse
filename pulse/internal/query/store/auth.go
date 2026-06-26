package store

import (
	"context"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

func (s *Store) EnsureUsersTable(ctx context.Context) error {
	return s.conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS pulse_users (
			id          String DEFAULT generateUUIDv4(),
			email       String,
			password_hash String,
			created_at  DateTime DEFAULT now()
		) ENGINE = MergeTree()
		ORDER BY id
	`)
}

func (s *Store) HasAnyUser(ctx context.Context) (bool, error) {
	row := s.conn.QueryRow(ctx, `SELECT count() FROM pulse_users`)
	var count uint64
	if err := row.Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Store) CreateUser(ctx context.Context, email, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.conn.Exec(ctx, `
		INSERT INTO pulse_users (id, email, password_hash, created_at)
		VALUES (generateUUIDv4(), ?, ?, now())
	`, email, string(hash))
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	row := s.conn.QueryRow(ctx, `
		SELECT id, email, password_hash, created_at
		FROM pulse_users WHERE email = ? LIMIT 1
	`, email)
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}
