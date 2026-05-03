package com.example.demo.driver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase.Replace;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

@DataJpaTest
@Import(DriverRepository.class)
@AutoConfigureTestDatabase(replace = Replace.NONE)
class DriverRepositoryTest extends PostgresIntegrationTest {

    @Autowired
    private DriverRepository repository;

    @Autowired
    private DriverJpaRepository driverJpaRepository;

    @BeforeEach
    void setUp() {
        driverJpaRepository.deleteAll();
    }

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
