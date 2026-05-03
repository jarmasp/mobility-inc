package paymentsv1

type CreateTransactionRequest struct {
	Type           string
	SenderId       string
	ReceiverId     string
	Amount         float64
	IdempotencyKey string
}

type Transaction struct {
	TransactionId string
	Type          string
	Status        string
	Code          string
	SenderId      string
	ReceiverId    string
	Amount        float64
	CreatedAt     string
}

type CreateTransactionResponse struct {
	Transaction *Transaction
}

type GetTransactionByCodeRequest struct {
	Code string
}

type GetTransactionByCodeResponse struct {
	Transaction *Transaction
}
