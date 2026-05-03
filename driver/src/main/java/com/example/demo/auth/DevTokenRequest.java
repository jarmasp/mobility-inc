package com.example.demo.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record DevTokenRequest(
        @NotBlank String subject,
        @NotBlank @Email String email,
        @NotBlank String name
) {
}
