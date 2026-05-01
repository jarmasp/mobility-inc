package com.example.demo.driver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DriverRepositoryTest {

    private final DriverRepository repository = new DriverRepository();

    @Test
    void saveAndFindByIdShouldReturnStoredDriver() {
        Driver driver = new Driver(
                UUID.randomUUID().toString(),
                "Alice",
                "alice@example.com",
                BigDecimal.valueOf(100),
                Instant.now()
        );

        repository.save(driver);

        assertTrue(repository.findById(driver.id()).isPresent());
        assertEquals("Alice", repository.findById(driver.id()).orElseThrow().name());
    }

    @Test
    void updateBalanceShouldApplyDelta() {
        Driver driver = new Driver(
                UUID.randomUUID().toString(),
                "Bob",
                "bob@example.com",
                BigDecimal.valueOf(100),
                Instant.now()
        );
        repository.save(driver);

        Driver updated = repository.updateBalance(driver.id(), BigDecimal.valueOf(-20)).orElseThrow();

        assertEquals(BigDecimal.valueOf(80), updated.balance());
    }
}
