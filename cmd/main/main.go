package main

import (
	"context"
	"flag"
	"log"
	"net/http"

	"golang.org/x/sync/errgroup"
)

func main() {
	wg, _ := errgroup.WithContext(context.Background())
	addr := flag.String("addr", ":1223", "HTTP server address")
	assetServer := http.FileServer(http.Dir("./ui/dist/assets"))

	flag.Parse()

	mux := http.NewServeMux()
	mux.Handle("/assets/", http.StripPrefix("/assets/", assetServer))
	mux.HandleFunc("/", snippetHome)
	mux.HandleFunc("/create", snippetCreate)
	mux.HandleFunc("/view", snippetView)
	mux.HandleFunc("/login", userLogin)
	mux.HandleFunc("/signup", userSignup)
	mux.HandleFunc("/about", aboutPage)

	wg.Go(func() error {
		if err := http.ListenAndServe(*addr, mux); err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	})

	log.Printf("Starting a HTTP server at 127.0.0.1%s", *addr)
	if err := wg.Wait(); err != nil {
		log.Printf("Error running a HTTP server:%s", err)
	}
}
