import { run } from "../models/causal-emergence/canonical/build.mjs";

await run({ verify: true });
await run({ verify: true, version: "2026.09.11" });
await run({ verify: true, version: "2026.09.12" });
await run({ verify: true, version: "2026.09.12.1" });
await run({ verify: true, version: "2026.09.12.2" });
await run({ verify: true, version: "2026.09.12.3" });
