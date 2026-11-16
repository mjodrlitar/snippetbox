package main

import (
	"context"
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/n3cr0l0rd/snippetbox/internal/models"
)

const (
	sessionCookie = "session"
	sessionTTL    = 7 * 24 * time.Hour
)

type contextKey string

const userContextKey = contextKey("user")

var usernameRE = regexp.MustCompile(`^[A-Za-z0-9_.-]{3,50}$`)

// authenticate puts the current user into the request context if they
// have a valid session.
func (app *application) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookie)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		user, err := app.sessions.User(r.Context(), cookie.Value)
		if errors.Is(err, models.ErrNoRecord) {
			clearSessionCookie(w)
			next.ServeHTTP(w, r)
			return
		} else if err != nil {
			serverError(w, err)
			return
		}
		ctx := context.WithValue(r.Context(), userContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// requireJSON is CSRF protection: a plain HTML form on another site cannot
// send a request with Content-Type: application/json without a CORS preflight.
func requireJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
			if mt != "application/json" {
				writeError(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func currentUser(r *http.Request) *models.User {
	user, _ := r.Context().Value(userContextKey).(*models.User)
	return user
}

func currentUserID(r *http.Request) *int64 {
	if u := currentUser(r); u != nil {
		return &u.ID
	}
	return nil
}

type signupRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (app *application) signup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	switch {
	case !usernameRE.MatchString(req.Username):
		writeError(w, http.StatusUnprocessableEntity, "username must be 3-50 characters: letters, digits, _ . -")
		return
	case !validEmail(req.Email):
		writeError(w, http.StatusUnprocessableEntity, "invalid e-mail address")
		return
	case utf8.RuneCountInString(req.Password) < 8:
		writeError(w, http.StatusUnprocessableEntity, "password must be at least 8 characters")
		return
	case len(req.Password) > 72: // bcrypt limit
		writeError(w, http.StatusUnprocessableEntity, "password must be at most 72 bytes")
		return
	}

	user, err := app.users.Insert(r.Context(), req.Username, req.Email, req.Password)
	switch {
	case errors.Is(err, models.ErrDuplicateEmail):
		writeError(w, http.StatusConflict, "e-mail is already registered")
		return
	case errors.Is(err, models.ErrDuplicateUsername):
		writeError(w, http.StatusConflict, "username is already taken")
		return
	case err != nil:
		serverError(w, err)
		return
	}

	app.startSession(w, r, user, http.StatusCreated)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (app *application) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := app.users.Authenticate(r.Context(), email, req.Password)
	if errors.Is(err, models.ErrInvalidCredentials) {
		writeError(w, http.StatusUnauthorized, "invalid e-mail or password")
		return
	} else if err != nil {
		serverError(w, err)
		return
	}

	app.startSession(w, r, user, http.StatusOK)
}

func (app *application) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		if err := app.sessions.Delete(r.Context(), cookie.Value); err != nil {
			serverError(w, err)
			return
		}
	}
	clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (app *application) me(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	if user == nil {
		writeError(w, http.StatusUnauthorized, "not logged in")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (app *application) startSession(w http.ResponseWriter, r *http.Request, user models.User, status int) {
	// Delete the old session (if any) to prevent session fixation.
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		_ = app.sessions.Delete(r.Context(), cookie.Value)
	}

	token, err := app.sessions.Create(r.Context(), user.ID, sessionTTL)
	if err != nil {
		serverError(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, status, user)
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func validEmail(s string) bool {
	if len(s) > 255 {
		return false
	}
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Address == s && strings.Contains(s, "@")
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}
