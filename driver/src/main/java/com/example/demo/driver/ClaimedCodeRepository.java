package com.example.demo.driver;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ClaimedCodeRepository extends JpaRepository<ClaimedCodeEntity, String> {
}
