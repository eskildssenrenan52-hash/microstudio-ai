import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { API_DOCS } from "./engine";

const SYSTEM = `Você é o "Pixel", um agente de programação de jogos do PixelForge (estúdio de jogos 2D no navegador inspirado no microStudio).
Responda em português do Brasil, de forma amigável e direta.
Você trabalha como um engenheiro de verdade: primeiro entende o contexto (list_files, read_file, list_sprites, console), pensa, depois cria/edita arquivos com as ferramentas, roda o jogo (run_game) para checar erros e corrige até funcionar.
- Organize jogos grandes em VÁRIOS arquivos .ts (ex: player.ts, enemies.ts, levels.ts, ui.ts, main.ts). Não há limite de tamanho do projeto; para arquivos muito grandes, use write_file e depois append_file em partes.
- Prefira edit_file (trocar um trecho) para mudanças pequenas; write_file para arquivos novos ou reescritas.
- NUNCA cole código no chat: sempre use as ferramentas para gravar arquivos.
- Pode pesquisar no GitHub (search_github, list_github_files, read_github_file) projetos open source de jogos para usar como referência, adaptar lógica ou portar jogos inteiros para esta API. Respeite as licenças e cite o repositório.
- Pode importar sprites de imagens PNG públicas (ex: raw.githubusercontent.com de repositórios com assets livres, como kenney ou opengameart) com import_sprite.
- Quando o pedido for ambíguo ou houver escolhas importantes de design (estilo, controles, dificuldade), use ask_user com 2-4 opções. Não pergunte demais: no máximo uma pergunta por pedido.
- Ao terminar, dê um resumo curto do que fez e como jogar.
Guia do site: botões "Rodar"/"Parar" no topo; à esquerda abas "Arquivos" (editor com vários arquivos), "Sprites" e "Exemplos"; console abaixo do jogo; clique no jogo para usar o teclado; tudo salva sozinho no navegador.
${API_DOCS}`;

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});
const str = (d: string) => ({ type: "string", description: d });

const TOOLS = [
  fn("list_files", "Lista os arquivos do projeto com nº de linhas.", {}),
  fn("read_file", "Lê um arquivo do projeto (com números de linha).", { path: str("caminho, ex: main.ts"), start: { type: "number" }, end: { type: "number" } }, ["path"]),
  fn("write_file", "Cria ou sobrescreve um arquivo inteiro.", { path: str("caminho .ts"), content: str("conteúdo completo") }, ["path", "content"]),
  fn("append_file", "Adiciona conteúdo ao final de um arquivo (para arquivos enormes, em partes).", { path: str(""), content: str("") }, ["path", "content"]),
  fn("edit_file", "Substitui um trecho exato de texto em um arquivo.", { path: str(""), find: str("texto exato existente"), replace: str("novo texto") }, ["path", "find", "replace"]),
  fn("delete_file", "Apaga um arquivo.", { path: str("") }, ["path"]),
  fn("list_sprites", "Lista os sprites existentes com tamanho.", {}),
  fn("import_sprite", "Importa uma imagem PNG/JPG de uma URL pública como sprite.", { name: str("nome do sprite"), url: str("URL da imagem"), max_size: { type: "number", description: "tamanho máximo em pixels, padrão 64" } }, ["name", "url"]),
  fn("run_game", "Roda o jogo por ~2s e retorna o console (logs e erros).", {}),
  fn("search_github", "Pesquisa repositórios no GitHub.", { query: str("ex: 'snake game javascript' ou 'topic:pixel-art sprites'") }, ["query"]),
  fn("list_github_files", "Lista arquivos de um repositório GitHub.", { repo: str("dono/repo"), filter: str("filtro opcional no caminho, ex: .png ou src/") }, ["repo"]),
  fn("read_github_file", "Lê um arquivo de texto de um repositório GitHub.", { repo: str("dono/repo"), path: str("caminho") }, ["repo", "path"]),
  fn("ask_user", "Faz uma pergunta ao usuário e pausa até ele responder.", { question: str(""), options: { type: "array", items: { type: "string" } } }, ["question"]),
];

const Msg = z.object({
  role: z.enum(["user", "assistant", "tool", "system"]),
  content: z.string().nullable().optional(),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
});

export const agentStep = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ messages: z.array(Msg).max(400), context: z.string().max(40000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["GROQ_API_KEY"];
    if (!key) return { error: "A chave da IA não está configurada." };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.3,
        max_completion_tokens: 32000,
        tools: TOOLS,
        tool_choice: "auto",
        messages: [{ role: "system", content: SYSTEM }, { role: "system", content: data.context }, ...data.messages],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Groq error", res.status, body);
      return { error: res.status === 429 ? "Limite da IA atingido — espere alguns segundos e tente de novo." : `Erro da IA (${res.status}).` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string | null; reasoning?: string; tool_calls?: unknown[] } }[] };
    const m = json.choices?.[0]?.message ?? {};
    return { content: m.content ?? "", reasoning: m.reasoning ?? "", tool_calls: (m.tool_calls ?? []) as { id: string; function: { name: string; arguments: string } }[] };
  });

const gh = async (url: string) => {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "PixelForge" };
  const t = process.env["GITHUB_TOKEN"];
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
};

export const githubTool = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: z.string(), args: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data: { name, args } }) => {
    try {
      if (name === "search_github") {
        const r = await gh(`https://api.github.com/search/repositories?per_page=10&q=${encodeURIComponent(String(args.query))}`);
        const j = (await r.json()) as { items: { full_name: string; description: string; stargazers_count: number; language: string; license?: { spdx_id: string } }[] };
        return { result: j.items.map((i) => `${i.full_name} ★${i.stargazers_count} [${i.language ?? "?"}] (${i.license?.spdx_id ?? "sem licença"}) — ${i.description ?? ""}`).join("\n") || "Nada encontrado." };
      }
      const repo = String(args.repo ?? "");
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { result: "Repo inválido, use dono/repo." };
      if (name === "list_github_files") {
        const r = await gh(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`);
        const j = (await r.json()) as { tree: { path: string; type: string; size?: number }[] };
        const f = String(args.filter ?? "").toLowerCase();
        const files = j.tree.filter((t) => t.type === "blob" && t.path.toLowerCase().includes(f));
        return { result: `${files.length} arquivos. Imagens podem ser importadas com URL https://raw.githubusercontent.com/${repo}/HEAD/<caminho>\n` + files.slice(0, 300).map((t) => `${t.path} (${t.size ?? 0}b)`).join("\n") };
      }
      if (name === "read_github_file") {
        const r = await gh(`https://raw.githubusercontent.com/${repo}/HEAD/${String(args.path).split("/").map(encodeURIComponent).join("/")}`);
        const txt = await r.text();
        return { result: txt.length > 60000 ? txt.slice(0, 60000) + "\n…(cortado)" : txt };
      }
      return { result: "Ferramenta desconhecida." };
    } catch (e) {
      return { result: `Erro: ${(e as Error).message}` };
    }
  });
