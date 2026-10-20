import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { API_DOCS } from "./engine";

const Input = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) })).max(40),
  code: z.string().max(50000),
  sprites: z.array(z.string()).max(200),
});

const SYSTEM = `Você é o "Pixel", assistente de IA do PixelForge, um estúdio de criação de jogos 2D no navegador (inspirado no microStudio).
Responda sempre em português do Brasil, de forma amigável e curta, para iniciantes.
Você ajuda a: programar jogos, corrigir erros, explicar conceitos e orientar pelo site.
Guia do site: no topo há o botão "Rodar" (executa o jogo) e "Parar". Abas à esquerda: "Código" (editor), "Sprites" (desenhe pixel art e dê um nome), "Exemplos" (jogos prontos). O console abaixo do jogo mostra mensagens de print() e erros. Clique no jogo para ele receber o teclado. Projetos salvam automaticamente no navegador.
${API_DOCS}
Quando escrever ou alterar código, SEMPRE devolva o programa COMPLETO em um único bloco \`\`\`js ... \`\`\` (o usuário terá um botão "Aplicar no editor"). Use só a API acima, sem import/HTML.`;

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["GROQ_API_KEY"];
    if (!key) return { reply: "A chave da IA não está configurada." };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "system", content: `Sprites disponíveis: ${data.sprites.join(", ") || "nenhum"}\nCódigo atual do usuário:\n\`\`\`js\n${data.code}\n\`\`\`` },
          ...data.messages,
        ],
      }),
    });
    if (!res.ok) {
      console.error("Groq error", res.status, await res.text());
      return { reply: res.status === 429 ? "Muitas perguntas seguidas — espere alguns segundos." : "Não consegui falar com a IA agora. Tente de novo." };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content ?? "(sem resposta)" };
  });
