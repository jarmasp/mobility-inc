package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jarmasp/mobility-inc/internal/handlers"
	"github.com/jarmasp/mobility-inc/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	storage := store.New()
	txHandler := handlers.NewTransactionsHandler(storage)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /transactions", txHandler.CreateTransaction)
	mux.HandleFunc("GET /transactions/code/{code}", txHandler.GetTransactionByCode)
	mux.HandleFunc("GET /health", handlers.Health)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("server shutdown error: %v", err)
		}
	}()

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}
