package com.example.demo.driver;

import java.math.BigDecimal;
import java.time.Instant;

public record Driver(
        String id,
        String name,
        String email,
        BigDecimal balance,
        Instant createdAt
) {
}
