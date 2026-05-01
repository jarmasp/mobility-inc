package com.example.demo.driver.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDriverRequest(
        @NotBlank
        @Size(max = 100)
        String name,
        @NotBlank
        @Email
        String email
) {
}
