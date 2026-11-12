// Baixa o código do sistema Tormenta20 (Vizael) usado como referência pelos testes e pelo build:
// compêndios do sistema (para clonar ameaças e referenciar magias/poderes) e o modelo de dados
// (para validar cada documento como o Foundry validaria).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { T20_DIR, T20_COMMIT } from "./caminhos.mjs";

if (existsSync(`${T20_DIR}/system.json`)) {
	console.log(`Sistema já está em ${T20_DIR}`);
} else {
	execFileSync("git", ["init", "-q", T20_DIR], { stdio: "inherit" });
	execFileSync("git", ["-C", T20_DIR, "remote", "add", "origin", "https://gitlab.com/vizael/Tormenta20.git"], { stdio: "inherit" });
	execFileSync("git", ["-C", T20_DIR, "fetch", "-q", "--depth", "1", "origin", T20_COMMIT], { stdio: "inherit" });
	execFileSync("git", ["-C", T20_DIR, "checkout", "-q", "FETCH_HEAD"], { stdio: "inherit" });
	console.log(`Sistema Tormenta20 (${T20_COMMIT.slice(0, 8)}) baixado em ${T20_DIR}`);
}
