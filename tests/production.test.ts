import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProductionEnvironment } from "../lib/server/production-environment";
const valid: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  APP_MODE: "saas",
  PERSISTENCE_MODE: "database",
  DATABASE_URL: "postgresql://user:secret@db.example.invalid/app",
  BETTER_AUTH_URL: "https://app.example.invalid",
  BETTER_AUTH_SECRET: "synthetic-session-secret-at-least-32-characters",
  AGENT_MODEL_PROVIDER: "openai",
  OPENAI_API_KEY: "synthetic-test-key",
};
test("production requires PostgreSQL, origin and strong secret without disclosing values", () => {
  for (const key of [
    "DATABASE_URL",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "OPENAI_API_KEY",
    "PERSISTENCE_MODE",
  ]) {
    const env = { ...valid };
    delete env[key];
    assert.throws(
      () => validateProductionEnvironment(env),
      (error) =>
        error instanceof Error &&
        error.message.includes(key) &&
        !error.message.includes("synthetic") &&
        !error.message.includes("user:secret"),
    );
  }
});
test("production accepts HTTPS PostgreSQL configuration", () =>
  assert.doesNotThrow(() => validateProductionEnvironment(valid)));
test("production forbids embedded databases, development API and mock provider", () => {
  for (const patch of [
    { SAAS_DEV_DATABASE: "true" },
    { DATABASE_DRIVER: "pglite" },
    { SAAS_DEV_API_ENABLED: "true" },
    { AGENT_ALLOW_MOCK_DEMO: "true" },
    { AGENT_MODEL_PROVIDER: "mock" },
  ])
    assert.throws(() => validateProductionEnvironment({ ...valid, ...patch }));
});
test("production rejects public HTTP and non-origin callback URLs", () => {
  for (const url of [
    "http://app.example.invalid",
    "https://app.example.invalid/callback",
    "https://user:password@app.example.invalid",
    "bad-url",
  ])
    assert.throws(() =>
      validateProductionEnvironment({ ...valid, BETTER_AUTH_URL: url }),
    );
});
test("loopback production QA still requires PostgreSQL", () => {
  assert.doesNotThrow(() =>
    validateProductionEnvironment({
      ...valid,
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
    }),
  );
  assert.throws(() =>
    validateProductionEnvironment({
      ...valid,
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      SAAS_DEV_DATABASE: "true",
    }),
  );
});
test("local mode and deterministic no-key fallback remain available", () => {
  assert.doesNotThrow(() =>
    validateProductionEnvironment({
      NODE_ENV: "production",
      APP_MODE: "local",
    }),
  );
  assert.doesNotThrow(() =>
    validateProductionEnvironment({
      ...valid,
      OPENAI_API_KEY: undefined,
      AGENT_MODEL_PROVIDER: undefined,
    }),
  );
  assert.doesNotThrow(() =>
    validateProductionEnvironment({
      NODE_ENV: "development",
      SAAS_DEV_DATABASE: "true",
    }),
  );
});
