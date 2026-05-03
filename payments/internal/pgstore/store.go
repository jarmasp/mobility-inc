package pgstore

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jarmasp/mobility-inc/internal/store"
	"github.com/jarmasp/mobility-inc/internal/transaction"
)

const (
	codeUniqueConstraint           = "transactions_code_uq"
	idempotencyKeyUniqueConstraint = "transactions_idempotency_key_uq"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create pgx pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Save(ctx context.Context, tx transaction.Transaction) error {
	_, err := s.pool.Exec(
		ctx,
		`INSERT INTO transactions (
			id, type, status, code, sender_id, receiver_id, amount, created_at, idempotency_key
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		tx.ID,
		tx.Type,
		tx.Status,
		tx.Code,
		tx.SenderID,
		tx.ReceiverID,
		tx.Amount,
		tx.CreatedAt,
		nullableString(tx.IdempotencyKey),
	)
	if err != nil {
		return mapConflictError(err, tx)
	}
	return nil
}

func (s *Store) GetByID(ctx context.Context, id string) (transaction.Transaction, bool, error) {
	return s.getOne(ctx, "id = $1", id)
}

func (s *Store) GetByCode(ctx context.Context, code string) (transaction.Transaction, bool, error) {
	return s.getOne(ctx, "code = $1", code)
}

func (s *Store) GetByIdempotencyKey(ctx context.Context, key string) (transaction.Transaction, bool, error) {
	return s.getOne(ctx, "idempotency_key = $1", key)
}

func (s *Store) getOne(ctx context.Context, where string, value string) (transaction.Transaction, bool, error) {
	query := fmt.Sprintf(
		`SELECT id, type, status, code, sender_id, receiver_id, amount, created_at, idempotency_key
		 FROM transactions WHERE %s LIMIT 1`,
		where,
	)

	var tx transaction.Transaction
	var codeValue *string
	var receiverID *string
	var idempotencyKey *string
	var createdAt time.Time

	err := s.pool.QueryRow(ctx, query, value).Scan(
		&tx.ID,
		&tx.Type,
		&tx.Status,
		&codeValue,
		&tx.SenderID,
		&receiverID,
		&tx.Amount,
		&createdAt,
		&idempotencyKey,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return transaction.Transaction{}, false, nil
	}
	if err != nil {
		return transaction.Transaction{}, false, err
	}

	tx.Code = codeValue
	tx.ReceiverID = receiverID
	tx.CreatedAt = createdAt.UTC()
	if idempotencyKey != nil {
		tx.IdempotencyKey = *idempotencyKey
	}

	return tx, true, nil
}

func nullableString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func mapConflictError(err error, tx transaction.Transaction) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return err
	}

	switch pgErr.ConstraintName {
	case idempotencyKeyUniqueConstraint:
		return &store.ConflictError{
			Field: store.ConflictFieldIdempotencyKey,
			Value: tx.IdempotencyKey,
			Err:   err,
		}
	case codeUniqueConstraint:
		var value string
		if tx.Code != nil {
			value = *tx.Code
		}
		return &store.ConflictError{
			Field: store.ConflictFieldCode,
			Value: value,
			Err:   err,
		}
	default:
		return err
	}
}
