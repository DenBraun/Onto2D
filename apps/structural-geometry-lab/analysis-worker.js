import { replayControls, analyzeScene } from "./analysis.js";
self.onmessage = ({ data: { id, payload, sceneId, regimeId } }) => {
  try {
    const start = performance.now();
    const controls = replayControls(payload);
    const result = analyzeScene(payload, sceneId, regimeId);
    self.postMessage({ id, ok: true, result, controls, elapsedMs: performance.now() - start });
  } catch (error) {
    self.postMessage({ id, ok: false, message: error.message });
  }
};
