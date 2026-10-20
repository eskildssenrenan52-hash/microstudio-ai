import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Wand2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = ["Como uso este site?", "Crie um jogo de nave atirando em asteroides", "Adicione gravidade e pulo ao meu jogo", "Por que meu código dá erro?"];

function Rendered({ text, onApply }: { text: string; onApply: (c: string) => void }) {
  const parts = text.split(/```(?:js|javascript)?\n?([\s\S]*?)```/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <div key={i} className="my-2 overflow-hidden rounded-md border border-border">
            <pre className="max-h-60 overflow-auto bg-background p-2 font-mono text-xs">{p}</pre>
            <button onClick={() => onApply(p)} className="flex w-full items-center justify-center gap-1 bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"><Wand2 className="h-3 w-3" /> Aplicar no editor</button>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap">{p.trim().replace(/\*\*/g, "")}</p>
        ),
      )}
    </>
  );
}

export function AssistantPanel({ code, sprites, onApply }: { code: string; sprites: string[]; onApply: (c: string) => void }) {
  const ask = useServerFn(askAssistant);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Oi! Eu sou o Pixel 👾. Posso escrever jogos para você, corrigir erros e te mostrar como usar o estúdio. O que vamos criar?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next); setInput(""); setLoading(true);
    try {
      const { reply } = await ask({ data: { messages: next.slice(1).slice(-20), code, sprites } });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Ops, algo deu errado. Tente de novo." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Sparkles className="h-4 w-4 text-accent" /><span className="font-semibold">Pixel · IA</span></div>
      <div className="flex-1 space-y-3 overflow-auto p-4 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-secondary p-3" : "mr-2 rounded-lg border border-border bg-card p-3"}>
            <Rendered text={m.content} onApply={onApply} />
          </div>
        ))}
        {loading && <div className="animate-pulse text-muted-foreground">Pixel está pensando…</div>}
        {msgs.length === 1 && (
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary hover:text-foreground">{s}</button>)}
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Peça um jogo, uma mudança ou ajuda…" className="resize-none" />
        <Button type="submit" size="icon" disabled={loading} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
