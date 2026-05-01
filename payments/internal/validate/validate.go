package validate

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jarmasp/mobility-inc/internal/transaction"
)

func ValidateCreateTransaction(req transaction.CreateTransactionRequest) (int, error) {
	if req.Amount <= 0 {
		return http.StatusBadRequest, errors.New("Amount must be greater than 0")
	}

	if strings.TrimSpace(req.SenderID) == "" {
		return http.StatusBadRequest, errors.New("senderId is required")
	}

	if !transaction.IsValidType(req.Type) {
		return http.StatusBadRequest, errors.New("Invalid transaction type")
	}

	switch req.Type {
	case transaction.TypeTransfer:
		if req.ReceiverID == nil || strings.TrimSpace(*req.ReceiverID) == "" {
			return http.StatusBadRequest, errors.New("receiverId is required for transfer")
		}
		if strings.TrimSpace(req.SenderID) == strings.TrimSpace(*req.ReceiverID) {
			return http.StatusUnprocessableEntity, errors.New("Self-transfer not allowed")
		}
	case transaction.TypeDeposit, transaction.TypeWithdrawal:
		if req.ReceiverID != nil && strings.TrimSpace(*req.ReceiverID) != "" {
			return http.StatusBadRequest, errors.New("receiverId must be null for deposit and withdrawal")
		}
	}

	return http.StatusOK, nil
}
