import assert from "node:assert/strict";
import test from "node:test";
import { createTarGzip, readTarGzip } from "../scripts/release-archive.mjs";

test("release archives are byte-for-byte reproducible and sorted", () => {
  const entries = [
    { path: "bundle/z.txt", content: "last\n" },
    { path: "bundle/a.txt", content: "first\n" }
  ];
  const first = createTarGzip(entries);
  const second = createTarGzip([...entries].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(readTarGzip(first).map((entry) => entry.path), ["bundle/a.txt", "bundle/z.txt"]);
  assert.equal(readTarGzip(first)[0].content.toString(), "first\n");
});

test("release archives reject traversal and duplicate paths", () => {
  assert.throws(() => createTarGzip([{ path: "../secret", content: "no" }]), /Unsafe archive path/);
  assert.throws(() => createTarGzip([{ path: "same", content: "a" }, { path: "same", content: "b" }]), /unique/);
});

test("USTAR prefix fields preserve long workflow paths", () => {
  const path = `bundle/workflows/${"department-".repeat(7)}/workflow.json`;
  const archive = createTarGzip([{ path, content: "{}\n" }]);
  assert.equal(readTarGzip(archive)[0].path, path);
});
