package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jarmasp/mobility-inc/internal/service"
	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
)

type TransactionsHandler struct {
	service *service.TransactionsService
}

func NewTransactionsHandler(store store.TransactionStore) *TransactionsHandler {
	return &TransactionsHandler{service: service.NewTransactionsService(store)}
}

func (h *TransactionsHandler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var req transaction.CreateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	idempotencyKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	tx, serviceErr := h.service.CreateTransaction(r.Context(), req, idempotencyKey)
	if serviceErr != nil {
		status := http.StatusBadRequest
		if serviceErr.Kind == service.ErrorKindSelfTransfer {
			status = http.StatusUnprocessableEntity
		}
		if serviceErr.Kind == service.ErrorKindUpstream {
			status = http.StatusInternalServerError
		}
		writeError(w, status, serviceErr.Message)
		return
	}

	writeJSON(w, http.StatusCreated, tx)
}

func (h *TransactionsHandler) GetTransactionByCode(w http.ResponseWriter, r *http.Request) {
	tx, serviceErr := h.service.GetTransactionByCode(r.Context(), r.PathValue("code"))
	if serviceErr != nil {
		status := http.StatusNotFound
		if serviceErr.Kind == service.ErrorKindUpstream {
			status = http.StatusInternalServerError
		}
		writeError(w, status, serviceErr.Message)
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
