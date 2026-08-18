const MAX_REGISTRY_BYTES = 512 * 1024;
const HISTORY_REGISTRY_URL = new URL("../../cases/history-case-registry.json", import.meta.url);

export const HISTORY_MODES = Object.freeze([
  Object.freeze({ id: "recorded", label: "Recorded", description: "The past survives as an inspectable external record." }),
  Object.freeze({ id: "embodied", label: "Embodied", description: "The past survives in present physical, biological, or latent state." }),
  Object.freeze({ id: "reconstructed", label: "Reconstructed", description: "Candidate pasts are inferred from surviving evidence." })
]);

export const HISTORY_EFFECTS = Object.freeze([
  Object.freeze({ id: "identity", label: "Identity", description: "History changes classification, provenance, status, or equivalence." }),
  Object.freeze({ id: "present-state", label: "Present State", description: "History changes a measurable or latent state now." }),
  Object.freeze({ id: "future", label: "Future", description: "History changes transitions, risks, responses, or reachable outcomes." })
]);

const PRESENTATION = Object.freeze({
  "live-bootstrap-provenance": Object.freeze({
    question: "What extra construction history is required when opaque shortcuts are inadmissible?",
    distinction: "possible history != admissible history",
    summary: "A pinned live-bootstrap manifest is converted into a reproducible trace, evidence graph, bounded path space, and explicit Historical Load analysis without treating source order as causality.",
    flagship: "Compare the one-event opaque GCC shortcut with the shortest declared route that satisfies bootstrap ancestry for the first GCC 4.0.4 milestone.",
    contribution: "The bounded model yields 79 - 1 = +78 event units under one declared regime. This is a property of the disclosed Onto2D model, not a live-bootstrap score.",
    boundaries: ["Pinned upstream commit and exact hashes for every consumed file", "Upstream facts kept separate from deterministic derivations", "Counterfactual paths never enter extracted evidence", "Hardware, firmware, host preparation, mirrors, and runtime effects remain outside scope"],
    outputs: ["Deterministic 205-event trace and state history", "442-record evidence bundle and provenance graph", "Verified external Model Pack", "Focused Bootstrap Provenance Explorer"]
  }),
  "git-history-identity": Object.freeze({
    question: "Can the same current tree have different commit identity and ancestry?",
    distinction: "same tree != same commit != same ancestry",
    summary: "A deterministic local Git fixture gives a compact, reproducible demonstration that final state does not uniquely determine commit identity or construction history.",
    flagship: "Six exact histories and four controlled comparisons converge to one final tree while varying ancestry, intermediate length, merge topology, or head metadata.",
    contribution: "All four comparisons are equal by tree and declared history-class identity but different by commit identity; the controls show exactly which ancestry properties changed.",
    boundaries: ["Fixture repository created entirely by deterministic test code", "Native blob, tree, commit, parent, and ref identities preserved", "Git parentage remains a native relation rather than a generic causal edge", "No Historical Load until a finite counterfactual path space is declared"],
    outputs: ["Deterministic fixture builder", "Bounded Git object extraction", "Four explicit identity regimes", "Side-by-side History Identity Lab"]
  }),
  "nix-derivation-identity": Object.freeze({
    question: "Can equal output content retain distinct construction identities?",
    distinction: "what was produced != how it was produced",
    summary: "A bounded Nix 2.31.0 capture compares native derivation and output identities with deterministic input-closure, builder-environment, and output-relative history regimes.",
    flagship: "Two native fixed-output derivations resolve to the same verified content object while retaining different derivation paths, input closures, and builder environments.",
    contribution: "Equal output content is demonstrated without erasing construction identity; an unexecuted input-addressed control remains honestly unresolved.",
    boundaries: ["Exact Nix version, fixture sources, derivation records, and platform assumptions", "Native direct inputs separated from derived transitive closure", "Nix-native identities preserved before Onto2D mapping", "No claim of generality beyond the bounded fixture set"],
    outputs: ["Nine native derivations with raw ATerm and JSON cross-checks", "Direct and transitive-only dependency relations", "Verified nix-derivations Model Pack", "Five-regime Nix Derivation Identity Lab"]
  }),
  "oci-layer-history": Object.freeze({
    question: "Can different ordered layer histories produce the same flattened root filesystem?",
    distinction: "final rootfs != layer history",
    summary: "Tiny deterministic OCI layouts will make erased history visible by comparing native layer sequences with derived flattened filesystem states.",
    flagship: "Compare a history that adds and later deletes a file with a shorter history that reaches the same normalized final root filesystem.",
    contribution: "The case will test identity after flattening and a bounded Historical Load candidate under explicit operation and transfer costs.",
    boundaries: ["Local content-addressed OCI fixtures instead of mutable public tags", "Bounded evaluator for additions, replacements, whiteouts, and fixture directories", "Derived rootfs states kept separate from native OCI records", "Layer count never presented as a universal complexity metric"],
    outputs: ["Pinned OCI layouts and layer descriptors", "State-after-layer evaluator", "oci-layer-provenance Model Pack", "Timeline, rootfs, history-diff, and load Explorer"]
  }),
  "in-toto-admissibility": Object.freeze({
    question: "Can identical artifact bytes come from histories with different policy admissibility?",
    distinction: "same artifact != same admissibility",
    summary: "An offline supply-chain fixture will keep the declared layout, actual execution records, verification evidence, and Onto2D counterfactual paths visibly distinct.",
    flagship: "Produce byte-identical output through one policy-conforming execution and one execution that violates an explicit native rule.",
    contribution: "The case will test possible versus admissible history using source-traceable constraints and a bounded policy-conforming load comparison.",
    boundaries: ["Pinned offline layout, fixture keys, links, materials, products, and commands", "Every Onto2D constraint points to a native in-toto rule", "Missing links are never synthesized", "Counterfactual paths remain distinct from actual execution"],
    outputs: ["Valid and invalid replayable fixtures", "Native-policy constraint mapping", "in-toto-provenance Model Pack", "Declared-versus-actual supply-chain Explorer"]
  }),
  "reproducible-build-equivalence": Object.freeze({
    question: "When should different build histories count as equivalent?",
    distinction: "different history can still be equivalent under F",
    summary: "Multiple captured build executions will remain distinct historical records while being compared under byte, input, toolchain, environment, and provenance equivalence regimes.",
    flagship: "Run two independent builds that produce identical bytes, then show that the same pair can agree under one regime and differ under another.",
    contribution: "The case will prevent the false global rule that every historical difference must imply a different identity.",
    boundaries: ["Tiny fully pinned build fixture", "Machine-local incidental fields excluded unless a regime declares them relevant", "Normalization profiles explicit and versioned", "Equivalence kept separate from Historical Load"],
    outputs: ["Independent captured build histories", "Versioned equivalence artifacts", "Five comparison regimes", "Pairwise History Equivalence Lab"]
  }),
  "slsa-provenance-evidence": Object.freeze({
    question: "Can provenance, a claim about provenance, and evidence for that claim remain distinct?",
    distinction: "history != claim != evidence != verification",
    summary: "Frozen provenance fixtures will place artifact, claim, attestation, and verification records in separate epistemic layers.",
    flagship: "Show one provenance claim as verified, contradicted, or unresolved without mutating the underlying artifact or source records.",
    contribution: "The case will test evidence status without silently converting an attestation into ontological truth.",
    boundaries: ["Small local provenance and attestation fixtures", "Subject identity distinct from statement identity", "Attested never silently upgraded to verified", "Missing evidence yields unknown or unresolved"],
    outputs: ["Valid, contradictory, unverifiable, and partial fixtures", "Claim/evidence graph", "slsa-provenance Model Pack", "Provenance Evidence Lab"]
  }),
  "software-heritage-lineage": Object.freeze({
    question: "Can one content object retain many real historical contexts at bounded ecosystem scale?",
    distinction: "same content != same context != same ancestry",
    summary: "A frozen deterministic sample of archival objects will move the experiments from controlled fixtures to many-to-many real historical context.",
    flagship: "Find exact content objects that occur in multiple origins, directories, revisions, or ancestry depths inside a documented bounded sample.",
    contribution: "The case will test scale, multiplicity, deterministic traversal, and explicit incompleteness without claiming global archive coverage.",
    boundaries: ["A bounded frozen content-object sample", "Exact source identifiers, response hashes, and selection algorithm", "Native archive object distinctions preserved", "Absence from the sample never interpreted as global absence"],
    outputs: ["Content-addressed frozen sample", "Case-local lineage indexes", "Stable comparison cohorts", "Bounded Software Lineage Explorer"]
  }),
  "chemical-synthesis-history": Object.freeze({
    question: "Can one molecular target retain multiple synthesis-route identities?",
    distinction: "same target molecule != same synthesis history",
    summary: "Pinned Open Reaction Database records will separate molecular identity from ordered reaction routes, intermediates, conditions, workups, and evidence coverage.",
    flagship: "Compare at least two independently recorded, reviewable routes that converge on the same strictly normalized target compound.",
    contribution: "The first physical-domain construction case will test route equivalence and a defensible bounded Historical Load without inventing chemistry.",
    boundaries: ["Exact ORD snapshot and schema version", "Versioned stereochemistry-sensitive identity profile", "Recorded links separated from inferred route connections", "Missing yield or provenance remains missing"],
    outputs: ["Bounded reaction-record extraction", "Target and route identity regimes", "Synthesis route comparison Explorer", "Declared admissibility experiment"]
  }),
  "mineral-formation-history": Object.freeze({
    question: "Can one conventional mineral species retain different supported formation histories?",
    distinction: "mineral species != formation-history class",
    summary: "A reviewed mineral cohort will keep sample observations, conventional classification, formation interpretation, and evidence as independent layers.",
    flagship: "Show same-species samples with different published formation modes alongside at least one unresolved formation history.",
    contribution: "The case will test historical natural-kind profiles without replacing or duplicating conventional mineral identity.",
    boundaries: ["One bounded mineral family", "Formation claims require reviewed evidence", "Locality alone never proves formation mechanism", "Unknown and contested modes remain explicit"],
    outputs: ["Pinned sample and publication evidence", "Four identity regimes", "Formation-mode evidence graph", "Mineral History Explorer"]
  }),
  "ltee-evolutionary-contingency": Object.freeze({
    question: "Can historical genetic background change which future innovations are accessible?",
    distinction: "same current phenotype != same future accessibility",
    summary: "A bounded LTEE citrate case will connect frozen historical samples and evolutionary replay experiments without equating replay evidence with the original history.",
    flagship: "Compare replay outcomes from different historical Ara-3 generations under one published experimental profile.",
    contribution: "This is the flagship Embodied History -> Future test and the first explicit history-conditioned reachability case.",
    boundaries: ["One reviewed citrate-innovation question", "Replay experiments remain separate experimental objects", "Not observed never becomes impossible", "Published causal interpretation retains attribution and uncertainty"],
    outputs: ["Pinned LTEE evidence package", "Historical lineage and sample timeline", "Replay outcome comparison", "Evolutionary Contingency Lab"]
  }),
  "material-process-history": Object.freeze({
    question: "Can process history remain encoded in present material structure and properties?",
    distinction: "same nominal alloy != same material state",
    summary: "A controlled NIST AM-Bench cohort will connect exact process histories to measured microstructure, residual state, and properties through an evidence-aware model.",
    flagship: "Compare nominally similar specimens produced under different scan or heat-treatment histories.",
    contribution: "This is the flagship Embodied History -> Present State case, with a strict firewall between sequence, correlation, and causal interpretation.",
    boundaries: ["Exact AM-Bench release, DOI, files, hashes, and specimen IDs", "Measurement units, coordinates, uncertainty, and technique preserved", "Draft NIST schema version remains pinned", "Correlation cannot satisfy a causal relation"],
    outputs: ["Process and measurement graph", "Specimen and identity-regime comparison", "Evidence-aware property links", "Material Process History Lab"]
  }),
  "cell-lineage-identity": Object.freeze({
    question: "Can similar current cell states retain different developmental lineages?",
    distinction: "current cell state != reconstructed lineage",
    summary: "A bounded scGESTALT cohort will link transcriptomic state, observed CRISPR barcode evidence, and reconstructed lineage without conflating them.",
    flagship: "Find a reviewed same-cell-type/different-lineage comparison and expose the barcode evidence and reconstruction limits.",
    contribution: "The case will test identity under partially embodied and reconstructed ancestry.",
    boundaries: ["Pinned public scGESTALT files and sample identities", "Large matrices remain verified external artifacts", "Barcode observation is distinct from inferred lineage", "Missing support never becomes an invented confidence value"],
    outputs: ["Bounded cell-state projection", "Barcode evidence model", "Linked state and lineage views", "Reconstruction-status inspector"]
  }),
  "lithic-operational-history": Object.freeze({
    question: "How much operational history can be reconstructed from present artefact traces?",
    distinction: "present refit evidence != one declared actual past",
    summary: "The ReViBE replication dataset will test inversion from physical artefacts and refit evidence to one or more supported reduction sequences.",
    flagship: "Ablate one evidence class and observe whether the set of surviving candidate histories becomes less constrained.",
    contribution: "The case will establish reconstruction analysis without forcing incomplete evidence into a single exact chronology.",
    boundaries: ["Exact DOI, artefact IDs, models, photographs, and tables", "Physical refit remains distinct from temporal interpretation", "Alternatives are labelled Onto2D constructions", "Unresolved order remains unresolved"],
    outputs: ["Verified 3D artifact references", "Refit and evidence graph", "Candidate-history analysis", "Lithic Operational History Explorer"]
  }),
  "artwork-provenance": Object.freeze({
    question: "Can one physical artwork retain different provenance and relational status?",
    distinction: "same artwork != same provenance status",
    summary: "A small pinned Getty Provenance Index cohort will model actors, places, events, source records, gaps, and alternative chains around stable artwork identity.",
    flagship: "Show one artwork across known provenance events with an unresolved interval preserved as a first-class gap.",
    contribution: "This is the flagship Recorded History -> Relational Identity case and a bridge from construction provenance to social provenance.",
    boundaries: ["Exact JSON-LD queries, responses, hashes, and mappings", "Object identity remains distinct from source-record identity", "Co-occurrence cannot become ownership", "Provenance status cannot become legal title"],
    outputs: ["Pinned Getty cohort", "Provenance event projection", "Gap and alternative-chain representation", "Artwork Provenance Identity Lab"]
  }),
  "manuscript-stemmatics": Object.freeze({
    question: "Can textual ancestry remain non-tree-shaped and evidence-dependent?",
    distinction: "textual similarity != copy ancestry",
    summary: "A bounded manuscript tradition will separate readings and similarity from attributed stemmatic reconstruction and multiple-parent transmission.",
    flagship: "Represent supported contamination or multiple-exemplar transmission without forcing the history into a tree.",
    contribution: "This is the flagship test for non-tree historical parentage and evidence-sensitive reconstruction.",
    boundaries: ["Machine-readable collation and published analysis", "Similarity metrics remain analysis artifacts", "Editorial stemmata are not direct observations", "Alternative histories may coexist"],
    outputs: ["Pinned witness and variant corpus", "Similarity and reconstruction layers", "Evidence-ablation experiment", "Textual Transmission Lab"]
  }),
  "operational-aging": Object.freeze({
    question: "Can similar sensor snapshots conceal different degradation histories and remaining lifetimes?",
    distinction: "similar observation != same damage state != same future lifetime",
    summary: "NASA C-MAPSS FD001 trajectories will separate current observation frames, recorded operational history, derived degradation features, and provided RUL.",
    flagship: "Find declared-near sensor frames associated with meaningfully different remaining lifetimes and compare their preceding windows.",
    contribution: "The case gives a controlled Embodied History -> Present State + Future benchmark without pretending latent health is directly observed.",
    boundaries: ["Pinned FD001 files and documentation", "Future cycles and test targets cannot leak into inputs", "Predicted RUL remains distinct from provided RUL", "Sensor similarity never becomes exact state identity"],
    outputs: ["Deterministic engine trajectories", "Observation and history-window projections", "Similar-snapshot comparison", "Operational Aging Lab"]
  }),
  "ecological-memory": Object.freeze({
    question: "Can similar ecological snapshots retain different disturbance histories and later responses?",
    distinction: "similar ecosystem snapshot != same disturbance history",
    summary: "Pinned NEON event and measurement products will connect recorded disturbance context to bounded state projections and recovery trajectories.",
    flagship: "Compare plot observations around one recorded disturbance, then test similar projected states with different preceding histories.",
    contribution: "The case will test ecological hysteresis while keeping observational association distinct from causal proof.",
    boundaries: ["Matching pinned NEON releases and product IDs", "Native observations retained before projection", "Event absence cannot become no disturbance", "Protocols, gaps, and quality flags stay explicit"],
    outputs: ["Site and disturbance timeline", "Versioned state projection", "Recovery-trajectory comparison", "Ecological Memory Lab"]
  }),
  "historical-linguistics": Object.freeze({
    question: "Can vertical inheritance and horizontal borrowing coexist without conflation?",
    distinction: "lexical similarity != genealogical ancestry",
    summary: "Pinned Glottolog, Lexibank, and WOLD records will place genealogical classification and expert-curated borrowing in one evidence-aware model.",
    flagship: "Overlay a reviewed borrowing edge across a small family tree so the historical graph visibly ceases to be a pure tree.",
    contribution: "The case will test ancestry plus horizontal transfer at language and lexical-system scale.",
    boundaries: ["Stable Glottocodes and pinned dataset releases", "Borrowing never becomes genealogical parentage", "Surface similarity never creates cognacy", "Unmatched mappings and contested classifications remain unresolved"],
    outputs: ["Bounded multilingual cohort", "Genealogical and borrowing layers", "History-equivalence regimes", "Language Lineage and Borrowing Lab"]
  }),
  "legal-precedent-history": Object.freeze({
    question: "How can recorded decisions constrain future legal context without turning citation into authority?",
    distinction: "cites != depends on != binding precedent",
    summary: "A bounded CourtListener cohort will represent opinions, citation history, availability at decision time, and separately attributed normative claims.",
    flagship: "Display the exact precedent context available at one decision time while excluding every later opinion.",
    contribution: "This is the normative Recorded History -> Future case; it models legal records and never supplies legal advice.",
    boundaries: ["One small jurisdictional and doctrinal cohort", "Citation count cannot create binding status", "Normative relations require explicit external evidence", "Counterfactual graph removal cannot rewrite source history"],
    outputs: ["Pinned opinion and citation records", "Available-at-time projection", "Citation versus normative-status view", "Legal Precedent History Lab"]
  }),
  "clinical-trajectories": Object.freeze({
    question: "What does longitudinal context add beyond a bounded clinical snapshot?",
    distinction: "bounded observation frame != complete patient state",
    summary: "A small open MIMIC-IV Demo cohort will expose exact deidentified events, bounded current frames, and prior recorded context without clinical prediction.",
    flagship: "Place one explicit observation frame beside its 24-hour, encounter, and available longitudinal history windows.",
    contribution: "The case will test longitudinal personal state while remaining descriptive, non-prescriptive, and strict about missingness.",
    boundaries: ["Open deidentified demo data only", "No diagnosis, treatment recommendation, or individual risk claim", "Future events cannot leak into current frames", "Codes, orders, administrations, and confirmed clinical facts remain distinct"],
    outputs: ["Pinned demo cohort", "Source-traceable patient timeline", "Bounded frame and lookback views", "Clinical Trajectory Lab"]
  }),
  "galactic-archaeology": Object.freeze({
    question: "How can present stellar traces support candidate Galactic histories without collapsing model layers?",
    distinction: "observed != derived != classified != historically interpreted",
    summary: "A frozen Gaia DR3 sample will preserve the full chain from measurement through parameter derivation and population assignment to published historical interpretation.",
    flagship: "Replay one bounded published-style cohort selection and show how quality-filter changes affect the supported interpretation.",
    contribution: "This is the extreme-scale reconstruction case and a stress test for long, uncertain epistemic chains.",
    boundaries: ["Exact ADQL query, release, result table, hash, and quality filters", "Measurement uncertainty is retained", "Population labels never become direct observations", "Chemical similarity never becomes common origin automatically"],
    outputs: ["Frozen Gaia cohort", "Observation and derived-parameter layers", "Quality-ablation analysis", "Galactic Archaeology Lab"]
  })
});

const MATURITY_LEVELS = Object.freeze([
  "DISCOVERED", "PLANNED", "SOURCE_PINNED", "EXTRACTABLE", "REPRODUCIBLE",
  "MODEL_PACK", "EXPLORER", "ANALYSIS_READY", "REVIEWED"
]);
const maturityRank = new Map(MATURITY_LEVELS.map((status, index) => [status, index]));
const HISTORY_MODE_IDS = Object.freeze(HISTORY_MODES.map(({ id }) => id));
const HISTORY_EFFECT_IDS = Object.freeze(HISTORY_EFFECTS.map(({ id }) => id));
const EVIDENCE_PROFILES = Object.freeze([
  "direct-record", "direct-measurement", "experimental-observation", "sample-identity",
  "attested", "cryptographically-verified", "published-interpretation", "derived",
  "reconstructed", "inferred", "counterfactual", "unknown", "contested"
]);
const ANALYSIS_LEVELS = Object.freeze([
  "primary", "secondary", "candidate", "relevant", "possible", "descriptive-only", "not-primary"
]);
const REGISTRY_FIELDS = Object.freeze([
  "schemaVersion", "taxonomyVersion", "historyModes", "effects", "maturityLevels", "cases"
]);
const CASE_FIELDS = Object.freeze([
  "caseId", "portfolioOrder", "title", "shortTitle", "domain", "domainLabel", "status", "priority",
  "primaryHistoryMode", "historyModes", "primaryEffects", "secondaryEffects", "evidenceProfile", "analyses",
  "modelId", "modelPackPath", "explorerId", "explorerPath", "casePagePath", "implementationDoc",
  "matrixPlacements"
]);
const ANALYSIS_FIELDS = Object.freeze(["historicalLoad", "historyEquivalence", "reachability", "reconstruction"]);
const PLACEMENT_FIELDS = Object.freeze(["mode", "effect", "role"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMPLEMENTATION_DOC_PATTERN = /^docs\/cases\/[A-Z0-9_]+_IMPLEMENTATION\.md$/;

function registryFailure(message) {
  throw new Error(`History case registry is invalid: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireExactFields(value, expected, label) {
  if (!isRecord(value)) registryFailure(`${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((field, index) => field !== required[index])) {
    registryFailure(`${label} fields must be exactly ${required.join(", ")}.`);
  }
}

function requireString(value, label, minimumLength, pattern = null) {
  if (typeof value !== "string" || value.length < minimumLength || (pattern && !pattern.test(value))) {
    registryFailure(`${label} is invalid.`);
  }
  return value;
}

function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) registryFailure(`${label} is invalid.`);
  return value;
}

function requireStringArray(value, allowed, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    registryFailure(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array.`);
  }
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !allowed.includes(item) || seen.has(item)) {
      registryFailure(`${label} contains an invalid or duplicate value.`);
    }
    seen.add(item);
  }
  return value;
}

function requireNullableId(value, label) {
  if (value !== null) requireString(value, label, 1, ID_PATTERN);
}

function requireRepositoryDirectory(value, label, prefix) {
  if (value === null) return;
  requireString(value, label, 1);
  const segments = value.split("/");
  if (segments.at(-1) !== "" || segments[0] !== prefix || segments.length < 3
    || segments.slice(1, -1).some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === "." || segment === "..")) {
    registryFailure(`${label} is not a safe ${prefix} directory.`);
  }
}

function sameValues(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function freezeEntry(entry) {
  Object.freeze(entry.historyModes);
  Object.freeze(entry.primaryEffects);
  Object.freeze(entry.secondaryEffects);
  for (const placement of entry.matrixPlacements) Object.freeze(placement);
  Object.freeze(entry.matrixPlacements);
  Object.freeze(entry.evidenceProfile);
  Object.freeze(entry.boundaries);
  Object.freeze(entry.outputs);
  Object.freeze(entry.analyses);
  return Object.freeze(entry);
}

export function statusPresentation(entry) {
  if (entry.status === "PLANNED" && entry.priority === "next") {
    return Object.freeze({ kind: "next", label: "Next" });
  }
  const rank = maturityRank.get(entry.status);
  if (rank >= maturityRank.get("REPRODUCIBLE")) {
    return Object.freeze({ kind: "implemented", label: entry.status.replaceAll("_", " ") });
  }
  return Object.freeze({
    kind: entry.status === "PLANNED" ? "planned" : "progress",
    label: entry.status.replaceAll("_", " ")
  });
}

export function validateHistoryRegistry(registry) {
  requireExactFields(registry, REGISTRY_FIELDS, "registry");
  if (registry.schemaVersion !== "1.0.0") registryFailure("schemaVersion is unsupported.");
  requireString(registry.taxonomyVersion, "taxonomyVersion", 1, /^\d{4}-\d{2}-\d{2}$/);
  if (!sameValues(registry.historyModes, HISTORY_MODE_IDS)) registryFailure("historyModes do not match the browser taxonomy.");
  if (!sameValues(registry.effects, HISTORY_EFFECT_IDS)) registryFailure("effects do not match the browser taxonomy.");
  if (!sameValues(registry.maturityLevels, MATURITY_LEVELS)) registryFailure("maturityLevels do not match the browser contract.");
  if (!Array.isArray(registry.cases) || registry.cases.length === 0) registryFailure("cases must be a non-empty array.");

  const ids = new Set();
  const portfolioOrders = new Set();
  const pagePaths = new Set();
  for (const entry of registry.cases) {
    requireExactFields(entry, CASE_FIELDS, "case");
    requireString(entry.caseId, "case.caseId", 1, ID_PATTERN);
    if (ids.has(entry.caseId)) registryFailure(`duplicate caseId ${entry.caseId}.`);
    ids.add(entry.caseId);
    if (!PRESENTATION[entry.caseId]) registryFailure(`missing presentation for ${entry.caseId}.`);

    if (!Number.isInteger(entry.portfolioOrder) || entry.portfolioOrder < 0 || portfolioOrders.has(entry.portfolioOrder)) {
      registryFailure(`${entry.caseId}.portfolioOrder is invalid or duplicated.`);
    }
    portfolioOrders.add(entry.portfolioOrder);
    requireString(entry.title, `${entry.caseId}.title`, 3);
    requireString(entry.shortTitle, `${entry.caseId}.shortTitle`, 2);
    requireString(entry.domain, `${entry.caseId}.domain`, 1, ID_PATTERN);
    requireString(entry.domainLabel, `${entry.caseId}.domainLabel`, 2);
    requireEnum(entry.status, MATURITY_LEVELS, `${entry.caseId}.status`);
    requireString(entry.priority, `${entry.caseId}.priority`, 1, ID_PATTERN);
    requireEnum(entry.primaryHistoryMode, HISTORY_MODE_IDS, `${entry.caseId}.primaryHistoryMode`);
    requireStringArray(entry.historyModes, HISTORY_MODE_IDS, `${entry.caseId}.historyModes`);
    requireStringArray(entry.primaryEffects, HISTORY_EFFECT_IDS, `${entry.caseId}.primaryEffects`);
    requireStringArray(entry.secondaryEffects, HISTORY_EFFECT_IDS, `${entry.caseId}.secondaryEffects`, true);
    requireStringArray(entry.evidenceProfile, EVIDENCE_PROFILES, `${entry.caseId}.evidenceProfile`);
    if (!entry.historyModes.includes(entry.primaryHistoryMode)) {
      registryFailure(`${entry.caseId}.primaryHistoryMode is absent from historyModes.`);
    }
    if (entry.primaryEffects.some((effect) => entry.secondaryEffects.includes(effect))) {
      registryFailure(`${entry.caseId} repeats an effect across primaryEffects and secondaryEffects.`);
    }

    requireExactFields(entry.analyses, ANALYSIS_FIELDS, `${entry.caseId}.analyses`);
    for (const field of ANALYSIS_FIELDS) requireEnum(entry.analyses[field], ANALYSIS_LEVELS, `${entry.caseId}.analyses.${field}`);
    requireNullableId(entry.modelId, `${entry.caseId}.modelId`);
    requireNullableId(entry.explorerId, `${entry.caseId}.explorerId`);
    requireRepositoryDirectory(entry.modelPackPath, `${entry.caseId}.modelPackPath`, "models");
    requireRepositoryDirectory(entry.explorerPath, `${entry.caseId}.explorerPath`, "apps");
    if (entry.modelPackPath !== null && entry.modelId === null) registryFailure(`${entry.caseId} has modelPackPath without modelId.`);
    if (entry.explorerPath !== null && entry.explorerId === null) registryFailure(`${entry.caseId} has explorerPath without explorerId.`);
    if (entry.status === "MODEL_PACK" && entry.modelPackPath === null) {
      registryFailure(`${entry.caseId} claims MODEL_PACK without modelPackPath.`);
    }
    if (maturityRank.get(entry.status) >= maturityRank.get("EXPLORER") && entry.explorerPath === null) {
      registryFailure(`${entry.caseId} claims ${entry.status} without explorerPath.`);
    }

    const expectedPagePath = `apps/external-cases/${entry.caseId}/`;
    if (entry.casePagePath !== expectedPagePath || pagePaths.has(entry.casePagePath)) {
      registryFailure(`${entry.caseId}.casePagePath is unsafe, duplicated, or not bound to its caseId.`);
    }
    pagePaths.add(entry.casePagePath);
    requireString(entry.implementationDoc, `${entry.caseId}.implementationDoc`, 1, IMPLEMENTATION_DOC_PATTERN);

    if (!Array.isArray(entry.matrixPlacements) || entry.matrixPlacements.length === 0) {
      registryFailure(`${entry.caseId}.matrixPlacements must be a non-empty array.`);
    }
    const placementKeys = new Set();
    const declaredEffects = [...entry.primaryEffects, ...entry.secondaryEffects];
    for (const placement of entry.matrixPlacements) {
      requireExactFields(placement, PLACEMENT_FIELDS, `${entry.caseId}.matrixPlacements entry`);
      requireEnum(placement.mode, HISTORY_MODE_IDS, `${entry.caseId}.matrixPlacements.mode`);
      requireEnum(placement.effect, HISTORY_EFFECT_IDS, `${entry.caseId}.matrixPlacements.effect`);
      requireEnum(placement.role, ["primary", "secondary"], `${entry.caseId}.matrixPlacements.role`);
      const key = `${placement.mode}/${placement.effect}`;
      if (placementKeys.has(key)) registryFailure(`${entry.caseId} repeats matrix placement ${key}.`);
      placementKeys.add(key);
      if (!entry.historyModes.includes(placement.mode) || !declaredEffects.includes(placement.effect)) {
        registryFailure(`${entry.caseId} has a matrix placement outside its declared taxonomy.`);
      }
      if (placement.role === "primary"
        && (placement.mode !== entry.primaryHistoryMode || !entry.primaryEffects.includes(placement.effect))) {
        registryFailure(`${entry.caseId} has a primary matrix placement outside its primary mode or effects.`);
      }
    }
    for (const effect of entry.primaryEffects) {
      if (!entry.matrixPlacements.some((placement) => placement.role === "primary"
        && placement.mode === entry.primaryHistoryMode && placement.effect === effect)) {
        registryFailure(`${entry.caseId} is missing its primary matrix placement for ${effect}.`);
      }
    }
    for (const mode of entry.historyModes) {
      if (!entry.matrixPlacements.some((placement) => placement.mode === mode)) {
        registryFailure(`${entry.caseId} has no matrix placement for declared mode ${mode}.`);
      }
    }
  }

  const expectedOrders = Array.from({ length: registry.cases.length }, (_, index) => index);
  if (!sameValues([...portfolioOrders].sort((left, right) => left - right), expectedOrders)) {
    registryFailure("portfolioOrder values must be contiguous from zero.");
  }
  const presentationIds = Object.keys(PRESENTATION);
  if (presentationIds.length !== ids.size || presentationIds.some((caseId) => !ids.has(caseId))) {
    registryFailure("case presentation and registry identities differ.");
  }
  return registry;
}

export function createHistoryCases(registry) {
  validateHistoryRegistry(registry);
  return Object.freeze([...registry.cases]
    .sort((left, right) => left.portfolioOrder - right.portfolioOrder)
    .map((entry) => {
      const presentation = PRESENTATION[entry.caseId];
      const status = statusPresentation(entry);
      return freezeEntry({ ...entry, ...presentation, statusKind: status.kind, statusLabel: status.label });
    }));
}

export function historyCaseById(cases, caseId) {
  return cases.find((entry) => entry.caseId === caseId) ?? null;
}

export async function loadHistoryRegistry(fetchImpl = fetch) {
  const response = await fetchImpl(HISTORY_REGISTRY_URL, {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error"
  });
  if (!response.ok) throw new Error(`History registry request failed (${response.status}).`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REGISTRY_BYTES) {
    throw new Error("History registry exceeds the browser size limit.");
  }
  const source = await response.text();
  if (new TextEncoder().encode(source).byteLength > MAX_REGISTRY_BYTES) {
    throw new Error("History registry exceeds the browser size limit.");
  }
  return validateHistoryRegistry(JSON.parse(source));
}

export function historyModeLabel(mode) {
  return HISTORY_MODES.find((entry) => entry.id === mode)?.label ?? mode;
}

export function historyEffectLabel(effect) {
  return HISTORY_EFFECTS.find((entry) => entry.id === effect)?.label ?? effect;
}
