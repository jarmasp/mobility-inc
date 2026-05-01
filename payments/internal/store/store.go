package store

import (
	"sync"

	"github.com/jarmasp/mobility-inc/internal/transaction"
)

type Store struct {
	mu                 sync.RWMutex
	byID               map[string]transaction.Transaction
	idByCode           map[string]string
	idByIdempotencyKey map[string]string
}

func New() *Store {
	return &Store{
		byID:               make(map[string]transaction.Transaction),
		idByCode:           make(map[string]string),
		idByIdempotencyKey: make(map[string]string),
	}
}

func (s *Store) Save(tx transaction.Transaction) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.byID[tx.ID] = tx
	if tx.Code != nil {
		s.idByCode[*tx.Code] = tx.ID
	}
	if tx.IdempotencyKey != "" {
		s.idByIdempotencyKey[tx.IdempotencyKey] = tx.ID
	}
}

func (s *Store) GetByID(id string) (transaction.Transaction, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	tx, ok := s.byID[id]
	return tx, ok
}

func (s *Store) GetByCode(code string) (transaction.Transaction, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id, ok := s.idByCode[code]
	if !ok {
		return transaction.Transaction{}, false
	}

	tx, found := s.byID[id]
	return tx, found
}

func (s *Store) GetByIdempotencyKey(key string) (transaction.Transaction, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id, ok := s.idByIdempotencyKey[key]
	if !ok {
		return transaction.Transaction{}, false
	}

	tx, found := s.byID[id]
	return tx, found
}
