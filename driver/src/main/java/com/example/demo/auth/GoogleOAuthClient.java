package com.example.demo.auth;

import java.util.Map;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Component
public class GoogleOAuthClient {

    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

    private final RestTemplate restTemplate;
    private final AuthProperties authProperties;

    public GoogleOAuthClient(RestTemplate restTemplate, AuthProperties authProperties) {
        this.restTemplate = restTemplate;
        this.authProperties = authProperties;
    }

    public GoogleUser fetchUserByCode(String code) {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("client_id", authProperties.clientId());
        body.add("client_secret", authProperties.clientSecret());
        body.add("redirect_uri", authProperties.callbackUrl());
        body.add("code", code);

        HttpHeaders tokenHeaders = new HttpHeaders();
        tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ResponseEntity<Map> tokenResponse = restTemplate.exchange(
                TOKEN_URL,
                HttpMethod.POST,
                new HttpEntity<>(body, tokenHeaders),
                Map.class
        );

        Object tokenValue = tokenResponse.getBody() != null ? tokenResponse.getBody().get("access_token") : null;
        if (!(tokenValue instanceof String accessToken) || accessToken.isBlank()) {
            throw new IllegalArgumentException("Unable to resolve Google access token");
        }

        HttpHeaders userHeaders = new HttpHeaders();
        userHeaders.setBearerAuth(accessToken);
        ResponseEntity<Map> userResponse = restTemplate.exchange(
                USERINFO_URL,
                HttpMethod.GET,
                new HttpEntity<>(userHeaders),
                Map.class
        );

        if (userResponse.getBody() == null) {
            throw new IllegalArgumentException("Unable to resolve Google user info");
        }

        String subject = String.valueOf(userResponse.getBody().getOrDefault("sub", ""));
        String email = String.valueOf(userResponse.getBody().getOrDefault("email", ""));
        String name = String.valueOf(userResponse.getBody().getOrDefault("name", ""));
        if (subject.isBlank() || email.isBlank()) {
            throw new IllegalArgumentException("Google user info missing required fields");
        }
        return new GoogleUser(subject, email, name);
    }

    public record GoogleUser(
            String subject,
            String email,
            String name
    ) {
    }
}
