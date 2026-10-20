import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const functionsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(functionsRoot, "..", "contracts", "backend", "v1");
const destination = resolve(functionsRoot, "lib", "contracts", "backend", "v1");

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`Copied canonical contracts to ${destination}`);
