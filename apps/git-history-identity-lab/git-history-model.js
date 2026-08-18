const OID = /^[0-9a-f]{40}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const TREE_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const REGIME_IDS = Object.freeze(["tree", "commit", "ancestry", "history-class"]);
const MAXIMUMS = Object.freeze({ blobs: 64, trees: 64, commits: 128, histories: 32, comparisons: 32 });

function fail(message) {
  throw new Error(`Git History Identity artifact invalid: ${message}`);
}

function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function array(value, label, maximum) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) fail(`${label} must contain 1-${maximum} records`);
  return value;
}

function string(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function exactKeys(value, expected, label) {
  record(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} fields must be exactly ${wanted.join(", ")}`);
  }
}

function indexBy(records, label, idField = "fixtureId") {
  const index = new Map();
  records.forEach((entry, position) => {
    const id = string(entry[idField], `${label}[${position}].${idField}`);
    if (index.has(id)) fail(`${label} repeats ${id}`);
    index.set(id, entry);
  });
  return index;
}

function frozenClone(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) frozenClone(child);
    Object.freeze(value);
  }
  return value;
}

function historyClosure(head, commitIndex) {
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];
  const visit = (fixtureId) => {
    if (visited.has(fixtureId)) return;
    if (visiting.has(fixtureId)) fail(`commit ancestry contains a cycle at ${fixtureId}`);
    const commit = commitIndex.get(fixtureId);
    if (!commit) fail(`history references unknown commit ${fixtureId}`);
    visiting.add(fixtureId);
    for (const parent of commit.parents) visit(parent);
    visiting.delete(fixtureId);
    visited.add(fixtureId);
    ordered.push(fixtureId);
  };
  visit(head);
  return ordered;
}

function validateObjects(objects) {
  exactKeys(objects, ["blobs", "trees", "commits"], "objects");
  const blobs = array(objects.blobs, "objects.blobs", MAXIMUMS.blobs);
  const trees = array(objects.trees, "objects.trees", MAXIMUMS.trees);
  const commits = array(objects.commits, "objects.commits", MAXIMUMS.commits);
  const blobIndex = indexBy(blobs, "objects.blobs");
  const treeIndex = indexBy(trees, "objects.trees");
  const commitIndex = indexBy(commits, "objects.commits");
  const blobOids = new Set();
  for (const blob of blobs) {
    if (!OID.test(blob.oid) || blobOids.has(blob.oid)) fail(`invalid or duplicate blob OID ${blob.oid}`);
    if (!SHA256.test(blob.contentSha256)) fail(`blob ${blob.fixtureId} has an invalid content hash`);
    if (!Number.isInteger(blob.bytes) || new TextEncoder().encode(blob.contentUtf8).length !== blob.bytes) fail(`blob ${blob.fixtureId} byte length is inconsistent`);
    blobOids.add(blob.oid);
  }
  const treeOids = new Set();
  for (const tree of trees) {
    if (!OID.test(tree.oid) || treeOids.has(tree.oid) || !SHA256.test(tree.rawSha256)) fail(`tree ${tree.fixtureId} identity is invalid`);
    if (!Array.isArray(tree.entries) || tree.entries.length === 0) fail(`tree ${tree.fixtureId} has no entries`);
    const paths = new Set();
    for (const entry of tree.entries) {
      const blob = blobIndex.get(entry.blobFixtureId);
      if (!blob || blob.oid !== entry.oid) fail(`tree ${tree.fixtureId} has an unresolved blob entry`);
      if (entry.mode !== "100644" || typeof entry.path !== "string" || entry.path.length > 240 || !TREE_PATH.test(entry.path) || paths.has(entry.path)) fail(`tree ${tree.fixtureId} has an invalid entry`);
      paths.add(entry.path);
    }
    treeOids.add(tree.oid);
  }
  const seenCommits = new Set();
  const commitOids = new Set();
  for (const commit of commits) {
    if (!OID.test(commit.oid) || commitOids.has(commit.oid) || !SHA256.test(commit.rawSha256)) fail(`commit ${commit.fixtureId} identity is invalid`);
    const tree = treeIndex.get(commit.treeFixtureId);
    if (!tree || tree.oid !== commit.tree) fail(`commit ${commit.fixtureId} has an unresolved tree`);
    if (!Array.isArray(commit.parents) || !Array.isArray(commit.parentOids) || commit.parents.length !== commit.parentOids.length || commit.parents.length > 2) fail(`commit ${commit.fixtureId} parent fields are invalid`);
    commit.parents.forEach((parentId, index) => {
      const parent = commitIndex.get(parentId);
      if (!parent || !seenCommits.has(parentId) || parent.oid !== commit.parentOids[index]) fail(`commit ${commit.fixtureId} has an unresolved or out-of-order parent`);
    });
    if (!Number.isSafeInteger(commit.timestamp) || commit.timezone !== "+0000") fail(`commit ${commit.fixtureId} timestamp is invalid`);
    seenCommits.add(commit.fixtureId);
    commitOids.add(commit.oid);
  }
  return { blobIndex, treeIndex, commitIndex };
}

export function createGitHistoryModel(input) {
  const artifact = structuredClone(input);
  exactKeys(artifact, ["format", "formatVersion", "caseVersion", "generatedBy", "source", "git", "regimes", "objects", "histories", "comparisons", "caseIdentity"], "artifact");
  if (artifact.format !== "onto2d-git-history-identity-case" || artifact.formatVersion !== "1" || artifact.caseVersion !== "git-history-identity-v1") fail("unsupported format or case version");
  if (!SHA256.test(artifact.caseIdentity) || !SHA256.test(artifact.source?.sourceIdentity)) fail("case or source identity is invalid");
  if (artifact.git?.objectFormat !== "sha1" || artifact.git.objectIdentityVerifiedIndependently !== true) fail("Git object verification boundary is missing");
  const { treeIndex, commitIndex } = validateObjects(record(artifact.objects, "objects"));

  const regimes = array(artifact.regimes, "regimes", REGIME_IDS.length);
  if (regimes.length !== REGIME_IDS.length || regimes.some((regime, index) => regime.id !== REGIME_IDS[index])) fail("identity regimes are incomplete or reordered");
  const regimeIndex = indexBy(regimes, "regimes", "id");

  const histories = array(artifact.histories, "histories", MAXIMUMS.histories);
  const historyIndex = indexBy(histories, "histories", "id");
  for (const history of histories) {
    if (!SHA256.test(history.ancestryIdentity)) fail(`history ${history.id} ancestry identity is invalid`);
    const expected = historyClosure(history.head, commitIndex);
    if (!Array.isArray(history.commits) || history.commitCount !== expected.length || history.commits.length !== expected.length || history.commits.some((id, index) => id !== expected[index])) fail(`history ${history.id} closure is inconsistent`);
  }

  const comparisons = array(artifact.comparisons, "comparisons", MAXIMUMS.comparisons);
  const comparisonIndex = indexBy(comparisons, "comparisons", "id");
  for (const comparison of comparisons) {
    const leftHistory = historyIndex.get(comparison.leftHistory);
    const rightHistory = historyIndex.get(comparison.rightHistory);
    if (!leftHistory || !rightHistory || leftHistory.head !== comparison.leftHead || rightHistory.head !== comparison.rightHead) fail(`comparison ${comparison.id} history binding is invalid`);
    const leftCommit = commitIndex.get(comparison.leftHead);
    const rightCommit = commitIndex.get(comparison.rightHead);
    const expected = {
      tree: [leftCommit.tree, rightCommit.tree],
      commit: [leftCommit.oid, rightCommit.oid],
      ancestry: [leftHistory.ancestryIdentity, rightHistory.ancestryIdentity]
    };
    for (const regimeId of REGIME_IDS) {
      const result = comparison.results?.[regimeId];
      if (!result || result.equal !== (result.left === result.right)) fail(`comparison ${comparison.id}/${regimeId} equality is inconsistent`);
      if (expected[regimeId] && (result.left !== expected[regimeId][0] || result.right !== expected[regimeId][1])) fail(`comparison ${comparison.id}/${regimeId} identities are inconsistent`);
    }
    const historyClass = comparison.results["history-class"];
    if (!SHA256.test(historyClass.left) || !SHA256.test(historyClass.right) || historyClass.equal !== comparison.results.tree.equal) fail(`comparison ${comparison.id} history class is not bound to tree-state-v1`);
  }

  frozenClone(artifact);
  return Object.freeze({
    identity: artifact.caseIdentity,
    sourceIdentity: artifact.source.sourceIdentity,
    statistics: Object.freeze({
      blobCount: artifact.objects.blobs.length,
      treeCount: artifact.objects.trees.length,
      commitCount: artifact.objects.commits.length,
      historyCount: histories.length,
      comparisonCount: comparisons.length
    }),
    regimes,
    comparisons,
    histories,
    comparison(id) {
      const value = comparisonIndex.get(id);
      if (!value) throw new RangeError(`Unknown comparison ${id}.`);
      return value;
    },
    regime(id) {
      const value = regimeIndex.get(id);
      if (!value) throw new RangeError(`Unknown identity regime ${id}.`);
      return value;
    },
    history(id) {
      const value = historyIndex.get(id);
      if (!value) throw new RangeError(`Unknown history ${id}.`);
      return value;
    },
    commit(id) {
      const value = commitIndex.get(id);
      if (!value) throw new RangeError(`Unknown commit ${id}.`);
      return value;
    },
    tree(id) {
      const value = treeIndex.get(id);
      if (!value) throw new RangeError(`Unknown tree ${id}.`);
      return value;
    }
  });
}
