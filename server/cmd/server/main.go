package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/guts-yang/hello-gutsyang/server/internal/auth"
	"github.com/guts-yang/hello-gutsyang/server/internal/config"
	"github.com/guts-yang/hello-gutsyang/server/internal/platform/db"
	"github.com/guts-yang/hello-gutsyang/server/internal/server"
	"github.com/guts-yang/hello-gutsyang/server/migrations"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "hash":
			runHash(os.Args[2:])
			return
		case "migrate":
			runMigrate(os.Args[2:])
			return
		case "help", "-h", "--help":
			fmt.Println(`usage:
  server                 start HTTP API
  server hash <password> print bcrypt hash
  server migrate up|status`)
			return
		}
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := server.Run(ctx, cfg); err != nil {
		log.Fatal(err)
	}
}

func runHash(args []string) {
	if len(args) != 1 {
		fmt.Fprintln(os.Stderr, "usage: server hash <password>")
		os.Exit(2)
	}
	hash, err := auth.HashPassword(args[0])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(hash)
}

func runMigrate(args []string) {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if cfg.DatabaseDSN == "" {
		fmt.Fprintln(os.Stderr, "migrate: DATABASE_URL is required")
		os.Exit(2)
	}
	sub := "up"
	if len(args) > 0 {
		sub = args[0]
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	sqlDB, err := db.Open(ctx, cfg.DatabaseDSN)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer sqlDB.Close()

	switch sub {
	case "up":
		ran, err := db.Up(ctx, sqlDB, migrations.FS)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		if len(ran) == 0 {
			fmt.Println("migrate up: nothing to do")
			return
		}
		for _, m := range ran {
			fmt.Printf("applied %03d_%s\n", m.Version, m.Name)
		}
	case "status":
		entries, err := db.Status(ctx, sqlDB, migrations.FS)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		for _, e := range entries {
			state := "pending"
			if e.Applied {
				state = "applied " + e.At.Format(time.RFC3339)
			}
			fmt.Printf("%03d_%s  %s\n", e.Version, e.Name, state)
		}
	default:
		fmt.Fprintln(os.Stderr, "usage: server migrate up|status")
		os.Exit(2)
	}
}
