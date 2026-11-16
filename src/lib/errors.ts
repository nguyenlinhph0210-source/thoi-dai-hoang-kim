export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}
export function isGameRuleError(error: unknown): error is GameRuleError {
  return error instanceof Error && error.name === "GameRuleError";
}
export class ConfigurationError extends Error {}
