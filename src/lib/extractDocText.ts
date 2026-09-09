import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractDocText(fileName: string, buffer: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (ext === "txt" || ext === "md" || ext === "csv") {
    // CSVs (e.g. LinkedIn's full data export — Positions.csv, Profile.csv,
    // Skills.csv, Education.csv) are already plain text; Claude reads the
    // raw table fine without a parsing library.
    return buffer.toString("utf-8");
  }
  throw new Error(`Unsupported file type ".${ext}". Supported: .pdf, .docx, .txt, .md, .csv`);
}
