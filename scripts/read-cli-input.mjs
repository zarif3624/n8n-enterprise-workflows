import { readFile } from "node:fs/promises";

export async function readCliInput(inputPath) {
  if (inputPath !== "-") return readFile(inputPath, "utf8");
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
