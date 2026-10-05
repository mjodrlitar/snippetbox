package main

import (
	"html/template"
	"log/slog"
	"net/http"
	"strconv"
)

func renderTemplate(w http.ResponseWriter, page string) {
	files := []string{
		"./ui/html/base.html",
		"./ui/html/pages/" + page,
	}

	ts, err := template.ParseFiles(files...)
	if err != nil {
		slog.Error(err.Error())
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	err = ts.ExecuteTemplate(w, "base", nil)
	if err != nil {
		slog.Error(err.Error())
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

func snippetCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	http.Redirect(w, r, "/view?id=1", http.StatusSeeOther)
}

func snippetView(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.URL.Query().Get("id"))
	if err != nil || id < 1 {
		http.Error(w, "Bad snippet id value: null or less", http.StatusBadRequest)
		return
	}
	renderTemplate(w, "view.html")
}

func snippetHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	renderTemplate(w, "home.html")
}

func userLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	renderTemplate(w, "login.html")
}

func userSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	renderTemplate(w, "signup.html")
}

func aboutPage(w http.ResponseWriter, r *http.Request) {
	renderTemplate(w, "about.html")
}
