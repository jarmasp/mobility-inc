package com.example.demo.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth.google")
public record AuthProperties(
        String clientId,
        String clientSecret,
        String callbackUrl
) {
}
