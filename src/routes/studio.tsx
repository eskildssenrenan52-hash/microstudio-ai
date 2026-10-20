import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createRuntime, DEFAULT_CODE, type SpriteMap } from "@/lib/engine";
import { EXAMPLES } from "@/lib/examples";
import { SpriteEditor } from "@/components/studio/SpriteEditor";
import { AssistantPanel } from "@/components/studio/AssistantPanel";
import { Button } from "@/components/ui/button";
import { Play, Square, Code2, Palette, BookOpen } from "lucide-react";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Estúdio · PixelForge" },
      { name: "description", content: "Programe jogos 2D no navegador com editor, sprites e IA assistente." },
      { property: "og:title", content: "Estúdio · PixelForge" },
      { property: "og:description", content: "Programe jogos 2D no navegador com editor, sprites e IA assistente." },
    ],
  }),
  component: Studio,
});

type Tab = "code" | "sprites" | "examples";
type Log = { msg: string; kind: "log" | "error" };

function Studio() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [sprites, setSprites] = useState<SpriteMap>({});
  const [tab, setTab] = useState<Tab>("code");
  const [logs, setLogs] = useState<Log[]>([]);
  const [running, setRunning] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pixelforge-project") || "null");
      if (saved) { setCode(saved.code ?? DEFAULT_CODE); setSprites(saved.sprites ?? {}); }
    } catch { /* ignore */ }
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) localStorage.setItem("pixelforge-project", JSON.stringify({ code, sprites })); }, [code, sprites]);

  const stop = () => { stopRef.current?.(); stopRef.current = null; setRunning(false); };
  const run = (src = code) => {
    stop();
    setLogs([]);
    if (!canvas.current) return;
    stopRef.current = createRuntime({ canvas: canvas.current, code: src, sprites, log: (msg, kind = "log") => setLogs((l) => [...l.slice(-100), { msg, kind }]) });
    setRunning(true);
  };
  useEffect(() => () => { stopRef.current?.(); }, []);

  const tabs: [Tab, string, typeof Code2][] = [["code", "Código", Code2], ["sprites", "Sprites", Palette], ["examples", "Exemplos", BookOpen]];

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-2">
        <Link to="/" className="font-mono text-lg font-bold"><span className="text-primary">Pixel</span>Forge</Link>
        <div className="flex gap-2">
          <Button onClick={() => run()}><Play className="h-4 w-4" /> Rodar</Button>
          <Button variant="secondary" onClick={stop} disabled={!running}><Square className="h-4 w-4" /> Parar</Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
        <section className="flex min-h-0 flex-col border-r border-border">
          <nav className="flex border-b border-border">
            {tabs.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 text-sm ${tab === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{label}</button>
            ))}
          </nav>
          <div className="min-h-0 flex-1">
            {tab === "code" && (
              <textarea
                value={code}
                spellCheck={false}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget; const s = t.selectionStart; const v = code.slice(0, s) + "  " + code.slice(t.selectionEnd); setCode(v); requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2)); }
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
                }}
                className="h-full w-full resize-none bg-sidebar p-4 font-mono text-sm leading-6 text-foreground outline-none"
              />
            )}
            {tab === "sprites" && <SpriteEditor sprites={sprites} onChange={setSprites} />}
            {tab === "examples" && (
              <div className="grid gap-3 p-4">
                {EXAMPLES.map((ex) => (
                  <button key={ex.name} onClick={() => { setCode(ex.code); setTab("code"); run(ex.code); }} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary">
                    <div className="font-semibold">{ex.name}</div>
                    <div className="text-sm text-muted-foreground">{ex.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="flex min-h-0 flex-col border-r border-border">
          <div className="flex flex-1 items-center justify-center bg-sidebar p-4">
            <canvas ref={canvas} tabIndex={0} width={640} height={360} className="aspect-video w-full rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-ring" style={{ imageRendering: "pixelated" }} />
          </div>
          <div className="h-40 overflow-auto border-t border-border p-3 font-mono text-xs">
            <div className="mb-1 text-muted-foreground">Console {running && "· clique no jogo para usar o teclado · Ctrl+Enter roda"}</div>
            {logs.map((l, i) => <div key={i} className={l.kind === "error" ? "text-destructive" : ""}>{l.msg}</div>)}
          </div>
        </section>
        <aside className="min-h-0 border-t border-border lg:border-t-0">
          <AssistantPanel code={code} sprites={Object.keys(sprites)} onApply={(c) => { setCode(c); setTab("code"); run(c); }} />
        </aside>
      </div>
    </div>
  );
}
