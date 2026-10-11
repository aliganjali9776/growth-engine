export function safeReturn(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.split("?")[0].includes("%") &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !value.startsWith("/api/")
    ? value
    : "/";
}
