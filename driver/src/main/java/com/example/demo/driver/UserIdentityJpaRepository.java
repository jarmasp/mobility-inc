package com.example.demo.driver;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserIdentityJpaRepository extends JpaRepository<UserIdentityEntity, String> {
    Optional<UserIdentityEntity> findByProviderAndProviderSubject(String provider, String providerSubject);
}
