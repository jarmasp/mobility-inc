package com.example.demo.driver;

import com.example.demo.driver.client.PaymentsClient;
import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import com.example.demo.driver.dto.CreateDriverRequest;
import com.example.demo.driver.exception.ForbiddenException;
import com.example.demo.driver.exception.InsufficientFundsException;
import com.example.demo.driver.exception.NotFoundException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class DriverService {

    private static final BigDecimal INITIAL_BALANCE = BigDecimal.valueOf(100);

    private final DriverRepository driverRepository;
    private final PaymentsClient paymentsClient;
    private final Set<String> claimedCodes = ConcurrentHashMap.newKeySet();
    private final Map<String, TransactionDto> claimedTransactions = new ConcurrentHashMap<>();

    public DriverService(DriverRepository driverRepository, PaymentsClient paymentsClient) {
        this.driverRepository = driverRepository;
        this.paymentsClient = paymentsClient;
    }

    public Driver register(CreateDriverRequest request) {
        Driver driver = new Driver(
                UUID.randomUUID().toString(),
                request.name(),
                request.email(),
                INITIAL_BALANCE,
                Instant.now()
        );
        return driverRepository.save(driver);
    }

    public Driver findById(String id) {
        return driverRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Driver not found"));
    }

    public WithdrawResult withdraw(String driverId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }

        Driver driver = findById(driverId);
        if (driver.balance().compareTo(amount) < 0) {
            throw new InsufficientFundsException("Insufficient funds");
        }

        TransactionDto transaction = paymentsClient.createTransaction(
                "WITHDRAWAL",
                driverId,
                null,
                amount,
                UUID.randomUUID().toString()
        );

        Driver updated = driverRepository.updateBalance(driverId, amount.negate())
                .orElseThrow(() -> new NotFoundException("Driver not found"));
        return new WithdrawResult(transaction.transactionId(), updated.balance());
    }

    public TransactionDto verifyTransactionCode(String driverId, String code) {
        findById(driverId);
        TransactionDto alreadyClaimed = claimedTransactions.get(code);
        if (alreadyClaimed != null) {
            return alreadyClaimed;
        }

        TransactionDto transaction = paymentsClient.getTransactionByCode(code)
                .orElseThrow(() -> new NotFoundException("Transaction not found"));

        if (!driverId.equals(transaction.receiverId())) {
            throw new ForbiddenException("Code does not belong to this driver");
        }

        synchronized (this) {
            TransactionDto claimed = claimedTransactions.get(code);
            if (claimed != null) {
                return claimed;
            }

            driverRepository.updateBalance(driverId, transaction.amount())
                    .orElseThrow(() -> new NotFoundException("Driver not found"));
            claimedCodes.add(code);
            claimedTransactions.put(code, transaction);
            return transaction;
        }
    }

    public boolean isClaimed(String code) {
        return claimedCodes.contains(code);
    }

    public record WithdrawResult(
            String transactionId,
            BigDecimal balance
    ) {
    }
}
