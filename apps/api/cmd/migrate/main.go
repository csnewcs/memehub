package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/noeulnight/memehub/apps/api/internal/config"
	"github.com/noeulnight/memehub/apps/api/internal/database"
)

func main() {
	envFile := flag.String("env-file", ".env", "Environment file path")
	flag.Parse()
	if err := godotenv.Load(*envFile); err != nil && !os.IsNotExist(err) {
		slog.Error("cannot read environment file")
		os.Exit(1)
	}
	dsn := os.Getenv("DATABASE_URL")
	if os.Getenv("DEMO_MODE") != "" && os.Getenv("DEMO_MODE") != "false" {
		cfg, err := config.Parse(os.Getenv)
		if err != nil {
			slog.Error(err.Error())
			os.Exit(1)
		}
		dsn = cfg.DatabaseURL
	}
	if dsn == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if err := database.Migrate(ctx, dsn); err != nil {
		slog.Error("database migration failed")
		os.Exit(1)
	}
	slog.Info("database migrations completed")
}
