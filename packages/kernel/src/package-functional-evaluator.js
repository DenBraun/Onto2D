import { canonicalClone, canonicalize, deepFreeze } from "./canonical.js";
import {
  accumulateDecimals,
  addDecimals,
  decimalToNumber,
  multiplyDecimals,
  parseDecimal,
  roundDecimal,
  subtractDecimals
} from "./decimal.js";
import { KernelError } from "./errors.js";
import { analyzeValueExpression } from "./expression-analyzer.js";
import { HASH_DOMAINS, hashCanonical } from "./hash.js";
import {
  candidateAttributeSymbolEnvironment,
  invariantSymbolEnvironment,
  invariantValueKind
} from "./invariant.js";
import {
  LOCAL_PREDICATE_EVALUATION_LIMITS,
  selectCanonicalValueSet
} from "./local-predicate-evaluator.js";
import { createPackageCandidateFilterSession } from "./package-candidate-filter.js";
import {
  createPackageDepthCandidateFilterSession
} from "./package-depth-candidate-filter.js";
import { normalizeQuantity, parseUnitExpression } from "./quantity.js";
import {
  PROFILE_INVARIANT_AGGREGATION_POLICY,
  aggregateProfileInvariantValues
} from "./profile-invariant-aggregation.js";
import { verifyLoadedPackage } from "./loaded-package-verifier.js";

export const PACKAGE_FUNCTIONAL_EVALUATOR_VERSION =
  "package-functional-evaluator-v1";
export const FUNCTIONAL_EXPRESSION_METHOD = "finite-functional-expression-v1";

const OPTION_FIELDS = new Set(["kernelVersion"]);
const PROFILE_INVARIANT_CONSENSUS_POLICY = "identical-normalized-quantity-v1";
const PROFILE_SCALAR_INVARIANT_CONSENSUS_POLICY = "identical-normalized-scalar-v1";
const INDETERMINATE_REASONS = new Set([
  "invariant-node-ambiguous",
  "invariant-value-unavailable",
  "profile-invariant-member-values-missing",
  "profile-invariant-member-values-disagree"
]);

class FunctionalIndeterminate extends Error {
  constructor(reason, details) {
    super(reason);
    this.reason = reason;
    this.details = details;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code, message, details = {}) {
  throw new KernelError({
    code,
    stage: "EVALUATE_PACKAGE_FUNCTIONAL",
    message,
    details
  });
}

function normalizedOptions(options) {
  let value;
  try {
    value = canonicalClone(options);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_FUNCTIONAL_OPTIONS_INVALID",
      "Package functional options are not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (!isObject(value)) {
    fail(
      "PACKAGE_FUNCTIONAL_OPTIONS_INVALID",
      "Package functional options must be an object."
    );
  }
  const unknown = Object.keys(value).filter((field) => !OPTION_FIELDS.has(field));
  if (unknown.length > 0) {
    fail(
      "PACKAGE_FUNCTIONAL_OPTION_UNKNOWN",
      "Unknown package functional evaluation option.",
      { unknown }
    );
  }
  if (
    value.kernelVersion !== undefined &&
    (
      typeof value.kernelVersion !== "string" ||
      value.kernelVersion.trim().length === 0 ||
      value.kernelVersion !== value.kernelVersion.trim()
    )
  ) {
    fail(
      "PACKAGE_FUNCTIONAL_KERNEL_VERSION_INVALID",
      "Expected kernel version must be a normalized non-empty string.",
      { value: value.kernelVersion }
    );
  }
  return value;
}

function normalizedFilter(input) {
  let value;
  try {
    value = canonicalClone(input);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    fail(
      "PACKAGE_FUNCTIONAL_FILTER_INVALID",
      "Package filter artifact is not canonicalizable.",
      { causeCode: error.code }
    );
  }
  if (
    !isObject(value) ||
    !isObject(value.formation) ||
    !isObject(value.formation.candidate)
  ) {
    fail(
      "PACKAGE_FUNCTIONAL_FILTER_INVALID",
      "Package functional evaluation requires a candidate-bearing filter artifact."
    );
  }
  return value;
}

function reproduceEligibleFilter(filterSession, filterInput) {
  const supplied = normalizedFilter(filterInput);
  const reproduced = filterSession.evaluate(supplied.formation.candidate);
  if (canonicalize(supplied) !== canonicalize(reproduced)) {
    fail(
      "PACKAGE_FUNCTIONAL_FILTER_MISMATCH",
      "Package filter artifact differs from deterministic reproduction.",
      {
        expectedFilterHash: reproduced.filterHash,
        actualFilterHash: typeof supplied.filterHash === "string"
          ? supplied.filterHash
          : null
      }
    );
  }
  if (reproduced.verdict !== "eligible") {
    fail(
      "PACKAGE_FUNCTIONAL_CANDIDATE_INELIGIBLE",
      "Functionals execute only for candidates with a reproduced eligible local verdict.",
      {
        candidateId: reproduced.formation.candidate.id,
        verdict: reproduced.verdict
      }
    );
  }
  return reproduced;
}

function findFunctional(loadedPackage, functionalId) {
  if (
    typeof functionalId !== "string" ||
    functionalId.trim().length === 0 ||
    functionalId !== functionalId.trim()
  ) {
    fail(
      "PACKAGE_FUNCTIONAL_ID_INVALID",
      "Functional identifier must be a normalized non-empty string.",
      { functionalId }
    );
  }
  const functional = loadedPackage.normalized.functionals
    .find((entry) => entry.id === functionalId);
  if (functional === undefined) {
    fail(
      "PACKAGE_FUNCTIONAL_NOT_FOUND",
      "Functional identifier is not declared by the loaded package.",
      { functionalId }
    );
  }
  return functional;
}

function reproduceAnalysis(loadedPackage, functional) {
  const invariants = invariantSymbolEnvironment(
    loadedPackage.normalized.primitives
  );
  const analysis = analyzeValueExpression(functional.expr, {
    environment: {
      invariants,
      attributes: candidateAttributeSymbolEnvironment(
        loadedPackage.normalized.candidateAttributes,
        invariants
      ),
      coefficients: functional.coefficients
    }
  });
  if (
    canonicalize(analysis.expression) !== canonicalize(functional.expr) ||
    !new Set(["number", "quantity"]).has(analysis.result.kind)
  ) {
    fail(
      "PACKAGE_FUNCTIONAL_ANALYSIS_MISMATCH",
      "Functional expression differs from its deterministic numeric analysis.",
      { functionalId: functional.id, resultKind: analysis.result.kind }
    );
  }
  return analysis;
}

function decimalMaximum(left, right) {
  return BigInt(subtractDecimals(left, right).coefficient) >= 0n ? left : right;
}

function decimalAbsolute(value) {
  const parsed = parseDecimal(value);
  return BigInt(parsed.coefficient) < 0n ? multiplyDecimals(parsed, -1) : parsed;
}

function quantityToleranceBound(quantity) {
  const absolute = parseDecimal(quantity.tolerance.absolute ?? 0);
  const relative = multiplyDecimals(
    parseDecimal(quantity.tolerance.relative ?? 0),
    parseDecimal(Math.abs(quantity.value))
  );
  return decimalMaximum(absolute, relative);
}

function nextPositiveBinary64(value) {
  if (value === 0) return Number.MIN_VALUE;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  view.setBigUint64(0, view.getBigUint64(0, false) + 1n, false);
  return view.getFloat64(0, false);
}

function outwardDecimalToNumber(value) {
  let converted;
  try {
    converted = decimalToNumber(value);
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    if (error.code === "DECIMAL_NUMBER_UNDERFLOW") return Number.MIN_VALUE;
    if (error.code !== "DECIMAL_NUMBER_OVERFLOW") throw error;
    fail(
      "PACKAGE_FUNCTIONAL_TOLERANCE_OVERFLOW",
      "Functional uncertainty cannot be represented as a finite outward binary64 bound.",
      { tolerance: parseDecimal(value).canonical }
    );
  }
  const difference = subtractDecimals(parseDecimal(converted), value);
  if (BigInt(difference.coefficient) >= 0n) return converted;
  const outward = nextPositiveBinary64(converted);
  if (!Number.isFinite(outward)) {
    fail(
      "PACKAGE_FUNCTIONAL_TOLERANCE_OVERFLOW",
      "Functional uncertainty cannot be represented as a finite outward binary64 bound.",
      { tolerance: parseDecimal(value).canonical }
    );
  }
  return outward;
}

function evidenceUnion(values) {
  return [...new Set(values.flatMap((value) => value.evidence))].sort();
}

function combineWitnesses(values) {
  return {
    selections: values.flatMap((value) => value.selections),
    invariants: values.flatMap((value) => value.invariants),
    coefficients: values.flatMap((value) => value.coefficients)
  };
}

function numberValue(value, fields = {}) {
  return {
    kind: "number",
    unrounded: parseDecimal(value),
    unit: "1",
    tolerance: parseDecimal(0),
    evidence: [],
    exact: true,
    selections: [],
    invariants: [],
    coefficients: [],
    ...fields
  };
}

function scalarValue(value, fields = {}) {
  return {
    kind: value === null ? "null" : typeof value,
    value,
    evidence: [],
    exact: true,
    selections: [],
    invariants: [],
    coefficients: [],
    ...fields
  };
}

function quantityValue(quantityInput, fields = {}) {
  const quantity = normalizeQuantity(quantityInput);
  return {
    kind: "quantity",
    unrounded: parseDecimal(quantity.value),
    unit: quantity.unit,
    tolerance: quantityToleranceBound(quantity),
    evidence: [...quantity.provenance.evidence],
    exact: true,
    selections: [],
    invariants: [],
    coefficients: [],
    ...fields
  };
}

function selectedNodes(graph, selector) {
  if (selector.kind === "canonical-index") {
    return selector.index < graph.nodes.length ? [selector.index] : [];
  }
  if (selector.kind === "all") return graph.nodes.map((_, index) => index);
  const expected = canonicalize(selector.equals);
  return graph.nodes.flatMap((node, index) => {
    const value = node.attrs?.[selector.attribute];
    const scalar = value === null ||
      ["string", "number", "boolean"].includes(typeof value);
    return scalar && canonicalize(value) === expected ? [index] : [];
  });
}

function runtimeIndexes(binding) {
  const selectedSource = new Set([
    "package-depth-candidate-binding-v2",
    "package-current-level-candidate-binding-v2"
  ]).has(binding.binder);
  const elements = selectedSource
    ? binding.sourcePopulation.elements
    : binding.sourcePopulation.population.elements;
  return {
    elements: new Map(
      elements.map((entry) => [entry.id, entry])
    ),
    profileClasses: new Map(
      binding.sourcePopulation.profileClasses.map((entry) => [entry.profileHash, entry])
    )
  };
}

function resolveInvariant(expression, path, graph, analysis, indexes, precision) {
  const nodeIndexes = expression.node === undefined
    ? graph.nodes.length === 1 ? [0] : []
    : selectedNodes(graph, expression.node);
  if (nodeIndexes.length !== 1) {
    throw new FunctionalIndeterminate("invariant-node-ambiguous", {
      path,
      name: expression.name,
      selector: expression.node ?? null,
      nodeIndexes
    });
  }
  const canonicalNode = nodeIndexes[0];
  const sourceRef = graph.nodes[canonicalNode].ref;
  const descriptor = analysis.symbols.invariants[expression.name];
  let value;
  let witnessBasis;
  let aggregationResult = null;
  if (graph.domain === "element-exact") {
    const element = indexes.elements.get(sourceRef);
    value = element?.invariants[expression.name];
    if (value === undefined) {
      throw new FunctionalIndeterminate("invariant-value-unavailable", {
        path,
        name: expression.name,
        canonicalNode,
        elementId: sourceRef
      });
    }
    witnessBasis = { elementId: sourceRef };
    assertInvariantValueMatchesDescriptor(value, descriptor, {
      path,
      name: expression.name,
      canonicalNode,
      elementId: sourceRef
    });
  } else {
    const profileClass = indexes.profileClasses.get(sourceRef);
    if (profileClass === undefined) {
      fail(
        "PACKAGE_FUNCTIONAL_PROFILE_CONTEXT_MISMATCH",
        "Candidate profile reference is absent from the reproduced binding.",
        { path, canonicalNode, profileHash: sourceRef }
      );
    }
    const missingElementIds = profileClass.members.filter((elementId) =>
      indexes.elements.get(elementId)?.invariants[expression.name] === undefined
    );
    if (missingElementIds.length > 0) {
      throw new FunctionalIndeterminate(
        "profile-invariant-member-values-missing",
        {
          path,
          name: expression.name,
          canonicalNode,
          profileHash: sourceRef,
          missingElementIds
        }
      );
    }
    const memberValues = profileClass.members.map((elementId) =>
      indexes.elements.get(elementId).invariants[expression.name]
    );
    profileClass.members.forEach((elementId, index) => {
      assertInvariantValueMatchesDescriptor(memberValues[index], descriptor, {
        path,
        name: expression.name,
        canonicalNode,
        profileHash: sourceRef,
        elementId
      });
    });
    if (expression.profileAggregation === PROFILE_INVARIANT_AGGREGATION_POLICY) {
      aggregationResult = aggregateProfileInvariantValues(
        descriptor,
        memberValues,
        precision
      );
      value = aggregationResult.value;
      witnessBasis = {
        profileHash: sourceRef,
        memberElementIds: [...profileClass.members],
        aggregation: aggregationResult.aggregation
      };
    } else {
      const first = canonicalize(memberValues[0]);
      const disagreeingElementIds = profileClass.members.filter((elementId, index) =>
        canonicalize(memberValues[index]) !== first
      );
      if (disagreeingElementIds.length > 0) {
        throw new FunctionalIndeterminate(
          "profile-invariant-member-values-disagree",
          {
            path,
            name: expression.name,
            canonicalNode,
            profileHash: sourceRef,
            memberElementIds: profileClass.members,
            disagreeingElementIds
          }
        );
      }
      value = memberValues[0];
      witnessBasis = {
        profileHash: sourceRef,
        memberElementIds: [...profileClass.members],
        consensusPolicy: descriptor.kind === "quantity"
          ? PROFILE_INVARIANT_CONSENSUS_POLICY
          : PROFILE_SCALAR_INVARIANT_CONSENSUS_POLICY
      };
    }
  }
  const witness = {
    expressionPath: path,
    name: expression.name,
    canonicalNode,
    ...witnessBasis,
    ...(descriptor.kind === "quantity"
      ? { quantity: value }
      : { valueKind: descriptor.kind, value })
  };
  if (aggregationResult !== null) {
    if (descriptor.kind === "quantity") {
      return {
        kind: "quantity",
        unrounded: aggregationResult.unrounded,
        unit: value.unit,
        tolerance: aggregationResult.tolerance,
        evidence: aggregationResult.evidence,
        exact: aggregationResult.exact,
        selections: [],
        invariants: [witness],
        coefficients: []
      };
    }
    return numberValue(aggregationResult.unrounded, {
      exact: aggregationResult.exact,
      invariants: [witness]
    });
  }
  if (descriptor.kind === "quantity") {
    return quantityValue(value, { invariants: [witness] });
  }
  if (descriptor.kind === "number") {
    return numberValue(value, { invariants: [witness] });
  }
  return scalarValue(value, { invariants: [witness] });
}

function assertInvariantValueMatchesDescriptor(value, descriptor, details) {
  const actualKind = invariantValueKind(value);
  if (descriptor === undefined || actualKind !== descriptor.kind) {
    fail(
      "PACKAGE_FUNCTIONAL_INVARIANT_TYPE_MISMATCH",
      "Resolved invariant differs from the reproduced functional symbol type.",
      {
        ...details,
        expectedKind: descriptor?.kind ?? null,
        actualKind
      }
    );
  }
  if (descriptor.kind !== "quantity") return;
  if (
    value.unit !== descriptor.unit ||
    value.semantic !== descriptor.semantic
  ) {
    fail(
      "PACKAGE_FUNCTIONAL_INVARIANT_TYPE_MISMATCH",
      "Resolved Quantity invariant differs from the reproduced functional symbol type.",
      {
        ...details,
        expectedKind: descriptor.kind,
        actualKind,
        expectedUnit: descriptor.unit,
        actualUnit: value.unit,
        expectedSemantic: descriptor.semantic,
        actualSemantic: value.semantic
      }
    );
  }
}

function multipliedUnit(values) {
  const factors = values
    .filter((value) => value.kind === "quantity" && value.unit !== "1")
    .map((value) => value.unit);
  return parseUnitExpression(factors.length === 0 ? "1" : factors.join("*")).canonicalUnit;
}

function selectedAttributeItems(expression, path, graph) {
  const selected = selectCanonicalValueSet(graph, expression.set);
  if (selected.indexes.length > LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectedValues) {
    fail(
      "PACKAGE_FUNCTIONAL_SELECTION_LIMIT",
      "Functional attribute aggregation exceeds the selected-value limit.",
      {
        path,
        attribute: expression.attribute,
        selected: selected.indexes.length,
        maximum: LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectedValues
      }
    );
  }
  const collection = expression.set.kind === "nodes" ? graph.nodes : graph.edges;
  const missingIndexes = [];
  const items = selected.indexes.flatMap((index) => {
    const attributes = collection[index].attrs;
    if (!attributes || !Object.prototype.hasOwnProperty.call(
      attributes,
      expression.attribute
    )) {
      missingIndexes.push(index);
      return [];
    }
    return [{ index, value: attributes[expression.attribute] }];
  });
  if (missingIndexes.length > 0) {
    fail(
      "PACKAGE_FUNCTIONAL_ATTRIBUTE_VALUE_UNAVAILABLE",
      "A selected candidate item does not provide the required structural attribute.",
      {
        path,
        attribute: expression.attribute,
        setKind: expression.set.kind,
        missingIndexes
      }
    );
  }
  return { items, selection: selected.selection };
}

function evaluateAttributeSum(expression, path, context) {
  const selected = selectedAttributeItems(expression, path, context.graph);
  const descriptor = context.analysis.symbols.attributes[expression.attribute];
  if (descriptor?.kind === "number") {
    const invalidIndexes = [];
    const values = selected.items.flatMap(({ index, value }) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return [parseDecimal(value)];
      }
      invalidIndexes.push(index);
      return [];
    });
    if (invalidIndexes.length > 0) {
      fail(
        "PACKAGE_FUNCTIONAL_ATTRIBUTE_VALUE_INVALID",
        "A selected candidate attribute does not match its declared numeric runtime type.",
        {
          path,
          attribute: expression.attribute,
          setKind: expression.set.kind,
          invalidIndexes
        }
      );
    }
    const accumulation = accumulateDecimals(
      values,
      context.precision.summation
    );
    return numberValue(accumulation.value, {
      exact: accumulation.exact,
      selections: [{
        expressionPath: path,
        ...selected.selection,
        attribute: expression.attribute,
        valueKind: "number",
        summation: accumulation.algorithm,
        accumulationExact: accumulation.exact
      }]
    });
  }
  if (descriptor?.kind !== "quantity") {
    fail(
      "PACKAGE_FUNCTIONAL_ATTRIBUTE_SUM_TYPE_INVALID",
      "A functional attribute sum requires a numeric or Quantity type.",
      { path, attribute: expression.attribute, kind: descriptor?.kind ?? null }
    );
  }
  const invalidIndexes = [];
  const unitMismatchIndexes = [];
  const semanticMismatchIndexes = [];
  const values = [];
  const toleranceBounds = [];
  const evidence = new Set();
  for (const { index, value } of selected.items) {
    let quantity;
    try {
      quantity = normalizeQuantity(value);
    } catch (error) {
      if (!(error instanceof KernelError)) throw error;
      invalidIndexes.push(index);
      continue;
    }
    if (quantity.unit !== descriptor.unit) {
      unitMismatchIndexes.push(index);
      continue;
    }
    if (quantity.semantic !== descriptor.semantic) {
      semanticMismatchIndexes.push(index);
      continue;
    }
    values.push(parseDecimal(quantity.value));
    toleranceBounds.push(quantityToleranceBound(quantity));
    quantity.provenance.evidence.forEach((entry) => evidence.add(entry));
  }
  if (invalidIndexes.length > 0) {
    fail(
      "PACKAGE_FUNCTIONAL_ATTRIBUTE_VALUE_INVALID",
      "A selected candidate attribute does not match its declared Quantity runtime type.",
      { path, attribute: expression.attribute, invalidIndexes }
    );
  }
  if (unitMismatchIndexes.length > 0) {
    fail(
      "PACKAGE_FUNCTIONAL_QUANTITY_UNIT_MISMATCH",
      "A selected Quantity attribute differs from its declared canonical unit.",
      {
        path,
        attribute: expression.attribute,
        expectedUnit: descriptor.unit,
        unitMismatchIndexes
      }
    );
  }
  if (semanticMismatchIndexes.length > 0) {
    fail(
      "PACKAGE_FUNCTIONAL_QUANTITY_SEMANTIC_MISMATCH",
      "A selected Quantity attribute differs from its declared semantic.",
      {
        path,
        attribute: expression.attribute,
        expectedSemantic: descriptor.semantic,
        semanticMismatchIndexes
      }
    );
  }
  const accumulation = accumulateDecimals(
    values,
    context.precision.summation
  );
  return {
    kind: "quantity",
    unrounded: accumulation.value,
    unit: descriptor.unit,
    tolerance: accumulateDecimals(
      toleranceBounds,
      "exact-decimal"
    ).value,
    evidence: [...evidence].sort(),
    exact: accumulation.exact,
    selections: [{
      expressionPath: path,
      ...selected.selection,
      attribute: expression.attribute,
      valueKind: "quantity",
      summation: accumulation.algorithm,
      accumulationExact: accumulation.exact,
      quantityUnit: descriptor.unit,
      quantitySemantic: descriptor.semantic,
      toleranceAggregation: "sum-effective-absolute-bounds-v1"
    }],
    invariants: [],
    coefficients: []
  };
}

function evaluateExpression(expression, path, context) {
  if (expression.kind === "constant") {
    if (isObject(expression.value)) return quantityValue(expression.value);
    return typeof expression.value === "number"
      ? numberValue(expression.value)
      : scalarValue(expression.value);
  }
  if (expression.kind === "coefficient") {
    const quantity = context.coefficients[expression.name];
    if (quantity === undefined) {
      fail(
        "PACKAGE_FUNCTIONAL_COEFFICIENT_MISSING",
        "Functional coefficient is absent from the normalized functional.",
        { path, name: expression.name }
      );
    }
    return quantityValue(quantity, {
      coefficients: [{ expressionPath: path, name: expression.name, quantity }]
    });
  }
  if (expression.kind === "invariant") {
    return resolveInvariant(
      expression,
      path,
      context.graph,
      context.analysis,
      context.indexes,
      context.precision
    );
  }
  if (expression.kind === "count") {
    const selected = selectCanonicalValueSet(context.graph, expression.set);
    if (selected.indexes.length > LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectedValues) {
      fail(
        "PACKAGE_FUNCTIONAL_SELECTION_LIMIT",
        "Functional set selection exceeds the local selected-value limit.",
        {
          path,
          selected: selected.indexes.length,
          maximum: LOCAL_PREDICATE_EVALUATION_LIMITS.maxSelectedValues
        }
      );
    }
    return numberValue(selected.indexes.length, {
      selections: [{ expressionPath: path, ...selected.selection }]
    });
  }
  if (expression.kind === "sum") {
    return evaluateAttributeSum(expression, path, context);
  }
  const field = expression.kind === "add" ? "terms" : "factors";
  const children = expression[field].map((child, index) =>
    evaluateExpression(child, `${path}.${field}[${index}]`, context)
  );
  const witnessFields = combineWitnesses(children);
  if (expression.kind === "add") {
    const accumulation = accumulateDecimals(
      children.map((child) => child.unrounded),
      context.precision.summation
    );
    return {
      kind: children.some((child) => child.kind === "quantity") ? "quantity" : "number",
      unrounded: accumulation.value,
      unit: children.find((child) => child.kind === "quantity")?.unit ?? "1",
      tolerance: accumulateDecimals(
        children.map((child) => child.tolerance),
        "exact-decimal"
      ).value,
      evidence: evidenceUnion(children),
      exact: accumulation.exact && children.every((child) => child.exact),
      ...witnessFields
    };
  }

  let unrounded = parseDecimal(1);
  let tolerance = parseDecimal(0);
  for (const child of children) {
    const nextTolerance = addDecimals(
      addDecimals(
        multiplyDecimals(decimalAbsolute(unrounded), child.tolerance),
        multiplyDecimals(decimalAbsolute(child.unrounded), tolerance)
      ),
      multiplyDecimals(tolerance, child.tolerance)
    );
    unrounded = multiplyDecimals(unrounded, child.unrounded);
    tolerance = nextTolerance;
  }
  return {
    kind: children.some((child) => child.kind === "quantity") ? "quantity" : "number",
    unrounded,
    unit: multipliedUnit(children),
    tolerance,
    evidence: evidenceUnion(children),
    exact: children.every((child) => child.exact),
    ...witnessFields
  };
}

/**
 * Internal verified-package expression runtime shared by package functionals
 * and complete cohort-key construction. Callers must first reproduce the
 * loaded package and package/run binding.
 */
export function createVerifiedPackageValueRuntime(binding) {
  const indexes = runtimeIndexes(binding);
  return Object.freeze({
    evaluate(graph, analysis, coefficients = {}) {
      try {
        return {
          status: "resolved",
          value: evaluateExpression(analysis.expression, "$", {
            graph,
            analysis,
            coefficients,
            precision: binding.runConfig.invariantPrecision,
            indexes
          })
        };
      } catch (error) {
        if (!(error instanceof FunctionalIndeterminate)) throw error;
        return {
          status: "indeterminate",
          reason: error.reason,
          details: error.details
        };
      }
    }
  });
}

function targetBound(specification, rounded) {
  const absolute = parseDecimal(specification.toleranceTarget.absolute ?? 0);
  const relative = multiplyDecimals(
    parseDecimal(specification.toleranceTarget.relative ?? 0),
    decimalAbsolute(rounded)
  );
  return decimalMaximum(absolute, relative);
}

function calculation(expressionResult, functional, precision, analysis) {
  const actualDimensions = parseUnitExpression(expressionResult.unit).dimensionSignature;
  if (actualDimensions !== analysis.result.dimensionSignature) {
    fail(
      "PACKAGE_FUNCTIONAL_RESULT_UNIT_MISMATCH",
      "Functional runtime result dimensions differ from reproduced analysis.",
      {
        functionalId: functional.id,
        runtimeUnit: expressionResult.unit,
        runtimeDimensions: actualDimensions,
        analysisUnit: analysis.result.unit,
        analysisDimensions: analysis.result.dimensionSignature
      }
    );
  }
  const rounded = roundDecimal(expressionResult.unrounded, precision);
  const toleranceTargetBound = targetBound(functional.result, rounded);
  const toleranceTargetMet = BigInt(subtractDecimals(
    expressionResult.tolerance,
    toleranceTargetBound
  ).coefficient) <= 0n;
  const effectiveAbsoluteTolerance = outwardDecimalToNumber(
    expressionResult.tolerance
  );
  const score = normalizeQuantity({
    value: decimalToNumber(rounded),
    unit: functional.result.unit,
    tolerance: { absolute: effectiveAbsoluteTolerance },
    semantic: functional.result.semantic,
    provenance: {
      kind: "computed",
      method: FUNCTIONAL_EXPRESSION_METHOD,
      evidence: expressionResult.evidence
    }
  });
  return {
    diagnostic: {
      unrounded: expressionResult.unrounded,
      rounded,
      exact: expressionResult.exact,
      expressionUnit: expressionResult.unit,
      effectiveAbsoluteTolerance: expressionResult.tolerance,
      toleranceTargetBound,
      toleranceTargetMet
    },
    score
  };
}

function indeterminateBasis(reason, details) {
  if (!INDETERMINATE_REASONS.has(reason)) {
    fail(
      "PACKAGE_FUNCTIONAL_INDETERMINATE_REASON_INVALID",
      "Functional runtime produced an unknown indeterminate reason.",
      { reason }
    );
  }
  return {
    status: "indeterminate",
    reason,
    details,
    score: null,
    diagnostic: null,
    selections: [],
    invariants: [],
    coefficients: []
  };
}

function evaluatePreparedFunctional(
  loadedPackage,
  binding,
  filter,
  functional,
  analysis,
  runtime
) {
  const graph = filter.formation.candidate;
  const precision = binding.runConfig.invariantPrecision;
  let evaluated;
  const expressionEvaluation = runtime.evaluate(
    graph,
    analysis,
    functional.coefficients
  );
  if (expressionEvaluation.status === "resolved") {
    const expressionResult = expressionEvaluation.value;
    const computed = calculation(
      expressionResult,
      functional,
      precision,
      analysis
    );
    evaluated = computed.diagnostic.toleranceTargetMet
      ? {
          status: "scored",
          score: computed.score,
          diagnostic: computed.diagnostic,
          selections: expressionResult.selections,
          invariants: expressionResult.invariants,
          coefficients: expressionResult.coefficients
        }
      : {
          status: "indeterminate",
          reason: "result-tolerance-target-unmet",
          details: {
            effectiveAbsoluteTolerance:
              computed.diagnostic.effectiveAbsoluteTolerance.canonical,
            toleranceTargetBound:
              computed.diagnostic.toleranceTargetBound.canonical
          },
          score: null,
          diagnostic: computed.diagnostic,
          selections: expressionResult.selections,
          invariants: expressionResult.invariants,
          coefficients: expressionResult.coefficients
        };
  } else {
    evaluated = indeterminateBasis(
      expressionEvaluation.reason,
      expressionEvaluation.details
    );
  }
  const basis = {
    schemaVersion: "1",
    evaluator: PACKAGE_FUNCTIONAL_EVALUATOR_VERSION,
    packageId: loadedPackage.packageId,
    rulesHash: loadedPackage.semanticManifest.rulesHash,
    bindingHash: binding.bindingHash,
    filterHash: filter.filterHash,
    candidateId: graph.id,
    functionalId: functional.id,
    expressionHash: analysis.expressionHash,
    analysisHash: analysis.analysisHash,
    resultSpecification: functional.result,
    precisionPolicy: precision,
    claimRefs: [...functional.claimRefs],
    ...evaluated
  };
  return deepFreeze({
    ...basis,
    evaluationHash: hashCanonical(HASH_DOMAINS.PACKAGE_FUNCTIONAL_EVALUATION, basis)
  });
}

/**
 * Evaluates a functional over a binding and eligible filter that were already
 * reproduced by a containing all-or-nothing artifact boundary.
 */
export function evaluateVerifiedPackageFunctional(
  loadedPackage,
  binding,
  filter,
  functionalId
) {
  if (!isObject(filter) || filter.verdict !== "eligible") {
    fail(
      "PACKAGE_FUNCTIONAL_CANDIDATE_INELIGIBLE",
      "Verified functional composition requires an eligible filter artifact.",
      {
        candidateId: filter?.formation?.candidate?.id ?? null,
        verdict: filter?.verdict ?? null
      }
    );
  }
  if (
    !isObject(filter.formation) ||
    !isObject(filter.formation.candidate) ||
    filter.bindingHash !== binding.bindingHash
  ) {
    fail(
      "PACKAGE_FUNCTIONAL_FILTER_MISMATCH",
      "Verified functional composition requires a filter from the supplied binding.",
      {
        expectedBindingHash: binding.bindingHash,
        actualBindingHash: filter.bindingHash ?? null
      }
    );
  }
  const functional = findFunctional(loadedPackage, functionalId);
  const analysis = reproduceAnalysis(loadedPackage, functional);
  const runtime = createVerifiedPackageValueRuntime(binding);
  return evaluatePreparedFunctional(
    loadedPackage,
    binding,
    filter,
    functional,
    analysis,
    runtime
  );
}

/**
 * Prepares one verified functional and reusable filter session. This is an
 * internal composition boundary for complete-cohort ranking; every supplied
 * filter is still reproduced before evaluation.
 */
export function createPackageFunctionalEvaluationSession(
  loadedPackageInput,
  bindingInput,
  functionalId,
  options = {}
) {
  const normalized = normalizedOptions(options);
  const loadedPackage = verifyLoadedPackage(loadedPackageInput, normalized);
  const filterSession = createPackageCandidateFilterSession(
    loadedPackage,
    bindingInput,
    normalized
  );
  return createPreparedPackageFunctionalEvaluationSession(
    loadedPackage,
    filterSession,
    functionalId
  );
}

/**
 * Internal composition boundary shared by primitive and depth-aware
 * functional sessions after their distinct filter bindings were reproduced.
 */
export function createPreparedPackageFunctionalEvaluationSession(
  loadedPackage,
  filterSession,
  functionalId
) {
  const binding = filterSession.binding;
  const functional = findFunctional(loadedPackage, functionalId);
  const analysis = reproduceAnalysis(loadedPackage, functional);
  const runtime = createVerifiedPackageValueRuntime(binding);
  function prepare(filterInput) {
    const filter = reproduceEligibleFilter(filterSession, filterInput);
    return Object.freeze({
      filter,
      evaluate(coefficients = functional.coefficients) {
        return evaluatePreparedFunctional(
          loadedPackage,
          binding,
          filter,
          { ...functional, coefficients },
          analysis,
          runtime
        );
      }
    });
  }
  return Object.freeze({
    loadedPackage,
    binding,
    functional,
    analysis,
    prepare,
    evaluate(filterInput) {
      return prepare(filterInput).evaluate();
    }
  });
}

/**
 * Prepares one functional over an exactly replayed depth-aware candidate
 * binding and its verified prior level closures.
 */
export function createPackageDepthFunctionalEvaluationSession(
  loadedPackageInput,
  bindingInput,
  levelClosuresInput,
  functionalId,
  options = {}
) {
  const normalized = normalizedOptions(options);
  const loadedPackage = verifyLoadedPackage(loadedPackageInput, normalized);
  const filterSession = createPackageDepthCandidateFilterSession(
    loadedPackage,
    bindingInput,
    levelClosuresInput,
    normalized
  );
  return createPreparedPackageFunctionalEvaluationSession(
    loadedPackage,
    filterSession,
    functionalId
  );
}

/**
 * Evaluates one normalized finite package functional only after exact
 * reproduction of an eligible local-filter artifact.
 */
export function evaluatePackageFunctional(
  loadedPackageInput,
  bindingInput,
  filterInput,
  functionalId,
  options = {}
) {
  return createPackageFunctionalEvaluationSession(
    loadedPackageInput,
    bindingInput,
    functionalId,
    options
  ).evaluate(filterInput);
}

/** Evaluates one functional after reproducing a depth-aware eligible filter. */
export function evaluatePackageDepthFunctional(
  loadedPackageInput,
  bindingInput,
  levelClosuresInput,
  filterInput,
  functionalId,
  options = {}
) {
  return createPackageDepthFunctionalEvaluationSession(
    loadedPackageInput,
    bindingInput,
    levelClosuresInput,
    functionalId,
    options
  ).evaluate(filterInput);
}
