package com.example.demo.driver;

import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import com.example.demo.driver.dto.CreateDriverRequest;
import com.example.demo.driver.dto.WithdrawRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/drivers")
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @PostMapping
    public ResponseEntity<Driver> createDriver(@Valid @RequestBody CreateDriverRequest request) {
        Driver driver = driverService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(driver);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Driver> getDriver(@PathVariable String id) {
        return ResponseEntity.ok(driverService.findById(id));
    }

    @PostMapping("/{id}/withdraw")
    public ResponseEntity<DriverService.WithdrawResult> withdraw(
            @PathVariable String id,
            @Valid @RequestBody WithdrawRequest request
    ) {
        return ResponseEntity.ok(driverService.withdraw(id, request.amount()));
    }

    @GetMapping("/{id}/transactions/{code}")
    public ResponseEntity<TransactionDto> verifyCode(@PathVariable String id, @PathVariable String code) {
        return ResponseEntity.ok(driverService.verifyTransactionCode(id, code));
    }
}
