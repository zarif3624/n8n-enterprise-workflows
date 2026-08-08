import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { schemaContractIssues } from "./schema-contract-check.mjs";

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function sortedIds(entries) {
  const ids = entries.map((entry) => entry.id);
  return JSON.stringify(ids) === JSON.stringify([...ids].sort());
}

async function readJson(root, path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

export async function contractRegistryIssues({ root, registry }) {
  const issues = [];
  let registrySchema;
  try {
    registrySchema = await readJson(root, "schemas/contract-registry.schema.json");
    issues.push(...schemaContractIssues(registry, registrySchema, registrySchema).map((issue) => `contract-registry.json ${issue}`));
  } catch {
    return ["schemas/contract-registry.schema.json could not be read as JSON"];
  }

  const documents = Array.isArray(registry?.documents) ? registry.documents : [];
  const outputs = Array.isArray(registry?.outputs) ? registry.outputs : [];
  if (!sortedIds(documents)) issues.push("documents must be sorted by id");
  if (!sortedIds(outputs)) issues.push("outputs must be sorted by id");
  for (const id of duplicates([...documents, ...outputs].map((entry) => entry.id))) issues.push(`duplicate contract id: ${id}`);
  for (const path of duplicates(documents.map((entry) => entry.path))) issues.push(`duplicate document path: ${path}`);

  for (const entry of documents) {
    try {
      const [document, schema] = await Promise.all([readJson(root, entry.path), readJson(root, entry.schema)]);
      issues.push(...schemaContractIssues(document, schema, schema).map((issue) => `${entry.id} ${issue}`));
    } catch {
      issues.push(`${entry.id}: document or schema could not be read as JSON`);
    }
  }
  for (const entry of outputs) {
    try {
      await readJson(root, entry.schema);
    } catch {
      issues.push(`${entry.id}: output schema could not be read as JSON`);
    }
  }

  const schemaFiles = (await readdir(join(root, "schemas")))
    .filter((name) => name.endsWith(".schema.json"))
    .map((name) => `schemas/${name}`)
    .sort();
  const registeredSchemas = new Set([...documents, ...outputs].map((entry) => entry.schema));
  for (const path of schemaFiles) if (!registeredSchemas.has(path)) issues.push(`orphaned schema: ${path}`);
  for (const path of registeredSchemas) if (!schemaFiles.includes(path)) issues.push(`registered schema is missing: ${path}`);
  return [...new Set(issues)];
}
