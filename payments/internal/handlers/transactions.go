package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jarmasp/mobility-inc/internal/code"
	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
	"github.com/jarmasp/mobility-inc/internal/validate"
)

type TransactionsHandler struct {
	store *store.Store
}

func NewTransactionsHandler(store *store.Store) *TransactionsHandler {
	return &TransactionsHandler{store: store}
}

func (h *TransactionsHandler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var req transaction.CreateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	idempotencyKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if idempotencyKey != "" {
		if tx, ok := h.store.GetByIdempotencyKey(idempotencyKey); ok {
			writeJSON(w, http.StatusCreated, tx)
			return
		}
	}

	status, err := validate.ValidateCreateTransaction(req)
	if err != nil {
		writeError(w, status, err.Error())
		return
	}

	var codeValue *string
	if req.Type == transaction.TypeTransfer {
		generated := code.Generate()
		codeValue = &generated
	}

	var receiverID *string
	if req.Type == transaction.TypeTransfer && req.ReceiverID != nil {
		trimmed := strings.TrimSpace(*req.ReceiverID)
		receiverID = &trimmed
	}

	tx := transaction.Transaction{
		ID:             uuid.NewString(),
		Type:           req.Type,
		Status:         transaction.StatusCompleted,
		Code:           codeValue,
		SenderID:       strings.TrimSpace(req.SenderID),
		ReceiverID:     receiverID,
		Amount:         req.Amount,
		CreatedAt:      time.Now().UTC(),
		IdempotencyKey: idempotencyKey,
	}

	h.store.Save(tx)
	writeJSON(w, http.StatusCreated, tx)
}

func (h *TransactionsHandler) GetTransactionByCode(w http.ResponseWriter, r *http.Request) {
	codeParam := strings.TrimSpace(r.PathValue("code"))
	if codeParam == "" {
		writeError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	tx, ok := h.store.GetByCode(codeParam)
	if !ok {
		writeError(w, http.StatusNotFound, "Transaction not found")
		return
	}

	writeJSON(w, http.StatusOK, tx)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
