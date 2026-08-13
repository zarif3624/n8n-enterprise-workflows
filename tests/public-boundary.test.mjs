import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { scanPublicBoundaryFile, scanPublicBoundaryText, scanTrackedPublicTree } from "../scripts/public-boundary-scan.mjs";
import { createTarGzip, readTarGzip } from "../scripts/release-archive.mjs";

const root = new URL("../", import.meta.url).pathname;

test("boundary patterns reject internal planning details but allow aggregate commercial-reserve language", () => {
  assert.deepEqual(scanPublicBoundaryText(
    "safe.md",
    "The public contract records a 48-family commercial reserve. Product packs are private."
  ), []);
  const unsafe = [
    "Create ", ["/", "Users", "/example/work/"].join(""), ["private", "product", "stash"].join("-"), "/",
    ["COMMERCIAL", "PORTFOLIO.md"].join("_"), " with eight ", ["pack", "briefs"].join(" "), ". ",
    ["Allocate exactly ", ["s", "ix"].join(""), " families to each of ", ["e", "ight"].join(""), " product packs."].join(""), " ",
    ["Allocate ", ["s", "ix"].join(""), " families to ", ["e", "ight"].join(""), " product packs."].join("")
  ].join("");
  const findings = scanPublicBoundaryText("unsafe.md", unsafe);
  assert.deepEqual(
    new Set(findings.map((finding) => finding.kind)),
    new Set(["absolute-local-path", "private-workspace-path", "named-private-planning-artifact", "detailed-private-pack-plan"])
  );
  assert.equal(findings.filter((finding) => finding.kind === "detailed-private-pack-plan").length, 2);
});

test("boundary patterns reject numeric, reversed, and Unicode-normalized private pack plans", () => {
  const evasions = [
    ["Allocate ", String(3 + 3), " families across ", String(4 + 4), " product packs."].join(""),
    ["The roadmap has ", ["e", "ight"].join(""), " packs of ", ["s", "ix"].join(""), " families."].join(""),
    ["The roadmap has ", String(4 + 4), " packs of ", String(3 + 3), "."].join(""),
    ["The roadmap has ", ["ｅ", "ｉｇｈｔ"].join(""), " packs of ", ["s", "ix"].join(""), " families."].join(""),
    ["The ", String(4 + 4), " packs each holding ", String(3 + 3), " families."].join(""),
    ["The ", String(4 + 4), " packs, with ", String(3 + 3), " families apiece."].join(""),
    ["The ", String(4 + 4), " packs contain ", String(3 + 3), " families each."].join("")
  ];

  for (const text of evasions) {
    assert.ok(
      scanPublicBoundaryText("evasion.md", text).some((finding) => finding.kind === "detailed-private-pack-plan"),
      `expected a detailed pack-plan finding for: ${text}`
    );
  }
});

test("unrecognized files cannot bypass scanning while known binary content stays ignored", () => {
  const detailedPlan = ["Allocate ", String(3 + 3), " families across ", String(4 + 4), " product packs."].join("");
  const nulPrefixedMarkdown = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(["Allocate exactly ", ["s", "ix"].join(""), " families to each of ", ["e", "ight"].join(""), " product packs."].join(""))
  ]);
  const invalidUtf8Markdown = Buffer.from([0xc3, 0x28]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

  assert.ok(scanPublicBoundaryFile("README.md", nulPrefixedMarkdown).some((finding) => finding.kind === "invalid-text"));
  assert.ok(scanPublicBoundaryFile("README.md", invalidUtf8Markdown).some((finding) => finding.kind === "invalid-text"));
  assert.ok(scanPublicBoundaryFile("logo.png", invalidUtf8Markdown).some((finding) => finding.kind === "invalid-text"));
  assert.ok(scanPublicBoundaryFile("README.md", png).some((finding) => finding.kind === "invalid-text"));
  assert.ok(scanPublicBoundaryFile("ROADMAP", detailedPlan).some((finding) => finding.kind === "detailed-private-pack-plan"));
  assert.ok(scanPublicBoundaryFile("plan.opaque", detailedPlan).some((finding) => finding.kind === "detailed-private-pack-plan"));
  assert.deepEqual(scanPublicBoundaryFile("logo.png", png), []);
});

test("recognized binary files expose readable boundary content without treating binary noise as invalid text", () => {
  const privatePath = ["/", "Users", "/", "zarif", "/review-notes"].join("");
  const numericPlan = ["Allocate ", String(3 + 3), " families across ", String(4 + 4), " product packs."].join("");
  const reversedPlan = ["The ", ["８"].join(""), " packs contain ", ["６"].join(""), " families each."].join("");
  const cases = [
    ["evidence.png", Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff]), Buffer.from(privatePath)])],
    ["evidence.pdf", Buffer.concat([Buffer.from("%PDF-1.7\n", "ascii"), Buffer.from([0xff, 0x00, 0xfe]), Buffer.from(numericPlan)])],
    ["evidence.zip", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff]), Buffer.from(reversedPlan)])]
  ];

  for (const [path, content] of cases) {
    const findings = scanPublicBoundaryFile(path, content);
    assert.equal(findings.length, 1, path);
    assert.notEqual(findings[0].kind, "invalid-text", path);
  }
  assert.equal(scanPublicBoundaryFile(cases[0][0], cases[0][1])[0].kind, "absolute-local-path");
  assert.equal(scanPublicBoundaryFile(cases[1][0], cases[1][1])[0].kind, "detailed-private-pack-plan");
  assert.equal(scanPublicBoundaryFile(cases[2][0], cases[2][1])[0].kind, "detailed-private-pack-plan");
});

test("binary pack-plan detection bridges bounded readable runs without joining other leak kinds", () => {
  const signatures = [
    ["png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["pdf", Buffer.from("%PDF-1.7\n", "ascii")],
    ["zip", Buffer.from([0x50, 0x4b, 0x03, 0x04])]
  ];
  const forward = [
    Buffer.from(["Allocate ", String(3 + 3), " families across"].join("")),
    Buffer.from([0xff, 0x00, 0x01, 0xfe]),
    Buffer.from([String(4 + 4), " product packs."].join(""))
  ];
  const reverse = [
    Buffer.from(["The ", String(4 + 4), " packs"].join("")),
    Buffer.from([0x00, 0xff]),
    Buffer.from("each holding"),
    Buffer.from([0x1f, 0xfe, 0x00]),
    Buffer.from([String(3 + 3), " families."].join(""))
  ];

  for (const [extension, signature] of signatures) {
    for (const [direction, runs] of [["forward", forward], ["reverse", reverse]]) {
      assert.deepEqual(
        scanPublicBoundaryFile(`${direction}.${extension}`, Buffer.concat([signature, Buffer.from([0xff]), ...runs])).map(({ kind }) => kind),
        ["detailed-private-pack-plan"],
        `${extension} ${direction}`
      );
    }
    assert.deepEqual(
      scanPublicBoundaryFile(`clean.${extension}`, Buffer.concat([signature, Buffer.from([0xff, 0x00]), Buffer.from("Public release artwork")])),
      [],
      `${extension} clean binary`
    );
  }

  const newlineSeparated = Buffer.concat([
    signatures[1][1],
    Buffer.from([0xff]),
    Buffer.from(["Allocate ", String(3 + 3), " families across"].join("")),
    Buffer.from([0x0a]),
    Buffer.from([String(4 + 4), " product packs."].join(""))
  ]);
  assert.deepEqual(scanPublicBoundaryFile("newline-separated.pdf", newlineSeparated).map(({ kind }) => kind), ["detailed-private-pack-plan"]);

  const splitPath = Buffer.concat([
    signatures[0][1],
    Buffer.from(["/", "Us"].join("")),
    Buffer.from([0xff, 0x00]),
    Buffer.from(["ers", "/", "zarif", "/notes"].join(""))
  ]);
  const splitArtifact = Buffer.concat([
    signatures[1][1],
    Buffer.from(["COMMERCIAL", "_"].join("")),
    Buffer.from([0xff, 0x00]),
    Buffer.from(["PORTFOLIO", ".md"].join(""))
  ]);
  assert.deepEqual(scanPublicBoundaryFile("split-path.png", splitPath), []);
  assert.deepEqual(scanPublicBoundaryFile("split-artifact.pdf", splitArtifact), []);
});

test("binary pack-plan windows retain boundary phrases despite long surrounding runs", () => {
  const signatures = [
    ["png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["pdf", Buffer.from("%PDF-1.7\n", "ascii")],
    ["zip", Buffer.from([0x50, 0x4b, 0x03, 0x04])]
  ];
  const longPrefix = Buffer.from("Public metadata before the reviewed boundary. ".repeat(7));
  const longSuffix = Buffer.from(" Reviewed release evidence after the boundary.".repeat(7));
  const boundaryNoise = Buffer.concat([Buffer.from([0xff]), Buffer.alloc(300, 0), Buffer.from([0xfe, 0x1f])]);
  const directions = [
    [
      "forward",
      Buffer.from(["Allocate ", String(3 + 3), " families across"].join("")),
      Buffer.from([String(4 + 4), " product packs."].join(""))
    ],
    [
      "reverse",
      Buffer.from(["The ", String(4 + 4), " packs"].join("")),
      Buffer.from(["each holding ", String(3 + 3), " families."].join(""))
    ]
  ];

  assert.ok(longPrefix.length > 240);
  assert.ok(longSuffix.length > 240);
  for (const [extension, signature] of signatures) {
    for (const [direction, beforeBoundary, afterBoundary] of directions) {
      const content = Buffer.concat([signature, Buffer.from([0xff]), longPrefix, beforeBoundary, boundaryNoise, afterBoundary, longSuffix]);
      assert.deepEqual(
        scanPublicBoundaryFile(`long-${direction}.${extension}`, content).map(({ kind }) => kind),
        ["detailed-private-pack-plan"],
        `${extension} ${direction}`
      );
    }
    assert.deepEqual(
      scanPublicBoundaryFile(`long-clean.${extension}`, Buffer.concat([signature, Buffer.from([0xff]), longPrefix, boundaryNoise, longSuffix])),
      [],
      `${extension} long clean binary`
    );
  }
});

test("built archives cannot hide boundary content behind unknown filenames", () => {
  const detailedPlan = ["Allocate ", String(3 + 3), " families across ", String(4 + 4), " product packs."].join("");
  const longPrefix = Buffer.from("Public archive metadata before the reviewed boundary. ".repeat(7));
  const longSuffix = Buffer.from(" Reviewed archive evidence after the boundary.".repeat(7));
  const boundaryNoise = Buffer.concat([Buffer.from([0xff]), Buffer.alloc(300, 0), Buffer.from([0xfe])]);
  const forwardBinaryPlan = Buffer.concat([
    Buffer.from("%PDF-1.7\n", "ascii"),
    longPrefix,
    Buffer.from(["Allocate ", String(3 + 3), " families across"].join("")),
    boundaryNoise,
    Buffer.from([String(4 + 4), " product packs."].join("")),
    longSuffix
  ]);
  const reverseBinaryPlan = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff]),
    longPrefix,
    Buffer.from(["The ", String(4 + 4), " packs"].join("")),
    boundaryNoise,
    Buffer.from(["each holding ", String(3 + 3), " families."].join("")),
    longSuffix
  ]);
  const archive = createTarGzip([
    { path: "bundle/ROADMAP", content: detailedPlan },
    { path: "bundle/plan.opaque", content: detailedPlan },
    { path: "bundle/allocation.pdf", content: forwardBinaryPlan },
    { path: "bundle/evidence.png", content: reverseBinaryPlan }
  ]);

  const findings = readTarGzip(archive).flatMap(({ path, content }) => scanPublicBoundaryFile(path, content));
  assert.deepEqual(findings.map(({ path, kind }) => ({ path, kind })), [
    { path: "bundle/ROADMAP", kind: "detailed-private-pack-plan" },
    { path: "bundle/allocation.pdf", kind: "detailed-private-pack-plan" },
    { path: "bundle/evidence.png", kind: "detailed-private-pack-plan" },
    { path: "bundle/plan.opaque", kind: "detailed-private-pack-plan" }
  ]);
});

test("tracked public files contain no private workspace or detailed commercialization plan", async () => {
  assert.deepEqual(await scanTrackedPublicTree(root), []);
});

test("public-boundary scanning works in an extracted source tree without Git metadata", async () => {
  const extractedRoot = await mkdtemp(join(tmpdir(), "public-boundary-source-"));
  try {
    await writeFile(join(extractedRoot, "README.md"), "A self-contained public source archive.\n");
    assert.deepEqual(await scanTrackedPublicTree(extractedRoot), []);
  } finally {
    await rm(extractedRoot, { recursive: true, force: true });
  }
});

test("source-tree scanning covers extensionless and unknown UTF-8 files", async () => {
  const extractedRoot = await mkdtemp(join(tmpdir(), "public-boundary-source-"));
  const detailedPlan = ["Allocate ", String(3 + 3), " families across ", String(4 + 4), " product packs."].join("");
  try {
    await writeFile(join(extractedRoot, "ROADMAP"), detailedPlan);
    await writeFile(join(extractedRoot, "plan.opaque"), detailedPlan);
    assert.deepEqual((await scanTrackedPublicTree(extractedRoot)).map(({ path, kind }) => ({ path, kind })), [
      { path: "ROADMAP", kind: "detailed-private-pack-plan" },
      { path: "plan.opaque", kind: "detailed-private-pack-plan" }
    ]);
  } finally {
    await rm(extractedRoot, { recursive: true, force: true });
  }
});
