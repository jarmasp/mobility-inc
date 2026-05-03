package grpcserver

import (
	"context"
	"time"

	paymentsv1 "github.com/jarmasp/mobility-inc/internal/gen/payments/v1"
	"github.com/jarmasp/mobility-inc/internal/service"
	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type PaymentsService struct {
	paymentsv1.UnimplementedPaymentsServiceServer
	service *service.TransactionsService
}

func NewPaymentsService(store store.TransactionStore) *PaymentsService {
	return &PaymentsService{
		service: service.NewTransactionsService(store),
	}
}

func (s *PaymentsService) CreateTransaction(ctx context.Context, req *paymentsv1.CreateTransactionRequest) (*paymentsv1.CreateTransactionResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is required")
	}

	var receiverID *string
	if req.ReceiverId != "" {
		receiverID = &req.ReceiverId
	}

	tx, serviceErr := s.service.CreateTransaction(ctx, transaction.CreateTransactionRequest{
		Type:       req.Type,
		SenderID:   req.SenderId,
		ReceiverID: receiverID,
		Amount:     req.Amount,
	}, req.IdempotencyKey)
	if serviceErr != nil {
		return nil, mapError(serviceErr)
	}

	return &paymentsv1.CreateTransactionResponse{
		Transaction: toProtoTransaction(tx),
	}, nil
}

func (s *PaymentsService) GetTransactionByCode(ctx context.Context, req *paymentsv1.GetTransactionByCodeRequest) (*paymentsv1.GetTransactionByCodeResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is required")
	}

	tx, serviceErr := s.service.GetTransactionByCode(ctx, req.Code)
	if serviceErr != nil {
		return nil, mapError(serviceErr)
	}

	return &paymentsv1.GetTransactionByCodeResponse{
		Transaction: toProtoTransaction(tx),
	}, nil
}

func mapError(err *service.Error) error {
	switch err.Kind {
	case service.ErrorKindValidation:
		return status.Error(codes.InvalidArgument, err.Message)
	case service.ErrorKindSelfTransfer:
		return status.Error(codes.FailedPrecondition, err.Message)
	case service.ErrorKindNotFound:
		return status.Error(codes.NotFound, err.Message)
	case service.ErrorKindUpstream:
		return status.Error(codes.Unavailable, err.Message)
	default:
		return status.Error(codes.Internal, "Internal server error")
	}
}

func toProtoTransaction(tx transaction.Transaction) *paymentsv1.Transaction {
	codeValue := ""
	if tx.Code != nil {
		codeValue = *tx.Code
	}

	receiverID := ""
	if tx.ReceiverID != nil {
		receiverID = *tx.ReceiverID
	}

	return &paymentsv1.Transaction{
		TransactionId: tx.ID,
		Type:          tx.Type,
		Status:        tx.Status,
		Code:          codeValue,
		SenderId:      tx.SenderID,
		ReceiverId:    receiverID,
		Amount:        tx.Amount,
		CreatedAt:     tx.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
}
