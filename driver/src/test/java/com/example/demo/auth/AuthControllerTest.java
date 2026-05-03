package com.example.demo.auth;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.demo.config.GlobalExceptionHandler;
import com.example.demo.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class})
@TestPropertySource(properties = "auth.stub=true")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GoogleOAuthClient googleOAuthClient;

    @MockBean
    private UserIdentityService userIdentityService;

    @MockBean
    private JwtTokenService jwtTokenService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @MockBean
    private AuthProperties authProperties;

    @Test
    void devTokenShouldIssueTokenWhenAuthStubEnabled() throws Exception {
        when(userIdentityService.findOrCreate(eq("dev"), eq("dev:e2e"), eq("driver@example.com")))
                .thenReturn("app-user-id");
        when(jwtTokenService.issueToken(eq("dev:e2e"), eq("app-user-id"), eq("driver")))
                .thenReturn("jwt-token");

        mockMvc.perform(post("/auth/dev/token")
                        .contentType("application/json")
                        .content("""
                                {"subject":"e2e","email":"driver@example.com","name":"Driver"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token"))
                .andExpect(jsonPath("$.appUserId").value("app-user-id"))
                .andExpect(jsonPath("$.role").value("driver"));
    }
}
