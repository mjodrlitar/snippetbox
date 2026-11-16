package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/n3cr0l0rd/snippetbox/internal/models"
)

type application struct {
	snippets *models.SnippetModel
}

func main() {
	addr := flag.String("addr", ":1223", "HTTP server address")
	dsn := flag.String("dsn", os.Getenv("DATABASE_URL"), "PostgreSQL connection string")
	flag.Parse()

	if *dsn == "" {
		*dsn = "postgres://snippetbox:snippetbox@localhost:5432/snippetbox?sslmode=disable"
	}

	db, err := openDB(*dsn)
	if err != nil {
		log.Fatalf("Cannot connect to database: %s", err)
	}
	defer db.Close()

	app := &application{snippets: &models.SnippetModel{DB: db}}

	log.Printf("Starting a HTTP server at 127.0.0.1%s", *addr)
	if err := http.ListenAndServe(*addr, app.routes()); err != nil {
		log.Fatalf("Error running a HTTP server: %s", err)
	}
}

// openDB создаёт пул соединений и ждёт, пока база станет доступна
// (в docker compose postgres может подниматься дольше бэкенда).
func openDB(dsn string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		return nil, err
	}
	for attempt := 1; ; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		err = pool.Ping(ctx)
		cancel()
		if err == nil {
			return pool, nil
		}
		if attempt == 15 {
			pool.Close()
			return nil, err
		}
		log.Printf("Waiting for database (%d): %s", attempt, err)
		time.Sleep(time.Second)
	}
}
