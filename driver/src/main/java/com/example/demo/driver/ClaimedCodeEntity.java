package com.example.demo.driver;

import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "claimed_codes")
public class ClaimedCodeEntity {

    @Id
    private String code;

    @Column(name = "driver_id", nullable = false)
    private String driverId;

    @Column(name = "transaction_id", nullable = false)
    private String transactionId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String status;

    @Column(name = "sender_id")
    private String senderId;

    @Column(name = "receiver_id")
    private String receiverId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "transaction_created_at", nullable = false)
    private Instant transactionCreatedAt;

    @Column(name = "claimed_at", nullable = false)
    private Instant claimedAt;

    protected ClaimedCodeEntity() {
    }

    public ClaimedCodeEntity(
            String code,
            String driverId,
            String transactionId,
            String type,
            String status,
            String senderId,
            String receiverId,
            BigDecimal amount,
            Instant transactionCreatedAt,
            Instant claimedAt
    ) {
        this.code = code;
        this.driverId = driverId;
        this.transactionId = transactionId;
        this.type = type;
        this.status = status;
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.amount = amount;
        this.transactionCreatedAt = transactionCreatedAt;
        this.claimedAt = claimedAt;
    }

    public static ClaimedCodeEntity fromTransaction(String driverId, TransactionDto transaction) {
        return new ClaimedCodeEntity(
                transaction.code(),
                driverId,
                transaction.transactionId(),
                transaction.type(),
                transaction.status(),
                transaction.senderId(),
                transaction.receiverId(),
                transaction.amount(),
                transaction.createdAt(),
                Instant.now()
        );
    }

    public String driverId() {
        return driverId;
    }

    public TransactionDto toTransactionDto() {
        return new TransactionDto(
                transactionId,
                type,
                status,
                code,
                senderId,
                receiverId,
                amount,
                transactionCreatedAt
        );
    }
}
