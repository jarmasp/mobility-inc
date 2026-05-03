package com.example.demo.driver;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class DriverRepository {

    private final DriverJpaRepository driverJpaRepository;

    public DriverRepository(DriverJpaRepository driverJpaRepository) {
        this.driverJpaRepository = driverJpaRepository;
    }

    public Driver save(Driver driver) {
        return save(driver, driver.id());
    }

    public Driver save(Driver driver, String appUserId) {
        driverJpaRepository.save(DriverEntity.fromDomain(driver, appUserId));
        return driver;
    }

    public Optional<Driver> findById(String id) {
        return driverJpaRepository.findById(id)
                .map(DriverEntity::toDomain);
    }

    public Optional<Driver> findByAppUserId(String appUserId) {
        return driverJpaRepository.findByAppUserId(appUserId).map(DriverEntity::toDomain);
    }

    @Transactional
    public Optional<Driver> updateBalance(String id, BigDecimal delta) {
        int updatedCount = driverJpaRepository.incrementBalance(id, delta);
        if (updatedCount == 0) {
            return Optional.empty();
        }
        return findById(id);
    }

    public List<Driver> findAll() {
        return driverJpaRepository.findAll()
                .stream()
                .map(DriverEntity::toDomain)
                .toList();
    }
}
