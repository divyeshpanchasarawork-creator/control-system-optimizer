package org.divyesh.panchasara.control_system_optimizer.api;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
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

	/** Guards the cause-chain walk against self-referencing or pathological chains. */
	private static final int MAX_CAUSE_DEPTH = 10;

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
		return respond(HttpStatus.BAD_REQUEST, describe(ex), request, "Bad Request");
	}

	/**
	 * The message a client should see. A rejected record constructor surfaces as
	 * "JSON parse error: Cannot construct instance of ..., problem: &lt;reason&gt;",
	 * so the innermost cause carries the actual reason and is preferred.
	 */
	private String describe(Exception ex) {
		String message = ex.getMessage();
		Throwable cause = ex.getCause();
		for (int depth = 0; depth < MAX_CAUSE_DEPTH && cause != null && cause != cause.getCause(); depth++) {
			String causeMessage = cause.getMessage();
			if (causeMessage != null && !causeMessage.isBlank()) {
				message = causeMessage;
			}
			cause = cause.getCause();
		}
		return safeMessageText(message);
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex,
			HttpServletRequest request) {
		return respond(HttpStatus.BAD_REQUEST, "Missing required parameter '" + ex.getParameterName() + "'", request,
				"Bad Request");
	}

	@ExceptionHandler(UnprocessableSimulationException.class)
	public ResponseEntity<ErrorResponse> handleUnprocessable(UnprocessableSimulationException ex,
			HttpServletRequest request) {
		return respond(HttpStatus.UNPROCESSABLE_ENTITY, safeMessage(ex), request, "Unprocessable Simulation");
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
		// never leak exception internals that could contain secrets or stack details
		return respond(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", request,
				"Internal Server Error");
	}

	/** A message whose internals are safe to echo; never exposes exception stack internals. */
	private String safeMessage(Exception ex) {
		return safeMessageText(ex.getMessage());
	}

	private String safeMessageText(String message) {
		if (message == null || message.isBlank() || !message.chars().allMatch(c -> c >= 0x20 && c != 0x7f)) {
			return "Bad Request";
		}
		return message.length() > 500 ? message.substring(0, 500) : message;
	}

	private ResponseEntity<ErrorResponse> respond(HttpStatus status, String message, HttpServletRequest request,
			String error) {
		return ResponseEntity.status(status).body(new ErrorResponse(Instant.now(), status.value(), error,
				message == null ? error : message, request.getRequestURI()));
	}

	public record ErrorResponse(Instant timestamp, int status, String error, String message, String path) {
	}
}