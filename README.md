# Control-System Simulator & Gain Optimization Framework

A Java 21 + Spring Boot backend for experimenting with linear control systems.
The first implemented physical system is a mass-spring-damper, but the
architecture is deliberately decoupled: the simulator, stability analyzer,
performance analyzer, objective function and optimizers all operate against
generic abstractions, so new systems (DC motor, inverted pendulum, cart-pole,
RLC circuit, …) can be added without touching them.

## 1. Mathematical model

The classic one-degree-of-freedom mass-spring-damper system is described by

```
m·x'' + c·x' + k·x = u
```

with mass `m`, damping `c`, spring stiffness `k`, control input `u` and
displacement `x`.

### State-space conversion

Define the state `x_1 = x` (position), `x_2 = ẋ` (velocity). Then

```
d/dt [x_1]   [  0      1   ] [x_1]   [  0  ]
     [x_2] = [ -k/m   -c/m ] [x_2] + [ 1/m ] u
```

i.e. `ẋ = A·x + B·u` with

```
A = [  0      1   ]        B = [  0  ]
    [ -k/m  -c/m ]            [ 1/m ]
```

Validation: `m > 0`, `c >= 0`, `k > 0`.

## 2. State feedback

```
u = -K·(x - r)        tracking    (K = [k_p  k_d])
u = -K·x              regulation
```

## 3. Closed-loop system

Substituting `u = -K·x` gives the closed-loop state matrix

```
A_cl = A - B·K
```

This is computed generically in `ClosedLoopSystem` from any `DynamicSystem` and
`StateFeedbackController` — never inside the physical system.

## 4. Stability analysis

For a continuous-time LTI system the origin is asymptotically stable iff every
eigenvalue of `A_cl` has a strictly negative real part. The stability endpoint
returns the eigenvalues plus the largest/smallest real part.

## 5. Performance metrics

From a simulated trajectory (all integrals trapezoidal over the samples):

| Metric        | Definition |
|---------------|------------|
| IAE           | `∫|x-r| dt` |
| ISE           | `∫|x-r|² dt` |
| controlEffort | `∫ uᵀu dt` |
| maxAbsError   | `max |x-r|` |
| finalError    | `|x(T)-r(T)|` |
| overshoot     | `(peak-r₀)/|r₀| · 100`, clamped ≥ 0; `0` for zero reference |
| settlingTime  | first `t` after which the error stays within a settling band of `‖r‖` forever; **null** (`NaN`) when the system never settles |
| maxControl    | `max ‖u‖₂` |

The settling band is configurable per request (`simulation.settlingBand`,
default `2`, meaning 2% of the reference norm). A non-settling trajectory is a
legitimate (undesirable) outcome, not a numerics failure; it is penalized in the
objective rather than rejected.

## 6. Objective function

```
J(K) = w₁·IAE + w₂·controlEffort + w₃·settlingTime + w₄·overshoot
```

Weights are configurable per request. If a metric is NaN the objective maps the
candidate to +∞ (infeasible), so NaN never leaks into the optimizer or the API.
A trajectory that never settles has `settlingTime = NaN` and is penalized as
settling exactly at the simulation horizon `T` (the finite penalty, not +∞),
because "never settles within the horizon" is a legitimate result to grade, not
a numerical failure.

Each optimization response also exposes `objectiveBreakdown` — the four weighted
contributions `(w₁·IAE, w₂·controlEffort, w₃·settlingTime, w₄·overshoot)` plus
their total — so a UI can show *why* one gain beats another.

### Hard constraints (optional)

The optimization request may include a `constraints` block:

```json
"constraints": {"maxControl": 20, "maxOvershoot": 10, "maxSettlingTime": 3}
```

Any candidate violating a present constraint is treated as infeasible (+∞). The
response reports each enforced constraint with the achieved value of the best
gain and whether it is satisfied.

### Metric surfaces (grid search)

When a 2-D grid search is run with `"includeCostSurface": true`, the response
additionally returns `metricSurfaces.iae` and `metricSurfaces.controlEffort` —
the per-cell IAE and control effort over the same grid, for layered heatmaps.

## 7. Deterministic optimization — grid search

```
for each k_p in [k_p,min .. k_p,max]:
  for each k_d in [k_d,min .. k_d,max]:
    K = [k_p, k_d]
    if A - B·K is unstable: reject
    simulate → metrics → J(K)
    keep the strictly-best K
```

Fully reproducible: fixed sampling, fixed order, strict `<` improvement.

## 8. Heuristic optimization — Differential Evolution

`DE/rand/1/bin` with a `SplittableRandom` seeded from the request. The same
input, bounds, objective and seed always produce the same result. Infeasible
candidates never win a replacement but keep the population moving.

## 9. REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/systems`                  | catalog of supported systems |
| POST | `/api/simulations`              | run a closed-loop simulation |
| POST | `/api/analysis/stability`       | eigenvalues of `A_cl` |
| POST | `/api/optimization`             | search the best feedback gains |

### Example: simulation

```bash
curl -X POST localhost:8080/api/simulations -H 'Content-Type: application/json' -d '{
  "system": {"type":"SPRING_DAMPER","parameters":{"mass":1,"damping":0.5,"springConstant":10}},
  "controller": {"type":"STATE_FEEDBACK","gain":[10,5]},
  "simulation": {"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":0.05}
}'
```

### Example: optimization

```bash
curl -X POST localhost:8080/api/optimization -H 'Content-Type: application/json' -d '{
  "system": {"type":"SPRING_DAMPER","parameters":{"mass":1,"damping":0.5,"springConstant":10}},
  "controller": {"type":"STATE_FEEDBACK"},
  "gainBounds": {"lower":[0,0],"upper":[30,10]},
  "optimizer": {"type":"GRID_SEARCH","resolution":[31,11],"includeCostSurface":true},
  "objective": {"trackingErrorWeight":1,"controlEffortWeight":0.1,"settlingTimeWeight":0.5,"overshootWeight":0.5},
  "simulation": {"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":0.05,"settlingBand":5},
  "constraints": {"maxControl":15,"maxOvershoot":25,"maxSettlingTime":3}
}'
```

Responses are plain JSON; `NaN`/`Infinity` values are mapped to `null` (e.g. a
`settlingTime` of `null` means the system never settled within the horizon).

## 10. The core experiment

With `m=1, c=0.5, k=10`:

```
A = [ 0     1 ]        B = [0]
    [-10  -0.5]            [1]
```

Every candidate `K=[k_p,k_d]` produces `A_cl = A - B·K`; changing the gains moves
the eigenvalues, which is exactly what the optimizer searches over. Under the
same system, initial conditions, reference, duration, timestep and objective you
can now compare:

- a manual gain `K`,
- the grid-search champion `K*`,
- the DE champion `K*`.

## 11. Caveat — no global optimality claim

The optimizers search a bounded gain box and are **not** guaranteed to find a
mathematically optimal controller. Grid search samples only the chosen
resolution; DE is heuristic. Neither establishes global optimality, so the
results are engineering recommendations, not proofs. Design outer-loop/verifying
experiments (e.g. sweep resolution or seeds, cross-check with an LQR or pole
placement) before trusting a single run.

## Architecture notes

```
api/          REST controllers, DTO records, error handler
service/      wiring (SystemRegistry, simulation/optimization/stability services)
model/        DynamicSystem, StateSpaceModel, SystemType
systems/      SpringDamperSystem + SystemRegistry factory
control/      Controller, StateFeedbackController, ClosedLoopSystem
simulation/   Simulator, RungeKutta4Simulator, Trajectory
analysis/     StabilityAnalyzer, PerformanceAnalyzer, metrics
optimization/ Optimizer, OptimizationProblem, grid search + DE, objective
config/       ControlProperties (@ConfigurationProperties)
```

The optimizer only sees `OptimizationProblem`; the simulator only sees
`DynamicSystem` + `Controller`. Adding a system = implement `DynamicSystem`,
register a factory in `SystemRegistry`, add it to the `SystemType` enum.

## Build & test

```bash
./mvnw test
```