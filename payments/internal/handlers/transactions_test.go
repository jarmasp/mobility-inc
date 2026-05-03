package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sync"
	"testing"
	"time"

	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
)

func setupMux() *http.ServeMux {
	s := store.New()
	h := NewTransactionsHandler(s)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /transactions", h.CreateTransaction)
	mux.HandleFunc("GET /transactions/code/{code}", h.GetTransactionByCode)
	return mux
}

func TestCreateTransactionTransferSuccessAndFindByCode(t *testing.T) {
	t.Parallel()
	mux := setupMux()

	payload := `{"type":"TRANSFER","senderId":"11111111-1111-4111-8111-111111111111","receiverId":"22222222-2222-4222-8222-222222222222","amount":12.5}`
	req := httptest.NewRequest(http.MethodPost, "/transactions", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("unexpected create status: got %d want %d", rec.Code, http.StatusCreated)
	}

	var created map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to decode create response: %v", err)
	}

	codeValue, ok := created["code"].(string)
	if !ok || !regexp.MustCompile(`^[A-Z0-9]{8}$`).MatchString(codeValue) {
		t.Fatalf("unexpected transfer code: %#v", created["code"])
	}

	getReq := httptest.NewRequest(http.MethodGet, "/transactions/code/"+codeValue, nil)
	getRec := httptest.NewRecorder()
	mux.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("unexpected get status: got %d want %d", getRec.Code, http.StatusOK)
	}

	if getRec.Body.String() != rec.Body.String() {
		t.Fatalf("fetched transaction differs from created one")
	}
}

func TestCreateTransactionValidationErrors(t *testing.T) {
	t.Parallel()
	mux := setupMux()

	tests := []struct {
		name       string
		payload    string
		wantStatus int
		wantErr    string
	}{
		{
			name:       "invalid type returns 400",
			payload:    `{"type":"INVALID","senderId":"11111111-1111-4111-8111-111111111111","amount":10}`,
			wantStatus: http.StatusBadRequest,
			wantErr:    "Invalid transaction type",
		},
		{
			name:       "self transfer returns 422",
			payload:    `{"type":"TRANSFER","senderId":"11111111-1111-4111-8111-111111111111","receiverId":"11111111-1111-4111-8111-111111111111","amount":10}`,
			wantStatus: http.StatusUnprocessableEntity,
			wantErr:    "Self-transfer not allowed",
		},
		{
			name:       "deposit with receiver returns 400",
			payload:    `{"type":"DEPOSIT","senderId":"11111111-1111-4111-8111-111111111111","receiverId":"22222222-2222-4222-8222-222222222222","amount":10}`,
			wantStatus: http.StatusBadRequest,
			wantErr:    "receiverId must be null for deposit and withdrawal",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(http.MethodPost, "/transactions", bytes.NewBufferString(tc.payload))
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("unexpected status: got %d want %d", rec.Code, tc.wantStatus)
			}

			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("failed to decode error response: %v", err)
			}
			if body["error"] != tc.wantErr {
				t.Fatalf("unexpected error body: got %q want %q", body["error"], tc.wantErr)
			}
		})
	}
}

func TestIdempotencyReplayReturnsIdenticalResponse(t *testing.T) {
	t.Parallel()
	mux := setupMux()
	header := "idem-key-1"

	firstPayload := `{"type":"TRANSFER","senderId":"11111111-1111-4111-8111-111111111111","receiverId":"22222222-2222-4222-8222-222222222222","amount":20}`
	firstReq := httptest.NewRequest(http.MethodPost, "/transactions", bytes.NewBufferString(firstPayload))
	firstReq.Header.Set("Idempotency-Key", header)
	firstRec := httptest.NewRecorder()
	mux.ServeHTTP(firstRec, firstReq)

	if firstRec.Code != http.StatusCreated {
		t.Fatalf("unexpected first status: got %d want %d", firstRec.Code, http.StatusCreated)
	}

	secondPayload := `{"type":"TRANSFER","senderId":"11111111-1111-4111-8111-111111111111","receiverId":"33333333-3333-4333-8333-333333333333","amount":999}`
	secondReq := httptest.NewRequest(http.MethodPost, "/transactions", bytes.NewBufferString(secondPayload))
	secondReq.Header.Set("Idempotency-Key", header)
	secondRec := httptest.NewRecorder()
	mux.ServeHTTP(secondRec, secondReq)

	if secondRec.Code != http.StatusCreated {
		t.Fatalf("unexpected second status: got %d want %d", secondRec.Code, http.StatusCreated)
	}
	if secondRec.Body.String() != firstRec.Body.String() {
		t.Fatalf("expected idempotent replay to return identical body")
	}
}

func TestGetTransactionByCodeNotFound(t *testing.T) {
	t.Parallel()
	mux := setupMux()

	req := httptest.NewRequest(http.MethodGet, "/transactions/code/NOTFOUND", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusNotFound)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode body: %v", err)
	}
	if body["error"] != "Transaction not found" {
		t.Fatalf("unexpected error message: %q", body["error"])
	}
}

type replayStore struct {
	mu               sync.Mutex
	getByKeyCalls    int
	existingByKey    map[string]transaction.Transaction
	nextSaveConflict bool
	lastSavedByKey   map[string]transaction.Transaction
}

func newReplayStore() *replayStore {
	return &replayStore{
		existingByKey:  make(map[string]transaction.Transaction),
		lastSavedByKey: make(map[string]transaction.Transaction),
	}
}

func (s *replayStore) Save(_ context.Context, tx transaction.Transaction) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.nextSaveConflict {
		s.nextSaveConflict = false
		return &store.ConflictError{
			Field: store.ConflictFieldIdempotencyKey,
			Value: tx.IdempotencyKey,
		}
	}

	if tx.IdempotencyKey != "" {
		s.lastSavedByKey[tx.IdempotencyKey] = tx
	}
	return nil
}

func (s *replayStore) GetByID(_ context.Context, _ string) (transaction.Transaction, bool, error) {
	return transaction.Transaction{}, false, nil
}

func (s *replayStore) GetByCode(_ context.Context, _ string) (transaction.Transaction, bool, error) {
	return transaction.Transaction{}, false, nil
}

func (s *replayStore) GetByIdempotencyKey(_ context.Context, key string) (transaction.Transaction, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.getByKeyCalls++
	if s.getByKeyCalls == 1 {
		return transaction.Transaction{}, false, nil
	}
	if tx, ok := s.existingByKey[key]; ok {
		return tx, true, nil
	}
	return transaction.Transaction{}, false, nil
}

func TestIdempotencyConflictReplayReturnsOriginal201(t *testing.T) {
	t.Parallel()

	s := newReplayStore()
	s.nextSaveConflict = true
	existingCode := "ZXCV1234"
	existingReceiver := "22222222-2222-4222-8222-222222222222"
	existing := transaction.Transaction{
		ID:             "11111111-1111-4111-8111-111111111111",
		Type:           transaction.TypeTransfer,
		Status:         transaction.StatusCompleted,
		Code:           &existingCode,
		SenderID:       "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		ReceiverID:     &existingReceiver,
		Amount:         31.5,
		CreatedAt:      time.Now().UTC(),
		IdempotencyKey: "idem-replay",
	}
	s.existingByKey[existing.IdempotencyKey] = existing

	h := NewTransactionsHandler(s)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /transactions", h.CreateTransaction)

	req := httptest.NewRequest(http.MethodPost, "/transactions", bytes.NewBufferString(`{"type":"TRANSFER","senderId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","receiverId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","amount":5}`))
	req.Header.Set("Idempotency-Key", existing.IdempotencyKey)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("unexpected status: got %d want %d", rec.Code, http.StatusCreated)
	}

	var got transaction.Transaction
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if got.ID != existing.ID {
		t.Fatalf("expected replayed transaction id %q, got %q", existing.ID, got.ID)
	}
	if got.Code == nil || *got.Code != existingCode {
		t.Fatalf("expected replayed code %q, got %#v", existingCode, got.Code)
	}
}
