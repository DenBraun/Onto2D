import { verifyRdfImportArtifact } from "@onto2d/rdf-import";
import { compareText } from "./data.js";

export function artifactIdentity(artifact) {
  return {
    sourceHash: artifact.source.hash,
    graphHash: artifact.graphHash,
    importHash: artifact.importHash
  };
}

export function createGraphIndex(input) {
  const artifact = verifyRdfImportArtifact(input);
  const bySubject = new Map();
  const byPredicate = new Map();
  const terms = new Map();

  function remember(term) {
    if (!terms.has(term.id)) terms.set(term.id, term);
  }

  for (const statement of artifact.statements) {
    remember(statement.subject);
    remember(statement.predicate);
    remember(statement.object);
    let predicates = bySubject.get(statement.subject.id);
    if (!predicates) {
      predicates = new Map();
      bySubject.set(statement.subject.id, predicates);
    }
    let objects = predicates.get(statement.predicate.value);
    if (!objects) {
      objects = new Map();
      predicates.set(statement.predicate.value, objects);
    }
    objects.set(statement.object.id, statement.object);
    const entries = byPredicate.get(statement.predicate.value) ?? [];
    entries.push(statement);
    byPredicate.set(statement.predicate.value, entries);
  }

  for (const entries of byPredicate.values()) {
    entries.sort((left, right) => compareText(left.id, right.id));
  }

  return {
    artifact,
    identity: artifactIdentity(artifact),
    terms,
    subjects: [...bySubject.keys()].sort(compareText),
    objects(subjectId, predicate) {
      return [...(bySubject.get(subjectId)?.get(predicate)?.values() ?? [])]
        .sort((left, right) => compareText(left.id, right.id));
    },
    predicates(subjectId) {
      return [...(bySubject.get(subjectId)?.keys() ?? [])].sort(compareText);
    },
    statements(predicate) {
      return byPredicate.get(predicate) ?? [];
    }
  };
}
