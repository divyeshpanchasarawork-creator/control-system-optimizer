package org.divyesh.panchasara.control_system_optimizer.systems;

import java.util.LinkedHashMap;
import java.util.Map;

import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.model.StateSpaceModel;
import org.divyesh.panchasara.control_system_optimizer.model.SystemType;
import org.apache.commons.math3.linear.Array2DRowRealMatrix;
import org.apache.commons.math3.linear.RealMatrix;

/**
 * Classical one-dimensional mass-spring-damper system:
 *
 * m*x'' + c*x' + k*x = u
 *
 * with state x_1 = position and x_2 = velocity:
 *
 * x' = [ 0      1   ] x + [ 0   ] u
 *      [ -k/m  -c/m ]     [ 1/m ]
 *
 * The physical parameters m, c and k are validated: m &gt; 0, c &gt;= 0, k &gt; 0.
 */
public final class SpringDamperSystem implements DynamicSystem {

	private final double mass;
	private final double damping;
	private final double springConstant;
	private final StateSpaceModel model;

	public SpringDamperSystem(double mass, double damping, double springConstant) {
		if (!(mass > 0.0)) {
			throw new IllegalArgumentException("Mass must be positive, got " + mass);
		}
		if (damping < 0.0) {
			throw new IllegalArgumentException("Damping must be non-negative, got " + damping);
		}
		if (!(springConstant > 0.0)) {
			throw new IllegalArgumentException("Spring constant must be positive, got " + springConstant);
		}
		this.mass = mass;
		this.damping = damping;
		this.springConstant = springConstant;

		RealMatrix a = new Array2DRowRealMatrix(new double[][] {
				{ 0.0, 1.0 },
				{ -springConstant / mass, -damping / mass }
		});
		RealMatrix b = new Array2DRowRealMatrix(new double[][] {
				{ 0.0 },
				{ 1.0 / mass }
		});
		this.model = StateSpaceModel.of(a, b);
	}

	@Override
	public int dimension() {
		return 2;
	}

	@Override
	public SystemType systemType() {
		return SystemType.SPRING_DAMPER;
	}

	@Override
	public StateSpaceModel stateSpaceModel() {
		return model;
	}

	@Override
	public double[] derivative(double time, double[] state, double[] control) {
		return model.derivativeAt(state, control);
	}

	@Override
	public Map<String, Double> parameters() {
		Map<String, Double> params = new LinkedHashMap<>();
		params.put("mass", mass);
		params.put("damping", damping);
		params.put("springConstant", springConstant);
		return params;
	}

	public double mass() {
		return mass;
	}

	public double damping() {
		return damping;
	}

	public double springConstant() {
		return springConstant;
	}
}