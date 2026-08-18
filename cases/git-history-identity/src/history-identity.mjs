import { hashCanonical } from "@onto2d/kernel/canonical";

const ANCESTRY_DOMAIN = "onto2d:git-history-ancestry:v1";
const HISTORY_CLASS_DOMAIN = "onto2d:git-history-equivalence:v1";

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireIdentifier(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    throw new TypeError(`${label} must be a normalized identifier.`);
  }
  return value;
}

function exactKeys(value, expected, label) {
  requireRecord(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} fields must be exactly ${wanted.join(", ")}.`);
  }
}

export const IDENTITY_REGIMES = Object.freeze([
  Object.freeze({ id: "tree", label: "Tree identity", compares: "Native Git tree object ID" }),
  Object.freeze({ id: "commit", label: "Commit identity", compares: "Native Git commit object ID" }),
  Object.freeze({ id: "ancestry", label: "Ancestry identity", compares: "Exact parent closure and topology below the selected head" }),
  Object.freeze({ id: "history-class", label: "History equivalence", compares: "Final tree under tree-state-v1 equivalence" })
]);

function commitIndex(commits) {
  const index = new Map();
  for (const [position, value] of commits.entries()) {
    const commit = requireRecord(value, `commits[${position}]`);
    requireIdentifier(commit.fixtureId, `commits[${position}].fixtureId`);
    requireIdentifier(commit.oid, `commits[${position}].oid`);
    if (!Array.isArray(commit.parents)) throw new TypeError(`commits[${position}].parents must be an array.`);
    if (index.has(commit.fixtureId)) throw new TypeError(`Duplicate commit fixture ID ${commit.fixtureId}.`);
    index.set(commit.fixtureId, commit);
  }
  return index;
}

export function ancestryProjection(headFixtureId, commits) {
  requireIdentifier(headFixtureId, "headFixtureId");
  if (!Array.isArray(commits)) throw new TypeError("commits must be an array.");
  const index = commitIndex(commits);
  const head = index.get(headFixtureId);
  if (!head) throw new RangeError(`Unknown head commit ${headFixtureId}.`);
  const nodes = new Set();
  const edges = [];
  const queue = head.parents.map((parent) => ({ child: "$head", parent }));
  while (queue.length > 0) {
    const current = queue.shift();
    const parent = index.get(current.parent);
    if (!parent) throw new RangeError(`Commit ${current.child} has unknown parent ${current.parent}.`);
    edges.push({ from: current.child, to: parent.oid });
    if (nodes.has(parent.fixtureId)) continue;
    nodes.add(parent.fixtureId);
    for (const ancestor of parent.parents) queue.push({ child: parent.oid, parent: ancestor });
  }
  const projectedNodes = [...nodes].map((fixtureId) => index.get(fixtureId).oid).sort();
  const projectedEdges = edges.sort((left, right) =>
    left.from.localeCompare(right.from) || left.to.localeCompare(right.to)
  );
  const basis = { format: "onto2d-git-ancestry-projection", formatVersion: "1", nodes: projectedNodes, edges: projectedEdges };
  return Object.freeze({ ...basis, identity: hashCanonical(ANCESTRY_DOMAIN, basis) });
}

function identityValue(regime, commit, ancestry) {
  if (regime === "tree") return commit.tree;
  if (regime === "commit") return commit.oid;
  if (regime === "ancestry") return ancestry.identity;
  if (regime === "history-class") {
    return hashCanonical(HISTORY_CLASS_DOMAIN, {
      regime: "tree-state-v1",
      finalTree: commit.tree
    });
  }
  throw new RangeError(`Unknown identity regime ${regime}.`);
}

export function compareHistories(experimentInput, historiesInput, commitsInput) {
  exactKeys(experimentInput, ["id", "label", "left", "right", "claim"], "experiment");
  if (!Array.isArray(historiesInput) || !Array.isArray(commitsInput)) {
    throw new TypeError("histories and commits must be arrays.");
  }
  const histories = new Map(historiesInput.map((history, index) => {
    exactKeys(history, ["id", "label", "head"], `histories[${index}]`);
    return [history.id, history];
  }));
  const commits = commitIndex(commitsInput);
  const leftHistory = histories.get(experimentInput.left);
  const rightHistory = histories.get(experimentInput.right);
  if (!leftHistory || !rightHistory) throw new RangeError(`Experiment ${experimentInput.id} references an unknown history.`);
  const leftCommit = commits.get(leftHistory.head);
  const rightCommit = commits.get(rightHistory.head);
  if (!leftCommit || !rightCommit) throw new RangeError(`Experiment ${experimentInput.id} references an unknown head.`);
  const leftAncestry = ancestryProjection(leftHistory.head, commitsInput);
  const rightAncestry = ancestryProjection(rightHistory.head, commitsInput);
  const results = Object.fromEntries(IDENTITY_REGIMES.map((regime) => {
    const left = identityValue(regime.id, leftCommit, leftAncestry);
    const right = identityValue(regime.id, rightCommit, rightAncestry);
    return [regime.id, Object.freeze({ left, right, equal: left === right })];
  }));
  return Object.freeze({
    id: experimentInput.id,
    label: experimentInput.label,
    claim: experimentInput.claim,
    leftHistory: leftHistory.id,
    rightHistory: rightHistory.id,
    leftHead: leftCommit.fixtureId,
    rightHead: rightCommit.fixtureId,
    results: Object.freeze(results)
  });
}
