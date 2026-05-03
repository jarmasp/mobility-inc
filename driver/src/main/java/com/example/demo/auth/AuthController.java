package com.example.demo.auth;

import jakarta.validation.Valid;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final boolean authStub;
    private final AuthProperties authProperties;
    private final GoogleOAuthClient googleOAuthClient;
    private final UserIdentityService userIdentityService;
    private final JwtTokenService jwtTokenService;

    public AuthController(
            @Value("${auth.stub:false}") boolean authStub,
            AuthProperties authProperties,
            GoogleOAuthClient googleOAuthClient,
            UserIdentityService userIdentityService,
            JwtTokenService jwtTokenService
    ) {
        this.authStub = authStub;
        this.authProperties = authProperties;
        this.googleOAuthClient = googleOAuthClient;
        this.userIdentityService = userIdentityService;
        this.jwtTokenService = jwtTokenService;
    }

    @GetMapping("/google")
    public ResponseEntity<?> googleAuth() {
        if (authStub) {
            return ResponseEntity.badRequest().body(Map.of("error", "Google OAuth disabled when AUTH_STUB=true"));
        }
        String url = "https://accounts.google.com/o/oauth2/v2/auth"
                + "?client_id=" + encoded(authProperties.clientId())
                + "&redirect_uri=" + encoded(authProperties.callbackUrl())
                + "&response_type=code"
                + "&scope=" + encoded("openid email profile");
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    @GetMapping("/google/callback")
    public ResponseEntity<AuthTokenResponse> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String email
    ) {
        String providerSubject;
        String resolvedEmail;
        if (authStub) {
            providerSubject = subject != null ? subject : "stub-user";
            resolvedEmail = email != null ? email : "stub-driver@mobility.local";
        } else {
            if (code == null || code.isBlank()) {
                throw new IllegalArgumentException("Missing OAuth code");
            }
            GoogleOAuthClient.GoogleUser user = googleOAuthClient.fetchUserByCode(code);
            providerSubject = user.subject();
            resolvedEmail = user.email();
        }
        String normalizedSubject = "google:" + providerSubject;
        String appUserId = userIdentityService.findOrCreate("google", normalizedSubject, resolvedEmail);
        String token = jwtTokenService.issueToken(normalizedSubject, appUserId, "driver");
        return ResponseEntity.ok(new AuthTokenResponse(token, appUserId, "driver"));
    }

    @PostMapping("/dev/token")
    public ResponseEntity<?> devToken(@Valid @RequestBody DevTokenRequest request) {
        if (!authStub) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Not found"));
        }
        String normalizedSubject = "dev:" + request.subject();
        String appUserId = userIdentityService.findOrCreate("dev", normalizedSubject, request.email());
        String token = jwtTokenService.issueToken(normalizedSubject, appUserId, "driver");
        return ResponseEntity.ok(new AuthTokenResponse(token, appUserId, "driver"));
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
