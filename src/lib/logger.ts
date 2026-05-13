export type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = process.env.NODE_ENV !== "production";



function shouldLog(level: LogLevel) {
  return isDev || level === "warn" || level === "error";
}

export function log(level: LogLevel, message: string, payload?: unknown) {
  if (!shouldLog(level)) return;

  if (level === "debug" || level === "info") {
    console.log(message, payload ?? "");
    return;
  }

  if (level === "warn") {
    console.warn(message, payload ?? "");
    return;
  }

  console.error(message, payload ?? "");
}

export function logError(message: string, error: unknown) {
  log("error", message, error);
}
