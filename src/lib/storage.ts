import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const DATA_ROOT = path.join(process.cwd(), "data");

// `data/` is gitignored — these are personal research materials (resumes, LinkedIn
// screenshots of real people) and must never be committed or pushed.
export function saveUploadedFile(subdir: string, fileName: string, buffer: Buffer): string {
  const safeName = `${Date.now()}-${path.basename(fileName)}`;
  const dir = path.join(DATA_ROOT, subdir);
  mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, safeName);
  writeFileSync(fullPath, buffer);
  return fullPath;
}
