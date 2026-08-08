export const policySchemaVersion = "1.0";
export const policyEngineVersion = "1.0.1";

function hasValue(value) {
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
}

function normalizeRequestId(value, fallback) {
  if (!hasValue(value)) return String(fallback);
  const normalized = String(value).replace(/[\r\n]/g, "").trim().slice(0, 200);
  return normalized || String(fallback);
}

function validateValue(field, value, contract) {
  const violations = [];
  const actualType = Array.isArray(value) ? "array" : typeof value;

  if (contract.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    return [{ field, code: "invalid_type", message: `${field} must be a finite number`, expected: "number" }];
  }
  if (contract.type === "string" && typeof value !== "string") {
    return [{ field, code: "invalid_type", message: `${field} must be a string`, expected: "string" }];
  }
  if (contract.type === "boolean" && typeof value !== "boolean") {
    return [{ field, code: "invalid_type", message: `${field} must be a boolean`, expected: "boolean" }];
  }
  if (contract.type === "array" && !Array.isArray(value)) {
    return [{ field, code: "invalid_type", message: `${field} must be an array`, expected: "array" }];
  }
  if (!["number", "string", "boolean", "array"].includes(contract.type)) {
    return [{ field, code: "invalid_contract", message: `Unsupported contract type for ${field}`, expected: contract.type, actual: actualType }];
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (contract.minLength !== undefined && normalized.length < contract.minLength) {
      violations.push({ field, code: "too_short", message: `${field} must contain at least ${contract.minLength} character(s)`, expected: `minLength:${contract.minLength}` });
    }
    if (contract.maxLength !== undefined && normalized.length > contract.maxLength) {
      violations.push({ field, code: "too_long", message: `${field} must contain at most ${contract.maxLength} characters`, expected: `maxLength:${contract.maxLength}` });
    }
    if (contract.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      violations.push({ field, code: "invalid_format", message: `${field} must be a valid email address`, expected: "email" });
    }
    if (contract.format === "date-time" && Number.isNaN(Date.parse(normalized))) {
      violations.push({ field, code: "invalid_format", message: `${field} must be an ISO 8601 date-time`, expected: "date-time" });
    }
    if (contract.pattern && !(new RegExp(contract.pattern)).test(normalized)) {
      violations.push({ field, code: "invalid_format", message: `${field} has an invalid format`, expected: contract.pattern });
    }
    if (contract.enum && !contract.enum.includes(normalized)) {
      violations.push({ field, code: "invalid_value", message: `${field} must be one of the supported values`, expected: contract.enum.join("|") });
    }
  }

  if (typeof value === "number") {
    if (contract.minimum !== undefined && value < contract.minimum) {
      violations.push({ field, code: "below_minimum", message: `${field} must be at least ${contract.minimum}`, expected: `minimum:${contract.minimum}` });
    }
    if (contract.maximum !== undefined && value > contract.maximum) {
      violations.push({ field, code: "above_maximum", message: `${field} must be at most ${contract.maximum}`, expected: `maximum:${contract.maximum}` });
    }
  }

  return violations;
}

export function matchesRule(rule, value) {
  switch (rule.operator) {
    case "missing": return !hasValue(value);
    case "truthy": return value === true;
    case "falsy": return value !== true;
    case "equals": return value === rule.value;
    case "includes": return Array.isArray(value) && value.includes(rule.value);
    case "gt": return Number(value) > Number(rule.value);
    case "gte": return Number(value) >= Number(rule.value);
    case "lt": return Number(value) < Number(rule.value);
    default: return false;
  }
}

export function evaluatePolicy({ policy, envelope, executionId, evaluatedAt }) {
  const input = envelope?.body ?? envelope;
  const headerRequestId = envelope?.headers?.["x-request-id"];
  const requestId = normalizeRequestId(headerRequestId, executionId);
  const schema = policy.inputSchema;
  const violations = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    violations.push({ field: "$", code: "invalid_type", message: "Request body must be a JSON object", expected: "object" });
  } else {
    for (const field of schema.required) {
      if (!hasValue(input[field])) {
        violations.push({ field, code: "required", message: `${field} is required`, expected: schema.properties[field].type });
      }
    }
    for (const [field, contract] of Object.entries(schema.properties)) {
      if (hasValue(input[field])) violations.push(...validateValue(field, input[field], contract));
    }
  }

  if (violations.length > 0) {
    return {
      ok: false,
      httpStatus: 400,
      requestId,
      error: "validation_error",
      message: "Request does not match the workflow input contract",
      details: {
        violations,
        missingFields: violations.filter((item) => item.code === "required").map((item) => item.field)
      },
      requestSchema: schema
    };
  }

  const matchedRules = policy.rules
    .map((rule, index) => ({ ...rule, ruleId: rule.id ?? `${rule.field}_${rule.operator}_${index + 1}` }))
    .filter((rule) => matchesRule(rule, input[rule.field]))
    .map(({ ruleId, field, points, reason, minimumBand }) => ({ ruleId, field, points, reason, ...(minimumBand ? { minimumBand } : {}) }));
  const rawScore = matchedRules.reduce((total, rule) => total + rule.points, 0);
  const minimumScore = matchedRules.reduce((floor, rule) => Math.max(floor, rule.minimumBand ? policy.thresholds[rule.minimumBand] : 0), 0);
  const score = Math.max(0, Math.min(100, Math.max(rawScore, minimumScore)));
  const priorityBand = score >= policy.thresholds.high ? "high" : score >= policy.thresholds.medium ? "medium" : "low";

  return {
    ok: true,
    httpStatus: 200,
    requestId,
    workflow: policy.slug,
    policyVersion: policy.policyVersion,
    decision: policy.decisions[priorityBand],
    priorityBand,
    score,
    matchedRules,
    recommendedActions: policy.actions,
    evaluatedAt
  };
}

export function buildPolicyExpression(policy, triggerName) {
  const evaluatorSource = evaluatePolicy.toString();
  const matcherSource = matchesRule.toString();
  const hasValueSource = hasValue.toString();
  const requestIdSource = normalizeRequestId.toString();
  const validatorSource = validateValue.toString();
  const serializedPolicy = JSON.stringify(policy, null, 2);

  if (serializedPolicy.includes("}}")) {
    throw new Error("Policy JSON contains an unescaped n8n expression terminator");
  }

  return `={{ (() => {
    const hasValue = ${hasValueSource};
    const normalizeRequestId = ${requestIdSource};
    const validateValue = ${validatorSource};
    const matchesRule = ${matcherSource};
    const evaluatePolicy = ${evaluatorSource};
    return evaluatePolicy({
      policy: ${serializedPolicy},
      envelope: $('${triggerName}').first().json,
      executionId: $execution.id,
      evaluatedAt: $now.toUTC().toISO()
    });
  })() }}`;
}
