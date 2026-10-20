import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Code2, Palette, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PixelForge — crie jogos 2D com IA no navegador" },
      { name: "description", content: "Motor de jogos 2D inspirado no microStudio, com editor, sprites e uma IA que programa com você." },
      { property: "og:title", content: "PixelForge — crie jogos 2D com IA" },
      { property: "og:description", content: "Motor de jogos 2D no navegador com IA assistente que programa com você." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Sparkles, title: "IA que programa", text: "Descreva o jogo em português e o Pixel escreve o código. Um clique aplica." },
  { icon: Code2, title: "API simples", text: "init, update e draw. Coordenadas centradas e fáceis de entender." },
  { icon: Palette, title: "Sprites embutidos", text: "Desenhe pixel art e use no jogo pelo nome." },
  { icon: Zap, title: "Roda na hora", text: "Sem instalar nada. Seu projeto fica salvo no navegador." },
];

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-mono text-xl font-bold"><span className="text-primary">Pixel</span>Forge</span>
        <Button asChild variant="secondary"><Link to="/studio">Abrir estúdio</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <p className="font-mono text-sm text-accent">// inspirado no microStudio</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-tight md:text-7xl">Faça jogos. <span className="text-primary">Com uma IA</span> do seu lado.</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">Um estúdio de jogos 2D direto no navegador, mais simples de mexer, com um assistente que escreve código, corrige erros e te guia pelo site.</p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg"><Link to="/studio">Começar a criar</Link></Button>
        </div>
        <pre className="mt-16 overflow-auto rounded-xl border border-border bg-card p-6 font-mono text-sm text-muted-foreground">{`function update() {
  if (keyboard.RIGHT) x += 2
}
function draw() {
  screen.clear("#1b1630")
  screen.fillRound(x, 0, 16, 16, "#b8ff3c")
}`}</pre>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5">
            <Icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
