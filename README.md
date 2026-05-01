**Onto2D**
Onto2D is a 2D semantic constraint engine for complex system modelling.

---

**Features**

**Semantic Graph Representation**

* Multilayer Emergence Graph structure
* Nodes represent complex, potentially recursive systems
* Supports structural folding and unfolding
* Causal and hierarchical relationships
* Dynamic approximation levels
* Integrated phase and system-level constraints

**Ontological Constraint Engine**

* Real-time validation of node connections
* Automatic enforcement of Emergence Catalogue rules
* Semantic collision detection (prevents invalid system configurations)
* Supports cross-level interaction with strict control
* Guided structural composition for users

**Interactive Tools**

* Visual 2D graph editor (Cytoscape.js-based)
* Manual and programmatic folding/unfolding of system nodes
* Approximation control per node or globally
* Structural integrity indicators and warnings
* Debug and trace tools for causal paths

**System Design**

* Data-driven JSON structure, compatible with OntoUML extensions
* Written in portable, modular JavaScript
* Designed for web-based and standalone applications
* Clear separation of visual layer and constraint logic
* Extensible plugin architecture for diagnostics, simulation, and AI assistants

**Samples**

* Preconfigured emergence catalogue samples
* Healthcare system modelling examples
* Biological, cognitive, and organizational system demos
* Diagnostic interface mockups with Paучок AI assistant

---

**Building and Installation**

**Prerequisites**

* Node.js and npm
* Recommended: modern browser for testing visual components

**Quick Start**

```bash
npm install
npm run dev
```

Opens a local development server with Onto2D visual environment.

**Production Build**

```bash
npm run build
```

Outputs optimized distributable files.

**Embedding Onto2D as a Library**

* Include core `onto2d.js` script in your project
* Instantiate with your system graph and constraint configuration
* Use exposed API for programmatic manipulation and validation

**Core Runtime Concept**

Onto2D separates the hidden ontology graph from the user world:

* `scr/level-*.json` and `scr/descriptions.json` define the hidden emergence catalogue.
* User-created bodies are concrete instances bound to ontology node categories.
* The engine validates body relations against the hidden graph and reports semantic contacts.

Minimal Node.js example:

```js
const fs = require("fs");
const Onto2D = require("./onto2d.js");

const levels = Array.from({ length: 8 }, (_, index) => {
  return JSON.parse(fs.readFileSync(`scr/level-${index}.json`, "utf8"));
});
const descriptions = JSON.parse(fs.readFileSync("scr/descriptions.json", "utf8"));

const engine = new Onto2D.Onto2DEngine();
engine.loadOntology({ levels, descriptions });

const world = engine.createWorld();

world.createBody({
  id: "protein_1",
  name: "Example protein",
  category: "3.0"
});

const capabilities = world.getCapabilities("protein_1");
const contacts = world.step().contacts;
```

---

**Compatibility**
Onto2D runs in any modern browser or Node.js environment.

Tested on:

* Windows, macOS, Linux
* Chromium-based and Firefox browsers

---

**Documentation**

* User Manual (work in progress)
* Technical Specification (includes Emergence Catalogue extensions)
* API Reference
* Visual Examples Gallery

---

**License**
Onto2D is developed by Denis Britov as part of the Causal Emergence Catalogue project and is distributed under the MIT license.

---
