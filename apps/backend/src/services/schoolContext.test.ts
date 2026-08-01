import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Request } from "express";
import { getRequestSchoolId, SchoolContextError, setDevelopmentSchoolIdResolverForTests } from "./schoolContext";

async function withNodeEnv<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.NODE_ENV;
  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

test("request school context prefers req.user.schoolId", async () => {
  const req = { user: { schoolId: "school-user-1" } } as Request;
  assert.equal(await getRequestSchoolId(req), "school-user-1");
});

test("request school context uses development fallback outside production", async () => {
  await withNodeEnv("development", async () => {
    setDevelopmentSchoolIdResolverForTests(async () => "school-dev-fallback");
    try {
      assert.equal(await getRequestSchoolId({} as Request), "school-dev-fallback");
    } finally {
      setDevelopmentSchoolIdResolverForTests(null);
    }
  });
});

test("request school context rejects missing user in production", async () => {
  await withNodeEnv("production", async () => {
    await assert.rejects(() => getRequestSchoolId({} as Request), SchoolContextError);
  });
});

test("teachers route uses request school context instead of default school", () => {
  const source = readFileSync("src/modules/teachers/teachers.routes.ts", "utf8");
  assert.match(source, /getRequestSchoolId\(req\)/);
  assert.doesNotMatch(source, /getDefaultSchoolId\(/);
});
