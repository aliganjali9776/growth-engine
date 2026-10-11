import { loadEnvConfig } from "@next/env";
import { validateProductionEnvironment } from "../lib/server/production-environment";
try {
  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  validateProductionEnvironment({ ...process.env, NODE_ENV: "production" });
  console.log("Production environment validated");
} catch (error) {
  const message = error instanceof Error && error.message.startsWith("Production environment invalid:")
    ? error.message : "Production environment validation failed";
  console.error(message);
  process.exitCode = 1;
}
