# Structural Geometry foundation: local review

Date: 2026-09-05. Scope: stages 0–2 / SG-001 through SG-008 of the adopted
roadmap. This is an implementation self-review, not independent scientific
review or approval to publish the repository preview.

## Reviewed boundaries and corrections

- Preserved the supplied proposal verbatim and adopted narrower executable
  contracts before runtime work. The policy is `source-parent-directed-v1`,
  reflecting the actual relation layer and known source findings.
- Checked the directed equation against the primary paper. Incoming-at-source
  and outgoing-at-target incidences are explicit. Reciprocal edges contribute
  on both sides; loops, parallel edges and foreign layers fail.
- Corrected the proposed invariance/benchmark interpretation: source ID changes
  change provenance hashes, unit curvature is determined by endpoint degrees,
  and global reversal preserves corresponding edge values.
- Checked complete source replay, exact manifest binding, record traces,
  immutable results, unsupported inputs, forged/rehashed artifacts and engine
  Model lookalikes or overridden record views. No stored result verifies itself.
- Browser bundling exposed a transitive `node:buffer` import through the engine's
  broad kernel entrypoint. Six engine modules now import their existing
  canonical helpers from `@onto2d/kernel/canonical`. The same implementations and
  hashes are retained; the kernel and Model Pack formats are unchanged.
- Improved the additional reference probes to use high pseudorandom bits;
  low bits would repeat the same topology. Assert that all twelve probes differ.
  Reference pipes decode UTF-8 explicitly and emit ASCII JSON, including under
  an intentionally ASCII Python I/O locale with non-BMP node IDs.
- Reviewed public exports, deep-readonly declarations, five closed schemas,
  workspace lock entries, browser bundling and CLI generation/check separation.
  Full-model generation preserves the hand-pinned source lock. Check/report
  commands do not rewrite fixtures.

## Validation

Local environment: macOS, Node v24.19.0, Python 3.9.6.

- `npm ci --offline --ignore-scripts`: passed from the updated lockfile.
- `npm test`: 1231 passed, 0 failed, 0 skipped.
- `npm run build`: passed repository checks, including the new geometry check,
  163 shared schemas, 16 workspace packages, source audit, exact model registry,
  kernel closure and unchanged worker/public module revision checks.
- `npm run check:goldens`: canonical and skeleton reference fixtures verified.
- `npm run structural-geometry:check`: 35 focused tests; sixteen frozen controls,
  twelve additional graphs, full-model Python incidence comparison, source replay,
  schema negatives and browser-target bundle execution without Node globals.
  Focused checks were repeated after the locale/diversity review corrections.
- Documentation links and `git diff --check`: passed.

The browser check executes an esbuild browser bundle in an isolated JavaScript
VM; it is not a claim that a new UI was tested or that the complete browser/OS
matrix ran locally. Existing CI covers Node 22/24 on Linux, macOS and Windows;
that remote run remains separate evidence.

## Result and remaining research

The frozen census covers all 249 nodes and 971 edges of Causal Emergence
2026.08.15. Edge curvature ranges from -34 to 1; the exact mean is -6328/971.
All source weights and classifications retain their original meaning. See the
[case result](../../cases/structural-geometry/RESULTS.md) for a short reading guide.

No unresolved implementation issue was found within this initial computational
scope. This is a historical foundation review; later metric experiments,
Ollivier and flow are implemented and recorded in their separate reviews.
The [revised roadmap](REVISED_ROADMAP.md) now controls provider, distinguishability,
comparison, topology and website work. Computational agreement does not turn
the source snapshot into causal evidence or establish added information beyond
the unit degree baseline. Independent scientific review remains open.
