package transaction

import "time"

const (
	TypeDeposit    = "DEPOSIT"
	TypeWithdrawal = "WITHDRAWAL"
	TypeTransfer   = "TRANSFER"

	StatusCompleted = "COMPLETED"
)

type Transaction struct {
	ID             string    `json:"transactionId"`
	Type           string    `json:"type"`
	Status         string    `json:"status"`
	Code           *string   `json:"code"`
	SenderID       string    `json:"senderId"`
	ReceiverID     *string   `json:"receiverId"`
	Amount         float64   `json:"amount"`
	CreatedAt      time.Time `json:"createdAt"`
	IdempotencyKey string    `json:"-"`
}

type CreateTransactionRequest struct {
	Type       string  `json:"type"`
	SenderID   string  `json:"senderId"`
	ReceiverID *string `json:"receiverId"`
	Amount     float64 `json:"amount"`
}

func IsValidType(t string) bool {
	return t == TypeDeposit || t == TypeWithdrawal || t == TypeTransfer
}
