import { deepFreeze } from "./canonical.js";

export const RUN_AXIS_MATERIALIZATION_POLICY =
  "normalized-run-ontology-target-or-absent-v1";

/** Materializes level/element axis fields from an already normalized RunConfig. */
export function materializeRunAxis(runConfig) {
  const ontologyCoordinate = runConfig.ontologyTarget;
  return deepFreeze({
    axisProvenance: {
      derivationDepth: "computed",
      ...(ontologyCoordinate === undefined
        ? {}
        : {
            ontologyLevel: "declared",
            ...(ontologyCoordinate.phase === undefined
              ? {}
              : { ontologyPhase: "declared" })
          })
    },
    ...(ontologyCoordinate === undefined ? {} : { ontologyCoordinate })
  });
}
