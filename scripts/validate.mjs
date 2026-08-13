#!/usr/bin/env node

// src/validator.ts
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// src/lib/errors.ts
var EXIT_CODES = {
  success: 0,
  validation: 1,
  usage: 2,
  prerequisite: 3,
  operational: 4,
  internal: 5
};
var GraphKeeperError = class extends Error {
  code;
  kind;
  exitCode;
  context;
  constructor(code, kind, message, context) {
    super(message);
    this.name = "GraphKeeperError";
    this.code = code;
    this.kind = kind;
    this.exitCode = EXIT_CODES[kind];
    if (context !== void 0) this.context = context;
  }
};
function diagnostic(code, message, context) {
  if (!/^GK[0-9]{3}$/.test(code)) throw new TypeError("Invalid GK diagnostic code: " + code);
  return context === void 0 ? code + " " + message : code + " [" + context + "] " + message;
}

// src/lib/git.ts
import { isAbsolute, resolve } from "node:path";

// src/lib/process.ts
import { spawn } from "node:child_process";
async function runProcess(command, args, options = {}) {
  return new Promise((resolveResult) => {
    let settled = false;
    let timedOut = false;
    let timer;
    const stdout = [];
    const stderr = [];
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer !== void 0) clearTimeout(timer);
      resolveResult(result);
    };
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", (error) => {
      finish({
        exitCode: null,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        problem: error.code === "ENOENT" ? "missing" : "spawn",
        error
      });
    });
    child.once("close", (code) => {
      finish({
        exitCode: timedOut ? null : code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        ...timedOut ? { problem: "timeout" } : {}
      });
    });
    if (options.timeoutMs !== void 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutMs);
    }
  });
}

// src/lib/git.ts
async function git(cwd, args) {
  return runProcess("git", args, { cwd, timeoutMs: 1e4 });
}
function gitFailure(message, stderr) {
  const detail = stderr.trim();
  return new GraphKeeperError("GK004", "operational", detail.length === 0 ? message : message + ": " + detail);
}
async function findGitRoot(cwd) {
  const result = await git(cwd, ["rev-parse", "--show-toplevel"]);
  if (result.exitCode !== 0) throw gitFailure("not inside a Git repository", result.stderr);
  return resolve(result.stdout.trim());
}

// src/lib/git-snapshot.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
var GRAPH_DOCUMENTS = [
  ["entities", "graph/entities.json"],
  ["claims", "graph/claims.json"],
  ["runs", "graph/runs.json"]
];
function emptyDocument(path) {
  return { path, content: "[]\n", missing: true };
}
function documentsFrom(entries) {
  const entities = entries.get("entities");
  const claims = entries.get("claims");
  const runs = entries.get("runs");
  if (entities === void 0 || claims === void 0 || runs === void 0) {
    throw new Error("incomplete graph snapshot");
  }
  return { entities, claims, runs };
}
async function git2(runner, repositoryRoot, args) {
  return runner("git", args, { cwd: repositoryRoot, timeoutMs: 1e4 });
}
async function loadWorktreeDocuments(repositoryRoot, issues) {
  const documents = /* @__PURE__ */ new Map();
  for (const [name, path] of GRAPH_DOCUMENTS) {
    try {
      const content = await readFile(join(repositoryRoot, ...path.split("/")), "utf8");
      documents.set(name, { path, content, missing: false });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : void 0;
      if (code === "ENOENT") {
        issues.push({
          code: "GK101",
          phase: "load",
          context: path,
          message: "required file is missing; fix: restore it or run graphkeeper init"
        });
      } else {
        issues.push({
          code: "GK004",
          phase: "load",
          context: path,
          message: "cannot read file; fix: restore read permission"
        });
      }
      documents.set(name, emptyDocument(path));
    }
  }
  return documentsFrom(documents);
}
async function loadStagedDocuments(repositoryRoot, runner, issues) {
  const documents = /* @__PURE__ */ new Map();
  for (const [name, path] of GRAPH_DOCUMENTS) {
    const specifier = ":" + path;
    const exists = await git2(runner, repositoryRoot, ["cat-file", "-e", specifier]);
    if (exists.exitCode !== 0) {
      issues.push({
        code: "GK101",
        phase: "load",
        context: path,
        message: "required staged file is missing; fix: add and stage the required file"
      });
      documents.set(name, emptyDocument(path));
      continue;
    }
    const selected = await git2(runner, repositoryRoot, ["show", specifier]);
    if (selected.exitCode !== 0) {
      issues.push({
        code: "GK004",
        phase: "load",
        context: path,
        message: "cannot read staged file; fix: restage a readable file"
      });
      documents.set(name, emptyDocument(path));
      continue;
    }
    documents.set(name, { path, content: selected.stdout, missing: false });
  }
  return documentsFrom(documents);
}
async function loadHeadDocuments(repositoryRoot, runner) {
  const head = await git2(runner, repositoryRoot, ["rev-parse", "--verify", "HEAD"]);
  if (head.exitCode !== 0) return null;
  const documents = /* @__PURE__ */ new Map();
  for (const [name, path] of GRAPH_DOCUMENTS) {
    const result = await git2(runner, repositoryRoot, ["show", "HEAD:" + path]);
    documents.set(name, result.exitCode === 0 ? { path, content: result.stdout, missing: false } : emptyDocument(path));
  }
  return documentsFrom(documents);
}
function parseEvidenceChanges(output) {
  if (output.length === 0) return [];
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  const changes = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index] ?? "";
    index += 1;
    const pathCount = status.startsWith("R") || status.startsWith("C") ? 2 : 1;
    const paths = fields.slice(index, index + pathCount);
    index += pathCount;
    if (status.length > 0 && paths.length === pathCount) changes.push({ status, paths });
  }
  return changes;
}
async function loadEvidenceChanges(repositoryRoot, mode, runner, hasBaseline, issues) {
  if (!hasBaseline) return { changes: [], stderr: "" };
  const args = [
    "diff",
    ...mode === "--staged" ? ["--cached"] : [],
    "--name-status",
    "-z",
    "--diff-filter=MDR",
    "HEAD",
    "--",
    "evidence/"
  ];
  const result = await git2(runner, repositoryRoot, args);
  if (result.exitCode !== 0) {
    issues.push({
      code: "GK004",
      phase: "evidence",
      message: mode === "--staged" ? "unable to compare staged evidence with HEAD" : "unable to compare evidence with HEAD"
    });
    return { changes: [], stderr: result.stderr };
  }
  return { changes: parseEvidenceChanges(result.stdout), stderr: result.stderr };
}
async function loadValidationSnapshot(options) {
  const runner = options.runner ?? runProcess;
  const issues = [];
  const current = options.mode === "--staged" ? await loadStagedDocuments(options.repositoryRoot, runner, issues) : await loadWorktreeDocuments(options.repositoryRoot, issues);
  const head = await loadHeadDocuments(options.repositoryRoot, runner);
  const evidence = await loadEvidenceChanges(
    options.repositoryRoot,
    options.mode,
    runner,
    head !== null,
    issues
  );
  return {
    mode: options.mode,
    current,
    head,
    evidenceChanges: evidence.changes,
    evidenceStderr: evidence.stderr,
    issues
  };
}

// src/lib/validation.ts
import { isDeepStrictEqual } from "node:util";

// src/lib/records.ts
var CLAIM_ID = /^claim_[0-9a-f]{8}$/;
var RUN_ID = /^run_[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9][a-z0-9_-]*$/;
var SLUG = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
var UTC_TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/;
var EVIDENCE_REF = /^evidence\/[^\s#]+#L[0-9]+-L[0-9]+$/;
var EVIDENCE_PATH = /^evidence\/[^\s#]+$/;
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}
function assertExactKeys(record, required, optional, label) {
  for (const key of required) {
    if (!hasOwn(record, key)) throw new Error(label + " is missing required field " + key);
  }
  const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
  const unknown = Object.keys(record).find((key) => !allowed.has(key));
  if (unknown !== void 0) throw new Error(label + " has unknown field " + unknown);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function isUtcTimestamp(value) {
  if (typeof value !== "string" || !UTC_TIMESTAMP.test(value)) return false;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;
  return new Date(milliseconds).toISOString().replace(".000Z", "Z") === value;
}
function hasSafeSegments(path) {
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
function isEvidenceReference(value) {
  return typeof value === "string" && EVIDENCE_REF.test(value) && hasSafeSegments(value.split("#", 1)[0] ?? "");
}
function isEvidencePath(value) {
  return typeof value === "string" && EVIDENCE_PATH.test(value) && hasSafeSegments(value);
}
function isUniqueStringArray(value, item) {
  return Array.isArray(value) && value.every((entry) => isNonEmptyString(entry) && (item === void 0 || item(entry))) && new Set(value).size === value.length;
}
function validateSource(value) {
  if (!isObject(value)) throw new Error("source must be an object");
  if (value.kind === "tool_output") {
    assertExactKeys(value, ["kind", "command", "exit_code", "ref", "captured"], [], "tool_output source");
    if (!isNonEmptyString(value.command)) throw new Error("tool_output command must be non-empty");
    if (!Number.isInteger(value.exit_code) || value.exit_code < 0 || value.exit_code > 255) {
      throw new Error("tool_output exit_code must be an integer from 0 through 255");
    }
    if (!isEvidenceReference(value.ref)) throw new Error("tool_output ref must be a canonical evidence reference");
    if (!isUtcTimestamp(value.captured)) throw new Error("tool_output captured must be an ISO 8601 UTC timestamp");
    return;
  }
  if (value.kind === "inference") {
    assertExactKeys(value, ["kind", "basis"], [], "inference source");
    if (!isNonEmptyString(value.basis)) throw new Error("inference basis must be non-empty");
    return;
  }
  throw new Error("source kind must be tool_output or inference");
}
function validateClaim(value) {
  if (!isObject(value)) throw new Error("claim must be an object");
  assertExactKeys(
    value,
    ["id", "subject", "predicate", "object", "source", "produced_by", "created"],
    ["confidence", "supersedes"],
    "claim"
  );
  if (typeof value.id !== "string" || !CLAIM_ID.test(value.id)) throw new Error("invalid claim ID");
  if (!isNonEmptyString(value.subject)) throw new Error("claim subject must be non-empty");
  if (typeof value.predicate !== "string" || !SLUG.test(value.predicate)) throw new Error("claim predicate must be snake_case");
  if (!isNonEmptyString(value.object)) throw new Error("claim object must be non-empty");
  const source = value.source;
  validateSource(source);
  if (typeof value.produced_by !== "string" || !RUN_ID.test(value.produced_by)) throw new Error("invalid producing run ID");
  if (!isUtcTimestamp(value.created)) throw new Error("claim created must be an ISO 8601 UTC timestamp");
  if (hasOwn(value, "confidence") && (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1)) {
    throw new Error("claim confidence must be from 0 through 1");
  }
  if (value.confidence === 1 && source.kind === "inference") {
    throw new Error("claim confidence 1 requires a non-inference source");
  }
  if (hasOwn(value, "supersedes") && (typeof value.supersedes !== "string" || !CLAIM_ID.test(value.supersedes))) {
    throw new Error("invalid superseded claim ID");
  }
}
function validateEntity(value) {
  if (!isObject(value)) throw new Error("entity must be an object");
  assertExactKeys(value, ["id", "type", "aliases", "first_seen"], ["source_docs"], "entity");
  if (typeof value.id !== "string" || !SLUG.test(value.id)) throw new Error("invalid entity ID");
  if (typeof value.type !== "string" || !SLUG.test(value.type)) throw new Error("invalid entity type");
  if (!isUniqueStringArray(value.aliases)) throw new Error("entity aliases must be unique non-empty strings");
  if (hasOwn(value, "source_docs") && !isUniqueStringArray(value.source_docs, isEvidenceReference)) {
    throw new Error("entity source_docs must be unique evidence references");
  }
  if (!isUtcTimestamp(value.first_seen)) throw new Error("entity first_seen must be an ISO 8601 UTC timestamp");
}
function validateRun(value) {
  if (!isObject(value)) throw new Error("run must be an object");
  assertExactKeys(value, ["id", "started", "tool", "evidence", "claims_written"], ["task", "ended", "verdict"], "run");
  if (typeof value.id !== "string" || !RUN_ID.test(value.id)) throw new Error("invalid run ID");
  if (!isUtcTimestamp(value.started)) throw new Error("run started must be an ISO 8601 UTC timestamp");
  if (!isNonEmptyString(value.tool)) throw new Error("run tool must be non-empty");
  if (hasOwn(value, "task") && !isNonEmptyString(value.task)) throw new Error("run task must be non-empty");
  if (!isUniqueStringArray(value.evidence, isEvidencePath)) throw new Error("run evidence must contain unique evidence paths");
  if (!isUniqueStringArray(value.claims_written, (id) => CLAIM_ID.test(id))) {
    throw new Error("run claims_written must contain unique claim IDs");
  }
  const hasEnded = hasOwn(value, "ended");
  const hasVerdict = hasOwn(value, "verdict");
  if (hasEnded !== hasVerdict) throw new Error("run ended and verdict must appear together");
  if (hasEnded) {
    if (!isUtcTimestamp(value.ended)) throw new Error("run ended must be an ISO 8601 UTC timestamp");
    if (Date.parse(value.ended) < Date.parse(value.started)) throw new Error("run ended cannot precede started");
    if (!["passed", "failed", "inconclusive", "aborted"].includes(value.verdict)) throw new Error("invalid run verdict");
  }
}
function validateRecords(value, recordType, validate) {
  if (!Array.isArray(value)) return [{ recordType, message: "expected a top-level array" }];
  const ids = /* @__PURE__ */ new Set();
  const issues = [];
  value.forEach((entry, index) => {
    try {
      validate(entry);
      const id = entry.id;
      if (ids.has(id)) throw new Error("duplicate ID " + id);
      ids.add(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const id = isObject(entry) && typeof entry.id === "string" ? entry.id : void 0;
      issues.push({
        recordType,
        index,
        ...id === void 0 ? {} : { id },
        message
      });
    }
  });
  return issues;
}
function validateClaimRecords(value) {
  return validateRecords(value, "claims", validateClaim);
}
function validateEntityRecords(value) {
  return validateRecords(value, "entities", validateEntity);
}
function validateRunRecords(value) {
  return validateRecords(value, "runs", validateRun);
}

// src/lib/validation.ts
function isObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasOwn2(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
function asObjects(value) {
  return Array.isArray(value) ? value.filter(isObject2) : [];
}
function parseDocument(document) {
  try {
    return { value: JSON.parse(document.content) };
  } catch {
    return {
      issue: diagnostic(
        "GK102",
        "invalid JSON; fix: restore a valid JSON array",
        document.path
      )
    };
  }
}
function jqText(value) {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
function recordIds(value) {
  if (!Array.isArray(value)) return "root";
  return value.map((entry, index) => {
    if (!isObject2(entry)) return "index_" + index;
    const id = entry.id;
    return id === null || id === void 0 || id === false ? "index_" + index : jqText(id);
  }).join(",");
}
function duplicateIds(value) {
  if (!Array.isArray(value)) return [];
  const counts = /* @__PURE__ */ new Map();
  for (const entry of value) {
    if (!isObject2(entry) || typeof entry.id !== "string") continue;
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();
}
function schemaDiagnostic(code, path, value, description, fix) {
  const ids = recordIds(value);
  const duplicates = duplicateIds(value);
  const detail = (duplicates.length === 0 ? "" : "duplicate_ids=" + duplicates.join(",") + "; ") + "records=" + ids;
  return diagnostic(code, description + " (" + detail + "); fix: " + fix, path + ":" + ids);
}
function stringId(record) {
  return typeof record.id === "string" ? record.id : void 0;
}
function indexById(records) {
  const result = /* @__PURE__ */ new Map();
  for (const record of records) {
    const id = stringId(record);
    if (id !== void 0) result.set(id, record);
  }
  return result;
}
function cycleMembers(claims, byClaim) {
  const members = /* @__PURE__ */ new Set();
  for (const claim of claims) {
    const start = stringId(claim);
    if (start === void 0) continue;
    const path = [];
    let current = start;
    while (current !== void 0 && byClaim.has(current)) {
      const repeatedAt = path.indexOf(current);
      if (repeatedAt !== -1) {
        for (const member of path.slice(repeatedAt)) members.add(member);
        break;
      }
      path.push(current);
      const next = byClaim.get(current)?.supersedes;
      current = typeof next === "string" ? next : void 0;
    }
  }
  return [...members].sort();
}
function findRelationProblem(documents) {
  if (!Array.isArray(documents.claims)) return null;
  const claims = asObjects(documents.claims);
  const entities = asObjects(documents.entities);
  const runs = asObjects(documents.runs);
  const byClaim = indexById(claims);
  const byEntity = indexById(entities);
  const byRun = indexById(runs);
  const successors = /* @__PURE__ */ new Map();
  for (const claim of claims) {
    if (!hasOwn2(claim, "supersedes")) continue;
    const target = claim.supersedes;
    const id = stringId(claim);
    if (typeof target === "string" && id !== void 0) {
      const ids2 = successors.get(target) ?? [];
      ids2.push(id);
      successors.set(target, ids2);
    }
  }
  const forks = [...successors.entries()].filter(([, ids2]) => ids2.length > 1).sort(([left], [right]) => left.localeCompare(right));
  const cycles = cycleMembers(claims, byClaim);
  let valid = claims.length === documents.claims.length && entities.length === (Array.isArray(documents.entities) ? documents.entities.length : 0) && runs.length === (Array.isArray(documents.runs) ? documents.runs.length : 0);
  for (const claim of claims) {
    if (typeof claim.subject !== "string" || !byEntity.has(claim.subject)) valid = false;
    if (typeof claim.produced_by !== "string" || !byRun.has(claim.produced_by)) valid = false;
    if (hasOwn2(claim, "supersedes") && (typeof claim.supersedes !== "string" || !byClaim.has(claim.supersedes))) valid = false;
  }
  if (forks.length > 0 || cycles.length > 0) valid = false;
  const writtenByRun = /* @__PURE__ */ new Map();
  const evidenceByRun = /* @__PURE__ */ new Map();
  for (const run of runs) {
    const runId = stringId(run);
    if (runId === void 0 || !Array.isArray(run.claims_written) || !Array.isArray(run.evidence)) {
      valid = false;
      continue;
    }
    const written = new Set(run.claims_written.filter((id) => typeof id === "string"));
    const evidence = new Set(run.evidence.filter((path) => typeof path === "string"));
    writtenByRun.set(runId, written);
    evidenceByRun.set(runId, evidence);
    for (const claimId of written) {
      const claim = byClaim.get(claimId);
      if (claim === void 0 || claim.produced_by !== runId) valid = false;
    }
  }
  for (const claim of claims) {
    const id = stringId(claim);
    const runId = typeof claim.produced_by === "string" ? claim.produced_by : void 0;
    if (id === void 0 || runId === void 0 || writtenByRun.get(runId)?.has(id) !== true) valid = false;
    if (isObject2(claim.source) && claim.source.kind === "tool_output") {
      const reference = claim.source.ref;
      const path = typeof reference === "string" ? reference.split("#", 1)[0] : void 0;
      if (path === void 0 || runId === void 0 || evidenceByRun.get(runId)?.has(path) !== true) valid = false;
    }
  }
  if (valid) return null;
  const topology = [];
  if (forks.length > 0) {
    topology.push("forks: " + forks.map(([target, ids2]) => target + " superseded by " + [...ids2].sort().join(",")).join(" | "));
  }
  if (cycles.length > 0) topology.push("cycle members: " + cycles.join(","));
  const topologyContext = forks[0]?.[0] ?? cycles[0];
  if (topology.length > 0 && topologyContext !== void 0) {
    return { context: topologyContext, detail: topology.join("; ") };
  }
  const unknownSubject = claims.find((claim) => typeof claim.subject !== "string" || !byEntity.has(claim.subject));
  if (unknownSubject !== void 0) {
    return {
      context: stringId(unknownSubject) ?? "graph/claims.json",
      detail: (stringId(unknownSubject) ?? "null") + " has unknown subject " + jqText(unknownSubject.subject)
    };
  }
  const unknownRun = claims.find((claim) => typeof claim.produced_by !== "string" || !byRun.has(claim.produced_by));
  if (unknownRun !== void 0) {
    return {
      context: stringId(unknownRun) ?? "graph/claims.json",
      detail: (stringId(unknownRun) ?? "null") + " has unknown run " + jqText(unknownRun.produced_by)
    };
  }
  const unknownTarget = claims.find((claim) => hasOwn2(claim, "supersedes") && (typeof claim.supersedes !== "string" || !byClaim.has(claim.supersedes)));
  if (unknownTarget !== void 0) {
    return {
      context: stringId(unknownTarget) ?? "graph/claims.json",
      detail: (stringId(unknownTarget) ?? "null") + " has unknown supersedes target " + jqText(unknownTarget.supersedes)
    };
  }
  const ids = claims.map((claim) => stringId(claim) ?? "null").join(",");
  return {
    context: stringId(claims[0] ?? {}) ?? "graph/claims.json",
    detail: ids + " has inconsistent cross-references, a supersession cycle, or provenance"
  };
}
function containsAll(oldValues, newValues) {
  if (!Array.isArray(oldValues) || !Array.isArray(newValues)) return false;
  return oldValues.every((oldValue) => newValues.some((newValue) => isDeepStrictEqual(oldValue, newValue)));
}
function changedClaimIds(oldValue, currentValue) {
  if (!Array.isArray(oldValue) || !Array.isArray(currentValue)) return ["unknown"];
  return asObjects(oldValue).filter((oldClaim) => !asObjects(currentValue).some((currentClaim) => currentClaim.id === oldClaim.id && isDeepStrictEqual(currentClaim, oldClaim))).map((claim) => stringId(claim) ?? "null");
}
function entityPreserved(oldEntity, current) {
  return current.some((entity) => entity.id === oldEntity.id && entity.type === oldEntity.type && entity.first_seen === oldEntity.first_seen && containsAll(oldEntity.aliases, entity.aliases) && containsAll(oldEntity.source_docs ?? [], entity.source_docs ?? []));
}
function changedEntityIds(oldValue, currentValue) {
  if (!Array.isArray(oldValue) || !Array.isArray(currentValue)) return ["unknown"];
  const current = asObjects(currentValue);
  return asObjects(oldValue).filter((oldEntity) => !entityPreserved(oldEntity, current)).map((entity) => stringId(entity) ?? "null");
}
function openRunPreserved(oldRun, currentRun) {
  return currentRun.started === oldRun.started && currentRun.tool === oldRun.tool && (!hasOwn2(oldRun, "task") || currentRun.task === oldRun.task) && containsAll(oldRun.evidence, currentRun.evidence) && containsAll(oldRun.claims_written, currentRun.claims_written);
}
function changedRunIds(oldValue, currentValue) {
  if (!Array.isArray(oldValue) || !Array.isArray(currentValue)) return ["unknown"];
  const current = indexById(asObjects(currentValue));
  return asObjects(oldValue).filter((oldRun) => {
    const id = stringId(oldRun);
    const currentRun = id === void 0 ? void 0 : current.get(id);
    if (currentRun === void 0) return true;
    return hasOwn2(oldRun, "verdict") ? !isDeepStrictEqual(currentRun, oldRun) : !openRunPreserved(oldRun, currentRun);
  }).map((run) => stringId(run) ?? "null");
}
function snapshotDiagnostic(issue) {
  return diagnostic(issue.code, issue.message, issue.context);
}
function parseDocuments(documents, diagnostics) {
  const entities = parseDocument(documents.entities);
  const claims = parseDocument(documents.claims);
  const runs = parseDocument(documents.runs);
  if (entities.issue !== void 0) diagnostics.push(entities.issue);
  if (claims.issue !== void 0) diagnostics.push(claims.issue);
  if (runs.issue !== void 0) diagnostics.push(runs.issue);
  if (entities.issue !== void 0 || claims.issue !== void 0 || runs.issue !== void 0) return null;
  return { entities: entities.value, claims: claims.value, runs: runs.value };
}
function validateSnapshot(snapshot) {
  const diagnostics = [];
  let stderr = "";
  const append = (line) => {
    diagnostics.push(line);
    stderr += line + "\n";
  };
  for (const issue of snapshot.issues.filter((entry) => entry.phase === "load")) append(snapshotDiagnostic(issue));
  const parseDiagnostics = [];
  const current = parseDocuments(snapshot.current, parseDiagnostics);
  for (const line of parseDiagnostics) append(line);
  if (current !== null) {
    if (validateEntityRecords(current.entities).length > 0) {
      append(schemaDiagnostic(
        "GK110",
        "graph/entities.json",
        current.entities,
        "entity schema or ID uniqueness violation",
        "correct the named records and keep IDs unique"
      ));
    }
    if (validateClaimRecords(current.claims).length > 0) {
      append(schemaDiagnostic(
        "GK120",
        "graph/claims.json",
        current.claims,
        "claim schema or ID uniqueness violation",
        "correct the named records and source shape"
      ));
    }
    if (validateRunRecords(current.runs).length > 0) {
      append(schemaDiagnostic(
        "GK130",
        "graph/runs.json",
        current.runs,
        "run schema, lifecycle, or ID uniqueness violation",
        "correct the named records and lifecycle fields"
      ));
    }
    const relation = findRelationProblem(current);
    if (relation !== null) {
      append(diagnostic(
        "GK140",
        relation.detail + "; fix: repair references, provenance, and use one acyclic supersession successor",
        relation.context
      ));
    }
    if (snapshot.head !== null) {
      const headDiagnostics = [];
      const head = parseDocuments(snapshot.head, headDiagnostics);
      if (head === null) {
        append("GK150 committed graph JSON cannot be parsed");
      } else {
        const claims = changedClaimIds(head.claims, current.claims);
        if (claims.length > 0) append(diagnostic(
          "GK151",
          "committed claim changed or was removed; fix: restore it and append a superseding claim",
          claims.join(",")
        ));
        const entities = changedEntityIds(head.entities, current.entities);
        if (entities.length > 0) append(diagnostic(
          "GK152",
          "entity identity changed or an accumulated value was removed; fix: restore identity and only add aliases or source_docs",
          entities.join(",")
        ));
        const runs = changedRunIds(head.runs, current.runs);
        if (runs.length > 0) append(diagnostic(
          "GK153",
          "invalid open-run transition or closed-run mutation; fix: restore the run or close an open run exactly once",
          runs.join(",")
        ));
      }
      stderr += snapshot.evidenceStderr;
      for (const issue of snapshot.issues.filter((entry) => entry.phase === "evidence")) {
        append(snapshotDiagnostic(issue));
      }
      const evidence = snapshot.evidenceChanges[0];
      if (evidence !== void 0) append(diagnostic(
        "GK154",
        "committed evidence changed, was deleted, or was renamed; fix: restore it and add a new evidence file",
        evidence.paths.join("	")
      ));
    }
  }
  if (diagnostics.length > 0) {
    stderr += "GraphKeeper: " + diagnostics.length + " violation(s)\n";
    return { exitCode: 1, stdout: "", stderr, diagnostics };
  }
  return {
    exitCode: 0,
    stdout: "GraphKeeper: validation passed\n",
    stderr,
    diagnostics
  };
}

// src/validator.ts
function terminal(exitCode, stderr) {
  return { exitCode, stdout: "", stderr: stderr + "\n" };
}
async function runStandaloneValidator(args, cwd = process.cwd()) {
  if (args.length !== 1) {
    return terminal(EXIT_CODES.usage, "GK002 expected --staged or --worktree");
  }
  const selected = args[0];
  if (selected !== "--staged" && selected !== "--worktree") {
    return terminal(EXIT_CODES.usage, "GK002 invalid validator mode");
  }
  const mode = selected;
  const git3 = await runProcess("git", ["--version"], { cwd, timeoutMs: 1e4 });
  if (git3.exitCode !== 0) {
    return terminal(EXIT_CODES.prerequisite, "GK003 git is required");
  }
  try {
    const repositoryRoot = await findGitRoot(cwd);
    return validateSnapshot(await loadValidationSnapshot({ repositoryRoot, mode }));
  } catch (error) {
    if (error instanceof GraphKeeperError) {
      return terminal(error.exitCode, diagnostic(error.code, error.message, error.context));
    }
    const detail = error instanceof Error ? error.message : String(error);
    return terminal(EXIT_CODES.operational, diagnostic("GK004", "unable to validate repository: " + detail));
  }
}
function isEntrypoint() {
  const entry = process.argv[1];
  if (entry === void 0) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isEntrypoint()) {
  runStandaloneValidator(process.argv.slice(2)).then((report) => {
    if (report.stdout.length > 0) process.stdout.write(report.stdout);
    if (report.stderr.length > 0) process.stderr.write(report.stderr);
    process.exitCode = report.exitCode;
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(diagnostic("GK004", "unable to validate repository: " + message) + "\n");
    process.exitCode = EXIT_CODES.operational;
  });
}
export {
  runStandaloneValidator
};
