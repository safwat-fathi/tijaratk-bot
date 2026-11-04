export class ToolUnavailableError extends Error {}

/** Raised by a handler when an argument fails a check the validator can't express generically. */
export class ActionArgumentError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(', '));
  }
}
