package com.example.demo.driver;

import com.example.demo.driver.client.PaymentsClient;
import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import com.example.demo.driver.dto.CreateDriverRequest;
import com.example.demo.driver.exception.ForbiddenException;
import com.example.demo.driver.exception.InsufficientFundsException;
import com.example.demo.driver.exception.NotFoundException;
import com.example.demo.notifications.NotificationService;
import org.springframework.dao.DataIntegrityViolationException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DriverService {

    private static final BigDecimal INITIAL_BALANCE = BigDecimal.valueOf(100);

    private final DriverRepository driverRepository;
    private final ClaimedCodeRepository claimedCodeRepository;
    private final PaymentsClient paymentsClient;
    private final NotificationService notificationService;

    public DriverService(
            DriverRepository driverRepository,
            ClaimedCodeRepository claimedCodeRepository,
            PaymentsClient paymentsClient,
            NotificationService notificationService
    ) {
        this.driverRepository = driverRepository;
        this.claimedCodeRepository = claimedCodeRepository;
        this.paymentsClient = paymentsClient;
        this.notificationService = notificationService;
    }

    public Driver register(String appUserId, CreateDriverRequest request) {
        Driver existing = driverRepository.findByAppUserId(appUserId).orElse(null);
        if (existing != null) {
            return existing;
        }
        Driver driver = new Driver(
                UUID.randomUUID().toString(),
                request.name(),
                request.email(),
                INITIAL_BALANCE,
                Instant.now()
        );
        Driver saved = driverRepository.save(driver, appUserId);
        notificationService.sendWelcomeDriver(saved);
        return saved;
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

    @Transactional
    public TransactionDto verifyTransactionCode(String driverId, String code) {
        findById(driverId);
        TransactionDto alreadyClaimed = findClaimedTransaction(driverId, code);
        if (alreadyClaimed != null) return alreadyClaimed;

        TransactionDto transaction = paymentsClient.getTransactionByCode(code)
                .orElseThrow(() -> new NotFoundException("Transaction not found"));

        if (!driverId.equals(transaction.receiverId())) {
            throw new ForbiddenException("Code does not belong to this driver");
        }

        try {
            claimedCodeRepository.saveAndFlush(ClaimedCodeEntity.fromTransaction(driverId, transaction));
            Driver creditedDriver = driverRepository.updateBalance(driverId, transaction.amount())
                    .orElseThrow(() -> new NotFoundException("Driver not found"));
            notificationService.sendPaymentReceived(creditedDriver, transaction);
            return transaction;
        } catch (DataIntegrityViolationException exception) {
            TransactionDto claimed = findClaimedTransaction(driverId, code);
            if (claimed != null) {
                return claimed;
            }
            throw exception;
        }
    }

    public boolean isClaimed(String code) {
        return claimedCodeRepository.existsById(code);
    }

    private TransactionDto findClaimedTransaction(String driverId, String code) {
        return claimedCodeRepository.findById(code)
                .map(claimed -> {
                    if (!driverId.equals(claimed.driverId())) {
                        throw new ForbiddenException("Code does not belong to this driver");
                    }
                    return claimed.toTransactionDto();
                })
                .orElse(null);
    }

    public record WithdrawResult(
            String transactionId,
            BigDecimal balance
    ) {
    }
}
