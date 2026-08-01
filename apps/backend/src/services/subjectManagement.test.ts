import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SubjectSchema } from "@som/shared";

test("subject schema accepts numeric max and pass marks", () => {
  const subject = SubjectSchema.parse({
    name: "الرياضيات",
    isHomeroom: false,
    maxMark: "100",
    passMark: "50"
  });

  assert.equal(subject.name, "الرياضيات");
  assert.equal(subject.maxMark, 100);
  assert.equal(subject.passMark, 50);
});

test("subject schema rejects decimal marks and pass marks above the maximum", () => {
  assert.throws(
    () =>
      SubjectSchema.parse({
        name: "الرياضيات",
        maxMark: "99.5",
        passMark: "50"
      }),
    /integer|expected/i
  );

  assert.throws(
    () =>
      SubjectSchema.parse({
        name: "الرياضيات",
        maxMark: "50",
        passMark: "60"
      }),
    /passMark/i
  );
});

test("subject routes persist subject mark limits and keep archival deactivation", () => {
  const schemaSource = readFileSync("../../packages/shared/src/index.ts", "utf8");
  const prismaSource = readFileSync("prisma/schema.prisma", "utf8");
  const routeSource = readFileSync("src/modules/subjects/subjects.routes.ts", "utf8");

  assert.match(
    schemaSource,
    /maxMark: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(500\)\.optional\(\)\.nullable\(\)/,
    "subject schema should accept a maximum mark"
  );
  assert.match(
    schemaSource,
    /passMark: z\.coerce\.number\(\)\.int\(\)\.min\(0\)\.max\(500\)\.optional\(\)\.nullable\(\)/,
    "subject schema should accept a passing mark"
  );
  assert.match(
    prismaSource,
    /maxMark\s+Int\?\s+@map\("max_mark"\)/,
    "subject prisma schema should store the maximum mark"
  );
  assert.match(
    prismaSource,
    /passMark\s+Int\?\s+@map\("pass_mark"\)/,
    "subject prisma schema should store the passing mark"
  );
  assert.match(
    routeSource,
    /subjectsRouter\.post\("\/:id\/deactivate"/,
    "subject deactivation route should still exist"
  );
  assert.match(routeSource, /status: "ARCHIVED"/, "subject deactivation should archive instead of hard deleting");
});
