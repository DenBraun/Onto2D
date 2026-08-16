export type ContentHash = `sha256:${string}`;
export type RdfImportSourceInput = string | Uint8Array | ArrayBuffer;

export interface RdfImportLimits {
  maxBytes: number;
  maxLines: number;
  maxStatements: number;
  maxLineBytes: number;
  maxTermLength: number;
  maxBlankNodeLabelLength: number;
  maxSourceIdLength: number;
}

export interface RdfImportOptions {
  sourceId: string;
  limits?: Partial<Pick<
    RdfImportLimits,
    "maxBytes" | "maxLines" | "maxStatements" | "maxLineBytes" | "maxTermLength"
  >>;
}

export interface RdfIriTerm {
  id: ContentHash;
  termType: "iri";
  value: string;
}

export interface RdfBlankNodeTerm {
  id: ContentHash;
  termType: "blank-node";
  value: string;
  scope: ContentHash;
}

export interface RdfLiteralTerm {
  id: ContentHash;
  termType: "literal";
  value: string;
  datatype: string;
  language: string | null;
}

export type RdfSubjectTerm = RdfIriTerm | RdfBlankNodeTerm;
export type RdfObjectTerm = RdfSubjectTerm | RdfLiteralTerm;
export type RdfTerm = RdfObjectTerm;

export interface RdfImportStatement {
  id: ContentHash;
  subject: RdfSubjectTerm;
  predicate: RdfIriTerm;
  object: RdfObjectTerm;
  occurrences: number[];
}

export interface RdfImportStatistics {
  sourceStatementCount: number;
  statementCount: number;
  duplicateStatementCount: number;
  termCount: number;
  iriTermCount: number;
  blankNodeCount: number;
  literalCount: number;
}

export interface RdfImportArtifact {
  schemaVersion: "1";
  format: "onto2d-rdf-import";
  formatVersion: "1";
  profile: "rdf11-n-triples-safe-v1";
  source: {
    id: string;
    mediaType: "application/n-triples";
    encoding: "utf-8";
    bytes: number;
    hash: ContentHash;
  };
  statements: RdfImportStatement[];
  statistics: RdfImportStatistics;
  graphHash: ContentHash;
  importHash: ContentHash;
}

export interface RdfNeutralGraphNodeBase {
  id: ContentHash;
  value: string;
}

export type RdfNeutralGraphNode =
  | (RdfNeutralGraphNodeBase & { termType: "iri" })
  | (RdfNeutralGraphNodeBase & { termType: "blank-node"; scope: ContentHash })
  | (RdfNeutralGraphNodeBase & {
      termType: "literal";
      datatype: string;
      language: string | null;
    });

export interface RdfNeutralGraphEdge {
  id: ContentHash;
  source: ContentHash;
  target: ContentHash;
  predicate: string;
  predicateId: ContentHash;
  occurrenceCount: number;
}

export interface RdfNeutralGraph {
  schemaVersion: "1";
  format: "onto2d-rdf-neutral-graph";
  formatVersion: "1";
  profile: "rdf11-n-triples-safe-v1";
  identity: {
    sourceHash: ContentHash;
    graphHash: ContentHash;
    importHash: ContentHash;
  };
  nodes: RdfNeutralGraphNode[];
  edges: RdfNeutralGraphEdge[];
  statistics: {
    nodeCount: number;
    edgeCount: number;
    iriNodeCount: number;
    blankNodeCount: number;
    literalNodeCount: number;
  };
  semantics: {
    inference: false;
    relationKind: "rdf-predicate";
    modelPackReady: false;
  };
  projectionHash: ContentHash;
}

export class RdfImportError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export const RDF_IMPORT_FORMAT: "onto2d-rdf-import";
export const RDF_IMPORT_FORMAT_VERSION: "1";
export const RDF_IMPORT_PROFILE_ID: "rdf11-n-triples-safe-v1";
export const RDF_NEUTRAL_GRAPH_FORMAT: "onto2d-rdf-neutral-graph";
export const RDF_NEUTRAL_GRAPH_FORMAT_VERSION: "1";
export const RDF_IMPORT_LIMITS: Readonly<RdfImportLimits>;
export const RDF_IMPORT_PROFILE: Readonly<{
  id: "rdf11-n-triples-safe-v1";
  rdfVersion: "1.1";
  syntax: "N-Triples";
  mediaType: "application/n-triples";
  encoding: "utf-8";
  lexicalTransport: "ascii-with-unicode-escapes";
  inference: false;
  dereferencing: false;
  rdf12Features: false;
  modelPackProjection: false;
}>;

export function importNTriples(
  source: RdfImportSourceInput,
  options: RdfImportOptions
): Readonly<RdfImportArtifact>;
export function verifyRdfImportArtifact(
  artifact: RdfImportArtifact
): Readonly<RdfImportArtifact>;
export function matchRdfImportSource(
  artifact: RdfImportArtifact,
  source: RdfImportSourceInput
): Readonly<RdfImportArtifact>;
export function projectRdfImportGraph(
  artifact: RdfImportArtifact
): Readonly<RdfNeutralGraph>;
