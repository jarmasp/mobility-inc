package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	paymentsv1 "github.com/jarmasp/mobility-inc/internal/gen/payments/v1"
	"github.com/jarmasp/mobility-inc/internal/grpcserver"
	"github.com/jarmasp/mobility-inc/internal/handlers"
	"github.com/jarmasp/mobility-inc/internal/pgstore"
	"github.com/jarmasp/mobility-inc/internal/store"
	"google.golang.org/grpc"
)

func main() {
	httpPort := "8081"
	grpcPort := "50051"

	var (
		storage   store.TransactionStore
		dbStorage *pgstore.Store
	)
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL != "" {
		pgStorage, err := pgstore.New(context.Background(), databaseURL)
		if err != nil {
			log.Fatalf("failed to initialize postgres store: %v", err)
		}
		dbStorage = pgStorage
		storage = pgStorage
		log.Printf("using postgres-backed transaction store")
	} else {
		storage = store.New()
		log.Printf("using in-memory transaction store")
	}
	if dbStorage != nil {
		defer dbStorage.Close()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handlers.Health)

	httpServer := &http.Server{
		Addr:    ":" + httpPort,
		Handler: mux,
	}
	grpcListener, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("failed to listen for grpc server: %v", err)
	}

	grpcServer := grpc.NewServer()
	paymentsv1.RegisterPaymentsServiceServer(grpcServer, grpcserver.NewPaymentsService(storage))

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		log.Printf("grpc server listening on %s", grpcPort)
		if serveErr := grpcServer.Serve(grpcListener); serveErr != nil {
			log.Printf("grpc server failed: %v", serveErr)
		}
	}()

	go func() {
		defer wg.Done()
		log.Printf("http health server listening on %s", httpPort)
		if serveErr := httpServer.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Printf("http server failed: %v", serveErr)
		}
	}()

	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		grpcServer.GracefulStop()
		if shutdownErr := httpServer.Shutdown(ctx); shutdownErr != nil {
			log.Printf("http shutdown error: %v", shutdownErr)
		}
	}()

	wg.Wait()
}
