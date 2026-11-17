package models

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Language is an editor language; the list is managed in the CMS.
type Language struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type LanguageModel struct {
	DB *pgxpool.Pool
}

// All returns all languages ordered by name.
func (m *LanguageModel) All(ctx context.Context) ([]Language, error) {
	rows, err := m.DB.Query(ctx, `SELECT code, name FROM languages ORDER BY name`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowToStructByPos[Language])
}
