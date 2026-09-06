import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalClone, canonicalize } from "@onto2d/kernel/canonical";
import { EngineError } from "@onto2d/engine";
import { defineScientificAdapter } from "@onto2d/scientific-adapter";

export function createPythonAdapter(options, { solver, oracle: oracleUrl, maximum, errorPrefix }) {
  const oracle = fileURLToPath(oracleUrl);
  const error = (suffix, message) => new EngineError(`${errorPrefix}_${suffix}`, message);
  const settings = canonicalClone(options);
  if (!settings || typeof settings !== "object" || Array.isArray(settings) ||
      Object.keys(settings).some((key) => !["pythonExecutable", "timeoutMs"].includes(key))) {
    throw error("INPUT_INVALID", "Unsupported Python adapter options.");
  }
  const executable = Object.hasOwn(settings, "pythonExecutable") ? settings.pythonExecutable : "python3";
  const timeoutMs = Object.hasOwn(settings, "timeoutMs") ? settings.timeoutMs : 30000;
  if (typeof executable !== "string" || !executable.trim() || executable.includes("\0") ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw error("INPUT_INVALID", "Invalid Python executable or timeout (1–30000 ms).");
  }
  return defineScientificAdapter({
    ...solver,
    async evaluate(request) {
      const payload = canonicalize(request);
      if (Buffer.byteLength(payload, "utf8") > maximum) throw error("LIMIT_EXCEEDED", "Oracle request exceeds the byte bound.");
      return new Promise((resolve, reject) => {
        const child = spawn(executable, ["-I", "-B", oracle], { stdio: ["pipe", "pipe", "pipe"], shell: false });
        const chunks = [];
        let outputBytes = 0; let stderrBytes = 0; let settled = false;
        const finish = (failure, response) => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (failure) { child.kill("SIGKILL"); reject(failure); } else resolve(response);
        };
        const timer = setTimeout(() => finish(error("ORACLE_TIMEOUT", "Python oracle exceeded its deadline.")), timeoutMs);
        child.on("error", () => finish(error("ORACLE_FAILED", "Could not start the Python oracle.")));
        child.stdin.on("error", () => finish(error("ORACLE_FAILED", "Python oracle closed its input unexpectedly.")));
        child.stdout.on("data", (chunk) => {
          outputBytes += chunk.length;
          if (outputBytes > maximum) finish(error("LIMIT_EXCEEDED", "Oracle response exceeds the byte bound."));
          else chunks.push(chunk);
        });
        child.stderr.on("data", (chunk) => {
          stderrBytes += chunk.length;
          if (stderrBytes > maximum) finish(error("LIMIT_EXCEEDED", "Oracle diagnostics exceed the byte bound."));
        });
        child.on("close", (code) => {
          if (settled) return;
          if (code !== 0) { finish(error("ORACLE_FAILED", "Python oracle rejected the request or failed.")); return; }
          try {
            const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
            finish(null, JSON.parse(text));
          } catch { finish(error("ORACLE_FAILED", "Python oracle returned invalid JSON.")); }
        });
        child.stdin.end(payload, "utf8");
      });
    }
  });
}
