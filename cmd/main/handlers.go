package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/n3cr0l0rd/snippetbox/internal/models"
)

var expirations = map[string]time.Duration{
	"never": 0,
	"10m":   10 * time.Minute,
	"1h":    time.Hour,
	"1d":    24 * time.Hour,
	"1w":    7 * 24 * time.Hour,
}

var languages = map[string]bool{
	"text": true, "c": true, "cpp": true, "go": true,
	"python": true, "js": true, "rust": true, "sh": true,
}

var visibilities = map[string]bool{"public": true, "unlisted": true, "private": true}

func (app *application) routes() http.Handler {
	mux := http.NewServeMux()

	// JSON API
	mux.HandleFunc("GET /api/snippets", app.snippetLatest)
	mux.HandleFunc("GET /api/snippets/{id}", app.snippetGet)
	mux.HandleFunc("POST /api/snippets", app.snippetCreate)

	// SPA (при локальном запуске без nginx)
	assetServer := http.FileServer(http.Dir("./ui/dist/assets"))
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", assetServer))
	for _, path := range []string{"/{$}", "/view", "/login", "/signup", "/about"} {
		mux.HandleFunc("GET "+path, renderApp)
	}
	mux.HandleFunc("POST /login", redirectHome)
	mux.HandleFunc("POST /signup", redirectHome)

	return mux
}

func renderApp(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./ui/dist/index.html")
}

func redirectHome(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (app *application) snippetLatest(w http.ResponseWriter, r *http.Request) {
	snippets, err := app.snippets.Latest(r.Context(), 10)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snippets)
}

func (app *application) snippetGet(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		writeError(w, http.StatusBadRequest, "bad snippet id")
		return
	}

	snippet, err := app.snippets.Get(r.Context(), id)
	if errors.Is(err, models.ErrNoRecord) {
		writeError(w, http.StatusNotFound, "snippet not found")
		return
	} else if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, snippet)
}

type createSnippetRequest struct {
	Title      string `json:"title"`
	Content    string `json:"content"`
	Language   string `json:"language"`
	Visibility string `json:"visibility"`
	Expires    string `json:"expires"`
}

func (app *application) snippetCreate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req createSnippetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		req.Title = "Untitled"
	}
	expiresIn, okExpires := expirations[req.Expires]
	switch {
	case strings.TrimSpace(req.Content) == "":
		writeError(w, http.StatusUnprocessableEntity, "content must not be empty")
		return
	case utf8.RuneCountInString(req.Title) > 100:
		writeError(w, http.StatusUnprocessableEntity, "title is longer than 100 characters")
		return
	case !languages[req.Language]:
		writeError(w, http.StatusUnprocessableEntity, "unknown language")
		return
	case !visibilities[req.Visibility]:
		writeError(w, http.StatusUnprocessableEntity, "unknown visibility")
		return
	case !okExpires:
		writeError(w, http.StatusUnprocessableEntity, "unknown expiration")
		return
	}

	id, err := app.snippets.Insert(r.Context(), req.Title, req.Content, req.Language, req.Visibility, expiresIn)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("Error encoding JSON: %s", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("Internal error: %s", err)
	writeError(w, http.StatusInternalServerError, "internal server error")
}
