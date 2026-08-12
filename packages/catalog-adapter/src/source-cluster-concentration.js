import {
  HASH_DOMAINS,
  KernelError,
  canonicalClone,
  canonicalize,
  deepFreeze,
  hashCanonical,
  isContentHash
} from "@onto2d/kernel";
import { verifySourceMigrationMetrics } from "./source-migration-metrics.js";

export const SOURCE_CLUSTER_CONCENTRATION_VERSION =
  "source-cluster-concentration-v1";
export const SOURCE_CLUSTER_CONCENTRATION_LIMITS = deepFreeze({
  maxPoints: 20_000,
  maxVertices: 20_000,
  maxDepth: 1_000_000,
  maxIdentifierLength: 1_024,
  maxTextLength: 16_384
});

const INPUT_FIELDS = new Set([
  "schemaVersion",
  "metricsHash",
  "definition",
  "points"
]);
const DEFINITION_FIELDS = new Set([
  "version",
  "frozenAt",
  "statement",
  "clusterLocationsSeenBeforeFreeze",
  "exposureDeclaration",
  "bottleneckArtifact",
  "concentratedAtOrAbove",
  "depletedAtOrBelow"
]);
const POINT_FIELDS = new Set([
  "depth",
  "depthBasis",
  "stratificationVertices",
  "sourceVertexIds",
  "bottleneck"
]);
const ARTIFACT_REF_FIELDS = new Set([
  "path",
  "mediaType",
  "schemaVersion",
  "bytes",
  "hash"
]);
const CANONICAL_OPTIONS = Object.freeze({
  limits: Object.freeze({
    maxDepth: 64,
    maxEntries: 2_000_000,
    maxStringBytes: 1_048_576
  })
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "SOURCE_CLUSTER_CONCENTRATION",
    message,
    details
  });
}

function cloneInput(value, label) {
  try {
    return canonicalClone(value, CANONICAL_OPTIONS);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "SOURCE_CLUSTER_CONCENTRATION_INPUT_INVALID",
      `${label} must be canonicalizable.`,
      { causeCode: error.code }
    );
  }
}

function exactFields(value, allowed, required, path, code) {
  if (!isObject(value)) {
    fail(code, "Cluster-concentration values must be objects.", { path });
  }
  const fields = Object.keys(value);
  const unknown = fields.filter((field) => !allowed.has(field));
  const missing = required.filter((field) => !fields.includes(field));
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, "Cluster-concentration fields do not match the contract.", {
      path,
      unknown,
      missing
    });
  }
}

function normalizedString(value, path, code, maximum) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > maximum
  ) {
    fail(code, "Cluster-concentration text must be normalized and bounded.", {
      path,
      maximum
    });
  }
  return value;
}

function artifactRef(value, path, code) {
  exactFields(value, ARTIFACT_REF_FIELDS, [...ARTIFACT_REF_FIELDS], path, code);
  if (
    typeof value.path !== "string" ||
    value.path.length === 0 ||
    value.path !== value.path.trim() ||
    value.path.length > 32_768 ||
    typeof value.mediaType !== "string" ||
    value.mediaType.length === 0 ||
    value.mediaType !== value.mediaType.trim() ||
    value.mediaType.length > 1_024 ||
    typeof value.schemaVersion !== "string" ||
    value.schemaVersion.length === 0 ||
    value.schemaVersion !== value.schemaVersion.trim() ||
    value.schemaVersion.length > 1_024 ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 0 ||
    !isContentHash(value.hash)
  ) {
    fail(code, "Bottleneck definitions require a complete artifact reference.", {
      path
    });
  }
  return value;
}

function timestamp(value, path, code) {
  const parsed = typeof value === "string" ? new Date(value) : null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    fail(code, "Definition freeze time must use canonical UTC milliseconds.", {
      path
    });
  }
  return value;
}

function normalizeDefinition(value) {
  const code = "SOURCE_CLUSTER_CONCENTRATION_DEFINITION_INVALID";
  exactFields(
    value,
    DEFINITION_FIELDS,
    [...DEFINITION_FIELDS],
    "$.definition",
    code
  );
  if (value.clusterLocationsSeenBeforeFreeze !== false) {
    fail(
      code,
      "The bottleneck definition must be frozen without cluster-location exposure."
    );
  }
  if (
    typeof value.concentratedAtOrAbove !== "number" ||
    !Number.isFinite(value.concentratedAtOrAbove) ||
    value.concentratedAtOrAbove <= 1 ||
    typeof value.depletedAtOrBelow !== "number" ||
    !Number.isFinite(value.depletedAtOrBelow) ||
    value.depletedAtOrBelow < 0 ||
    value.depletedAtOrBelow >= 1 ||
    value.depletedAtOrBelow >= value.concentratedAtOrAbove
  ) {
    fail(code, "Concentration interpretation thresholds must bracket one.");
  }
  return {
    version: normalizedString(
      value.version,
      "$.definition.version",
      code,
      SOURCE_CLUSTER_CONCENTRATION_LIMITS.maxIdentifierLength
    ),
    frozenAt: timestamp(value.frozenAt, "$.definition.frozenAt", code),
    statement: normalizedString(
      value.statement,
      "$.definition.statement",
      code,
      SOURCE_CLUSTER_CONCENTRATION_LIMITS.maxTextLength
    ),
    clusterLocationsSeenBeforeFreeze: false,
    exposureDeclaration: normalizedString(
      value.exposureDeclaration,
      "$.definition.exposureDeclaration",
      code,
      SOURCE_CLUSTER_CONCENTRATION_LIMITS.maxTextLength
    ),
    bottleneckArtifact: artifactRef(
      value.bottleneckArtifact,
      "$.definition.bottleneckArtifact",
      code
    ),
    concentratedAtOrAbove: value.concentratedAtOrAbove,
    depletedAtOrBelow: value.depletedAtOrBelow
  };
}

function normalizePoints(pointsInput, resolution) {
  const code = "SOURCE_CLUSTER_CONCENTRATION_POINTS_INVALID";
  if (
    !Array.isArray(pointsInput) ||
    pointsInput.length === 0 ||
    pointsInput.length > SOURCE_CLUSTER_CONCENTRATION_LIMITS.maxPoints
  ) {
    fail(code, "Cluster-concentration points must be a non-empty bounded array.");
  }
  const vertexById = new Map(
    resolution.vertices.map((entry) => [entry.vertexId, entry])
  );
  const points = pointsInput.map((entry, index) => {
    const path = `$.points[${index}]`;
    exactFields(entry, POINT_FIELDS, [...POINT_FIELDS], path, code);
    if (
      !Number.isSafeInteger(entry.depth) ||
      entry.depth < 0 ||
      entry.depth > SOURCE_CLUSTER_CONCENTRATION_LIMITS.maxDepth ||
      !isContentHash(entry.depthBasis) ||
      !Number.isSafeInteger(entry.stratificationVertices) ||
      entry.stratificationVertices < 1 ||
      entry.stratificationVertices > SOURCE_CLUSTER_CONCENTRATION_LIMITS.maxVertices ||
      typeof entry.bottleneck !== "boolean" ||
      !Array.isArray(entry.sourceVertexIds) ||
      entry.sourceVertexIds.length > SOURCE_CLUSTER_CONCENTRATION_LIMITS.maxVertices
    ) {
      fail(code, "A cluster-concentration point is malformed.", { path });
    }
    const sourceVertexIds = entry.sourceVertexIds.map((vertexId) => {
      if (!isContentHash(vertexId) || !vertexById.has(vertexId)) {
        fail(code, "A concentration point names no reviewed source vertex.", {
          path,
          vertexId
        });
      }
      return vertexId;
    }).sort(compareStrings);
    if (
      new Set(sourceVertexIds).size !== sourceVertexIds.length ||
      entry.stratificationVertices < sourceVertexIds.length
    ) {
      fail(
        code,
        "Source vertices must be unique and fit within the declared level population.",
        { path }
      );
    }
    return {
      depth: entry.depth,
      depthBasis: entry.depthBasis,
      stratificationVertices: entry.stratificationVertices,
      sourceVertexIds,
      bottleneck: entry.bottleneck
    };
  }).sort((left, right) =>
    left.depth - right.depth || compareStrings(left.depthBasis, right.depthBasis)
  );
  const depths = points.map((entry) => entry.depth);
  const assigned = points.flatMap((entry) => entry.sourceVertexIds);
  const expected = [...vertexById.keys()].sort(compareStrings);
  const missing = expected.filter((vertexId) => !assigned.includes(vertexId));
  if (
    new Set(depths).size !== depths.length ||
    new Set(assigned).size !== assigned.length ||
    assigned.length !== expected.length ||
    missing.length > 0
  ) {
    fail(
      code,
      "Every reviewed source vertex must map to exactly one unique depth point.",
      { missing, expected: expected.length, actual: assigned.length }
    );
  }
  return { points, vertexById };
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

/** Computes cluster concentration over independently frozen bottleneck points. */
export function createSourceClusterConcentration(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolutionInput,
  condensation,
  reconciliation,
  metricsInput,
  concentrationInput
) {
  const metrics = verifySourceMigrationMetrics(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    amendments,
    classifiedRelations,
    nodeResolutionPolicy,
    resolutionInput,
    condensation,
    reconciliation,
    metricsInput
  );
  const resolution = cloneInput(resolutionInput, "Source node resolution");
  const input = cloneInput(concentrationInput, "Source cluster concentration input");
  const code = "SOURCE_CLUSTER_CONCENTRATION_INVALID";
  exactFields(input, INPUT_FIELDS, [...INPUT_FIELDS], "$", code);
  if (input.schemaVersion !== "1" || input.metricsHash !== metrics.metricsHash) {
    fail(code, "Cluster concentration is not bound to verified migration metrics.");
  }
  const definition = normalizeDefinition(input.definition);
  const definitionHash = hashCanonical(
    HASH_DOMAINS.SOURCE_CLUSTER_CONCENTRATION_DEFINITION,
    { schemaVersion: "1", ...definition },
    CANONICAL_OPTIONS
  );
  const { points: normalizedPoints, vertexById } = normalizePoints(
    input.points,
    resolution
  );
  const points = normalizedPoints.map((point) => {
    const vertices = point.sourceVertexIds.map((vertexId) => vertexById.get(vertexId));
    const constitutive = vertices.filter((vertex) =>
      vertex.kind === "condensed-cluster" &&
      vertex.disposition === "constitutive-cluster"
    );
    const sourceRecords = vertices.reduce(
      (total, vertex) => total + vertex.members.length,
      0
    );
    const constitutiveMembers = constitutive.reduce(
      (total, vertex) => total + vertex.members.length,
      0
    );
    return {
      ...point,
      sourceRecords,
      constitutiveClusters: constitutive.length,
      constitutiveMembers,
      constitutiveClusterDensity:
        constitutive.length / point.stratificationVertices,
      constitutiveMemberShare: ratio(constitutiveMembers, sourceRecords)
    };
  });
  const pooled = points.reduce((result, point) => {
    const bucket = point.bottleneck ? result.bottleneck : result.other;
    bucket.sourceRecords += point.sourceRecords;
    bucket.constitutiveMembers += point.constitutiveMembers;
    return result;
  }, {
    bottleneck: { sourceRecords: 0, constitutiveMembers: 0 },
    other: { sourceRecords: 0, constitutiveMembers: 0 }
  });
  const bottleneckShare = ratio(
    pooled.bottleneck.constitutiveMembers,
    pooled.bottleneck.sourceRecords
  );
  const otherShare = ratio(
    pooled.other.constitutiveMembers,
    pooled.other.sourceRecords
  );
  const enrichmentRatio =
    bottleneckShare === null || otherShare === null || otherShare === 0
      ? null
      : bottleneckShare / otherShare;
  const interpretation = enrichmentRatio === null
    ? "indeterminate"
    : enrichmentRatio >= definition.concentratedAtOrAbove
      ? "concentrated"
      : enrichmentRatio <= definition.depletedAtOrBelow
        ? "depleted"
        : "uniform";
  const notes = enrichmentRatio === null
    ? ["enrichment-ratio-denominator-zero-or-population-missing"]
    : [];
  const basis = {
    schemaVersion: "1",
    builder: SOURCE_CLUSTER_CONCENTRATION_VERSION,
    metricsHash: metrics.metricsHash,
    resolutionHash: resolution.resolutionHash,
    definition,
    definitionHash,
    points,
    pooled: {
      bottleneck: {
        ...pooled.bottleneck,
        constitutiveMemberShare: bottleneckShare
      },
      other: {
        ...pooled.other,
        constitutiveMemberShare: otherShare
      }
    },
    enrichmentRatio,
    nullModel: { status: "not-run" },
    interpretation,
    notes
  };
  return deepFreeze({
    ...basis,
    concentrationHash: hashCanonical(
      HASH_DOMAINS.SOURCE_CLUSTER_CONCENTRATION,
      basis,
      CANONICAL_OPTIONS
    )
  });
}

/** Exactly replays a serialized source-cluster concentration artifact. */
export function verifySourceClusterConcentration(
  classificationPolicy,
  classificationView,
  annotations,
  adjudication,
  amendments,
  classifiedRelations,
  nodeResolutionPolicy,
  resolution,
  condensation,
  reconciliation,
  metrics,
  concentrationInput
) {
  const supplied = cloneInput(concentrationInput, "Source cluster concentration");
  const reproduced = createSourceClusterConcentration(
    classificationPolicy,
    classificationView,
    annotations,
    adjudication,
    amendments,
    classifiedRelations,
    nodeResolutionPolicy,
    resolution,
    condensation,
    reconciliation,
    metrics,
    {
      schemaVersion: supplied?.schemaVersion,
      metricsHash: supplied?.metricsHash,
      definition: supplied?.definition,
      points: Array.isArray(supplied?.points)
        ? supplied.points.map((entry) => ({
            depth: entry.depth,
            depthBasis: entry.depthBasis,
            stratificationVertices: entry.stratificationVertices,
            sourceVertexIds: entry.sourceVertexIds,
            bottleneck: entry.bottleneck
          }))
        : supplied?.points
    }
  );
  if (
    canonicalize(supplied, CANONICAL_OPTIONS) !==
    canonicalize(reproduced, CANONICAL_OPTIONS)
  ) {
    fail(
      "SOURCE_CLUSTER_CONCENTRATION_MISMATCH",
      "Source cluster concentration differs from deterministic replay.",
      {
        expected: reproduced.concentrationHash,
        actual: isObject(supplied) ? supplied.concentrationHash ?? null : null
      }
    );
  }
  return reproduced;
}
