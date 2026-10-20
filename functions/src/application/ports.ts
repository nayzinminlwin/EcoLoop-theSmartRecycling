import type { Identifier, Instant } from "../domain/types.js";

export interface Clock {
  now(): Instant;
}

export interface IdGenerator {
  nextId(namespace: string): Identifier;
}

export interface OperationStore<T> {
  get(operationKey: string): Promise<T | null>;
  put(operationKey: string, value: T): Promise<void>;
}

export interface TransactionRunner {
  run<T>(operation: () => Promise<T>): Promise<T>;
}
