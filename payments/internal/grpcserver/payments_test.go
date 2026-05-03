package grpcserver

import (
	"context"
	"errors"
	"testing"

	paymentsv1 "github.com/jarmasp/mobility-inc/internal/gen/payments/v1"
	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestCreateTransactionAndGetByCodeSuccess(t *testing.T) {
	t.Parallel()

	svc := NewPaymentsService(store.New())

	created, err := svc.CreateTransaction(context.Background(), &paymentsv1.CreateTransactionRequest{
		Type:       transaction.TypeTransfer,
		SenderId:   "11111111-1111-4111-8111-111111111111",
		ReceiverId: "22222222-2222-4222-8222-222222222222",
		Amount:     12.5,
	})
	if err != nil {
		t.Fatalf("create transaction returned error: %v", err)
	}
	if created.Transaction == nil || created.Transaction.Code == "" {
		t.Fatalf("expected transaction code to be present")
	}

	fetched, err := svc.GetTransactionByCode(context.Background(), &paymentsv1.GetTransactionByCodeRequest{
		Code: created.Transaction.Code,
	})
	if err != nil {
		t.Fatalf("get transaction by code returned error: %v", err)
	}

	if fetched.Transaction == nil || fetched.Transaction.TransactionId != created.Transaction.TransactionId {
		t.Fatalf("fetched transaction does not match created transaction")
	}
}

func TestCreateTransactionMapsInvalidArgument(t *testing.T) {
	t.Parallel()

	svc := NewPaymentsService(store.New())
	_, err := svc.CreateTransaction(context.Background(), &paymentsv1.CreateTransactionRequest{
		Type:     "INVALID",
		SenderId: "11111111-1111-4111-8111-111111111111",
		Amount:   10,
	})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("unexpected code: got %s want %s", status.Code(err), codes.InvalidArgument)
	}
}

func TestCreateTransactionMapsSelfTransfer(t *testing.T) {
	t.Parallel()

	svc := NewPaymentsService(store.New())
	_, err := svc.CreateTransaction(context.Background(), &paymentsv1.CreateTransactionRequest{
		Type:       transaction.TypeTransfer,
		SenderId:   "11111111-1111-4111-8111-111111111111",
		ReceiverId: "11111111-1111-4111-8111-111111111111",
		Amount:     10,
	})
	if status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("unexpected code: got %s want %s", status.Code(err), codes.FailedPrecondition)
	}
}

func TestGetTransactionByCodeMapsNotFound(t *testing.T) {
	t.Parallel()

	svc := NewPaymentsService(store.New())
	_, err := svc.GetTransactionByCode(context.Background(), &paymentsv1.GetTransactionByCodeRequest{Code: "MISSING"})
	if status.Code(err) != codes.NotFound {
		t.Fatalf("unexpected code: got %s want %s", status.Code(err), codes.NotFound)
	}
}

func TestCreateTransactionMapsUpstreamError(t *testing.T) {
	t.Parallel()

	svc := NewPaymentsService(&failingStore{})
	_, err := svc.CreateTransaction(context.Background(), &paymentsv1.CreateTransactionRequest{
		Type:       transaction.TypeTransfer,
		SenderId:   "11111111-1111-4111-8111-111111111111",
		ReceiverId: "22222222-2222-4222-8222-222222222222",
		Amount:     1,
	})
	if status.Code(err) != codes.Unavailable {
		t.Fatalf("unexpected code: got %s want %s", status.Code(err), codes.Unavailable)
	}
}

type failingStore struct{}

func (s *failingStore) Save(_ context.Context, _ transaction.Transaction) error {
	return errors.New("upstream error")
}

func (s *failingStore) GetByID(_ context.Context, _ string) (transaction.Transaction, bool, error) {
	return transaction.Transaction{}, false, errors.New("upstream error")
}

func (s *failingStore) GetByCode(_ context.Context, _ string) (transaction.Transaction, bool, error) {
	return transaction.Transaction{}, false, errors.New("upstream error")
}

func (s *failingStore) GetByIdempotencyKey(_ context.Context, _ string) (transaction.Transaction, bool, error) {
	return transaction.Transaction{}, false, errors.New("upstream error")
}
