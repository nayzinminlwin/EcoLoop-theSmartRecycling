import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import AjvModule, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

const Ajv = AjvModule.default;
const addFormats = addFormatsModule.default;

export type ContractName = "commands" | "findings" | "snapshots";

const ajv = new Ajv({ allErrors: true, strict: true, strictTypes: false });
addFormats(ajv);
const validators = new Map<ContractName, ValidateFunction>();

function contractPaths(name: ContractName): URL[] {
  return [
    new URL(`../contracts/backend/v1/${name}.schema.json`, import.meta.url),
    new URL(`../../../contracts/backend/v1/${name}.schema.json`, import.meta.url),
  ];
}

async function loadValidator(name: ContractName): Promise<ValidateFunction> {
  const current = validators.get(name);
  if (current !== undefined) return current;
  let schemaText: string | undefined;
  let lastError: unknown;
  for (const path of contractPaths(name)) {
    try {
      schemaText = await readFile(fileURLToPath(path), "utf8");
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (schemaText === undefined) {
    throw lastError ?? new Error(`Contract schema not found: ${name}`);
  }
  const schema = JSON.parse(schemaText) as object;
  const validator = ajv.compile(schema);
  validators.set(name, validator);
  return validator;
}

export async function validateContract(name: ContractName, value: unknown): Promise<void> {
  const validator = await loadValidator(name);
  if (!validator(value)) {
    throw new Error(formatValidationErrors(name, validator.errors));
  }
}

export function formatValidationErrors(name: ContractName, errors: ErrorObject[] | null | undefined): string {
  return `${name} contract validation failed: ${(errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`).join("; ")}`;
}

export function validateNormalizedBox(box: { x1: number; y1: number; x2: number; y2: number }): void {
  if (!Number.isFinite(box.x1) || !Number.isFinite(box.y1) ||
      !Number.isFinite(box.x2) || !Number.isFinite(box.y2) ||
      box.x1 > box.x2 || box.y1 > box.y2) {
    throw new Error("Finding box must be finite and ordered");
  }
}
