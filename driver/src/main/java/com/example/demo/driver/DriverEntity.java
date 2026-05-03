package com.example.demo.driver;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "drivers")
public class DriverEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private BigDecimal balance;

    @Column(name = "app_user_id", nullable = false)
    private String appUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DriverEntity() {
    }

    public DriverEntity(String id, String name, String email, BigDecimal balance, String appUserId, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.balance = balance;
        this.appUserId = appUserId;
        this.createdAt = createdAt;
    }

    public static DriverEntity fromDomain(Driver driver, String appUserId) {
        return new DriverEntity(
                driver.id(),
                driver.name(),
                driver.email(),
                driver.balance(),
                appUserId,
                driver.createdAt()
        );
    }

    public Driver toDomain() {
        return new Driver(id, name, email, balance, createdAt);
    }

    public String appUserId() {
        return appUserId;
    }
}
