import {
  canonicalize,
  deepFreeze,
  hashArtifactBytes,
  hashCanonical,
  isContentHash
} from "@onto2d/kernel/canonical";

export const RDF_IMPORT_FORMAT = "onto2d-rdf-import";
export const RDF_IMPORT_FORMAT_VERSION = "1";
export const RDF_IMPORT_PROFILE_ID = "rdf11-n-triples-safe-v1";
export const RDF_NEUTRAL_GRAPH_FORMAT = "onto2d-rdf-neutral-graph";
export const RDF_NEUTRAL_GRAPH_FORMAT_VERSION = "1";
export const RDF_IMPORT_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxLines: 200_000,
  maxStatements: 100_000,
  maxLineBytes: 256 * 1024,
  maxTermLength: 16_384,
  maxBlankNodeLabelLength: 256,
  maxSourceIdLength: 256
});
export const RDF_IMPORT_PROFILE = deepFreeze({
  id: RDF_IMPORT_PROFILE_ID,
  rdfVersion: "1.1",
  syntax: "N-Triples",
  mediaType: "application/n-triples",
  encoding: "utf-8",
  lexicalTransport: "ascii-with-unicode-escapes",
  inference: false,
  dereferencing: false,
  rdf12Features: false,
  modelPackProjection: false
});

const TERM_DOMAIN = "onto2d:rdf-term:v1";
const STATEMENT_DOMAIN = "onto2d:rdf-statement:v1";
const GRAPH_DOMAIN = "onto2d:rdf-graph:v1";
const IMPORT_DOMAIN = "onto2d:rdf-import:v1";
const PROJECTION_DOMAIN = "onto2d:rdf-neutral-graph:v1";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const RDF_LANG_STRING = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";
const SOURCE_FIELDS = new Set(["id", "mediaType", "encoding", "bytes", "hash"]);
const ARTIFACT_FIELDS = new Set([
  "schemaVersion",
  "format",
  "formatVersion",
  "profile",
  "source",
  "statements",
  "statistics",
  "graphHash",
  "importHash"
]);
const STATEMENT_FIELDS = new Set(["id", "subject", "predicate", "object", "occurrences"]);
const STATISTICS_FIELDS = new Set([
  "sourceStatementCount",
  "statementCount",
  "duplicateStatementCount",
  "termCount",
  "iriTermCount",
  "blankNodeCount",
  "literalCount"
]);
const OPTION_FIELDS = new Set(["sourceId", "limits"]);
const LIMIT_FIELDS = new Set([
  "maxBytes",
  "maxLines",
  "maxStatements",
  "maxLineBytes",
  "maxTermLength"
]);
const IRI_TERM_FIELDS = new Set(["id", "termType", "value"]);
const BLANK_TERM_FIELDS = new Set(["id", "termType", "value", "scope"]);
const LITERAL_TERM_FIELDS = new Set(["id", "termType", "value", "datatype", "language"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const BLANK_LABEL_PATTERN = /^[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?$/;
const LANGUAGE_PATTERN = /^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/;
const ABSOLUTE_IRI_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const HASH_OPTIONS = Object.freeze({
  limits: Object.freeze({
    maxDepth: 32,
    maxEntries: 2_000_000,
    maxStringBytes: 1024 * 1024
  })
});
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const encoder = new TextEncoder();

export class RdfImportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RdfImportError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new RdfImportError(code, message, details);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dataEntries(value, path, code) {
  if (!isPlainObject(value)) fail(code, `${path} must be a plain object.`, { path });
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail(code, `${path} must not contain symbol fields.`, { path });
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = new Map();
  for (const key of Object.keys(descriptors).sort(compareText)) {
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true || FORBIDDEN_KEYS.has(key)) {
      fail(code, `${path} must contain enumerable safe data fields only.`, { path, field: key });
    }
    entries.set(key, descriptor.value);
  }
  return entries;
}

function exactEntries(value, fields, path, code) {
  const entries = dataEntries(value, path, code);
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort(compareText);
  const missing = [...fields].filter((field) => !entries.has(field)).sort(compareText);
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, `${path} has an invalid field set.`, { path, unknown, missing });
  }
  return entries;
}

function optionalEntries(value, fields, required, path, code) {
  const entries = dataEntries(value, path, code);
  const unknown = [...entries.keys()].filter((field) => !fields.has(field)).sort(compareText);
  const missing = [...required].filter((field) => !entries.has(field)).sort(compareText);
  if (unknown.length > 0 || missing.length > 0) {
    fail(code, `${path} has an invalid field set.`, { path, unknown, missing });
  }
  return entries;
}

function arrayValues(value, path, maximum, code, allowEmpty = true) {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    fail(code, `${path} must be a bounded dense array.`, { path, maximum });
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail(code, `${path} must not contain symbol fields.`, { path });
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Object.keys(descriptors)) {
    if (key === "length") continue;
    if (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
      fail(code, `${path} must not contain named fields.`, { path, field: key });
    }
  }
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      fail(code, `${path} must contain data elements only.`, { path, index });
    }
    result.push(descriptor.value);
  }
  return result;
}

function integer(value, path, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(code, `${path} is outside the supported range.`, { path, minimum, maximum });
  }
  return value;
}

function boundedString(value, path, maximum, code, allowEmpty = false) {
  if (
    typeof value !== "string"
    || (!allowEmpty && value.length === 0)
    || (typeof value === "string" && [...value].length > maximum)
  ) {
    fail(
      code,
      allowEmpty ? `${path} must be a bounded string.` : `${path} must be a non-empty bounded string.`,
      { path, maximum }
    );
  }
  try {
    canonicalize(value, HASH_OPTIONS);
  } catch (error) {
    fail(code, `${path} must contain valid Unicode.`, { path, causeCode: error?.code });
  }
  return value;
}

function sourceId(value, code = "RDF_IMPORT_OPTIONS_INVALID") {
  const result = boundedString(value, "options.sourceId", RDF_IMPORT_LIMITS.maxSourceIdLength, code);
  if (!SOURCE_ID_PATTERN.test(result) || FORBIDDEN_KEYS.has(result)) {
    fail(code, "options.sourceId must be a safe ASCII identifier.", { path: "options.sourceId" });
  }
  return result;
}

function normalizeLimits(value) {
  if (value === undefined) return { ...RDF_IMPORT_LIMITS };
  const entries = dataEntries(value, "options.limits", "RDF_IMPORT_OPTIONS_INVALID");
  const unknown = [...entries.keys()].filter((field) => !LIMIT_FIELDS.has(field)).sort(compareText);
  if (unknown.length > 0) {
    fail("RDF_IMPORT_OPTIONS_INVALID", "options.limits contains unknown fields.", { unknown });
  }
  const limits = { ...RDF_IMPORT_LIMITS };
  for (const [field, supplied] of entries) {
    limits[field] = integer(
      supplied,
      `options.limits.${field}`,
      1,
      RDF_IMPORT_LIMITS[field],
      "RDF_IMPORT_LIMIT_INVALID"
    );
  }
  return limits;
}

function normalizeOptions(value) {
  const entries = optionalEntries(
    value,
    OPTION_FIELDS,
    new Set(["sourceId"]),
    "options",
    "RDF_IMPORT_OPTIONS_INVALID"
  );
  return {
    sourceId: sourceId(entries.get("sourceId")),
    limits: normalizeLimits(entries.get("limits"))
  };
}

function sourceBytes(input, maximum = RDF_IMPORT_LIMITS.maxBytes) {
  let bytes;
  if (typeof input === "string") {
    bytes = encoder.encode(input);
  } else if (input instanceof Uint8Array && input.buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input.slice(0));
  } else {
    fail(
      "RDF_IMPORT_SOURCE_INVALID",
      "N-Triples source must be a string, Uint8Array, or ArrayBuffer."
    );
  }
  if (bytes.byteLength > maximum) {
    fail("RDF_IMPORT_LIMIT_EXCEEDED", "N-Triples source exceeds maxBytes.", {
      limit: "maxBytes",
      maximum,
      actual: bytes.byteLength
    });
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    fail("RDF_IMPORT_ENCODING_INVALID", "N-Triples source must not contain a UTF-8 BOM.");
  }
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    fail("RDF_IMPORT_ENCODING_INVALID", "N-Triples source must be valid UTF-8.");
  }
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] > 0x7f) {
      fail(
        "RDF_IMPORT_PROFILE_UNSUPPORTED",
        "This profile requires ASCII lexical transport; use N-Triples Unicode escapes.",
        { byteOffset: index }
      );
    }
  }
  return { bytes, text };
}

function termId(term) {
  return hashCanonical(TERM_DOMAIN, term, HASH_OPTIONS);
}

function isSupportedAbsoluteIri(value) {
  if (!ABSOLUTE_IRI_PATTERN.test(value) || /%(?![0-9A-Fa-f]{2})/.test(value)) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x20 || '<>"{}|^`\\'.includes(character)) return false;
  }
  return true;
}

function iriTerm(value) {
  const basis = { termType: "iri", value };
  return { id: termId(basis), ...basis };
}

function blankTerm(value, scope) {
  const basis = { termType: "blank-node", value, scope };
  return { id: termId(basis), ...basis };
}

function literalTerm(value, datatype, language) {
  const basis = { termType: "literal", value, datatype, language };
  return { id: termId(basis), ...basis };
}

function termBasis(term) {
  if (term.termType === "iri") return { termType: term.termType, value: term.value };
  if (term.termType === "blank-node") {
    return { termType: term.termType, value: term.value, scope: term.scope };
  }
  return {
    termType: term.termType,
    value: term.value,
    datatype: term.datatype,
    language: term.language
  };
}

function statementBasis(statement) {
  return {
    subject: termBasis(statement.subject),
    predicate: termBasis(statement.predicate),
    object: termBasis(statement.object)
  };
}

function statementId(statement) {
  return hashCanonical(STATEMENT_DOMAIN, statementBasis(statement), HASH_OPTIONS);
}

class LineParser {
  constructor(line, lineNumber, scope, limits) {
    this.line = line;
    this.lineNumber = lineNumber;
    this.scope = scope;
    this.limits = limits;
    this.index = 0;
  }

  error(message, code = "RDF_IMPORT_SYNTAX_INVALID") {
    fail(code, message, { line: this.lineNumber, column: this.index + 1 });
  }

  peek(offset = 0) {
    return this.line[this.index + offset];
  }

  skipWhitespace() {
    const start = this.index;
    while (this.peek() === " " || this.peek() === "\t") this.index += 1;
    return this.index - start;
  }

  unicodeEscape() {
    const marker = this.peek(1);
    const count = marker === "u" ? 4 : marker === "U" ? 8 : 0;
    if (count === 0) this.error("Only Unicode escapes are allowed in an IRI.");
    const digits = this.line.slice(this.index + 2, this.index + 2 + count);
    if (digits.length !== count || !/^[0-9A-Fa-f]+$/.test(digits)) {
      this.error("Unicode escape has an invalid hexadecimal payload.");
    }
    const codePoint = Number.parseInt(digits, 16);
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      this.error("Unicode escape must identify a Unicode scalar value.");
    }
    this.index += count + 2;
    return String.fromCodePoint(codePoint);
  }

  iri() {
    if (this.peek() !== "<") this.error("Expected an absolute IRI enclosed in angle brackets.");
    this.index += 1;
    let value = "";
    while (this.index < this.line.length) {
      const character = this.peek();
      if (character === ">") {
        this.index += 1;
        if (!isSupportedAbsoluteIri(value)) {
          this.error("IRI must be absolute and contain only supported IRI characters.");
        }
        if ([...value].length > this.limits.maxTermLength) {
          this.error("IRI exceeds maxTermLength.", "RDF_IMPORT_LIMIT_EXCEEDED");
        }
        return iriTerm(value);
      }
      if (character === "\\") {
        value += this.unicodeEscape();
        continue;
      }
      const code = character.charCodeAt(0);
      if (code <= 0x20 || '<>"{}|^`'.includes(character)) {
        this.error("IRI contains a character outside the supported RDF 1.1 profile.");
      }
      value += character;
      this.index += 1;
    }
    this.error("IRI is not terminated.");
  }

  blank() {
    if (this.peek() !== "_" || this.peek(1) !== ":") {
      this.error("Expected a blank-node label.");
    }
    this.index += 2;
    const start = this.index;
    while (/[A-Za-z0-9_.-]/.test(this.peek() ?? "")) this.index += 1;
    const value = this.line.slice(start, this.index);
    if (
      value.length > this.limits.maxBlankNodeLabelLength
      || !BLANK_LABEL_PATTERN.test(value)
    ) {
      this.error("Blank-node label is invalid or exceeds the profile limit.");
    }
    return blankTerm(value, this.scope);
  }

  resource(allowBlank) {
    if (this.peek() === "<") return this.iri();
    if (allowBlank && this.peek() === "_" && this.peek(1) === ":") return this.blank();
    this.error(allowBlank ? "Expected an IRI or blank node." : "Predicate must be an IRI.");
  }

  literalEscape() {
    const marker = this.peek(1);
    const escapes = {
      t: "\t",
      b: "\b",
      n: "\n",
      r: "\r",
      f: "\f",
      '"': '"',
      "'": "'",
      "\\": "\\"
    };
    if (marker === "u" || marker === "U") return this.unicodeEscape();
    if (!Object.prototype.hasOwnProperty.call(escapes, marker)) {
      this.error("Literal contains an unsupported escape sequence.");
    }
    this.index += 2;
    return escapes[marker];
  }

  literal() {
    if (this.peek() !== '"') this.error("Expected an RDF literal.");
    this.index += 1;
    let value = "";
    let terminated = false;
    while (this.index < this.line.length) {
      const character = this.peek();
      if (character === '"') {
        this.index += 1;
        terminated = true;
        break;
      }
      if (character === "\\") {
        value += this.literalEscape();
        continue;
      }
      if (character.charCodeAt(0) < 0x20) {
        this.error("Literal contains an unescaped control character.");
      }
      value += character;
      this.index += 1;
    }
    if (!terminated) this.error("Literal is not terminated.");
    if ([...value].length > this.limits.maxTermLength) {
      this.error("Literal exceeds maxTermLength.", "RDF_IMPORT_LIMIT_EXCEEDED");
    }
    if (this.peek() === "@") {
      this.index += 1;
      const start = this.index;
      while (/[A-Za-z0-9-]/.test(this.peek() ?? "")) this.index += 1;
      const language = this.line.slice(start, this.index);
      if (language.includes("--")) {
        this.error(
          "RDF 1.2 directional language strings are outside this profile.",
          "RDF_IMPORT_PROFILE_UNSUPPORTED"
        );
      }
      if (!LANGUAGE_PATTERN.test(language) || this.peek() === "-") {
        this.error("Literal language tag is invalid.");
      }
      if (language.length > this.limits.maxTermLength) {
        this.error("Literal language tag exceeds maxTermLength.", "RDF_IMPORT_LIMIT_EXCEEDED");
      }
      return literalTerm(value, RDF_LANG_STRING, language.toLowerCase());
    }
    if (this.peek() === "^" && this.peek(1) === "^") {
      this.index += 2;
      const datatype = this.iri();
      return literalTerm(value, datatype.value, null);
    }
    return literalTerm(value, XSD_STRING, null);
  }

  object() {
    if (this.peek() === '"') return this.literal();
    return this.resource(true);
  }

  parse() {
    this.skipWhitespace();
    if (this.index === this.line.length || this.peek() === "#") return null;
    if (
      this.line.startsWith("VERSION", this.index)
      || this.line.startsWith("<<", this.index)
      || this.line.startsWith("@prefix", this.index)
      || this.line.startsWith("@base", this.index)
      || this.line.startsWith("PREFIX", this.index)
      || this.line.startsWith("BASE", this.index)
    ) {
      this.error(
        "The source uses syntax outside the RDF 1.1 N-Triples safe profile.",
        "RDF_IMPORT_PROFILE_UNSUPPORTED"
      );
    }
    const subject = this.resource(true);
    if (this.skipWhitespace() === 0) this.error("Subject and predicate must be separated.");
    const predicate = this.resource(false);
    if (this.skipWhitespace() === 0) this.error("Predicate and object must be separated.");
    const object = this.object();
    this.skipWhitespace();
    if (this.peek() !== ".") this.error("Triple must end with a period.");
    this.index += 1;
    this.skipWhitespace();
    if (this.peek() === "#") this.index = this.line.length;
    if (this.index !== this.line.length) this.error("Unexpected content follows the triple.");
    const statement = { subject, predicate, object };
    return { id: statementId(statement), ...statement, occurrences: [this.lineNumber] };
  }
}

function documentLines(text, limits) {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\r" && text[index + 1] !== "\n") {
      fail("RDF_IMPORT_ENCODING_INVALID", "Line endings must use LF or CRLF.", {
        byteOffset: index
      });
    }
  }
  const lines = text.length === 0 ? [] : text.split(/\r?\n/);
  if (text.endsWith("\n")) lines.pop();
  if (lines.length > limits.maxLines) {
    fail("RDF_IMPORT_LIMIT_EXCEEDED", "N-Triples source exceeds maxLines.", {
      limit: "maxLines",
      maximum: limits.maxLines,
      actual: lines.length
    });
  }
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].length > limits.maxLineBytes) {
      fail("RDF_IMPORT_LIMIT_EXCEEDED", "N-Triples line exceeds maxLineBytes.", {
        limit: "maxLineBytes",
        line: index + 1,
        maximum: limits.maxLineBytes,
        actual: lines[index].length
      });
    }
  }
  return lines;
}

function computeStatistics(statements, sourceStatementCount) {
  const terms = new Map();
  for (const statement of statements) {
    for (const term of [statement.subject, statement.predicate, statement.object]) {
      terms.set(term.id, term);
    }
  }
  const values = [...terms.values()];
  return {
    sourceStatementCount,
    statementCount: statements.length,
    duplicateStatementCount: sourceStatementCount - statements.length,
    termCount: values.length,
    iriTermCount: values.filter((term) => term.termType === "iri").length,
    blankNodeCount: values.filter((term) => term.termType === "blank-node").length,
    literalCount: values.filter((term) => term.termType === "literal").length
  };
}

function graphIdentityBasis(statements) {
  return {
    profile: RDF_IMPORT_PROFILE_ID,
    statements: statements.map(statementBasis)
  };
}

function importIdentityBasis(artifact) {
  return {
    schemaVersion: artifact.schemaVersion,
    format: artifact.format,
    formatVersion: artifact.formatVersion,
    profile: artifact.profile,
    source: artifact.source,
    statements: artifact.statements,
    statistics: artifact.statistics,
    graphHash: artifact.graphHash
  };
}

export function importNTriples(input, options) {
  const normalized = normalizeOptions(options);
  const source = sourceBytes(input, normalized.limits.maxBytes);
  const sourceHash = hashArtifactBytes(source.bytes);
  const lines = documentLines(source.text, normalized.limits);
  const byId = new Map();
  let sourceStatementCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const statement = new LineParser(
      lines[index],
      index + 1,
      sourceHash,
      normalized.limits
    ).parse();
    if (statement === null) continue;
    sourceStatementCount += 1;
    if (sourceStatementCount > normalized.limits.maxStatements) {
      fail("RDF_IMPORT_LIMIT_EXCEEDED", "N-Triples source exceeds maxStatements.", {
        limit: "maxStatements",
        maximum: normalized.limits.maxStatements
      });
    }
    const existing = byId.get(statement.id);
    if (existing === undefined) {
      byId.set(statement.id, statement);
    } else {
      if (canonicalize(statementBasis(existing), HASH_OPTIONS) !== canonicalize(statementBasis(statement), HASH_OPTIONS)) {
        fail("RDF_IMPORT_HASH_COLLISION", "Distinct RDF triples produced the same identity.");
      }
      existing.occurrences.push(index + 1);
    }
  }
  const statements = [...byId.values()].sort((left, right) => compareText(left.id, right.id));
  const statistics = computeStatistics(statements, sourceStatementCount);
  const sourceRecord = {
    id: normalized.sourceId,
    mediaType: RDF_IMPORT_PROFILE.mediaType,
    encoding: RDF_IMPORT_PROFILE.encoding,
    bytes: source.bytes.byteLength,
    hash: sourceHash
  };
  const basis = {
    schemaVersion: "1",
    format: RDF_IMPORT_FORMAT,
    formatVersion: RDF_IMPORT_FORMAT_VERSION,
    profile: RDF_IMPORT_PROFILE_ID,
    source: sourceRecord,
    statements,
    statistics,
    graphHash: hashCanonical(GRAPH_DOMAIN, graphIdentityBasis(statements), HASH_OPTIONS)
  };
  return deepFreeze({
    ...basis,
    importHash: hashCanonical(IMPORT_DOMAIN, importIdentityBasis(basis), HASH_OPTIONS)
  });
}

function requireContentHash(value, path, code) {
  if (!isContentHash(value)) fail(code, `${path} must be a lowercase SHA-256 hash.`, { path });
  return value;
}

function absoluteIri(value, path, code) {
  const iri = boundedString(value, path, RDF_IMPORT_LIMITS.maxTermLength, code);
  if (!isSupportedAbsoluteIri(iri)) {
    fail(code, `${path} must be an absolute IRI in the supported profile.`, { path });
  }
  return iri;
}

function verifyTerm(value, path, sourceHash) {
  const code = "RDF_IMPORT_ARTIFACT_INVALID";
  const entries = dataEntries(value, path, code);
  const termType = entries.get("termType");
  const fields = termType === "iri"
    ? IRI_TERM_FIELDS
    : termType === "blank-node"
      ? BLANK_TERM_FIELDS
      : termType === "literal"
        ? LITERAL_TERM_FIELDS
        : null;
  if (fields === null) fail(code, `${path}.termType is unsupported.`, { path });
  const exact = exactEntries(value, fields, path, code);
  const id = requireContentHash(exact.get("id"), `${path}.id`, code);
  let term;
  if (termType === "iri") {
    term = { id, termType, value: absoluteIri(exact.get("value"), `${path}.value`, code) };
  } else if (termType === "blank-node") {
    const label = boundedString(
      exact.get("value"),
      `${path}.value`,
      RDF_IMPORT_LIMITS.maxBlankNodeLabelLength,
      code
    );
    const scope = requireContentHash(exact.get("scope"), `${path}.scope`, code);
    if (!BLANK_LABEL_PATTERN.test(label) || scope !== sourceHash) {
      fail(code, `${path} contains an invalid or unscoped blank node.`, { path });
    }
    term = { id, termType, value: label, scope };
  } else {
    const language = exact.get("language");
    if (
      language !== null
      && (
        typeof language !== "string"
        || language !== language.toLowerCase()
        || !LANGUAGE_PATTERN.test(language)
      )
    ) {
      fail(code, `${path}.language must be null or a normalized language tag.`, { path });
    }
    const datatype = absoluteIri(exact.get("datatype"), `${path}.datatype`, code);
    if (language !== null && datatype !== RDF_LANG_STRING) {
      fail(code, `${path} language literal must use rdf:langString.`, { path });
    }
    term = {
      id,
      termType,
      value: boundedString(
        exact.get("value"),
        `${path}.value`,
        RDF_IMPORT_LIMITS.maxTermLength,
        code,
        true
      ),
      datatype,
      language
    };
  }
  const expected = termId(termBasis(term));
  if (term.id !== expected) fail(code, `${path}.id does not match the RDF term.`, { path, expected });
  return term;
}

function verifySource(value) {
  const code = "RDF_IMPORT_ARTIFACT_INVALID";
  const fields = exactEntries(value, SOURCE_FIELDS, "artifact.source", code);
  const id = sourceId(fields.get("id"), code);
  const bytes = integer(fields.get("bytes"), "artifact.source.bytes", 0, RDF_IMPORT_LIMITS.maxBytes, code);
  const hash = requireContentHash(fields.get("hash"), "artifact.source.hash", code);
  if (
    fields.get("mediaType") !== RDF_IMPORT_PROFILE.mediaType
    || fields.get("encoding") !== RDF_IMPORT_PROFILE.encoding
  ) {
    fail(code, "artifact.source media type or encoding is unsupported.");
  }
  return { id, mediaType: RDF_IMPORT_PROFILE.mediaType, encoding: RDF_IMPORT_PROFILE.encoding, bytes, hash };
}

function verifyStatistics(value, expected) {
  const code = "RDF_IMPORT_ARTIFACT_INVALID";
  const fields = exactEntries(value, STATISTICS_FIELDS, "artifact.statistics", code);
  const result = {};
  for (const field of STATISTICS_FIELDS) {
    result[field] = integer(
      fields.get(field),
      `artifact.statistics.${field}`,
      0,
      RDF_IMPORT_LIMITS.maxStatements * 3,
      code
    );
  }
  if (canonicalize(result, HASH_OPTIONS) !== canonicalize(expected, HASH_OPTIONS)) {
    fail(code, "artifact.statistics does not match its statements.");
  }
  return result;
}

export function verifyRdfImportArtifact(value) {
  const code = "RDF_IMPORT_ARTIFACT_INVALID";
  const fields = exactEntries(value, ARTIFACT_FIELDS, "artifact", code);
  if (
    fields.get("schemaVersion") !== "1"
    || fields.get("format") !== RDF_IMPORT_FORMAT
    || fields.get("formatVersion") !== RDF_IMPORT_FORMAT_VERSION
    || fields.get("profile") !== RDF_IMPORT_PROFILE_ID
  ) {
    fail(code, "RDF import artifact format or profile is unsupported.");
  }
  const source = verifySource(fields.get("source"));
  const statementInputs = arrayValues(
    fields.get("statements"),
    "artifact.statements",
    RDF_IMPORT_LIMITS.maxStatements,
    code
  );
  const statements = [];
  let previousId = null;
  let sourceStatementCount = 0;
  const occurrenceLines = new Set();
  for (let index = 0; index < statementInputs.length; index += 1) {
    const path = `artifact.statements[${index}]`;
    const entry = exactEntries(statementInputs[index], STATEMENT_FIELDS, path, code);
    const subject = verifyTerm(entry.get("subject"), `${path}.subject`, source.hash);
    const predicate = verifyTerm(entry.get("predicate"), `${path}.predicate`, source.hash);
    const object = verifyTerm(entry.get("object"), `${path}.object`, source.hash);
    if (subject.termType === "literal" || predicate.termType !== "iri") {
      fail(code, `${path} violates RDF triple term positions.`, { path });
    }
    const occurrences = arrayValues(
      entry.get("occurrences"),
      `${path}.occurrences`,
      RDF_IMPORT_LIMITS.maxLines,
      code,
      false
    ).map((line, occurrenceIndex) => integer(
      line,
      `${path}.occurrences[${occurrenceIndex}]`,
      1,
      RDF_IMPORT_LIMITS.maxLines,
      code
    ));
    for (let occurrenceIndex = 1; occurrenceIndex < occurrences.length; occurrenceIndex += 1) {
      if (occurrences[occurrenceIndex - 1] >= occurrences[occurrenceIndex]) {
        fail(code, `${path}.occurrences must be strictly ordered and unique.`, { path });
      }
    }
    for (const line of occurrences) {
      if (occurrenceLines.has(line)) {
        fail(code, "One physical source line cannot contain distinct RDF statements.", { line });
      }
      occurrenceLines.add(line);
    }
    sourceStatementCount += occurrences.length;
    if (sourceStatementCount > RDF_IMPORT_LIMITS.maxStatements) {
      fail(code, "artifact occurrences exceed the source statement limit.");
    }
    const statement = { id: entry.get("id"), subject, predicate, object, occurrences };
    requireContentHash(statement.id, `${path}.id`, code);
    const expectedId = statementId(statement);
    if (statement.id !== expectedId) fail(code, `${path}.id does not match the RDF triple.`, { path });
    if (previousId !== null && compareText(previousId, statement.id) >= 0) {
      fail(code, "artifact.statements must be uniquely sorted by identity.");
    }
    previousId = statement.id;
    statements.push(statement);
  }
  const statistics = verifyStatistics(
    fields.get("statistics"),
    computeStatistics(statements, sourceStatementCount)
  );
  if (source.bytes === 0 && statistics.sourceStatementCount !== 0) {
    fail(code, "An empty source cannot contain RDF statements.");
  }
  const graphHash = requireContentHash(fields.get("graphHash"), "artifact.graphHash", code);
  const expectedGraphHash = hashCanonical(GRAPH_DOMAIN, graphIdentityBasis(statements), HASH_OPTIONS);
  if (graphHash !== expectedGraphHash) fail(code, "artifact.graphHash does not match its RDF graph.");
  const artifact = {
    schemaVersion: "1",
    format: RDF_IMPORT_FORMAT,
    formatVersion: RDF_IMPORT_FORMAT_VERSION,
    profile: RDF_IMPORT_PROFILE_ID,
    source,
    statements,
    statistics,
    graphHash,
    importHash: requireContentHash(fields.get("importHash"), "artifact.importHash", code)
  };
  const expectedImportHash = hashCanonical(IMPORT_DOMAIN, importIdentityBasis(artifact), HASH_OPTIONS);
  if (artifact.importHash !== expectedImportHash) {
    fail(code, "artifact.importHash does not match its exact import content.");
  }
  return deepFreeze(artifact);
}

export function matchRdfImportSource(artifactInput, sourceInput) {
  const artifact = verifyRdfImportArtifact(artifactInput);
  const source = sourceBytes(sourceInput);
  const actualHash = hashArtifactBytes(source.bytes);
  if (source.bytes.byteLength !== artifact.source.bytes || actualHash !== artifact.source.hash) {
    fail("RDF_IMPORT_SOURCE_MISMATCH", "Source bytes do not match the RDF import artifact.", {
      expectedBytes: artifact.source.bytes,
      actualBytes: source.bytes.byteLength,
      expectedHash: artifact.source.hash,
      actualHash
    });
  }
  return artifact;
}

function addProjectionTerm(terms, term) {
  const projected = term.termType === "iri"
    ? { id: term.id, termType: term.termType, value: term.value }
    : term.termType === "blank-node"
      ? { id: term.id, termType: term.termType, value: term.value, scope: term.scope }
      : {
          id: term.id,
          termType: term.termType,
          value: term.value,
          datatype: term.datatype,
          language: term.language
        };
  const existing = terms.get(term.id);
  if (existing !== undefined && canonicalize(existing, HASH_OPTIONS) !== canonicalize(projected, HASH_OPTIONS)) {
    fail("RDF_IMPORT_HASH_COLLISION", "Distinct RDF terms produced the same identity.");
  }
  terms.set(term.id, projected);
}

export function projectRdfImportGraph(artifactInput) {
  const artifact = verifyRdfImportArtifact(artifactInput);
  const terms = new Map();
  const edges = artifact.statements.map((statement) => {
    addProjectionTerm(terms, statement.subject);
    addProjectionTerm(terms, statement.object);
    return {
      id: statement.id,
      source: statement.subject.id,
      target: statement.object.id,
      predicate: statement.predicate.value,
      predicateId: statement.predicate.id,
      occurrenceCount: statement.occurrences.length
    };
  });
  const nodes = [...terms.values()].sort((left, right) => compareText(left.id, right.id));
  edges.sort((left, right) => compareText(left.id, right.id));
  const identity = {
    sourceHash: artifact.source.hash,
    graphHash: artifact.graphHash,
    importHash: artifact.importHash
  };
  const statistics = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    iriNodeCount: nodes.filter((node) => node.termType === "iri").length,
    blankNodeCount: nodes.filter((node) => node.termType === "blank-node").length,
    literalNodeCount: nodes.filter((node) => node.termType === "literal").length
  };
  const basis = {
    schemaVersion: "1",
    format: RDF_NEUTRAL_GRAPH_FORMAT,
    formatVersion: RDF_NEUTRAL_GRAPH_FORMAT_VERSION,
    profile: RDF_IMPORT_PROFILE_ID,
    identity,
    nodes,
    edges,
    statistics,
    semantics: {
      inference: false,
      relationKind: "rdf-predicate",
      modelPackReady: false
    }
  };
  return deepFreeze({
    ...basis,
    projectionHash: hashCanonical(PROJECTION_DOMAIN, basis, HASH_OPTIONS)
  });
}
