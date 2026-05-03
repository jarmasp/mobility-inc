package pgstore

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
)

func TestPostgresStoreSaveAndLookups(t *testing.T) {
	s := newIntegrationStore(t)
	codeValue := "ABCD1234"
	receiver := "22222222-2222-4222-8222-222222222222"
	tx := transaction.Transaction{
		ID:             "11111111-1111-4111-8111-111111111111",
		Type:           transaction.TypeTransfer,
		Status:         transaction.StatusCompleted,
		Code:           &codeValue,
		SenderID:       "33333333-3333-4333-8333-333333333333",
		ReceiverID:     &receiver,
		Amount:         12.5,
		CreatedAt:      time.Now().UTC().Truncate(time.Microsecond),
		IdempotencyKey: "idem-save-and-lookup",
	}

	if err := s.Save(context.Background(), tx); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	if got, ok, err := s.GetByID(context.Background(), tx.ID); err != nil {
		t.Fatalf("GetByID() error = %v", err)
	} else if !ok || got.ID != tx.ID {
		t.Fatalf("GetByID() = (%+v, %v), want id %q", got, ok, tx.ID)
	}

	if got, ok, err := s.GetByCode(context.Background(), codeValue); err != nil {
		t.Fatalf("GetByCode() error = %v", err)
	} else if !ok || got.ID != tx.ID {
		t.Fatalf("GetByCode() = (%+v, %v), want id %q", got, ok, tx.ID)
	}

	if got, ok, err := s.GetByIdempotencyKey(context.Background(), tx.IdempotencyKey); err != nil {
		t.Fatalf("GetByIdempotencyKey() error = %v", err)
	} else if !ok || got.ID != tx.ID {
		t.Fatalf("GetByIdempotencyKey() = (%+v, %v), want id %q", got, ok, tx.ID)
	}
}

func TestPostgresStoreIdempotencyConflict(t *testing.T) {
	s := newIntegrationStore(t)
	first := transaction.Transaction{
		ID:             "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		Type:           transaction.TypeDeposit,
		Status:         transaction.StatusCompleted,
		SenderID:       "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		Amount:         20,
		CreatedAt:      time.Now().UTC(),
		IdempotencyKey: "idem-conflict",
	}
	second := transaction.Transaction{
		ID:             "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
		Type:           transaction.TypeDeposit,
		Status:         transaction.StatusCompleted,
		SenderID:       "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
		Amount:         99,
		CreatedAt:      time.Now().UTC(),
		IdempotencyKey: first.IdempotencyKey,
	}

	if err := s.Save(context.Background(), first); err != nil {
		t.Fatalf("Save(first) error = %v", err)
	}
	err := s.Save(context.Background(), second)
	if err == nil {
		t.Fatalf("Save(second) expected conflict error, got nil")
	}
	if !store.IsConflictOn(err, store.ConflictFieldIdempotencyKey) {
		t.Fatalf("Save(second) expected idempotency conflict, got %v", err)
	}
}

func newIntegrationStore(t *testing.T) *Store {
	t.Helper()

	databaseURL := os.Getenv("PAYMENTS_TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = os.Getenv("DATABASE_URL")
	}
	if databaseURL == "" {
		t.Skip("set PAYMENTS_TEST_DATABASE_URL or DATABASE_URL to run pgstore integration tests")
	}

	s, err := New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	t.Cleanup(s.Close)

	if _, err := s.pool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS transactions (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			status TEXT NOT NULL,
			code TEXT NULL,
			sender_id TEXT NOT NULL,
			receiver_id TEXT NULL,
			amount DOUBLE PRECISION NOT NULL,
			created_at TIMESTAMPTZ NOT NULL,
			idempotency_key TEXT NULL
		)`); err != nil {
		t.Fatalf("create table error: %v", err)
	}
	if _, err := s.pool.Exec(context.Background(), `
		CREATE UNIQUE INDEX IF NOT EXISTS transactions_code_uq
			ON transactions (code) WHERE code IS NOT NULL`); err != nil {
		t.Fatalf("create code index error: %v", err)
	}
	if _, err := s.pool.Exec(context.Background(), `
		CREATE UNIQUE INDEX IF NOT EXISTS transactions_idempotency_key_uq
			ON transactions (idempotency_key) WHERE idempotency_key IS NOT NULL`); err != nil {
		t.Fatalf("create idempotency index error: %v", err)
	}
	if _, err := s.pool.Exec(context.Background(), "TRUNCATE TABLE transactions"); err != nil {
		t.Fatalf("truncate error: %v", err)
	}

	return s
}
