package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/jarmasp/mobility-inc/internal/store"
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
