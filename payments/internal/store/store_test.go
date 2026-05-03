package store

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/jarmasp/mobility-inc/internal/transaction"
)

func TestStoreSaveAndLookup(t *testing.T) {
	t.Parallel()

	s := New()
	codeValue := "ABCD1234"
	receiver := "22222222-2222-4222-8222-222222222222"
	tx := transaction.Transaction{
		ID:             "11111111-1111-4111-8111-111111111111",
		Type:           transaction.TypeTransfer,
		Status:         transaction.StatusCompleted,
		Code:           &codeValue,
		SenderID:       "11111111-1111-4111-8111-111111111111",
		ReceiverID:     &receiver,
		Amount:         10,
		CreatedAt:      time.Now().UTC(),
		IdempotencyKey: "idem-1",
	}

	if err := s.Save(context.Background(), tx); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	gotByID, ok, err := s.GetByID(context.Background(), tx.ID)
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if !ok || gotByID.ID != tx.ID {
		t.Fatalf("GetByID failed: got %#v, ok=%v", gotByID, ok)
	}

	gotByCode, ok, err := s.GetByCode(context.Background(), codeValue)
	if err != nil {
		t.Fatalf("GetByCode returned error: %v", err)
	}
	if !ok || gotByCode.ID != tx.ID {
		t.Fatalf("GetByCode failed: got %#v, ok=%v", gotByCode, ok)
	}

	gotByIdempotencyKey, ok, err := s.GetByIdempotencyKey(context.Background(), "idem-1")
	if err != nil {
		t.Fatalf("GetByIdempotencyKey returned error: %v", err)
	}
	if !ok || gotByIdempotencyKey.ID != tx.ID {
		t.Fatalf("GetByIdempotencyKey failed: got %#v, ok=%v", gotByIdempotencyKey, ok)
	}
}

func TestStoreParallelWrites(t *testing.T) {
	t.Parallel()

	s := New()
	const total = 500

	var wg sync.WaitGroup
	wg.Add(total)
	for i := range total {
		i := i
		go func() {
			defer wg.Done()
			id := fmt.Sprintf("00000000-0000-4000-8000-%012d", i)
			tx := transaction.Transaction{
				ID:        id,
				Type:      transaction.TypeDeposit,
				Status:    transaction.StatusCompleted,
				SenderID:  id,
				Amount:    float64(i + 1),
				CreatedAt: time.Now().UTC(),
			}
			if err := s.Save(context.Background(), tx); err != nil {
				t.Errorf("Save failed: %v", err)
			}
		}()
	}
	wg.Wait()

	for i := range total {
		id := fmt.Sprintf("00000000-0000-4000-8000-%012d", i)
		if _, ok, err := s.GetByID(context.Background(), id); err != nil {
			t.Fatalf("GetByID returned error: %v", err)
		} else if !ok {
			t.Fatalf("transaction %s not found after concurrent saves", id)
		}
	}
}
