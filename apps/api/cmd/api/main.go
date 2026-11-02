package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/noeulnight/memehub/apps/api/internal/config"
	"github.com/noeulnight/memehub/apps/api/internal/server"
)

func main() {
	envFile := flag.String("env-file", ".env", "Environment file path")
	flag.Parse()
	cfg, err := config.Load(*envFile)
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	startup, stop := context.WithTimeout(ctx, 15*time.Second)
	defer stop()
	pool, err := pgxpool.New(startup, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database configuration failed")
		os.Exit(1)
	}
	defer pool.Close()
	if err = pool.Ping(startup); err != nil {
		slog.Error("database connection failed")
		os.Exit(1)
	}
	app, err := server.New(startup, cfg, pool)
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}
	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: app.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 25 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: time.Minute, MaxHeaderBytes: 16384}
	done := make(chan error, 1)
	go func() { slog.Info("API listening", "address", cfg.HTTPAddr); done <- srv.ListenAndServe() }()
	select {
	case err = <-done:
		if err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server failed")
			os.Exit(1)
		}
	case <-ctx.Done():
		shutdown, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		if err = srv.Shutdown(shutdown); err != nil {
			_ = srv.Close()
			slog.Error("HTTP shutdown failed")
		}
	}
}
