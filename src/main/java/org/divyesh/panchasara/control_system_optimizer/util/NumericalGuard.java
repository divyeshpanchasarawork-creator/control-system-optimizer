package org.divyesh.panchasara.control_system_optimizer.util;

/**
 * Rejection helpers for numeric inputs that would otherwise reach the integrators
 * and produce non-finite results, a silent one-sample trajectory, or a
 * non-terminating integration loop.
 *
 * <p>Every method throws {@link IllegalArgumentException} so the existing
 * {@code GlobalExceptionHandler} turns it into a 400 response.
 */
public final class NumericalGuard {

	private NumericalGuard() {
	}

	/** Requires a finite value, rejecting NaN and both infinities. */
	public static double requireFinite(double value, String name) {
		if (!Double.isFinite(value)) {
			throw new IllegalArgumentException(name + " must be a finite number, got " + value);
		}
		return value;
	}

	/** Requires a finite value when present; a {@code null} value means "use the default". */
	public static void requireFiniteIfPresent(Double value, String name) {
		if (value != null && !Double.isFinite(value)) {
			throw new IllegalArgumentException(name + " must be a finite number, got " + value);
		}
	}

	/** Requires a finite value strictly greater than zero. */
	public static double requirePositive(double value, String name) {
		if (!Double.isFinite(value) || !(value > 0.0)) {
			throw new IllegalArgumentException(name + " must be a finite positive number, got " + value);
		}
		return value;
	}

	/** Requires a finite value strictly greater than zero when present. */
	public static void requirePositiveIfPresent(Double value, String name) {
		if (value != null && (!Double.isFinite(value) || !(value > 0.0))) {
			throw new IllegalArgumentException(name + " must be a finite positive number, got " + value);
		}
	}

	/** Requires every element of the array to be finite. A {@code null} array is allowed. */
	public static void requireAllFinite(double[] values, String name) {
		if (values == null) {
			return;
		}
		for (int i = 0; i < values.length; i++) {
			if (!Double.isFinite(values[i])) {
				throw new IllegalArgumentException(name + "[" + i + "] must be a finite number, got " + values[i]);
			}
		}
	}

	/**
	 * Requires {@code end} to be strictly greater than {@code start}. Without this a
	 * horizon at or before the start time silently produces a single-sample run.
	 */
	public static void requireAfter(double start, double end, String endName) {
		if (!(end > start)) {
			throw new IllegalArgumentException(endName + " (" + end + ") must be greater than the start time (" + start
					+ ")");
		}
	}
}
