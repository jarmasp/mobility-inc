package store

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/jarmasp/mobility-inc/internal/transaction"
)

const (
	ConflictFieldCode           = "code"
	ConflictFieldIdempotencyKey = "idempotency_key"
)

type TransactionStore interface {
	Save(ctx context.Context, tx transaction.Transaction) error
	GetByID(ctx context.Context, id string) (transaction.Transaction, bool, error)
	GetByCode(ctx context.Context, code string) (transaction.Transaction, bool, error)
	GetByIdempotencyKey(ctx context.Context, key string) (transaction.Transaction, bool, error)
}

type ConflictError struct {
	Field string
	Value string
	Err   error
}

func (e *ConflictError) Error() string {
	return fmt.Sprintf("conflict on %s", e.Field)
}

func (e *ConflictError) Unwrap() error {
	return e.Err
}

func IsConflictOn(err error, field string) bool {
	var conflictErr *ConflictError
	if !errors.As(err, &conflictErr) {
		return false
	}
	return conflictErr.Field == field
}

type MemoryStore struct {
	mu                 sync.RWMutex
	byID               map[string]transaction.Transaction
	idByCode           map[string]string
	idByIdempotencyKey map[string]string
}

func New() *MemoryStore {
	return &MemoryStore{
		byID:               make(map[string]transaction.Transaction),
		idByCode:           make(map[string]string),
		idByIdempotencyKey: make(map[string]string),
	}
}

func (s *MemoryStore) Save(_ context.Context, tx transaction.Transaction) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.byID[tx.ID] = tx
	if tx.Code != nil {
		s.idByCode[*tx.Code] = tx.ID
	}
	if tx.IdempotencyKey != "" {
		s.idByIdempotencyKey[tx.IdempotencyKey] = tx.ID
	}
	return nil
}

func (s *MemoryStore) GetByID(_ context.Context, id string) (transaction.Transaction, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	tx, ok := s.byID[id]
	return tx, ok, nil
}

func (s *MemoryStore) GetByCode(_ context.Context, code string) (transaction.Transaction, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id, ok := s.idByCode[code]
	if !ok {
		return transaction.Transaction{}, false, nil
	}

	tx, found := s.byID[id]
	return tx, found, nil
}

func (s *MemoryStore) GetByIdempotencyKey(_ context.Context, key string) (transaction.Transaction, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id, ok := s.idByIdempotencyKey[key]
	if !ok {
		return transaction.Transaction{}, false, nil
	}

	tx, found := s.byID[id]
	return tx, found, nil
}
