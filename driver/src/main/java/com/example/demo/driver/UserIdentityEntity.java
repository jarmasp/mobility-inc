package com.example.demo.driver;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "user_identities")
public class UserIdentityEntity {

    @Id
    @Column(name = "app_user_id")
    private String appUserId;

    @Column(nullable = false)
    private String provider;

    @Column(name = "provider_subject", nullable = false)
    private String providerSubject;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected UserIdentityEntity() {
    }

    public UserIdentityEntity(
            String appUserId,
            String provider,
            String providerSubject,
            String email,
            String role,
            Instant createdAt
    ) {
        this.appUserId = appUserId;
        this.provider = provider;
        this.providerSubject = providerSubject;
        this.email = email;
        this.role = role;
        this.createdAt = createdAt;
    }

    public String appUserId() {
        return appUserId;
    }
}
