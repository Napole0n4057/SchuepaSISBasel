import { promises as fs } from "node:fs";
import path from "node:path";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(STORE_DIR, "students.txt");

async function ensureStore() {
  try {
    await fs.mkdir(STORE_DIR, { recursive: true });
  } catch {}

  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, "", "utf8");
  }
}

function parseLine(line) {
  const [nameOrEmail, emailOrPasswordHash, passwordHashOrCreatedAt, maybeCreatedAt] =
    line.split("\t");
  // Backward compatibility with older rows: email, passwordHash, createdAt
  const hasNameColumn = maybeCreatedAt !== undefined;
  const name = hasNameColumn ? nameOrEmail : "";
  const email = hasNameColumn ? emailOrPasswordHash : nameOrEmail;
  const passwordHash = hasNameColumn
    ? passwordHashOrCreatedAt
    : emailOrPasswordHash;
  const createdAt = hasNameColumn ? maybeCreatedAt : passwordHashOrCreatedAt;
  if (!email || !passwordHash) return null;
  return {
    name,
    email,
    passwordHash,
    createdAt: createdAt || null,
  };
}

function serializeLine(entry) {
  return [
    entry.name || "",
    entry.email,
    entry.passwordHash,
    entry.createdAt || new Date().toISOString(),
  ].join("\t");
}

export async function readStudents() {
  await ensureStore();
  const content = await fs.readFile(STORE_FILE, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter(Boolean);
}

export async function writeStudents(entries) {
  await ensureStore();
  const payload = entries.map(serializeLine).join("\n") + (entries.length ? "\n" : "");
  await fs.writeFile(STORE_FILE, payload, "utf8");
}

export async function addStudent(entry) {
  const entries = await readStudents();
  const existing = entries.find((e) => e.email === entry.email);
  if (existing) {
    throw new Error("Student already exists");
  }
  entries.unshift(entry);
  await writeStudents(entries);
}

export async function removeStudent(email) {
  const entries = await readStudents();
  const next = entries.filter((e) => e.email !== email);
  if (next.length === entries.length) {
    throw new Error("Student not found");
  }
  await writeStudents(next);
}
