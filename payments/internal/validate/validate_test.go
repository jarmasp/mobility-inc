package validate

import (
	"net/http"
	"testing"

	"github.com/jarmasp/mobility-inc/internal/transaction"
)

func strPtr(s string) *string {
	return &s
}

func TestValidateCreateTransaction(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		req        transaction.CreateTransactionRequest
		wantStatus int
		wantErr    bool
	}{
		{
			name: "valid transfer",
			req: transaction.CreateTransactionRequest{
				Type:       transaction.TypeTransfer,
				SenderID:   "11111111-1111-4111-8111-111111111111",
				ReceiverID: strPtr("22222222-2222-4222-8222-222222222222"),
				Amount:     10.5,
			},
			wantStatus: http.StatusOK,
			wantErr:    false,
		},
		{
			name: "amount must be greater than zero",
			req: transaction.CreateTransactionRequest{
				Type:     transaction.TypeDeposit,
				SenderID: "11111111-1111-4111-8111-111111111111",
				Amount:   0,
			},
			wantStatus: http.StatusBadRequest,
			wantErr:    true,
		},
		{
			name: "sender required",
			req: transaction.CreateTransactionRequest{
				Type:   transaction.TypeDeposit,
				Amount: 5,
			},
			wantStatus: http.StatusBadRequest,
			wantErr:    true,
		},
		{
			name: "invalid type",
			req: transaction.CreateTransactionRequest{
				Type:     "UNKNOWN",
				SenderID: "11111111-1111-4111-8111-111111111111",
				Amount:   5,
			},
			wantStatus: http.StatusBadRequest,
			wantErr:    true,
		},
		{
			name: "transfer requires receiver",
			req: transaction.CreateTransactionRequest{
				Type:     transaction.TypeTransfer,
				SenderID: "11111111-1111-4111-8111-111111111111",
				Amount:   9,
			},
			wantStatus: http.StatusBadRequest,
			wantErr:    true,
		},
		{
			name: "self transfer returns 422",
			req: transaction.CreateTransactionRequest{
				Type:       transaction.TypeTransfer,
				SenderID:   "11111111-1111-4111-8111-111111111111",
				ReceiverID: strPtr("11111111-1111-4111-8111-111111111111"),
				Amount:     9,
			},
			wantStatus: http.StatusUnprocessableEntity,
			wantErr:    true,
		},
		{
			name: "deposit receiver must be null or omitted",
			req: transaction.CreateTransactionRequest{
				Type:       transaction.TypeDeposit,
				SenderID:   "11111111-1111-4111-8111-111111111111",
				ReceiverID: strPtr("22222222-2222-4222-8222-222222222222"),
				Amount:     9,
			},
			wantStatus: http.StatusBadRequest,
			wantErr:    true,
		},
		{
			name: "withdrawal receiver must be null or omitted",
			req: transaction.CreateTransactionRequest{
				Type:       transaction.TypeWithdrawal,
				SenderID:   "11111111-1111-4111-8111-111111111111",
				ReceiverID: strPtr("22222222-2222-4222-8222-222222222222"),
				Amount:     9,
			},
			wantStatus: http.StatusBadRequest,
			wantErr:    true,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			gotStatus, err := ValidateCreateTransaction(tc.req)
			if gotStatus != tc.wantStatus {
				t.Fatalf("status mismatch: got %d want %d", gotStatus, tc.wantStatus)
			}
			if (err != nil) != tc.wantErr {
				t.Fatalf("error mismatch: got %v wantErr %v", err, tc.wantErr)
			}
		})
	}
}
