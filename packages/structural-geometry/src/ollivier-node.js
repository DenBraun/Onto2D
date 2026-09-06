import { createPythonAdapter } from "./python-adapter.js";
import { OLLIVIER_POLICY, OLLIVIER_SOLVER } from "./ollivier-policy.js";

export function createPythonOllivierAdapter(options = {}) {
  return createPythonAdapter(options, {
    solver: OLLIVIER_SOLVER,
    oracle: new URL("./python/ollivier_oracle.py", import.meta.url),
    maximum: OLLIVIER_POLICY.limits.maxTransportBytes,
    errorPrefix: "STRUCTURAL_OLLIVIER"
  });
}
