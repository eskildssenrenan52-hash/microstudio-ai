import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { agentStep, githubTool } from "@/lib/ai.functions";
import type { SpriteMap } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Square, FileText, Pencil, Search, Github, Image as ImageIcon, Play, Brain, HelpCircle, Trash2, FolderTree } from "lucide-react";

export type StudioApi = {
  getFiles: () => Record<string, string>;
  setFiles: (f: Record<string, string>) => void;
  getSprites: () => SpriteMap;
  setSprites: (s: SpriteMap) => void;
  getLogs: () => string[];
  runAndCollect: () => Promise<string>;
  openFile: (p: string) => void;
};

type ApiMsg = { role: "user" | "assistant" | "tool"; content?: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string };
type Item =
  | { kind: "user" | "assistant"; text: string }
  | { kind: "thinking"; text: string }
  | { kind: "tool"; name: string; label: string; ok: boolean }
  | { kind: "question"; text: string; options: string[] };

const SUGGESTIONS = ["Crie um jogo de plataforma com vários níveis, em vários arquivos", "Procure no GitHub um jogo snake open source e traga para cá", "Importe sprites de nave de um repositório open source", "Analise meu código e melhore o jogo"];

const ICONS: Record<string, typeof FileText> = { list_files: FolderTree, read_file: FileText, write_file: Pencil, append_file: Pencil, edit_file: Pencil, delete_file: Trash2, list_sprites: ImageIcon, import_sprite: ImageIcon, run_game: Play, search_github: Search, list_github_files: Github, read_github_file: Github, ask_user: HelpCircle };

function label(name: string, a: Record<string, unknown>) {
  const m: Record<string, string> = {
    list_files: "Listando arquivos do projeto", read_file: `Lendo ${a.path}`, write_file: `Escrevendo ${a.path}`, append_file: `Continuando ${a.path}`, edit_file: `Editando ${a.path}`, delete_file: `Apagando ${a.path}`,
    list_sprites: "Vendo os sprites", import_sprite: `Importando sprite "${a.name}"`, run_game: "Rodando o jogo para testar", search_github: `Pesquisando no GitHub: ${a.query}`,
    list_github_files: `Explorando ${a.repo}`, read_github_file: `Lendo ${a.repo}/${a.path}`, ask_user: "Fazendo uma pergunta",
  };
  return m[name] ?? name;
}

const lines = (s: string) => s.split("\n").length;

function loadImageSprite(url: string, max: number): Promise<{ w: number; h: number; pixels: string[] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * r)), h = Math.max(1, Math.round(img.height * r));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d")!; g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data; const pixels: string[] = [];
      for (let i = 0; i < d.length; i += 4) pixels.push(d[i + 3] < 128 ? "" : "#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
      resolve({ w, h, pixels });
    };
    img.onerror = () => reject(new Error("não consegui carregar a imagem (URL inválida ou bloqueada)"));
    img.src = url;
  });
}

// Keep requests small: old tool outputs and big file writes are summarized.
function compact(msgs: ApiMsg[]): ApiMsg[] {
  const keep = msgs.length - 8;
  return msgs.map((m, i) => {
    if (i >= keep) return m;
    if (m.role === "tool" && (m.content?.length ?? 0) > 1500) return { ...m, content: m.content!.slice(0, 1500) + "\n…(resumido)" };
    if (m.tool_calls) return { ...m, tool_calls: m.tool_calls.map((t) => {
      if (t.function.arguments.length <= 1500) return t;
      let path = ""; try { path = JSON.parse(t.function.arguments).path ?? ""; } catch { /* */ }
      return { ...t, function: { ...t.function, arguments: JSON.stringify({ path, note: "conteúdo omitido, use read_file" }) } };
    }) };
    return m;
  });
}

export function AssistantPanel({ api }: { api: StudioApi }) {
  const step = useServerFn(agentStep);
  const ghTool = useServerFn(githubTool);
  const [items, setItems] = useState<Item[]>([{ kind: "assistant", text: "Oi! Eu sou o Pixel 👾, seu agente de jogos. Eu leio e edito todos os arquivos do projeto, testo o jogo, pesquiso jogos e sprites open source no GitHub e te pergunto quando precisar. O que vamos criar?" }]);
  const history = useRef<ApiMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const cancel = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = end.current; if (el?.parentElement) el.parentElement.scrollTop = el.parentElement.scrollHeight; }, [items, busy]);
  const push = (it: Item) => setItems((x) => [...x, it]);

  const context = () => {
    const f = api.getFiles(); const s = api.getSprites(); const logs = api.getLogs().slice(-15);
    return `ESTADO ATUAL DO PROJETO\nArquivos:\n${Object.entries(f).map(([p, c]) => `- ${p} (${lines(c)} linhas)`).join("\n") || "(nenhum)"}\nSprites: ${Object.entries(s).map(([n, v]) => `${n} ${v.w}x${v.h}`).join(", ") || "nenhum"}\nConsole recente:\n${logs.join("\n") || "(vazio)"}\n${f["main.ts"] && f["main.ts"].length < 6000 ? `\nmain.ts:\n${f["main.ts"]}` : ""}`;
  };

  const exec = async (name: string, a: Record<string, any>): Promise<string> => {
    const files = { ...api.getFiles() };
    switch (name) {
      case "list_files": return Object.entries(files).map(([p, c]) => `${p} (${lines(c)} linhas)`).join("\n") || "(vazio)";
      case "read_file": {
        const c = files[a.path]; if (c == null) return `Arquivo ${a.path} não existe.`;
        const ls = c.split("\n"); const s = Math.max(1, a.start ?? 1), e = Math.min(ls.length, a.end ?? s + 799);
        return ls.slice(s - 1, e).map((l, i) => `${s + i}| ${l}`).join("\n") + (e < ls.length ? `\n…(linhas ${e + 1}-${ls.length} restantes, use start/end)` : "");
      }
      case "write_file": files[a.path] = String(a.content ?? ""); api.setFiles(files); api.openFile(a.path); return `OK, ${a.path} com ${lines(files[a.path])} linhas.`;
      case "append_file": files[a.path] = (files[a.path] ?? "") + String(a.content ?? ""); api.setFiles(files); return `OK, ${a.path} agora tem ${lines(files[a.path])} linhas.`;
      case "edit_file": {
        const c = files[a.path]; if (c == null) return `Arquivo ${a.path} não existe.`;
        if (!c.includes(a.find)) return "Trecho não encontrado. Leia o arquivo de novo e use o texto exato.";
        files[a.path] = c.replace(a.find, a.replace); api.setFiles(files); api.openFile(a.path); return "OK, editado.";
      }
      case "delete_file": delete files[a.path]; api.setFiles(files); return "OK, apagado.";
      case "list_sprites": return Object.entries(api.getSprites()).map(([n, v]) => `${n} ${v.w}x${v.h}`).join("\n") || "nenhum sprite";
      case "import_sprite": {
        const sp = await loadImageSprite(String(a.url), Math.min(128, Number(a.max_size) || 64));
        api.setSprites({ ...api.getSprites(), [a.name]: sp }); return `OK, sprite "${a.name}" ${sp.w}x${sp.h} importado. Use screen.drawSprite("${a.name}", x, y, w, h).`;
      }
      case "run_game": return await api.runAndCollect();
      case "search_github": case "list_github_files": case "read_github_file": return (await ghTool({ data: { name, args: a } })).result;
      default: return "Ferramenta desconhecida.";
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput(""); push({ kind: "user", text }); setBusy(true); cancel.current = false;
    history.current.push({ role: "user", content: text });
    try {
      for (let i = 0; i < 40 && !cancel.current; i++) {
        const r = await step({ data: { messages: compact(history.current).slice(-120), context: context().slice(0, 40000) } });
        if ("error" in r && r.error) { push({ kind: "assistant", text: r.error }); break; }
        const res = r as { content: string; reasoning: string; tool_calls: { id: string; function: { name: string; arguments: string } }[] };
        if (res.reasoning) push({ kind: "thinking", text: res.reasoning });
        const calls = res.tool_calls.map((t) => ({ id: t.id, type: "function" as const, function: t.function }));
        history.current.push({ role: "assistant", content: res.content || null, ...(calls.length ? { tool_calls: calls } : {}) });
        if (res.content) push({ kind: "assistant", text: res.content });
        if (!calls.length) break;
        let paused = false;
        for (const c of calls) {
          let a: Record<string, any> = {};
          try { a = JSON.parse(c.function.arguments || "{}"); } catch { /* */ }
          const name = c.function.name;
          if (name === "ask_user") {
            push({ kind: "question", text: String(a.question), options: Array.isArray(a.options) ? a.options.map(String) : [] });
            history.current.push({ role: "tool", tool_call_id: c.id, content: "Pergunta mostrada. A resposta virá na próxima mensagem do usuário." });
            paused = true; continue;
          }
          let out: string, ok = true;
          try { out = await exec(name, a); } catch (e) { out = `Erro: ${(e as Error).message}`; ok = false; }
          if (out.startsWith("Erro")) ok = false;
          push({ kind: "tool", name, label: label(name, a), ok });
          history.current.push({ role: "tool", tool_call_id: c.id, content: out });
        }
        if (paused) break;
      }
    } catch {
      push({ kind: "assistant", text: "Ops, algo deu errado. Tente de novo." });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Sparkles className="h-4 w-4 text-accent" /><span className="font-semibold">Pixel · Agente IA</span></div>
      <div className="flex-1 space-y-2 overflow-auto p-4 text-sm">
        {items.map((m, i) => {
          if (m.kind === "user") return <div key={i} className="ml-8 whitespace-pre-wrap rounded-lg bg-secondary p-3">{m.text}</div>;
          if (m.kind === "assistant") return <div key={i} className="mr-2 whitespace-pre-wrap rounded-lg border border-border bg-card p-3">{m.text.replace(/\*\*/g, "")}</div>;
          if (m.kind === "thinking") return (
            <details key={i} className="rounded-md text-xs text-muted-foreground">
              <summary className="flex cursor-pointer items-center gap-1"><Brain className="h-3 w-3" /> Pensou</summary>
              <p className="mt-1 whitespace-pre-wrap border-l border-border pl-2">{m.text}</p>
            </details>
          );
          if (m.kind === "tool") { const I = ICONS[m.name] ?? FileText; return <div key={i} className={`flex items-center gap-2 font-mono text-xs ${m.ok ? "text-muted-foreground" : "text-destructive"}`}><I className="h-3 w-3 shrink-0" /><span className="truncate">{m.label}</span></div>; }
          return (
            <div key={i} className="rounded-lg border border-primary bg-card p-3">
              <div className="mb-2 flex items-center gap-1 font-semibold"><HelpCircle className="h-4 w-4 text-primary" /> {m.text}</div>
              <div className="flex flex-wrap gap-2">{m.options.map((o) => <button key={o} disabled={busy} onClick={() => send(o)} className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary">{o}</button>)}</div>
            </div>
          );
        })}
        {busy && <div className="animate-pulse text-xs text-muted-foreground">Pixel está trabalhando…</div>}
        {items.length === 1 && (
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary hover:text-foreground">{s}</button>)}
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Peça um jogo, uma mudança ou ajuda…" className="resize-none" />
        {busy
          ? <Button type="button" size="icon" variant="secondary" onClick={() => { cancel.current = true; }} aria-label="Parar"><Square className="h-4 w-4" /></Button>
          : <Button type="submit" size="icon" aria-label="Enviar"><Send className="h-4 w-4" /></Button>}
      </form>
    </div>
  );
}
