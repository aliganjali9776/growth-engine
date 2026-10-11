// Pure validation: messages contain variable names only, never their values.
export function validateProductionEnvironment(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  if ((env.APP_MODE ?? "saas") === "saas") {
    if (env.PERSISTENCE_MODE !== "database")
      problems.push("PERSISTENCE_MODE must be database");
    if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL ?? ""))
      problems.push("DATABASE_URL must be a PostgreSQL URL");
    if ((env.BETTER_AUTH_SECRET?.length ?? 0) < 32)
      problems.push("BETTER_AUTH_SECRET requires at least 32 characters");
    try {
      const url = new URL(env.BETTER_AUTH_URL ?? "");
      if (
        url.origin !== env.BETTER_AUTH_URL ||
        (url.protocol !== "https:" &&
          !(
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
          ))
      )
        throw Error();
    } catch {
      problems.push(
        "BETTER_AUTH_URL requires an HTTPS origin (HTTP allowed only for loopback QA)",
      );
    }
    if (env.SAAS_DEV_DATABASE === "true" || env.DATABASE_DRIVER === "pglite")
      problems.push(
        "Embedded development databases are disabled in production",
      );
  } else if (env.APP_MODE !== "local")
    problems.push("APP_MODE must be saas or local");
  if (
    env.SAAS_DEV_API_ENABLED === "true" ||
    env.AGENT_ALLOW_MOCK_DEMO === "true" ||
    env.AGENT_MODEL_PROVIDER === "mock"
  )
    problems.push(
      "Development API and mock providers are disabled in production",
    );
  if (env.AGENT_MODEL_PROVIDER === "openai" && !env.OPENAI_API_KEY?.trim())
    problems.push("OPENAI_API_KEY required for configured OpenAI provider");
  if (problems.length)
    throw new Error("Production environment invalid: " + problems.join("; "));
}
