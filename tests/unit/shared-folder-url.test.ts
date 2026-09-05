import { describe, it, expect } from "vitest";
import {
  SHARED_FOLDER_LABEL_DEFAULT,
  SHARED_FOLDER_LABEL_MAX,
  SHARED_FOLDER_URL_MAX,
  normalizeSharedFolderUrl,
  assertValidSharedFolderUrl,
  normalizeSharedFolderLabel,
} from "@/lib/shared-folder-url";

describe("normalizeSharedFolderUrl", () => {
  it("acepta URL HTTPS de Google Drive y conserva query (resourcekey)", () => {
    const input =
      "https://drive.google.com/drive/folders/1NskSnUyMgMOkbVMb9xJ6oNT9xWi-jrGP?usp=drive_link";
    expect(normalizeSharedFolderUrl(input)).toBe(input);
  });

  it("acepta URL HTTPS de Dropbox", () => {
    expect(
      normalizeSharedFolderUrl("https://www.dropbox.com/scl/fo/abc123/folder?dl=0"),
    ).toBe("https://www.dropbox.com/scl/fo/abc123/folder?dl=0");
  });

  it("acepta URL HTTPS de OneDrive / SharePoint", () => {
    expect(
      normalizeSharedFolderUrl("https://contoso.sharepoint.com/:f:/s/Equipo/EmxYz?e=abcdef"),
    ).toBe("https://contoso.sharepoint.com/:f:/s/Equipo/EmxYz?e=abcdef");
  });

  it("conserva query string incluyendo resourcekey", () => {
    const input =
      "https://drive.google.com/drive/folders/abc?resourcekey=0-xyz&usp=sharing";
    expect(normalizeSharedFolderUrl(input)).toBe(input);
  });

  it("conserva el fragment", () => {
    expect(normalizeSharedFolderUrl("https://example.com/docs#seccion-2")).toBe(
      "https://example.com/docs#seccion-2",
    );
  });

  it("aplica trim alrededor del valor", () => {
    expect(normalizeSharedFolderUrl("  https://example.com/docs  ")).toBe(
      "https://example.com/docs",
    );
  });

  it("rechaza http:", () => {
    expect(normalizeSharedFolderUrl("http://example.com/docs")).toBeNull();
  });

  it("rechaza protocolos peligrosos (javascript:, data:)", () => {
    expect(normalizeSharedFolderUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeSharedFolderUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rechaza URLs relativas", () => {
    expect(normalizeSharedFolderUrl("drive.google.com/folders/x")).toBeNull();
    expect(normalizeSharedFolderUrl("/carpeta/compartida")).toBeNull();
  });

  it("rechaza hostname vacío", () => {
    expect(normalizeSharedFolderUrl("https://")).toBeNull();
    expect(normalizeSharedFolderUrl("https://:80/path")).toBeNull();
  });

  it("rechaza credenciales embebidas (user:pass@)", () => {
    expect(normalizeSharedFolderUrl("https://user:pass@example.com/docs")).toBeNull();
    expect(normalizeSharedFolderUrl("https://user@example.com/docs")).toBeNull();
  });

  it("rechaza valores vacíos o nulos", () => {
    expect(normalizeSharedFolderUrl("")).toBeNull();
    expect(normalizeSharedFolderUrl("   ")).toBeNull();
    expect(normalizeSharedFolderUrl(null)).toBeNull();
    expect(normalizeSharedFolderUrl(undefined)).toBeNull();
  });

  it("rechaza whitespace interno", () => {
    expect(normalizeSharedFolderUrl("https://example.com/a b")).toBeNull();
  });

  it("rechaza longitud excesiva", () => {
    const long = `https://example.com/${"a".repeat(SHARED_FOLDER_URL_MAX)}`;
    expect(long.length).toBeGreaterThan(SHARED_FOLDER_URL_MAX);
    expect(normalizeSharedFolderUrl(long)).toBeNull();
  });
});

describe("assertValidSharedFolderUrl", () => {
  it("devuelve la URL normalizada cuando es válida", () => {
    expect(assertValidSharedFolderUrl("  https://example.com/docs  ")).toBe(
      "https://example.com/docs",
    );
  });

  it("lanza error con mensaje claro cuando es inválida", () => {
    expect(() => assertValidSharedFolderUrl("ftp://example.com")).toThrow(/HTTPS/);
    expect(() => assertValidSharedFolderUrl(null)).toThrow(/HTTPS/);
  });
});

describe("normalizeSharedFolderLabel", () => {
  it("aplica trim", () => {
    expect(normalizeSharedFolderLabel("  Documentación  ")).toBe("Documentación");
  });

  it("usa el valor predeterminado cuando queda vacía", () => {
    expect(normalizeSharedFolderLabel("")).toBe(SHARED_FOLDER_LABEL_DEFAULT);
    expect(normalizeSharedFolderLabel("   ")).toBe(SHARED_FOLDER_LABEL_DEFAULT);
    expect(normalizeSharedFolderLabel(null)).toBe(SHARED_FOLDER_LABEL_DEFAULT);
    expect(normalizeSharedFolderLabel(undefined)).toBe(SHARED_FOLDER_LABEL_DEFAULT);
  });

  it("rechaza etiqueta excesivamente larga", () => {
    expect(() => normalizeSharedFolderLabel("a".repeat(SHARED_FOLDER_LABEL_MAX + 1))).toThrow(
      /120 caracteres/,
    );
  });

  it("acepta el máximo permitido", () => {
    const label = "a".repeat(SHARED_FOLDER_LABEL_MAX);
    expect(normalizeSharedFolderLabel(label)).toBe(label);
  });
});
