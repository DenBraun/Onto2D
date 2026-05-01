/* Onto2D core runtime.
 *
 * The source JSON catalogue is treated as a hidden ontology graph. User worlds
 * contain concrete bodies that are instances of ontology nodes.
 */

(function initOnto2D(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Onto2D = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createOnto2D() {
  "use strict";

  const DEFAULT_WEIGHT_TOLERANCE = 0.05;

  function nodeCode(level, id) {
    return `${level}.${id}`;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function makeIssue(severity, code, message, details) {
    return {
      severity,
      code,
      message,
      details: details || {}
    };
  }

  function normalizeRelationInput(relation) {
    const source = relation || {};
    return {
      dependencyType: source.dependencyType ?? source.DependencyType ?? null,
      interactionModes: source.interactionModes || source.InteractionModes || [],
      causalDirections: source.causalDirections || source.CausalDirections || [],
      ontologicalRole: source.ontologicalRole || source.OntologicalRole || null,
      necessity: source.necessity || source.Necessity || null,
      weight: source.weight ?? source.Weight ?? null,
      metadata: source.metadata || {}
    };
  }

  class OntologyGraph {
    constructor(options) {
      const source = options || {};
      this.nodes = new Map();
      this.childrenByParent = new Map();
      this.parentsByChild = new Map();
      this.descriptions = source.descriptions || {};
      this.dictionaries = this.#buildDictionaries(this.descriptions);

      this.addLevels(source.levels || []);
    }

    static fromCatalog(catalog) {
      const source = catalog || {};
      return new OntologyGraph({
        levels: source.levels || source.Levels || [],
        descriptions: source.descriptions || source.Descriptions || {}
      });
    }

    addLevels(levels) {
      const flatNodes = [];

      for (const level of levels) {
        if (Array.isArray(level)) {
          flatNodes.push(...level);
        } else if (level && Array.isArray(level.nodes)) {
          flatNodes.push(...level.nodes);
        } else if (level && Array.isArray(level.Nodes)) {
          flatNodes.push(...level.Nodes);
        }
      }

      for (const node of flatNodes) {
        this.addNode(node);
      }

      this.#rebuildEdges();
    }

    addNode(rawNode) {
      if (!rawNode || typeof rawNode !== "object") {
        throw new TypeError("Ontology node must be an object.");
      }

      const code = nodeCode(rawNode.Level, rawNode.Id);
      if (this.nodes.has(code)) {
        throw new Error(`Duplicate ontology node code: ${code}`);
      }

      const node = clone(rawNode);
      node.Code = code;
      this.nodes.set(code, node);
      return node;
    }

    getNode(code) {
      return this.nodes.get(code) || null;
    }

    hasNode(code) {
      return this.nodes.has(code);
    }

    getParents(code) {
      const node = this.getNode(code);
      if (!node) return [];
      return asArray(node.Parents).map((relation) => ({
        parent: this.getNode(relation.ParentCode),
        relation: clone(relation)
      }));
    }

    getChildren(code) {
      return clone(this.childrenByParent.get(code) || []);
    }

    findTemplateRelation(parentCategory, childCategory) {
      const child = this.getNode(childCategory);
      if (!child) return null;

      const relation = asArray(child.Parents).find((item) => {
        return item.ParentCode === parentCategory;
      });

      return relation ? clone(relation) : null;
    }

    getCapabilities(categoryCode) {
      const node = this.getNode(categoryCode);
      if (!node) {
        throw new Error(`Unknown ontology category: ${categoryCode}`);
      }

      return {
        category: clone(node),
        requirements: clone(node.Requirements || {}),
        requiredParents: this.getParents(categoryCode),
        canConstrain: this.getChildren(categoryCode),
        canRealize: this.getChildren(categoryCode).filter((edge) => {
          return edge.relation && edge.relation.OntologicalRole === "arising";
        })
      };
    }

    validate(options) {
      const config = options || {};
      const tolerance = config.weightTolerance ?? DEFAULT_WEIGHT_TOLERANCE;
      const issues = [];

      for (const [code, node] of this.nodes) {
        const parents = asArray(node.Parents);
        const seenParents = new Set();

        for (const relation of parents) {
          if (!this.hasNode(relation.ParentCode)) {
            issues.push(makeIssue(
              "error",
              "ONTOLOGY_PARENT_MISSING",
              `Ontology node ${code} references missing parent ${relation.ParentCode}.`,
              { node: code, parent: relation.ParentCode }
            ));
          }

          if (relation.ParentCode === code) {
            issues.push(makeIssue(
              "error",
              "ONTOLOGY_SELF_PARENT",
              `Ontology node ${code} cannot be its own parent.`,
              { node: code }
            ));
          }

          if (seenParents.has(relation.ParentCode)) {
            issues.push(makeIssue(
              "warning",
              "ONTOLOGY_DUPLICATE_PARENT",
              `Ontology node ${code} has duplicate parent ${relation.ParentCode}.`,
              { node: code, parent: relation.ParentCode }
            ));
          }
          seenParents.add(relation.ParentCode);

          this.#validateDictionaryReferences(code, relation, issues);
        }

        if (parents.length > 0) {
          const sum = parents.reduce((total, relation) => {
            return total + Number(relation.Weight || 0);
          }, 0);

          if (Math.abs(sum - 1) > tolerance) {
            issues.push(makeIssue(
              "warning",
              "ONTOLOGY_WEIGHT_SUM",
              `Ontology node ${code} parent weights sum to ${Number(sum.toFixed(4))}, expected about 1.`,
              { node: code, sum }
            ));
          }
        }

        this.#validateRequirementCoverage(code, node, issues);
      }

      return issues;
    }

    #buildDictionaries(descriptions) {
      return {
        dependencyTypes: new Set(asArray(descriptions.DependencyTypes).map((item) => item.Id)),
        interactionModes: new Set(asArray(descriptions.InteractionModes).map((item) => item.Id)),
        causalDirections: new Set(asArray(descriptions.CausalDirections).map((item) => item.Id)),
        typeRoles: new Set(asArray(descriptions.TypeRoles).map((item) => item.Id)),
        complexityLevels: new Set(asArray(descriptions.ComplexityLevels).map((item) => item.Id))
      };
    }

    #rebuildEdges() {
      this.childrenByParent.clear();
      this.parentsByChild.clear();

      for (const [childCode, node] of this.nodes) {
        const parentEdges = [];

        for (const relation of asArray(node.Parents)) {
          const edge = {
            parentCode: relation.ParentCode,
            childCode,
            parent: this.getNode(relation.ParentCode),
            child: node,
            relation: clone(relation)
          };

          parentEdges.push(edge);

          if (!this.childrenByParent.has(relation.ParentCode)) {
            this.childrenByParent.set(relation.ParentCode, []);
          }
          this.childrenByParent.get(relation.ParentCode).push(edge);
        }

        this.parentsByChild.set(childCode, parentEdges);
      }
    }

    #validateDictionaryReferences(code, relation, issues) {
      if (
        this.dictionaries.dependencyTypes.size > 0 &&
        !this.dictionaries.dependencyTypes.has(relation.DependencyType)
      ) {
        issues.push(makeIssue(
          "error",
          "ONTOLOGY_DEPENDENCY_TYPE_UNKNOWN",
          `Ontology relation ${relation.ParentCode} -> ${code} uses unknown dependency type ${relation.DependencyType}.`,
          { node: code, parent: relation.ParentCode, dependencyType: relation.DependencyType }
        ));
      }

      for (const mode of asArray(relation.InteractionModes)) {
        if (
          this.dictionaries.interactionModes.size > 0 &&
          !this.dictionaries.interactionModes.has(mode)
        ) {
          issues.push(makeIssue(
            "error",
            "ONTOLOGY_INTERACTION_MODE_UNKNOWN",
            `Ontology relation ${relation.ParentCode} -> ${code} uses unknown interaction mode ${mode}.`,
            { node: code, parent: relation.ParentCode, interactionMode: mode }
          ));
        }
      }

      for (const direction of asArray(relation.CausalDirections)) {
        if (
          this.dictionaries.causalDirections.size > 0 &&
          !this.dictionaries.causalDirections.has(direction)
        ) {
          issues.push(makeIssue(
            "error",
            "ONTOLOGY_CAUSAL_DIRECTION_UNKNOWN",
            `Ontology relation ${relation.ParentCode} -> ${code} uses unknown causal direction ${direction}.`,
            { node: code, parent: relation.ParentCode, causalDirection: direction }
          ));
        }
      }
    }

    #validateRequirementCoverage(code, node, issues) {
      const required = asArray(node.Requirements && node.Requirements.MustCover);
      if (required.length === 0) return;

      const covered = new Set(asArray(node.Parents).map((relation) => relation.DependencyType));
      const missing = required.filter((dependencyType) => !covered.has(dependencyType));

      if (missing.length > 0) {
        issues.push(makeIssue(
          "error",
          "ONTOLOGY_REQUIREMENT_UNCOVERED",
          `Ontology node ${code} does not cover mandatory dependency types: ${missing.join(", ")}.`,
          { node: code, missing }
        ));
      }
    }
  }

  class OntoWorld {
    constructor(ontology, options) {
      if (!(ontology instanceof OntologyGraph)) {
        throw new TypeError("OntoWorld requires an OntologyGraph instance.");
      }

      this.ontology = ontology;
      this.options = options || {};
      this.bodies = new Map();
      this.relations = new Map();
      this.nextRelationId = 1;
    }

    createBody(definition) {
      const body = definition || {};
      if (!body.id) {
        throw new Error("Body id is required.");
      }
      if (!body.category) {
        throw new Error(`Body ${body.id} requires ontology category.`);
      }
      if (this.bodies.has(body.id)) {
        throw new Error(`Duplicate body id: ${body.id}`);
      }
      if (!this.ontology.hasNode(body.category)) {
        throw new Error(`Body ${body.id} references unknown ontology category: ${body.category}`);
      }

      const result = {
        id: body.id,
        name: body.name || body.id,
        category: body.category,
        state: clone(body.state || {}),
        metadata: clone(body.metadata || {})
      };

      this.bodies.set(result.id, result);
      return clone(result);
    }

    getBody(id) {
      return clone(this.bodies.get(id) || null);
    }

    destroyBody(id) {
      if (!this.bodies.has(id)) return false;

      this.bodies.delete(id);
      for (const [relationId, relation] of this.relations) {
        if (relation.from === id || relation.to === id) {
          this.relations.delete(relationId);
        }
      }

      return true;
    }

    connect(fromBodyId, toBodyId, relationDefinition) {
      const from = this.bodies.get(fromBodyId);
      const to = this.bodies.get(toBodyId);

      if (!from) throw new Error(`Unknown source body: ${fromBodyId}`);
      if (!to) throw new Error(`Unknown target body: ${toBodyId}`);

      const relation = normalizeRelationInput(relationDefinition);
      const id = relationDefinition && relationDefinition.id
        ? relationDefinition.id
        : `rel_${this.nextRelationId++}`;

      if (this.relations.has(id)) {
        throw new Error(`Duplicate relation id: ${id}`);
      }

      const result = {
        id,
        from: fromBodyId,
        to: toBodyId,
        ...relation
      };

      this.relations.set(id, result);
      return clone(result);
    }

    disconnect(relationId) {
      return this.relations.delete(relationId);
    }

    getCapabilities(bodyId) {
      const body = this.bodies.get(bodyId);
      if (!body) {
        throw new Error(`Unknown body: ${bodyId}`);
      }

      return this.ontology.getCapabilities(body.category);
    }

    validate() {
      const contacts = [];

      for (const body of this.bodies.values()) {
        if (!this.ontology.hasNode(body.category)) {
          contacts.push(makeIssue(
            "error",
            "BODY_CATEGORY_UNKNOWN",
            `Body ${body.id} references unknown ontology category ${body.category}.`,
            { body: body.id, category: body.category }
          ));
        }
      }

      for (const relation of this.relations.values()) {
        contacts.push(...this.#validateRelation(relation));
      }

      contacts.push(...this.#validateBodyRequirements());

      return contacts;
    }

    step() {
      return {
        contacts: this.validate(),
        bodies: this.bodies.size,
        relations: this.relations.size
      };
    }

    toJSON() {
      return {
        bodies: Array.from(this.bodies.values()).map(clone),
        relations: Array.from(this.relations.values()).map(clone)
      };
    }

    #validateRelation(relation) {
      const contacts = [];
      const from = this.bodies.get(relation.from);
      const to = this.bodies.get(relation.to);

      if (!from || !to) {
        contacts.push(makeIssue(
          "error",
          "RELATION_BODY_MISSING",
          `Relation ${relation.id} references a missing body.`,
          { relation: relation.id, from: relation.from, to: relation.to }
        ));
        return contacts;
      }

      const template = this.ontology.findTemplateRelation(from.category, to.category);
      if (!template) {
        contacts.push(makeIssue(
          "error",
          "RELATION_NOT_ALLOWED",
          `Relation ${relation.id} is not allowed by ontology: ${from.category} -> ${to.category}.`,
          {
            relation: relation.id,
            from: relation.from,
            to: relation.to,
            fromCategory: from.category,
            toCategory: to.category
          }
        ));
        return contacts;
      }

      if (
        relation.dependencyType != null &&
        relation.dependencyType !== template.DependencyType
      ) {
        contacts.push(makeIssue(
          "error",
          "RELATION_DEPENDENCY_TYPE_MISMATCH",
          `Relation ${relation.id} dependency type does not match ontology template.`,
          {
            relation: relation.id,
            actual: relation.dependencyType,
            expected: template.DependencyType
          }
        ));
      }

      this.#validateRelationSetSubset(
        contacts,
        relation,
        "RELATION_INTERACTION_MODE_MISMATCH",
        "interactionModes",
        template.InteractionModes
      );

      this.#validateRelationSetSubset(
        contacts,
        relation,
        "RELATION_CAUSAL_DIRECTION_MISMATCH",
        "causalDirections",
        template.CausalDirections
      );

      return contacts;
    }

    #validateRelationSetSubset(contacts, relation, code, field, expectedValues) {
      const actual = asArray(relation[field]);
      if (actual.length === 0) return;

      const expected = new Set(asArray(expectedValues));
      const invalid = actual.filter((value) => !expected.has(value));

      if (invalid.length > 0) {
        contacts.push(makeIssue(
          "error",
          code,
          `Relation ${relation.id} has values not allowed by ontology template: ${invalid.join(", ")}.`,
          {
            relation: relation.id,
            field,
            invalid,
            expected: Array.from(expected)
          }
        ));
      }
    }

    #validateBodyRequirements() {
      const contacts = [];
      const incomingByBody = new Map();

      for (const relation of this.relations.values()) {
        if (!incomingByBody.has(relation.to)) incomingByBody.set(relation.to, []);
        incomingByBody.get(relation.to).push(relation);
      }

      for (const body of this.bodies.values()) {
        const category = this.ontology.getNode(body.category);
        if (!category) continue;

        const mustCover = asArray(category.Requirements && category.Requirements.MustCover);
        if (mustCover.length === 0) continue;

        const incoming = incomingByBody.get(body.id) || [];
        const covered = new Set();

        for (const relation of incoming) {
          const sourceBody = this.bodies.get(relation.from);
          if (!sourceBody) continue;

          const template = this.ontology.findTemplateRelation(sourceBody.category, body.category);
          if (template) {
            covered.add(template.DependencyType);
          }
          if (relation.dependencyType != null) {
            covered.add(relation.dependencyType);
          }
        }

        const missing = mustCover.filter((dependencyType) => !covered.has(dependencyType));
        if (missing.length > 0) {
          contacts.push(makeIssue(
            "warning",
            "BODY_REQUIREMENT_UNSATISFIED",
            `Body ${body.id} is missing mandatory dependency coverage: ${missing.join(", ")}.`,
            {
              body: body.id,
              category: body.category,
              missing
            }
          ));
        }
      }

      return contacts;
    }
  }

  class Onto2DEngine {
    constructor(options) {
      this.options = options || {};
      this.ontology = null;
    }

    loadOntology(catalog) {
      this.ontology = OntologyGraph.fromCatalog(catalog);
      return this.ontology;
    }

    createWorld(options) {
      if (!this.ontology) {
        throw new Error("Ontology must be loaded before creating a world.");
      }

      return new OntoWorld(this.ontology, options);
    }
  }

  return {
    Onto2DEngine,
    OntologyGraph,
    OntoWorld,
    nodeCode
  };
});
