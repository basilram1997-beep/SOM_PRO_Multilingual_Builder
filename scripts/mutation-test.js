require("dotenv").config();

const crypto = require("node:crypto");
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const nodeCommand = process.platform === "win32" ? "node.exe" : "node";
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "apps", "backend", "src", "services", "scheduleRules.ts");

function makeRunId() {
  return `mutation-${crypto.randomBytes(4).toString("hex")}`;
}

function trace(message, details) {
  if (details === undefined) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    return;
  }
  console.log(`[${new Date().toISOString()}] ${message}`, details);
}

function applyMutation(source, mutation) {
  const mutated = source.replace(mutation.from, mutation.to);
  if (mutated === source) {
    throw new Error(`Failed to apply mutation: ${mutation.name}`);
  }
  return mutated;
}

function writeMutationTest(tempDir) {
  const testSource = `
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySubstitutionCandidate,
  gradeOfClassName,
  isEventCoveredSlot,
  isTeacherBusyInPeriod,
  statusReason,
  substitutionKindWeight
} from "./scheduleRules.ts";

test("mutation smoke helper still honors event boundaries", () => {
  const slot = {
    id: "slot-1",
    period: 3,
    teacherId: "teacher-a",
    classId: "class-a",
    subjectId: "math",
    class: { name: "الصف العاشر أ" }
  };

  assert.equal(isEventCoveredSlot(slot, [{ classId: "class-a", fromPeriod: 2, toPeriod: 3 }]), true);
  assert.equal(isTeacherBusyInPeriod("teacher-a", 3, [slot], new Set()), true);
});

test("mutation smoke helper keeps substitution ordering stable", () => {
  const slot = {
    id: "slot-1",
    period: 1,
    teacherId: "absent",
    classId: "class-10a",
    subjectId: "math",
    class: { name: "الصف العاشر أ" }
  };

  const teachers = [
    { id: "same-subject", assignments: [{ classId: "class-11a", subjectId: "math", class: { name: "الصف الحادي عشر أ" } }] },
    { id: "free", assignments: [{ classId: "class-12a", subjectId: "history", class: { name: "الصف الثاني عشر أ" } }] },
    { id: "same-grade", assignments: [{ classId: "class-10b", subjectId: "science", class: { name: "الصف العاشر ب" } }] },
    { id: "same-class", assignments: [{ classId: "class-10a", subjectId: "english", class: { name: "الصف العاشر أ" } }] }
  ];

  const ordered = teachers
    .map((teacher) => ({ teacher, kind: classifySubstitutionCandidate(teacher, slot) }))
    .sort((left, right) => substitutionKindWeight[left.kind] - substitutionKindWeight[right.kind])
    .map((item) => item.teacher.id);

  assert.deepEqual(ordered, ["same-class", "same-grade", "same-subject", "free"]);
});

test("mutation smoke helper keeps Arabic labels and grades intact", () => {
  assert.equal(statusReason("ABSENT", 1, 7), "غياب");
  assert.equal(gradeOfClassName("الصف العاشر ب"), "10");
});
`;

  writeFileSync(path.join(tempDir, "mutation.smoke.test.ts"), testSource, "utf8");
}

function runTestFile(tempDir) {
  const result = spawnSync(nodeCommand, ["--test", "--import", "tsx", path.join(tempDir, "mutation.smoke.test.ts")], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env }
  });

  return result;
}

function main() {
  const runId = makeRunId();
  const tempDir = mkdtempSync(path.join(tmpdir(), `${runId}-`));
  const tempSourcePath = path.join(tempDir, "scheduleRules.ts");
  const originalSource = readFileSync(sourcePath, "utf8");

  mkdirSync(tempDir, { recursive: true });
  writeFileSync(tempSourcePath, originalSource, "utf8");
  writeMutationTest(tempDir);

  const baselineResult = spawnSync(
    nodeCommand,
    ["--test", "--import", "tsx", path.join(tempDir, "mutation.smoke.test.ts")],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env }
    }
  );

  if ((baselineResult.status || 0) !== 0) {
    throw new Error(
      `Baseline mutation smoke test failed before mutation step: ${(baselineResult.stderr || baselineResult.stdout || "").toString().slice(0, 1200)}`
    );
  }

  const mutants = [
    {
      name: "event-end-boundary",
      from: "slot.period <= event.toPeriod",
      to: "slot.period < event.toPeriod"
    },
    {
      name: "same-class-ordering",
      from: "SAME_CLASS: 2",
      to: "SAME_CLASS: 9"
    },
    {
      name: "arabic-grade-detection",
      from: 'if (clean.includes("العاشر")) return "10";',
      to: 'if (clean.includes("العاشر")) return "";'
    }
  ];

  let killed = 0;
  for (const mutant of mutants) {
    writeFileSync(tempSourcePath, applyMutation(originalSource, mutant), "utf8");
    const result = runTestFile(tempDir);
    const passed = (result.status || 0) === 0;
    if (passed) {
      throw new Error(`Mutation survived unexpectedly: ${mutant.name}`);
    }
    killed += 1;
    trace("mutation killed", { name: mutant.name });
  }

  trace("mutation testing completed", { killed, total: mutants.length, runId });
  rmSync(tempDir, { recursive: true, force: true });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
