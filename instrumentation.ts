export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateProductionEnvironment } =
      await import("./lib/server/production-environment");
    validateProductionEnvironment(process.env);
  }
}
