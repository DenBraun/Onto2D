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
    summary: "Four deterministic OCI v1.1.1 manifests preserve distinct native descriptor sequences while the bounded whiteout-aware evaluator reproduces one normalized final rootfs.",
    flagship: "History A adds and later deletes /a.txt; History B never contains it. Both finish with exactly /b.txt and /c.txt under the declared rootfs identity profile.",
    contribution: "The case proves flattened equivalence without collapsing ancestry and resolves Historical Load as +3 layers, +2 operations, +12 changed bytes, or +4608 transferred bytes under four explicit costs.",
    boundaries: ["Local content-addressed OCI fixtures instead of mutable public tags", "Bounded evaluator for regular files and OCI whiteouts, not a container runtime", "Derived rootfs states kept separate from native index, manifest, config, and layer records", "Historical Load applies only to four declared histories and never becomes a universal OCI score"],
    outputs: ["Four verified OCI manifests and exact content-addressed blobs", "State-after-layer replay with hidden deletion evidence", "Verified oci-layer-provenance Model Pack", "Timeline, rootfs, identity-regime, hidden-history, and Historical Load Explorer"]
  }),
  "in-toto-admissibility": Object.freeze({
    question: "Can identical artifact bytes come from histories with different policy admissibility?",
    distinction: "same artifact != same admissibility",
    summary: "Five deterministic, signed in-toto v1.0 execution fixtures keep the declared layout, actual link records, native verification results, an optional Onto2D command policy, and counterfactual routes visibly distinct.",
    flagship: "The valid and shortcut executions end in the same SHA-256 artifact bytes; the shortcut is rejected because the required build link and product-to-material continuity are absent.",
    contribution: "The bounded model resolves Historical Load as +1 construction step, distinct actor, signed link, or material transition between the cheapest possible and cheapest natively admissible routes.",
    boundaries: ["Pinned offline layout, non-secret fixture keys, signed links, materials, products, and exact target bytes", "Native artifact rules retain exact source pointers; the strict command rule is labeled as an Onto2D addition", "Missing links and failed verifier checks are never synthesized or downgraded to unknown", "Counterfactual routes remain distinct from five actual fixture executions"],
    outputs: ["Five reproducible Ed25519-signed execution fixtures", "Native and optional-policy verification records", "Verified in-toto-provenance Model Pack", "Declared, actual, verification, counterfactual, and Historical Load Explorer"]
  }),
  "reproducible-build-equivalence": Object.freeze({
    question: "When should different build histories count as equivalent?",
    distinction: "different history can still be equivalent under F",
    summary: "Four source-locked execution records compare exact output bytes, declared inputs, Node.js toolchains, normalized environment, and provenance without collapsing the underlying histories.",
    flagship: "Independent Node.js 24.19.0 and 22.23.2 executions produce the same 205-byte artifact while remaining toolchain- and provenance-distinct.",
    contribution: "The case demonstrates H1 ~F H2 directly: equality is local to one declared regime, while excluded ambient variation and a relevant input mutation act as controls.",
    boundaries: ["Two exact fixture source files, exact builder bytes, fixed SOURCE_DATE_EPOCH, and four captured execution records", "ONTO2D_SESSION_LABEL is recorded but explicitly excluded from normalized environment identity", "Cross-machine and non-Darwin reproducibility remain untested", "Historical Load is undefined because no route cost or admissibility problem is declared"],
    outputs: ["Four independently captured build histories", "Three-pair by five-regime equivalence matrix", "Verified reproducible-build-equivalence Model Pack", "Pairwise History Equivalence Lab"]
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
    summary: "Two source-locked ORD v0.1.0 cohorts keep exact product identifiers, reaction records, condition profiles, native cross-reaction continuity, and Onto2D analysis in separate evidence layers.",
    flagship: "Across five complete product groups, compare deterministic minimum- and maximum-yield records that share one exact source product SMILES while retaining different reaction IDs and route profiles.",
    contribution: "The first chemistry case proves that target-identifier equality does not erase synthesis history and resolves a bounded +2 Historical Load for the cross-referenced islatravir cascade.",
    boundaries: ["Exact ORD v0.1.0 tag, commit, schema tag, dataset IDs, LFS hashes, record hashes, and DOI provenance", "Byte-exact source SMILES with no silent structure normalization", "Physical material continuity only from native ORD reaction_id references", "Counterfactual shortcuts make no chemical-feasibility, yield, safety, or cost claim"],
    outputs: ["Thirteen selected native ORD reaction projections", "Five same-target/different-route experiments", "Verified chemical-reaction-provenance Model Pack", "Route comparison, continuity, counterfactual, and Historical Load Explorer"]
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
    question: "Can one exact artwork record support different history views without filling its evidence gaps?",
    distinction: "same artwork record != same history projection != complete provenance",
    summary: "Eight exact Getty Linked.Art entity responses and one exact SPARQL snapshot preserve four artwork records, two activities, two stock-book records, current context, and a known missing interval in separate evidence layers.",
    flagship: "Follow A1983 through a day-bounded purchase and month-bounded sale, then stop at an explicit unknown interval before its frozen current-owner context.",
    contribution: "The flagship Recorded History -> Identity case demonstrates regime-relative equality while preventing source acquisition and current-owner relations from becoming legal-title findings.",
    boundaries: ["Exact Getty entity responses, SPARQL query/response, byte counts, hashes, retrieval time, and CC0 source metadata", "Exact HumanMadeObject URI identity remains distinct from labels and source-record identity", "Co-occurrence and referred-to-by relations cannot become ownership", "Current owner and transferred-title source relations cannot become an Onto2D legal-title, authenticity, or restitution finding"],
    outputs: ["Four-object source-locked Getty cohort", "Two native activities and two hashed stock-book transcriptions", "Verified artwork-provenance Model Pack", "Artwork Provenance Identity Lab with explicit gap and five equivalence regimes"]
  }),
  "manuscript-stemmatics": Object.freeze({
    question: "Can textual ancestry remain non-tree-shaped and evidence-dependent?",
    distinction: "textual similarity != copy ancestry",
    summary: "A source-locked Miller's Tale projection separates seven witness records and two source-discussed readings from Robinson's attributed copying and multiple-exemplar reconstruction.",
    flagship: "Cx2 retains both a base-text relation to Cx1 and a non-tree-compatible correction source from an unresolved better copy, while Pn and Wy remain attributed descendants of Cx2.",
    contribution: "The flagship non-tree parentage case makes evidence sensitivity operational: removing the published correction claim withholds both inputs into Cx2, while removing only the 207-reading profile downgrades the correction relation to attributed-only.",
    boundaries: ["Exact New Stemmatics index, MI.nex, and published-analysis hashes plus compact source projections", "Two selected readings are disclosed as non-representative and cannot create ancestry", "Every transmission edge remains attributed to published analysis rather than direct observation", "The better copy, central rooting, exact missing rates, and Historical Load remain unresolved or undefined"],
    outputs: ["Fifty-eight-witness corpus census with a seven-witness bounded projection", "Four attributed transmission relations including one explicit contamination edge", "Four evidence-ablation runs and a three-pair by four-regime equivalence matrix", "Verified manuscript-transmission Model Pack and Textual Transmission Lab"]
  }),
  "operational-aging": Object.freeze({
    question: "Can similar sensor snapshots conceal different degradation histories and remaining lifetimes?",
    distinction: "similar observation != same damage state != same future lifetime",
    summary: "A source-locked NASA C-MAPSS FD001 analysis separates 100 current test endpoints, two complete observed prefixes, training-normalized distance profiles, and the separately supplied RUL outcomes.",
    flagship: "Test units 25 and 72 rank 78th of 4,950 pairs by their final settings-and-sensors frame, yet their provided RUL values are 145 and 50 cycles; history-window ranks move to 1,439 and 1,072.",
    contribution: "The case makes a snapshot-versus-history result operational without exposing latent health or claiming prediction: current-frame nearness, observed history, supplied outcome, and unknown simulator state remain separate.",
    boundaries: ["Exact NASA archive and five consumed-member hashes plus deterministic FD001 projections", "Unit ID, cycle, observed-history length, future rows, and provided RUL cannot enter current-frame distance", "The flagship is outcome-aware and selection-biased, not a predictor evaluation", "Declared nearness never becomes exact state identity; latent health and Historical Load remain unobserved or undefined"],
    outputs: ["One-hundred-endpoint source-locked cohort and two complete observed prefixes", "Five exact distance profiles over all 4,950 unordered test-endpoint pairs", "Verified operational-aging Model Pack with observation, history, outcome, and boundary layers", "Operational Aging Lab with trajectory, rank, context-control, and outcome views"]
  }),
  "ecological-memory": Object.freeze({
    question: "Can one cell look the same under a bounded ecological projection while its recorded context and exact measurements differ?",
    distinction: "same rounded projection != same measurement != same ecosystem or history",
    summary: "Exact public NEON SOAP tutorial files yield a 7,275-cell comparison of four projected vegetation-height quantiles before and after recorded 2020 Creek Fire context.",
    flagship: "Cell 7880 has the same four-number signature after 0.1 m rounding in 2019 and 2021, while its exact values, return counts, sensor protocol, and event context differ.",
    contribution: "The case makes projection-relative ecological similarity operational without promoting event precedence to causation or two surveys to a recovery trajectory.",
    boundaries: ["Exact public file IDs, bytes, hashes, and tutorial Git blobs without inventing a formal release tag", "Four height quantiles remain a bounded projection rather than full ecosystem state", "Recorded fire context and published tile interpretation remain separate from a direct spatial causal join", "Different sensors, absent control design, future response, and Historical Load remain explicit boundaries"],
    outputs: ["Two source-locked survey projections and four exact event records", "Full 7,275-cell paired grid plus six history-equivalence regimes", "Verified ecological-memory Model Pack with zero causal edges", "Ecological Memory Lab with chronology, map, before/after, window, and boundary views"]
  }),
  "historical-linguistics": Object.freeze({
    question: "Can vertical inheritance and horizontal borrowing coexist without conflation?",
    distinction: "lexical similarity != genealogical ancestry",
    summary: "Six exact WOLD/Lexibank forms for one meaning are joined by Glottocode to their full Glottolog 5.3 classification paths, then kept separate from four form-local borrowing records.",
    flagship: "English -> Manange crosses the two selected top-level families: the WOLD source relation is certain, while the target form remains only 'perhaps borrowed' at 0.5.",
    contribution: "The case makes a non-tree history queryable without corrupting the tree: 40 published-classification edges, four horizontal annotations, and zero generated cognacy claims.",
    boundaries: ["Glottolog 5.3 and Lexibank WOLD 4.2 full-file hashes plus exact selection projections", "Borrowing records target lexical forms and never become genealogical parentage", "Unicode surface similarity creates neither cognacy nor ancestry", "Source certainty stays independent from target borrowed-status uncertainty"],
    outputs: ["Six-language, one-concept source-locked cohort", "Forty-edge classification layer plus four borrowing records", "Three-pair by four-regime history-equivalence matrix", "Verified language-transmission Model Pack and Language Lineage & Borrowing Lab"]
  }),
  "legal-precedent-history": Object.freeze({
    question: "How can recorded decisions constrain future legal context without turning citation into authority?",
    distinction: "cites != depends on != binding precedent",
    summary: "Seven selected Supreme Court school-desegregation opinions are locked to CourtListener identifiers and official GovInfo documents, with citation, time, and attributed treatment kept as separate layers.",
    flagship: "At Green's official 1968 decision date, Brown I, Brown II, Cooper, and Griffin are admitted as the four selected prior opinions; Alexander and Swann remain recorded but excluded as later.",
    contribution: "The case makes normative Recorded History -> Future inspectable without manufacturing authority: 16 native citations, four source-attributed treatment claims, and zero inferred binding claims.",
    boundaries: ["Seven-opinion research cohort is deliberately incomplete and is not a statement of current law", "CourtListener citation counts are display-only and cannot create authority", "Four treatment claims are attributed to exact locators in the official Green opinion", "GovInfo and CourtListener date conflicts remain visible; counterfactual removal mutates no source record"],
    outputs: ["Seven opinion records with exact provider and official-document identities", "Green available-at-time projection with two later opinions excluded", "Verified Legal Precedent History Model Pack", "Legal Precedent History Lab with citation, treatment, date-conflict, and ablation views"]
  }),
  "clinical-trajectories": Object.freeze({
    question: "What does longitudinal context add beyond a bounded clinical snapshot?",
    distinction: "bounded observation frame != complete patient state",
    summary: "Eight exact MIMIC-IV Demo v2.2 file locks produce five deidentified trajectories, four-lab cutoff frames, source-returning timelines, and record-count history windows without clinical prediction.",
    flagship: "P04 and P05 are the nearest pair under one declared four-lab metric at distance 0.09, while their available procedure, prescription, flagged-lab, and event histories remain visibly different.",
    contribution: "The case makes Embodied + Recorded History -> Present State inspectable while proving that a bounded frame, a descriptive similarity score, and temporal order do not become complete patient state or clinical meaning.",
    boundaries: ["Open MIMIC-IV Demo v2.2 only, with ciphered identifiers and shifted dates", "No diagnosis, prognosis, treatment recommendation, treatment-effect estimate, or patient-level clinical conclusion", "All timeline events are cutoff-safe and return to an exact source table, CSV row, and native record ID", "Prescription orders remain distinct from administration or adherence; missing labs are never imputed"],
    outputs: ["Five-subject source projection over 1,766 selected native records", "Five bounded frames and 1,981 cutoff-safe source events", "Verified clinical-trajectories Model Pack with zero causal or clinical-result edges", "Clinical Trajectory Lab with frame, timeline, provenance, similarity, and boundary views"]
  }),
  "galactic-archaeology": Object.freeze({
    question: "How can present stellar traces support candidate Galactic histories without collapsing model layers?",
    distinction: "observed != derived != classified != historically interpreted",
    summary: "Thirty-three exact Gaia DR3 ADQL queries freeze 64 stellar sources across four explicit chemo-kinematic rules, while catalogue observations, Apsis estimates, published orbit estimates, Onto2D classification, and historical context remain separate.",
    flagship: "The Appendix B High-quality view removes exactly half of the bounded cohort yet leaves eight sources in each rule profile; medians move, while no birth-origin or ancestry claim is strengthened.",
    contribution: "The case makes a long Reconstructed History -> Present State chain inspectable and shows precisely where present-day evidence permits only candidate historical compatibility.",
    boundaries: ["Gaia DR3 tables, paper PDF, 33 executed queries, source projection, and generator are byte-locked", "All selected Gaia-parameter and published-orbit estimates retain their reported intervals", "Four cohort names are Onto2D rules, never native Gaia population labels", "Chemistry, radial motion, and counter-rotation establish neither birth origin nor common ancestry"],
    outputs: ["64-source offline Gaia DR3 projection balanced across four rules and two quality strata", "Five-layer case artifact with quality and evidence ablations", "Verified 83-node / 437-edge Galactic Archaeology Model Pack", "Galactic Archaeology Lab with orbit-space inspection and source-level uncertainty"]
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
  "modelId", "modelVersion", "modelPackPath", "explorerId", "explorerPath", "casePagePath", "implementationDoc",
  "matrixPlacements"
]);
const ANALYSIS_FIELDS = Object.freeze(["historicalLoad", "historyEquivalence", "reachability", "reconstruction"]);
const PLACEMENT_FIELDS = Object.freeze(["mode", "effect", "role"]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
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

export function modelStudioHref(entry, projectRoot) {
  const url = new URL("apps/model-studio/", projectRoot);
  if (!isRecord(entry)) registryFailure("model selection entry must be an object.");
  if (entry.modelPackPath === null) return url.href;
  requireString(entry.modelId, "model selection modelId", 1, ID_PATTERN);
  requireString(entry.modelVersion, "model selection modelVersion", 1, VERSION_PATTERN);
  url.hash = new URLSearchParams({ model: entry.modelId, version: entry.modelVersion }).toString();
  return url.href;
}

export function validateHistoryRegistry(registry) {
  requireExactFields(registry, REGISTRY_FIELDS, "registry");
  if (registry.schemaVersion !== "1.1.0") registryFailure("schemaVersion is unsupported.");
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
    if (entry.modelVersion !== null) requireString(entry.modelVersion, `${entry.caseId}.modelVersion`, 1, VERSION_PATTERN);
    requireNullableId(entry.explorerId, `${entry.caseId}.explorerId`);
    requireRepositoryDirectory(entry.modelPackPath, `${entry.caseId}.modelPackPath`, "models");
    requireRepositoryDirectory(entry.explorerPath, `${entry.caseId}.explorerPath`, "apps");
    if (entry.modelPackPath !== null && (entry.modelId === null || entry.modelVersion === null)) registryFailure(`${entry.caseId} has modelPackPath without an exact model selection.`);
    if (entry.modelPackPath === null && entry.modelVersion !== null) registryFailure(`${entry.caseId} has modelVersion without modelPackPath.`);
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
