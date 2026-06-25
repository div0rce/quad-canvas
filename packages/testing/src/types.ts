// @quad/testing — shared test-harness types.

/** A reachable local service (host + TCP port). */
export interface ServiceEndpoint {
  readonly host: string;
  readonly port: number;
}

/** Polling options for readiness waits. */
export interface WaitOptions {
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
}
