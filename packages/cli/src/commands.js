import path from "node:path";
import { Onto2D } from "@onto2d/engine";
import { loadModelPackPath } from "@onto2d/model-pack/node";

function packSummary(pack) {
  const { manifest } = pack;
  return {
    model: manifest.model,
    identity: {
      rootHash: manifest.rootHash,
      manifestHash: manifest.manifestHash
    },
    compatibility: manifest.compatibility,
    statistics: manifest.statistics,
    source: {
      id: manifest.source.id,
      auditHash: manifest.source.auditHash ?? null,
      fileCount: manifest.source.files.length
    }
  };
}

async function loadPack(parsed, cwd) {
  const source = path.resolve(cwd, parsed.source);
  return loadModelPackPath(source);
}

async function loadContext(parsed, cwd) {
  const pack = await loadPack(parsed, cwd);
  const engine = await Onto2D.create({
    models: [pack],
    model: {
      id: pack.manifest.model.id,
      version: pack.manifest.model.version
    }
  });
  return { pack, engine };
}

function identifiers(nodes) {
  return nodes.map((node) => node.id);
}

export async function executeCommand(parsed, cwd) {
  if (parsed.command === "verify") {
    const pack = await loadPack(parsed, cwd);
    return {
      verified: true,
      release: packSummary(pack)
    };
  }

  const { pack, engine } = await loadContext(parsed, cwd);
  const model = engine.model;
  const release = packSummary(pack);
  if (parsed.command === "node") {
    const node = model.require(parsed.nodeId);
    return {
      release,
      node: node.toJSON(),
      adjacent: {
        parents: identifiers(model.parents(node.id)),
        children: identifiers(model.children(node.id))
      }
    };
  }

  if (parsed.command === "neighborhood") {
    const options = {
      depth: parsed.options.depth ?? 1,
      direction: parsed.options.direction ?? "both",
      selector: parsed.options.selector ?? {}
    };
    const neighborhood = model.neighborhood(parsed.nodeId, options);
    return {
      release,
      focusId: parsed.nodeId,
      options,
      nodes: neighborhood.nodes.map((node) => node.toJSON()),
      edges: neighborhood.edges,
      distance: neighborhood.distance
    };
  }

  const options = {
    maximumPaths: parsed.options.maximumPaths ?? 256,
    selector: parsed.options.selector ?? {}
  };
  const paths = model.paths({
    from: parsed.from,
    to: parsed.to,
    ...options
  });
  return {
    release,
    from: parsed.from,
    to: parsed.to,
    options,
    pathCount: paths.length,
    shortestLength: paths.length === 0 ? null : paths[0].length - 1,
    paths
  };
}
