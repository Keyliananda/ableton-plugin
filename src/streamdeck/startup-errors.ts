const DEFAULT_PORT = 17375;

export function describeStartupError(error: unknown): string {
  if (isAddressInUseError(error)) {
    return [
      `Ableton Rack Control failed to start: Port ${DEFAULT_PORT} is already in use.`,
      "The Dev Host is probably still running, or another Stream Deck plugin instance is active.",
      'If you are at the Dev Host ">" prompt, type "q" to stop it before starting the Stream Deck app.'
    ].join(" ");
  }

  return "Ableton Rack Control failed to start.";
}

function isAddressInUseError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; port?: unknown; message?: unknown };
  return (
    candidate.code === "EADDRINUSE" ||
    candidate.port === DEFAULT_PORT ||
    (typeof candidate.message === "string" && candidate.message.includes("EADDRINUSE"))
  );
}
