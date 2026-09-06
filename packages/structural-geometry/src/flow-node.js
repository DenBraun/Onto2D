import { createPythonAdapter } from "./python-adapter.js";
import { STRUCTURAL_FLOW_POLICY, STRUCTURAL_FLOW_SOLVER } from "./flow-policy.js";

export function createPythonStructuralFlowAdapter(options = {}) {
  return createPythonAdapter(options, {
    solver: STRUCTURAL_FLOW_SOLVER,
    oracle: new URL("./python/flow_oracle.py", import.meta.url),
    maximum: STRUCTURAL_FLOW_POLICY.limits.maxTransportBytes,
    errorPrefix: "STRUCTURAL_FLOW"
  });
}
