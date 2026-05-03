package com.example.demo.notifications;

import com.example.demo.driver.Driver;
import com.example.demo.driver.client.PaymentsClient.TransactionDto;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final JavaMailSender mailSender;
    private final ResourceLoader resourceLoader;
    private final String fromAddress;

    public NotificationService(
            JavaMailSender mailSender,
            ResourceLoader resourceLoader,
            @Value("${smtp.from}") String fromAddress
    ) {
        this.mailSender = mailSender;
        this.resourceLoader = resourceLoader;
        this.fromAddress = fromAddress;
    }

    public void sendWelcomeDriver(Driver driver) {
        sendBestEffort(
                driver.email(),
                "welcome-driver",
                "templates/welcome-driver.txt",
                Map.of(
                        "name", driver.name(),
                        "driverId", driver.id()
                )
        );
    }

    public void sendPaymentReceived(Driver driver, TransactionDto transaction) {
        sendBestEffort(
                driver.email(),
                "payment-received",
                "templates/payment-received.txt",
                Map.of(
                        "name", driver.name(),
                        "code", String.valueOf(transaction.code()),
                        "amount", transaction.amount().toPlainString()
                )
        );
    }

    private void sendBestEffort(String to, String subject, String templatePath, Map<String, String> values) {
        try {
            String body = renderTemplate(templatePath, values);
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (Exception exception) {
            log.warn("Failed to deliver '{}' notification to {}: {}", subject, to, exception.getMessage());
        }
    }

    private String renderTemplate(String templatePath, Map<String, String> values) throws IOException {
        Resource resource = resourceLoader.getResource("classpath:" + templatePath);
        String text = resource.getContentAsString(StandardCharsets.UTF_8);
        String rendered = text;
        for (Map.Entry<String, String> entry : values.entrySet()) {
            rendered = rendered.replace("{{" + entry.getKey() + "}}", entry.getValue());
        }
        return rendered;
    }
}
