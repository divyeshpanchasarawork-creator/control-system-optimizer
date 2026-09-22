package org.divyesh.panchasara.control_system_optimizer.analysis;

/**
 * A complex eigenvalue, split into real and imaginary parts for JSON-safe
 * serialization.
 */
public record ComplexValue(double real, double imag) {

	@Override
	public String toString() {
		return imag == 0.0 ? String.valueOf(real) : real + " " + (imag > 0 ? "+" : "-") + " " + Math.abs(imag) + "i";
	}
}