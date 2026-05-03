package com.example.demo.driver.client;

import com.example.demo.driver.exception.UpstreamException;
import com.example.payments.v1.CreateTransactionRequest;
import com.example.payments.v1.GetTransactionByCodeRequest;
import com.example.payments.v1.PaymentsServiceGrpc;
import com.example.payments.v1.TransactionResponse;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import javax.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PaymentsClient {

    private final ManagedChannel channel;
    private final PaymentsServiceGrpc.PaymentsServiceBlockingStub blockingStub;

    public PaymentsClient(@Value("${payments.grpc-url}") String paymentsGrpcUrl) {
        this.channel = ManagedChannelBuilder.forTarget(paymentsGrpcUrl).usePlaintext().build();
        this.blockingStub = PaymentsServiceGrpc.newBlockingStub(channel);
    }

    public TransactionDto createTransaction(
            String type,
            String senderId,
            String receiverId,
            BigDecimal amount,
            String idempotencyKey
    ) {
        try {
            TransactionResponse response = blockingStub.createTransaction(
                    CreateTransactionRequest.newBuilder()
                            .setType(type)
                            .setSenderId(senderId != null ? senderId : "")
                            .setReceiverId(receiverId != null ? receiverId : "")
                            .setAmount(amount.toPlainString())
                            .setIdempotencyKey(idempotencyKey != null ? idempotencyKey : "")
                            .build()
            );
            return toDto(response);
        } catch (StatusRuntimeException exception) {
            throw new UpstreamException("Payments service unavailable");
        }
    }

    public Optional<TransactionDto> getTransactionByCode(String code) {
        try {
            TransactionResponse response = blockingStub.getTransactionByCode(
                    GetTransactionByCodeRequest.newBuilder().setCode(code).build()
            );
            return Optional.of(toDto(response));
        } catch (StatusRuntimeException exception) {
            if (exception.getStatus().getCode() == Status.Code.NOT_FOUND) {
                return Optional.empty();
            }
            throw new UpstreamException("Payments service unavailable");
        }
    }

    @PreDestroy
    public void shutdown() {
        channel.shutdownNow();
    }

    private TransactionDto toDto(TransactionResponse response) {
        try {
            return new TransactionDto(
                    response.getTransactionId(),
                    response.getType(),
                    response.getStatus(),
                    response.getCode().isBlank() ? null : response.getCode(),
                    response.getSenderId().isBlank() ? null : response.getSenderId(),
                    response.getReceiverId().isBlank() ? null : response.getReceiverId(),
                    new BigDecimal(response.getAmount()),
                    Instant.parse(response.getCreatedAt())
            );
        } catch (NumberFormatException | DateTimeParseException exception) {
            throw new UpstreamException("Payments service unavailable");
        }
    }

    public record TransactionDto(
            String transactionId,
            String type,
            String status,
            String code,
            String senderId,
            String receiverId,
            BigDecimal amount,
            Instant createdAt
    ) {
    }
}
