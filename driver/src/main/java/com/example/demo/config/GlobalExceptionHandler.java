package com.example.demo.config;

import com.example.demo.driver.exception.ForbiddenException;
import com.example.demo.driver.exception.InsufficientFundsException;
import com.example.demo.driver.exception.NotFoundException;
import com.example.demo.driver.exception.UpstreamException;
import java.util.Map;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldError() != null
                ? exception.getBindingResult().getFieldError().getDefaultMessage()
                : "Validation failed";
        return errorResponse(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler({NoSuchElementException.class, NotFoundException.class})
    public ResponseEntity<Map<String, String>> handleNotFound(RuntimeException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ForbiddenException exception) {
        return errorResponse(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(InsufficientFundsException.class)
    public ResponseEntity<Map<String, String>> handleInsufficientFunds(InsufficientFundsException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler({IllegalArgumentException.class})
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler(UpstreamException.class)
    public ResponseEntity<Map<String, String>> handleUpstream(UpstreamException exception) {
        return errorResponse(HttpStatus.BAD_GATEWAY, exception.getMessage());
    }

    private ResponseEntity<Map<String, String>> errorResponse(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
