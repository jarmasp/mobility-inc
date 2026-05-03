package com.example.demo.driver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.demo.driver.client.PaymentsClient;
import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import com.example.demo.driver.dto.CreateDriverRequest;
import com.example.demo.notifications.NotificationService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
class DriverServiceTest extends PostgresIntegrationTest {

    @Autowired
    private DriverService driverService;

    @Autowired
    private DriverRepository driverRepository;

    @MockBean
    private PaymentsClient paymentsClient;

    @MockBean
    private NotificationService notificationService;

    @Autowired
    private DriverJpaRepository driverJpaRepository;

    @Autowired
    private ClaimedCodeRepository claimedCodeRepository;

    @BeforeEach
    void setUp() {
        claimedCodeRepository.deleteAll();
        driverJpaRepository.deleteAll();
    }

    @Test
    void registerShouldSendWelcomeOnceForNewIdentity() {
        Driver first = driverService.register("app-user-register", new CreateDriverRequest("New", "new@example.com"));
        Driver second = driverService.register("app-user-register", new CreateDriverRequest("Changed", "changed@example.com"));

        assertEquals(first.id(), second.id());
        verify(notificationService, times(1)).sendWelcomeDriver(any(Driver.class));
    }

    @Test
    void verifyTransactionCodeShouldBeIdempotentAndCreditOnlyOnce() {
        Driver driver = driverService.register("app-user-1", new CreateDriverRequest("Driver", "driver@example.com"));
        BigDecimal amount = BigDecimal.valueOf(25);
        TransactionDto transaction = new TransactionDto(
                "11111111-1111-4111-8111-111111111111",
                "TRANSFER",
                "COMPLETED",
                "code-123",
                "22222222-2222-4222-8222-222222222222",
                driver.id(),
                amount,
                Instant.parse("2026-01-01T00:00:00Z")
        );
        when(paymentsClient.getTransactionByCode("code-123")).thenReturn(java.util.Optional.of(transaction));

        TransactionDto first = driverService.verifyTransactionCode(driver.id(), "code-123");
        TransactionDto second = driverService.verifyTransactionCode(driver.id(), "code-123");

        assertEquals(first, second);
        assertTrue(driverService.isClaimed("code-123"));
        assertEquals(
                BigDecimal.valueOf(125),
                driverRepository.findById(driver.id()).orElseThrow().balance()
        );
        verify(paymentsClient, times(1)).getTransactionByCode(anyString());
        verify(notificationService, times(1)).sendPaymentReceived(any(Driver.class), eq(first));
    }

    @Test
    void verifyTransactionCodeShouldCreditOnlyOnceUnderConcurrentRequests() throws Exception {
        Driver driver = driverService.register("app-user-2", new CreateDriverRequest("Concurrent", "concurrent@example.com"));
        BigDecimal amount = BigDecimal.valueOf(25);
        TransactionDto transaction = new TransactionDto(
                "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "TRANSFER",
                "COMPLETED",
                "code-concurrent",
                "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                driver.id(),
                amount,
                Instant.parse("2026-01-01T00:00:00Z")
        );
        when(paymentsClient.getTransactionByCode("code-concurrent")).thenReturn(java.util.Optional.of(transaction));

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch startLatch = new CountDownLatch(1);
        Future<TransactionDto> firstFuture = executor.submit(() -> {
            startLatch.await();
            return driverService.verifyTransactionCode(driver.id(), "code-concurrent");
        });
        Future<TransactionDto> secondFuture = executor.submit(() -> {
            startLatch.await();
            return driverService.verifyTransactionCode(driver.id(), "code-concurrent");
        });

        startLatch.countDown();
        TransactionDto first = firstFuture.get();
        TransactionDto second = secondFuture.get();
        executor.shutdown();

        assertEquals(first.transactionId(), second.transactionId());
        assertEquals(
                BigDecimal.valueOf(125),
                driverRepository.findById(driver.id()).orElseThrow().balance()
        );
        assertTrue(driverService.isClaimed("code-concurrent"));
        verify(notificationService, times(1)).sendPaymentReceived(any(Driver.class), any(TransactionDto.class));
    }
}
