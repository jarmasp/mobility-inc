package com.example.demo.driver.client;

import com.example.demo.driver.exception.UpstreamException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;

@Component
public class PaymentsClient {

    private final RestTemplate restTemplate;
    private final String paymentsUrl;

    public PaymentsClient(RestTemplate restTemplate, @Value("${payments.url}") String paymentsUrl) {
        this.restTemplate = restTemplate;
        this.paymentsUrl = paymentsUrl;
    }

    public TransactionDto createTransaction(
            String type,
            String senderId,
            String receiverId,
            BigDecimal amount,
            String idempotencyKey
    ) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            headers.set("Idempotency-Key", idempotencyKey);
        }

        CreateTransactionRequest request = new CreateTransactionRequest(type, senderId, receiverId, amount);
        HttpEntity<CreateTransactionRequest> entity = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<TransactionDto> response = restTemplate.exchange(
                    paymentsUrl + "/transactions",
                    HttpMethod.POST,
                    entity,
                    TransactionDto.class
            );
            return response.getBody();
        } catch (RestClientException exception) {
            throw new UpstreamException("Payments service unavailable");
        }
    }

    public Optional<TransactionDto> getTransactionByCode(String code) {
        try {
            ResponseEntity<TransactionDto> response = restTemplate.exchange(
                    paymentsUrl + "/transactions/code/" + code,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    TransactionDto.class
            );
            return Optional.ofNullable(response.getBody());
        } catch (HttpClientErrorException.NotFound exception) {
            return Optional.empty();
        } catch (RestClientException exception) {
            throw new UpstreamException("Payments service unavailable");
        }
    }

    public record CreateTransactionRequest(
            String type,
            String senderId,
            String receiverId,
            BigDecimal amount
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
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
