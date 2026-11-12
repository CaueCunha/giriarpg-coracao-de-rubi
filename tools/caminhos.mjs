import { fileURLToPath } from "node:url";
import path from "node:path";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const T20_DIR = process.env.T20_DIR ?? path.join(RAIZ, ".cache", "tormenta20");
/** Commit do sistema Tormenta20 conferido (v1.6.4, out/2026). */
export const T20_COMMIT = "9e88b3186683c438f89968ea153315f85958e3d2";
export const GERADORES = path.join(RAIZ, "src", "geradores");
export const FONTE_PACKS = path.join(RAIZ, "src", "packs");
export const PACKS = path.join(RAIZ, "packs");
/** Assinaturas de todas as versões publicadas de cada documento (para a atualização opcional). */
export const HISTORICO = path.join(RAIZ, "src", "historico.json");
