package models

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNoRecord = errors.New("models: no matching record found")

type Snippet struct {
	ID         int64      `json:"id"`
	Title      string     `json:"title"`
	Content    string     `json:"content"`
	Language   string     `json:"language"`
	Visibility string     `json:"visibility"`
	Author     *string    `json:"author"` // nil = guest
	CreatedAt  time.Time  `json:"createdAt"`
	ExpiresAt  *time.Time `json:"expiresAt"` // nil = never
}

type SnippetModel struct {
	DB *pgxpool.Pool
}

const notExpired = `(s.expires_at IS NULL OR s.expires_at > now())`

// Insert creates a snippet and returns its id.
// userID == nil means a guest snippet; expiresIn == 0 means "never expires".
func (m *SnippetModel) Insert(ctx context.Context, userID *int64, title, content, language, visibility string, expiresIn time.Duration) (int64, error) {
	var expiresAt *time.Time
	if expiresIn > 0 {
		t := time.Now().Add(expiresIn)
		expiresAt = &t
	}

	var id int64
	err := m.DB.QueryRow(ctx, `
		INSERT INTO snippets (title, content, language, visibility, expires_at, user_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`,
		title, content, language, visibility, expiresAt, userID,
	).Scan(&id)
	return id, err
}

// Get returns a non-expired snippet by id. A private snippet is returned only
// to its owner (viewerID == nil means guest).
func (m *SnippetModel) Get(ctx context.Context, id int64, viewerID *int64) (Snippet, error) {
	rows, err := m.DB.Query(ctx, `
		SELECT s.id, s.title, s.content, s.language, s.visibility::text,
		       u.username, s.created_at, s.expires_at
		FROM snippets s
		LEFT JOIN users u ON u.id = s.user_id
		WHERE s.id = $1
		  AND (s.visibility <> 'private' OR s.user_id = $2)
		  AND `+notExpired, id, viewerID)
	if err != nil {
		return Snippet{}, err
	}
	s, err := pgx.CollectExactlyOneRow(rows, scanSnippet)
	if errors.Is(err, pgx.ErrNoRows) {
		return Snippet{}, ErrNoRecord
	}
	return s, err
}

// Latest returns the most recent public non-expired snippets.
func (m *SnippetModel) Latest(ctx context.Context, limit int) ([]Snippet, error) {
	rows, err := m.DB.Query(ctx, `
		SELECT s.id, s.title, s.content, s.language, s.visibility::text,
		       u.username, s.created_at, s.expires_at
		FROM snippets s
		LEFT JOIN users u ON u.id = s.user_id
		WHERE s.visibility = 'public' AND `+notExpired+`
		ORDER BY s.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanSnippet)
}

// ByUser returns all of the user's non-expired snippets of any visibility.
func (m *SnippetModel) ByUser(ctx context.Context, userID int64, limit int) ([]Snippet, error) {
	rows, err := m.DB.Query(ctx, `
		SELECT s.id, s.title, s.content, s.language, s.visibility::text,
		       u.username, s.created_at, s.expires_at
		FROM snippets s
		JOIN users u ON u.id = s.user_id
		WHERE s.user_id = $1 AND `+notExpired+`
		ORDER BY s.created_at DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, scanSnippet)
}

func scanSnippet(row pgx.CollectableRow) (Snippet, error) {
	var s Snippet
	err := row.Scan(&s.ID, &s.Title, &s.Content, &s.Language, &s.Visibility,
		&s.Author, &s.CreatedAt, &s.ExpiresAt)
	return s, err
}
