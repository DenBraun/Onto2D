"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const Onto2D = require("../../onto2d.js");

function descriptions() {
  return {
    DependencyTypes: [{ Id: 0 }],
    InteractionModes: [{ Id: 3 }],
    CausalDirections: [{ Id: 0 }],
    TypeRoles: [{ Id: 2 }],
    ComplexityLevels: [{ Id: 0 }]
  };
}

function graphNodes() {
  return [
    {
      Level: 0,
      Id: 0,
      Name: "Parent",
      TypeRole: 2,
      Parents: [],
      Requirements: { MustCover: [] }
    },
    {
      Level: 0,
      Id: 1,
      Name: "Child",
      TypeRole: 2,
      Parents: [{
        ParentCode: "0.0",
        DependencyType: 0,
        InteractionModes: [3],
        CausalDirections: [0],
        OntologicalRole: "arising",
        Necessity: "necessary",
        Weight: 1
      }],
      Requirements: { MustCover: [0] }
    }
  ];
}

test("legacy module keeps its public API", () => {
  assert.deepEqual(Object.keys(Onto2D).sort(), [
    "Onto2DEngine",
    "OntoWorld",
    "OntologyGraph",
    "nodeCode"
  ]);
  assert.equal(Onto2D.nodeCode(3, 12), "3.12");
});

test("ontology graph validates a minimal valid catalogue", () => {
  const graph = new Onto2D.OntologyGraph({ levels: [graphNodes()], descriptions: descriptions() });
  assert.deepEqual(graph.validate(), []);
  assert.equal(graph.getNode("0.1").Code, "0.1");
  assert.equal(graph.findTemplateRelation("0.0", "0.1").DependencyType, 0);
});

test("adding one node refreshes the public parent-child index", () => {
  const [parent, child] = graphNodes();
  const graph = new Onto2D.OntologyGraph({ levels: [[parent]], descriptions: descriptions() });
  assert.equal(graph.getChildren("0.0").length, 0);

  graph.addNode(child);

  assert.equal(graph.getChildren("0.0").length, 1);
  assert.equal(graph.getChildren("0.0")[0].childCode, "0.1");
});

test("ontology validation preserves structured issue details", () => {
  const node = {
    Level: 0,
    Id: 0,
    Parents: [{
      ParentCode: "0.0",
      DependencyType: 99,
      InteractionModes: [99],
      CausalDirections: [99],
      Weight: 1
    }]
  };
  const graph = new Onto2D.OntologyGraph({ levels: [[node]], descriptions: descriptions() });
  const issues = graph.validate();
  const selfParent = issues.find((issue) => issue.code === "ONTOLOGY_SELF_PARENT");
  assert.deepEqual(selfParent.details, { node: "0.0" });
  assert.ok(issues.some((issue) => issue.code === "ONTOLOGY_DEPENDENCY_TYPE_UNKNOWN"));
  assert.ok(issues.some((issue) => issue.code === "ONTOLOGY_INTERACTION_MODE_UNKNOWN"));
  assert.ok(issues.some((issue) => issue.code === "ONTOLOGY_CAUSAL_DIRECTION_UNKNOWN"));
});

test("world accepts an ontology-backed relation and reports a disallowed one", () => {
  const engine = new Onto2D.Onto2DEngine();
  engine.loadOntology({ levels: [graphNodes()], descriptions: descriptions() });

  const validWorld = engine.createWorld();
  validWorld.createBody({ id: "parent", category: "0.0" });
  validWorld.createBody({ id: "child", category: "0.1" });
  validWorld.connect("parent", "child", {
    dependencyType: 0,
    interactionModes: [3],
    causalDirections: [0]
  });
  assert.deepEqual(validWorld.validate(), []);

  const invalidWorld = engine.createWorld();
  invalidWorld.createBody({ id: "parent", category: "0.0" });
  invalidWorld.createBody({ id: "child", category: "0.1" });
  invalidWorld.connect("child", "parent");
  assert.ok(invalidWorld.validate().some((issue) => issue.code === "RELATION_NOT_ALLOWED"));
});

test("destroying a body removes its incident relations", () => {
  const engine = new Onto2D.Onto2DEngine();
  engine.loadOntology({ levels: [graphNodes()], descriptions: descriptions() });
  const world = engine.createWorld();
  world.createBody({ id: "parent", category: "0.0" });
  world.createBody({ id: "child", category: "0.1" });
  world.connect("parent", "child");

  assert.equal(world.destroyBody("parent"), true);
  assert.equal(world.toJSON().relations.length, 0);
  assert.equal(world.destroyBody("missing"), false);
});
