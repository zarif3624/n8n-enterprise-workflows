import { gunzipSync, gzipSync } from "node:zlib";

const blockSize = 512;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function writeString(buffer, offset, length, value) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`Tar field is too long: ${value}`);
  bytes.copy(buffer, offset);
}

function writeOctal(buffer, offset, length, value) {
  const octal = value.toString(8);
  if (octal.length > length - 1) throw new Error(`Tar numeric field is too large: ${value}`);
  writeString(buffer, offset, length, `${octal.padStart(length - 1, "0")}\0`);
}

function splitPath(path) {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: "" };
  for (let index = path.lastIndexOf("/"); index > 0; index = path.lastIndexOf("/", index - 1)) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  throw new Error(`Tar path is too long: ${path}`);
}

function normalizeEntries(entries) {
  const normalized = entries.map((entry) => {
    const path = entry.path.replaceAll("\\", "/");
    if (!path || path.startsWith("/") || path.includes("\0") || path.split("/").includes("..")) {
      throw new Error(`Unsafe archive path: ${entry.path}`);
    }
    return { path, content: Buffer.from(entry.content), mode: entry.mode ?? 0o644 };
  }).sort((left, right) => compareText(left.path, right.path));
  if (new Set(normalized.map((entry) => entry.path)).size !== normalized.length) {
    throw new Error("Archive paths must be unique");
  }
  return normalized;
}

export function createTar(entries) {
  const chunks = [];
  for (const entry of normalizeEntries(entries)) {
    const header = Buffer.alloc(blockSize);
    const { name, prefix } = splitPath(entry.path);
    writeString(header, 0, 100, name);
    writeOctal(header, 100, 8, entry.mode);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, entry.content.length);
    writeOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeString(header, 257, 6, "ustar\0");
    writeString(header, 263, 2, "00");
    writeString(header, 345, 155, prefix);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
    chunks.push(header, entry.content);
    const padding = (blockSize - (entry.content.length % blockSize)) % blockSize;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(blockSize * 2));
  return Buffer.concat(chunks);
}

export function createTarGzip(entries) {
  const archive = gzipSync(createTar(entries), { level: 9, mtime: 0 });
  archive.fill(0, 4, 8);
  archive[9] = 255;
  return archive;
}

function readNullTerminated(buffer, start, length) {
  const end = buffer.indexOf(0, start);
  return buffer.toString("utf8", start, end === -1 || end > start + length ? start + length : end);
}

export function readTarGzip(archive) {
  const tar = gunzipSync(archive);
  const entries = [];
  let offset = 0;
  while (offset + blockSize <= tar.length) {
    const header = tar.subarray(offset, offset + blockSize);
    if (header.every((byte) => byte === 0)) break;
    const expectedChecksum = Number.parseInt(readNullTerminated(header, 148, 8).trim(), 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (expectedChecksum !== actualChecksum) throw new Error("Tar header checksum mismatch");
    const name = readNullTerminated(header, 0, 100);
    const prefix = readNullTerminated(header, 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const size = Number.parseInt(readNullTerminated(header, 124, 12).trim(), 8);
    const contentStart = offset + blockSize;
    const contentEnd = contentStart + size;
    if (!Number.isSafeInteger(size) || contentEnd > tar.length) throw new Error(`Invalid tar entry size for ${path}`);
    entries.push({ path, content: Buffer.from(tar.subarray(contentStart, contentEnd)) });
    offset = contentStart + Math.ceil(size / blockSize) * blockSize;
  }
  return entries;
}
