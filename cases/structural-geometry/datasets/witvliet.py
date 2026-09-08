"""Read pinned Witvliet exports and literal metadata without importing author code.

The native records and their channels remain available separately from the
declared unsigned, neuron-only, loop-free chemical projection. Tree-node IDs
are identifiers, not coordinates. An endpoint-only export cannot certify the
animal's full node universe or absent isolated cells.
"""

import ast
from collections import Counter, defaultdict
from copy import deepcopy
import hashlib
import json
from pathlib import Path

from sources import HERE, load_lock


DATASETS = tuple("Dataset%d" % index for index in range(1, 9))
NEURON_TYPES = frozenset(("sensory", "inter", "motor", "modulatory"))


def _literal(node):
    try:
        return ast.literal_eval(node)
    except (ValueError, TypeError, SyntaxError) as error:
        raise ValueError("Expected literal author metadata") from error


def _assignment(tree, name):
    matches = [node.value for node in tree.body if isinstance(node, ast.Assign)
               and any(isinstance(target, ast.Name) and target.id == name
                       for target in node.targets)]
    if len(matches) != 1:
        raise ValueError("Missing or repeated metadata assignment: " + name)
    value = matches[0]
    if isinstance(value, ast.Dict):
        keys = [_literal(key) for key in value.keys]
        if len(set(keys)) != len(keys):
            raise ValueError("Repeated metadata dictionary key: " + name)
    return _literal(value)


def _function(tree, name):
    matches = [node for node in tree.body
               if isinstance(node, ast.FunctionDef) and node.name == name]
    if len(matches) != 1:
        raise ValueError("Missing or repeated metadata function: " + name)
    return matches[0]


def _branch_classes(test, variable):
    if (isinstance(test, ast.Compare) and isinstance(test.left, ast.Name)
            and test.left.id == variable and len(test.ops) == 1):
        if isinstance(test.ops[0], ast.In):
            values = _literal(test.comparators[0])
            if not isinstance(values, (tuple, list)):
                raise ValueError("Metadata class group must be literal")
        elif isinstance(test.ops[0], ast.Eq):
            values = [_literal(test.comparators[0])]
        else:
            return None
        if any(not isinstance(value, str) or not value for value in values):
            raise ValueError("Invalid metadata class label")
        return values
    return None


def _shape(node, expression):
    return ast.dump(node) == ast.dump(ast.parse(expression, mode="eval").body)


def _members(expression, cls):
    """Recognize finite declarative member tables, never evaluate Python code."""
    if isinstance(expression, ast.List):
        if _shape(expression, "[cls]"):
            return [cls]
        value = _literal(expression)
        if any(not isinstance(label, str) or not label for label in value):
            raise ValueError("Invalid literal class member")
        return value
    if not isinstance(expression, ast.ListComp) or len(expression.generators) != 1:
        raise ValueError("Unsupported finite class member table: " + cls)
    generator = expression.generators[0]
    if generator.ifs or generator.is_async:
        raise ValueError("Unsupported class member condition")
    if isinstance(generator.iter, ast.Tuple):
        suffixes = _literal(generator.iter)
        if (not isinstance(generator.target, ast.Name) or generator.target.id != "n") or any(
                not isinstance(suffix, str) for suffix in suffixes):
            raise ValueError("Invalid class member suffix table")
        if _shape(expression.elt, "cls + n"):
            return [cls + suffix for suffix in suffixes]
        if _shape(expression.elt, "'BWM-' + n + cls[-2:]"):
            return ["BWM-" + suffix + cls[-2:] for suffix in suffixes]
    if (isinstance(generator.iter, ast.Call)
            and _shape(generator.iter.func, "range")
            and len(generator.iter.args) == 1 and not generator.iter.keywords
            and isinstance(generator.target, ast.Name) and generator.target.id == "i"):
        count = _literal(generator.iter.args[0])
        if type(count) is not int or not 1 <= count <= 100:
            raise ValueError("Invalid finite class member count")
        if _shape(expression.elt, "cls[:2] + str(i + 1)"):
            prefix = cls[:2]
        elif (isinstance(expression.elt, ast.BinOp)
              and isinstance(expression.elt.op, ast.Add)
              and _shape(expression.elt.right, "str(i + 1)")):
            prefix = _literal(expression.elt.left)
            if not isinstance(prefix, str):
                raise ValueError("Invalid finite class member prefix")
        else:
            raise ValueError("Unsupported finite class member expansion")
        return [prefix + str(index + 1) for index in range(count)]
    raise ValueError("Unsupported finite class member table: " + cls)


def parse_metadata(dataset_text, neuron_text, exporter_text):
    """Extract literal stages, source cell classification and exporter channels."""
    datasets = ast.parse(dataset_text)
    all_datasets = _assignment(datasets, "all_datasets")
    stages = _assignment(datasets, "stage")
    timepoints = _assignment(datasets, "timepoint")
    if (not isinstance(all_datasets, (list, tuple)) or tuple(all_datasets) != DATASETS
            or not isinstance(stages, dict)
            or not isinstance(timepoints, dict)):
        raise ValueError("Expected all eight ordered source datasets")
    for dataset in DATASETS:
        if stages.get(dataset) not in ("L1", "L2", "L3", "L4", "Adult"):
            raise ValueError("Missing or invalid source stage: " + dataset)
        if type(timepoints.get(dataset)) is not int or timepoints[dataset] < 0:
            raise ValueError("Missing or invalid source timepoint: " + dataset)

    neurons = ast.parse(neuron_text)
    classes = _assignment(neurons, "neuron_list")
    if (not isinstance(classes, (list, tuple)) or not classes
            or any(not isinstance(cls, str) or not cls for cls in classes)
            or len(set(classes)) != len(classes)):
        raise ValueError("Invalid source cell-class catalogue")
    types = {}
    for branch in _function(neurons, "ntype").body:
        if not isinstance(branch, ast.If):
            continue
        labels = _branch_classes(branch.test, "n")
        if labels is None:
            continue
        if len(branch.body) != 1 or not isinstance(branch.body[0], ast.Return):
            raise ValueError("Expected a literal cell-type table")
        cell_type = _literal(branch.body[0].value)
        if cell_type not in NEURON_TYPES | {"muscle", "other"}:
            raise ValueError("Unknown source cell type")
        for label in labels:
            if label in types:
                raise ValueError("Conflicting source cell type: " + label)
            types[label] = cell_type
    if set(classes) != set(types):
        raise ValueError("Cell-type table does not cover source catalogue exactly")

    expansions = {}
    member_function = _function(neurons, "class_members")
    if (not member_function.body or not isinstance(member_function.body[-1], ast.Return)
            or not _shape(member_function.body[-1].value, "[cls]")):
        raise ValueError("Unknown source member-table fallback")
    for branch in member_function.body:
        if not isinstance(branch, ast.If):
            continue
        labels = _branch_classes(branch.test, "cls")
        relevant = set(labels or ()) & set(classes)
        if not relevant:
            continue
        if len(branch.body) != 1 or not isinstance(branch.body[0], ast.Return):
            raise ValueError("Expected a finite cell-member table")
        for cls in sorted(relevant):
            if cls in expansions:
                raise ValueError("Conflicting source cell members: " + cls)
            expansions[cls] = _members(branch.body[0].value, cls)
    members = {}
    for cls in classes:
        for member in expansions.get(cls, [cls]):
            if member in members:
                raise ValueError("Conflicting source individual label: " + member)
            members[member] = {"class": cls, "type": types[cls]}

    exporter = _function(ast.parse(exporter_text), "export_nemanode_connections")
    channels = {}
    for node in exporter.body:
        if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Call):
            continue
        call = node.value
        if not isinstance(call.func, ast.Attribute) or call.func.attr != "assign":
            continue
        source_calls = [child.func.attr for child in ast.walk(call.func.value)
                        if isinstance(child, ast.Call)
                        and isinstance(child.func, ast.Attribute)
                        and isinstance(child.func.value, ast.Name)
                        and child.func.value.id == "data_manager"]
        if len(source_calls) != 1:
            raise ValueError("Ambiguous source export channel")
        keywords = {keyword.arg: _literal(keyword.value) for keyword in call.keywords}
        if (set(keywords) != {"typ", "syn"} or type(keywords["syn"]) is not int
                or keywords["syn"] != 1):
            raise ValueError("Unknown native export multiplicity policy")
        channel = {"get_synapses_one_to_one": "chemical",
                   "get_gapjunctions": "gap-junction"}.get(source_calls[0])
        code = keywords["typ"]
        if channel is None or type(code) is not int or code in channels:
            raise ValueError("Unknown or conflicting source export channel")
        channels[code] = channel
    if channels != {0: "chemical", 2: "gap-junction"}:
        raise ValueError("Source export channel encoding changed")
    return {"stages": stages, "timepoints": timepoints, "members": members,
            "classes": types, "channels": channels}


def _node(label, metadata):
    member = metadata["members"].get(label)
    if member is not None:
        return {"id": label, "class": member["class"], "type": member["type"],
                "labelResolution": "individual-member",
                "isNeuron": member["type"] in NEURON_TYPES}
    if label in metadata["classes"]:
        return {"id": label, "class": label, "type": metadata["classes"][label],
                "labelResolution": "class-label", "isNeuron": None}
    return {"id": label, "class": None, "type": "unclassified",
            "labelResolution": "unclassified", "isNeuron": None}


def adapt_records(records, dataset, metadata, source=None):
    """Validate the full native unit and derive explicitly separated channels."""
    if dataset not in DATASETS or not isinstance(records, list) or not records:
        raise ValueError("Expected a nonempty selected anatomical dataset")
    edges, nodes, grouped = [], set(), defaultdict(list)
    required = {"ids", "pre", "post", "pre_tid", "post_tid", "syn", "typ"}
    for index, record in enumerate(records):
        if not isinstance(record, dict) or set(record) != required:
            raise ValueError("Unexpected native connection fields at record %d" % index)
        for key in ("pre", "post"):
            if (not isinstance(record[key], str) or not record[key]
                    or record[key] != record[key].strip()):
                raise ValueError("Invalid native endpoint label")
        typ = record["typ"]
        if type(typ) is not int or typ not in metadata["channels"]:
            raise ValueError("Unknown native connection type")
        arrays = [record[key] for key in ("ids", "pre_tid", "post_tid", "syn")]
        if (any(not isinstance(values, list) or not values for values in arrays)
                or len({len(values) for values in arrays}) != 1):
            raise ValueError("Unaligned native contact arrays")
        if any(type(value) is not int or value <= 0 for values in arrays for value in values):
            raise ValueError("Invalid native contact identifier/count")
        if any(value != 1 for value in record["syn"]):
            raise ValueError("Native syn entries contradict the pinned exporter")
        contacts = list(zip(record["ids"], record["pre_tid"], record["post_tid"]))
        if len(set(contacts)) != len(contacts):
            raise ValueError("Repeated native contact within connection record")
        nodes.update((record["pre"], record["post"]))
        edge = {"source": record["pre"], "target": record["post"],
                "channel": metadata["channels"][typ], "nativeType": typ,
                "recordIndex": index, "contactCount": len(record["syn"])}
        edges.append(edge)
        grouped[(edge["source"], edge["target"], typ)].append(index)
    # Export grouping guarantees uniqueness. Retain the census field but fail
    # conflicting input instead of accidentally aggregating repeated records.
    if any(len(indexes) != 1 for indexes in grouped.values()):
        raise ValueError("Duplicate native pre/post/type connection record")
    node_metadata = [_node(label, metadata) for label in sorted(nodes)]
    neuron_nodes = [node["id"] for node in node_metadata if node["isNeuron"] is True]
    neurons = set(neuron_nodes)
    chemical = [edge for edge in edges if edge["channel"] == "chemical"]
    chemical_projection = [deepcopy(edge) for edge in chemical
                           if edge["source"] in neurons and edge["target"] in neurons
                           and edge["source"] != edge["target"]]
    chemical_projection.sort(key=lambda edge: (edge["source"], edge["target"]))
    gap_pairs = defaultdict(list)
    for edge in edges:
        if edge["channel"] == "gap-junction":
            gap_pairs[tuple(sorted((edge["source"], edge["target"])))].append(edge)
    gaps = []
    for (left, right), pair_edges in sorted(gap_pairs.items()):
        contact_sets = []
        for edge in pair_edges:
            record = records[edge["recordIndex"]]
            tids = (record["pre_tid"], record["post_tid"]) if edge["source"] == left \
                else (record["post_tid"], record["pre_tid"])
            contact_sets.append(Counter(zip(record["ids"], *tids)))
        if len(contact_sets) == 2 and contact_sets[0] != contact_sets[1]:
            raise ValueError("Conflicting mirrored gap-junction contacts")
        gaps.append({"source": left, "target": right, "channel": "gap-junction",
                     "directed": False, "contactCount": sum(contact_sets[0].values()),
                     "recordIndexes": sorted(edge["recordIndex"] for edge in pair_edges),
                     "mirrorStatus": "self-loop" if left == right else
                         "verified-mirror" if len(pair_edges) == 2 else "single-native-orientation"})
    census = {
        "id": dataset, "stage": metadata["stages"][dataset],
        "nativeRecordCount": len(records), "endpointNodeCount": len(nodes),
        "nativeContactEntries": sum(edge["contactCount"] for edge in edges),
        "chemicalRecordCount": len(chemical),
        "gapRecordCount": sum(edge["channel"] == "gap-junction" for edge in edges),
        "gapUndirectedPairCount": len(gaps),
        "gapMirrorCounts": dict(sorted(Counter(gap["mirrorStatus"] for gap in gaps).items())),
        "nativeSelfLoopCount": sum(edge["source"] == edge["target"] for edge in edges),
        "duplicateConnectionRecordCount": 0,
        "nodeTypeCounts": dict(sorted(Counter(node["type"] for node in node_metadata).items())),
        "nodeLabelResolutionCounts": dict(sorted(Counter(
            node["labelResolution"] for node in node_metadata).items())),
        "projectionNodeCount": len(neuron_nodes),
        "projectionEdgeCount": len(chemical_projection),
        "chemicalExcludedNonNeuronOrUnresolvedCount": sum(
            edge["source"] not in neurons or edge["target"] not in neurons for edge in chemical),
        "chemicalExcludedNeuronLoopCount": sum(
            edge["source"] in neurons and edge["target"] in neurons
            and edge["source"] == edge["target"] for edge in chemical),
        "completeNodeUniverse": False, "unobservedIsolates": None,
    }
    return {
        "id": dataset, "stage": metadata["stages"][dataset],
        "sourceTimepoint": metadata["timepoints"][dataset],
        "source": source, "independentUnit": dataset,
        "cohortRelation": "distinct-animal-cross-sectional",
        "nodes": sorted(nodes), "nodeMetadata": node_metadata, "edges": edges,
        "nativeRecords": deepcopy(records), "gapJunctionPairs": gaps,
        "coordinates": {"status": "not-supplied", "endpointTreeNodeIdsAreCoordinates": False},
        "nodeUniverse": {"basis": "all-native-record-endpoints", "complete": False,
                         "unobservedIsolates": None,
                         "metadataClassCatalogueIsAnimalCensus": False},
        "projection": {
            "id": "witvliet-neuron-chemical-simple-v1",
            "nodes": neuron_nodes, "edges": chemical_projection,
            "channel": "chemical", "directed": True, "signed": False,
            "weighted": False, "selfLoops": "excluded-and-counted",
            "multiplicity": "one-arc-per-ordered-pair; native contacts retained separately",
            "nodePolicy": "all-individual-neuron-endpoints-from-both-native-channels",
            "gapPolicy": "excluded; retained as separate undirected pairs with checked mirrors",
            "unknownLabels": "retained-in-native-data; excluded-from-neuron-projection",
        },
        "census": census,
    }


def adapt_witvliet(cache):
    """Verify every selected source and adapt all eight units deterministically."""
    cache = Path(cache)
    if cache.is_symlink():
        raise ValueError("Source cache must not be a symlink")
    entries = [entry for entry in load_lock(HERE / "source-lock.json")
               if entry["dataset"] == "celegans-witvliet-2021"]
    by_name = {entry["file"]: entry for entry in entries}
    required = {"witvliet2021-%s.py" % name for name in
                ("dataset_info", "neuron_info", "data_manager", "export_json")}
    required.update("witvliet2021-witvliet_2020_%d.json" % index for index in range(1, 9))
    if set(by_name) != required or len(entries) != len(required):
        raise ValueError("Unexpected Witvliet source inventory")
    contents = {}
    for entry in entries:
        path = cache / entry["file"]
        if path.is_symlink() or not path.is_file():
            raise ValueError("Missing regular source file: " + str(path))
        # Parse exactly the bounded bytes whose identity was checked. A later
        # replacement of the cache path cannot change this native snapshot.
        with path.open("rb") as source:
            content = source.read(entry["byteLength"] + 1)
        if (len(content), hashlib.sha256(content).hexdigest()) != (entry["byteLength"], entry["sha256"]):
            raise ValueError("Source bytes differ from lock: " + entry["file"])
        contents[entry["file"]] = content.decode("utf-8")
    metadata = parse_metadata(*[contents["witvliet2021-%s.py" % name]
                                for name in ("dataset_info", "neuron_info", "export_json")])
    units = []
    for index, dataset in enumerate(DATASETS, 1):
        name = "witvliet2021-witvliet_2020_%d.json" % index
        records = json.loads(contents[name])
        source = {key: by_name[name][key] for key in
                  ("file", "sha256", "sourcePath", "sourceCommit")}
        units.append(adapt_records(records, dataset, metadata, source))
    return {
        "format": "onto2d-witvliet-native-v1", "dataset": "celegans-witvliet-2021",
        "version": 1, "units": units,
        "sourceMetadata": [{key: entry[key] for key in
                            ("file", "sha256", "sourcePath", "sourceCommit")}
                           for entry in entries if entry["file"].endswith(".py")],
        "classificationPolicy": {
            "sourceFile": "witvliet2021-neuron_info.py",
            "basis": "finite class_members tables joined to literal ntype class tables",
            "classLabelsWithMultipleMembers": "unresolved; excluded from individual-neuron projection",
            "unknownSourceLabels": "preserved without invented aliases",
            "authorIsNeuronFunctionExecuted": False,
        },
        "census": {"unitCount": len(units), "units": [unit["census"] for unit in units],
                   "stageCounts": dict(sorted(Counter(unit["stage"] for unit in units).items())),
                   "scoringPerformed": False},
    }
