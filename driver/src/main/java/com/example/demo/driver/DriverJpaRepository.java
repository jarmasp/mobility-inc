package com.example.demo.driver;

import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DriverJpaRepository extends JpaRepository<DriverEntity, String> {
    Optional<DriverEntity> findByAppUserId(String appUserId);

    @Modifying
    @Query("update DriverEntity d set d.balance = d.balance + :delta where d.id = :id")
    int incrementBalance(@Param("id") String id, @Param("delta") BigDecimal delta);
}
