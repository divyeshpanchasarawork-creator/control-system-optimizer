package org.divyesh.panchasara.control_system_optimizer.api;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Translates validation, domain and unexpected errors into a stable JSON shape.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
		String message = ex.getBindingResult().getFieldErrors().stream()
				.map(e -> e.getField() + ": " + e.getDefaultMessage())
				.reduce((a, b) -> a + "; " + b)
				.orElse("Validation failed");
		return respond(HttpStatus.BAD_REQUEST, message, request, "Validation failed");
	}

	@ExceptionHandler({ IllegalArgumentException.class, HttpMessageNotReadableException.class,
			MethodArgumentTypeMismatchException.class })
	public ResponseEntity<ErrorResponse> handleBadRequest(Exception ex, HttpServletRequest request) {
		return respond(HttpStatus.BAD_REQUEST, ex.getMessage(), request, "Bad Request");
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
		return respond(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage(), request, "Internal Server Error");
	}

	private ResponseEntity<ErrorResponse> respond(HttpStatus status, String message, HttpServletRequest request,
			String error) {
		return ResponseEntity.status(status).body(new ErrorResponse(Instant.now(), status.value(), error,
				message == null ? error : message, request.getRequestURI()));
	}

	public record ErrorResponse(Instant timestamp, int status, String error, String message, String path) {
	}
}