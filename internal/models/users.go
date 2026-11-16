package models

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("models: invalid credentials")
	ErrDuplicateEmail     = errors.New("models: duplicate email")
	ErrDuplicateUsername  = errors.New("models: duplicate username")
)

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

type UserModel struct {
	DB *pgxpool.Pool
}

func (m *UserModel) Insert(ctx context.Context, username, email, password string) (User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return User{}, err
	}

	u := User{Username: username, Email: email}
	err = m.DB.QueryRow(ctx, `
		INSERT INTO users (username, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`,
		username, email, string(hash),
	).Scan(&u.ID, &u.CreatedAt)

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		switch pgErr.ConstraintName {
		case "users_email_key":
			return User{}, ErrDuplicateEmail
		case "users_username_key":
			return User{}, ErrDuplicateUsername
		}
	}
	return u, err
}

// Authenticate checks the email and password and returns the user.
func (m *UserModel) Authenticate(ctx context.Context, email, password string) (User, error) {
	var u User
	var hash string
	err := m.DB.QueryRow(ctx, `
		SELECT id, username, email, created_at, password_hash
		FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Username, &u.Email, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		// Compare against a dummy hash so the response time does not reveal
		// whether such an email exists.
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return User{}, ErrInvalidCredentials
	} else if err != nil {
		return User{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return User{}, ErrInvalidCredentials
	}
	return u, nil
}

var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password"), 12)

type SessionModel struct {
	DB *pgxpool.Pool
}

// Create creates a session and returns the token for the cookie.
func (m *SessionModel) Create(ctx context.Context, userID int64, ttl time.Duration) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	// Clean up expired sessions along the way.
	if _, err := m.DB.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= now()`); err != nil {
		return "", err
	}
	_, err := m.DB.Exec(ctx, `
		INSERT INTO sessions (token_hash, user_id, expires_at)
		VALUES ($1, $2, $3)`,
		hashToken(token), userID, time.Now().Add(ttl),
	)
	return token, err
}

// User returns the owner of a valid session.
func (m *SessionModel) User(ctx context.Context, token string) (User, error) {
	var u User
	err := m.DB.QueryRow(ctx, `
		SELECT u.id, u.username, u.email, u.created_at
		FROM sessions s
		JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = $1 AND s.expires_at > now()`, hashToken(token),
	).Scan(&u.ID, &u.Username, &u.Email, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNoRecord
	}
	return u, err
}

func (m *SessionModel) Delete(ctx context.Context, token string) error {
	_, err := m.DB.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, hashToken(token))
	return err
}

func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
