**Onto2D**
Onto2D is a 2D semantic constraint engine for complex system modelling.

**Onto2D Version 1.0 Preview**

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

**Community**

* Discord Server (discussion, support, feature requests)
* GitHub Issues for bugs and feedback
* Planned GitHub Discussions space

**Contributing**
We welcome feedback and suggestions. For now, please file issues rather than direct pull requests. We aim to stabilize the core before accepting code contributions.

---

**License**
Onto2D is developed by Denis Britov as part of the Causal Emergence Catalogue project and is distributed under the MIT license.

---
