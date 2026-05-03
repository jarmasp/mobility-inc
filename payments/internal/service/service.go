package service

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jarmasp/mobility-inc/internal/code"
	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
	"github.com/jarmasp/mobility-inc/internal/validate"
)

type ErrorKind string

const (
	ErrorKindValidation   ErrorKind = "validation"
	ErrorKindSelfTransfer ErrorKind = "self_transfer"
	ErrorKindNotFound     ErrorKind = "not_found"
	ErrorKindUpstream     ErrorKind = "upstream"
)

type Error struct {
	Kind    ErrorKind
	Message string
	Err     error
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *Error) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

type TransactionsService struct {
	store store.TransactionStore
}

func NewTransactionsService(store store.TransactionStore) *TransactionsService {
	return &TransactionsService{store: store}
}

func (s *TransactionsService) CreateTransaction(ctx context.Context, req transaction.CreateTransactionRequest, idempotencyKey string) (transaction.Transaction, *Error) {
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if idempotencyKey != "" {
		tx, ok, err := s.store.GetByIdempotencyKey(ctx, idempotencyKey)
		if err != nil {
			return transaction.Transaction{}, &Error{Kind: ErrorKindUpstream, Message: "Internal server error", Err: err}
		}
		if ok {
			return tx, nil
		}
	}

	status, err := validate.ValidateCreateTransaction(req)
	if err != nil {
		kind := ErrorKindValidation
		if status == http.StatusUnprocessableEntity {
			kind = ErrorKindSelfTransfer
		}
		return transaction.Transaction{}, &Error{Kind: kind, Message: err.Error(), Err: err}
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

	if err := s.store.Save(ctx, tx); err != nil {
		if idempotencyKey != "" && store.IsConflictOn(err, store.ConflictFieldIdempotencyKey) {
			existing, ok, lookupErr := s.store.GetByIdempotencyKey(ctx, idempotencyKey)
			if lookupErr != nil {
				return transaction.Transaction{}, &Error{Kind: ErrorKindUpstream, Message: "Internal server error", Err: lookupErr}
			}
			if ok {
				return existing, nil
			}
		}
		return transaction.Transaction{}, &Error{Kind: ErrorKindUpstream, Message: "Internal server error", Err: err}
	}

	return tx, nil
}

func (s *TransactionsService) GetTransactionByCode(ctx context.Context, codeValue string) (transaction.Transaction, *Error) {
	codeValue = strings.TrimSpace(codeValue)
	if codeValue == "" {
		return transaction.Transaction{}, &Error{Kind: ErrorKindNotFound, Message: "Transaction not found"}
	}

	tx, ok, err := s.store.GetByCode(ctx, codeValue)
	if err != nil {
		return transaction.Transaction{}, &Error{Kind: ErrorKindUpstream, Message: "Internal server error", Err: err}
	}
	if !ok {
		return transaction.Transaction{}, &Error{Kind: ErrorKindNotFound, Message: "Transaction not found"}
	}

	return tx, nil
}
