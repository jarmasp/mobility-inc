package com.example.demo.auth;

import com.example.demo.driver.UserIdentityEntity;
import com.example.demo.driver.UserIdentityJpaRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserIdentityService {

    private final UserIdentityJpaRepository userIdentityJpaRepository;

    public UserIdentityService(UserIdentityJpaRepository userIdentityJpaRepository) {
        this.userIdentityJpaRepository = userIdentityJpaRepository;
    }

    @Transactional
    public String findOrCreate(String provider, String providerSubject, String email) {
        return userIdentityJpaRepository.findByProviderAndProviderSubject(provider, providerSubject)
                .map(UserIdentityEntity::appUserId)
                .orElseGet(() -> {
                    String appUserId = UUID.randomUUID().toString();
                    userIdentityJpaRepository.save(new UserIdentityEntity(
                            appUserId,
                            provider,
                            providerSubject,
                            email,
                            "driver",
                            Instant.now()
                    ));
                    return appUserId;
                });
    }
}
