package main

import (
	"net/http"
	"strconv"
)

func renderApp(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./ui/dist/index.html")
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
	renderApp(w, r)
}

func snippetHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	renderApp(w, r)
}

func userLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	renderApp(w, r)
}

func userSignup(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	renderApp(w, r)
}

func aboutPage(w http.ResponseWriter, r *http.Request) {
	renderApp(w, r)
}
