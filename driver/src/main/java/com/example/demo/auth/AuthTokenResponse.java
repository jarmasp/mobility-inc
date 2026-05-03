package com.example.demo.auth;

public record AuthTokenResponse(
        String token,
        String appUserId,
        String role
) {
}
