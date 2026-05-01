package com.example.demo.driver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.demo.driver.client.PaymentsClient;
import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import com.example.demo.driver.dto.CreateDriverRequest;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest(classes = {DriverService.class, DriverRepository.class})
class DriverServiceTest {

    @Autowired
    private DriverService driverService;

    @Autowired
    private DriverRepository driverRepository;

    @MockBean
    private PaymentsClient paymentsClient;

    @Test
    void verifyTransactionCodeShouldBeIdempotentAndCreditOnlyOnce() {
        Driver driver = driverService.register(new CreateDriverRequest("Driver", "driver@example.com"));
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
    }
}
