package com.example.demo.driver;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Repository;

@Repository
public class DriverRepository {

    private final ConcurrentHashMap<String, Driver> drivers = new ConcurrentHashMap<>();

    public Driver save(Driver driver) {
        drivers.put(driver.id(), driver);
        return driver;
    }

    public Optional<Driver> findById(String id) {
        return Optional.ofNullable(drivers.get(id));
    }

    public Optional<Driver> updateBalance(String id, BigDecimal delta) {
        Driver updated = drivers.computeIfPresent(id, (key, existing) -> new Driver(
                existing.id(),
                existing.name(),
                existing.email(),
                existing.balance().add(delta),
                existing.createdAt()
        ));
        return Optional.ofNullable(updated);
    }
}
