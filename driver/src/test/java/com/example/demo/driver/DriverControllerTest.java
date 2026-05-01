package com.example.demo.driver;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.demo.config.GlobalExceptionHandler;
import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import com.example.demo.driver.dto.CreateDriverRequest;
import com.example.demo.driver.exception.ForbiddenException;
import com.example.demo.driver.exception.InsufficientFundsException;
import com.example.demo.driver.exception.NotFoundException;
import com.example.demo.driver.exception.UpstreamException;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DriverController.class)
@Import({GlobalExceptionHandler.class, DriverControllerTest.TestSecurityConfig.class})
class DriverControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DriverService driverService;

    @Test
    void createDriverShouldReturn201() throws Exception {
        Driver response = new Driver(
                "11111111-1111-4111-8111-111111111111",
                "Alice",
                "alice@example.com",
                BigDecimal.valueOf(100),
                Instant.parse("2026-01-01T00:00:00Z")
        );
        when(driverService.register(any(CreateDriverRequest.class))).thenReturn(response);

        mockMvc.perform(post("/drivers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Alice","email":"alice@example.com"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(response.id()))
                .andExpect(jsonPath("$.balance").value(100));
    }

    @Test
    void createDriverShouldReturn400ForInvalidBody() throws Exception {
        mockMvc.perform(post("/drivers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"","email":"bad-email"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void getDriverShouldReturn200() throws Exception {
        Driver response = new Driver(
                "11111111-1111-4111-8111-111111111111",
                "Alice",
                "alice@example.com",
                BigDecimal.valueOf(90),
                Instant.parse("2026-01-01T00:00:00Z")
        );
        when(driverService.findById(response.id())).thenReturn(response);

        mockMvc.perform(get("/drivers/{id}", response.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@example.com"));
    }

    @Test
    void getDriverShouldReturn404() throws Exception {
        when(driverService.findById("missing")).thenThrow(new NotFoundException("Driver not found"));

        mockMvc.perform(get("/drivers/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Driver not found"));
    }

    @Test
    void withdrawShouldReturn200() throws Exception {
        DriverService.WithdrawResult result = new DriverService.WithdrawResult(
                "33333333-3333-4333-8333-333333333333",
                BigDecimal.valueOf(80)
        );
        when(driverService.withdraw(eq("driver-id"), eq(BigDecimal.valueOf(20)))).thenReturn(result);

        mockMvc.perform(post("/drivers/{id}/withdraw", "driver-id")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":20}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transactionId").value(result.transactionId()))
                .andExpect(jsonPath("$.balance").value(80));
    }

    @Test
    void withdrawShouldReturn400ForInsufficientFunds() throws Exception {
        when(driverService.withdraw(eq("driver-id"), eq(BigDecimal.valueOf(20))))
                .thenThrow(new InsufficientFundsException("Insufficient funds"));

        mockMvc.perform(post("/drivers/{id}/withdraw", "driver-id")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":20}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Insufficient funds"));
    }

    @Test
    void withdrawShouldReturn404WhenDriverMissing() throws Exception {
        when(driverService.withdraw(eq("missing"), eq(BigDecimal.valueOf(20))))
                .thenThrow(new NotFoundException("Driver not found"));

        mockMvc.perform(post("/drivers/{id}/withdraw", "missing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":20}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Driver not found"));
    }

    @Test
    void withdrawShouldReturn502OnUpstreamFailure() throws Exception {
        when(driverService.withdraw(eq("driver-id"), eq(BigDecimal.valueOf(20))))
                .thenThrow(new UpstreamException("Payments service unavailable"));

        mockMvc.perform(post("/drivers/{id}/withdraw", "driver-id")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":20}
                                """))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("Payments service unavailable"));
    }

    @Test
    void verifyCodeShouldReturn200() throws Exception {
        TransactionDto dto = new TransactionDto(
                "44444444-4444-4444-8444-444444444444",
                "TRANSFER",
                "COMPLETED",
                "code-1",
                "55555555-5555-4555-8555-555555555555",
                "driver-id",
                BigDecimal.valueOf(10),
                Instant.parse("2026-01-01T00:00:00Z")
        );
        when(driverService.verifyTransactionCode("driver-id", "code-1")).thenReturn(dto);

        mockMvc.perform(get("/drivers/{id}/transactions/{code}", "driver-id", "code-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.receiverId").value("driver-id"));
    }

    @Test
    void verifyCodeShouldReturn403() throws Exception {
        when(driverService.verifyTransactionCode("driver-id", "bad-code"))
                .thenThrow(new ForbiddenException("Code does not belong to this driver"));

        mockMvc.perform(get("/drivers/{id}/transactions/{code}", "driver-id", "bad-code"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Code does not belong to this driver"));
    }

    @Test
    void verifyCodeShouldReturn404() throws Exception {
        when(driverService.verifyTransactionCode("driver-id", "missing-code"))
                .thenThrow(new NotFoundException("Transaction not found"));

        mockMvc.perform(get("/drivers/{id}/transactions/{code}", "driver-id", "missing-code"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Transaction not found"));
    }

    @Test
    void verifyCodeShouldReturn502() throws Exception {
        when(driverService.verifyTransactionCode("driver-id", "code-1"))
                .thenThrow(new UpstreamException("Payments service unavailable"));

        mockMvc.perform(get("/drivers/{id}/transactions/{code}", "driver-id", "code-1"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error").value("Payments service unavailable"));
    }

    @TestConfiguration
    static class TestSecurityConfig {
        @Bean
        SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
            return http.csrf(csrf -> csrf.disable())
                    .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                    .build();
        }
    }
}
