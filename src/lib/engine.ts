import { transform } from "sucrase";
// Mini game runtime inspired by microStudio: origin at center, y up, screen height = 200 units.
export type SpriteMap = Record<string, { w: number; h: number; pixels: string[] }>;

export const API_DOCS = `API do motor (TypeScript, vários arquivos):
O projeto tem vários arquivos .ts que compartilham o MESMO escopo global (são concatenados em ordem alfabética, main.ts por último). Não use import/export: tudo declarado num arquivo é visível nos outros. Não redeclare o mesmo nome em dois arquivos.
Defina (normalmente em main.ts) as funções init(), update() (60x por segundo) e draw().
Coordenadas: centro da tela é (0,0), y para cima, altura da tela = 200 unidades. screen.width / screen.height.
screen.clear(cor?) | screen.fillRect(x,y,w,h,cor) | screen.drawRect(x,y,w,h,cor)
screen.fillRound(x,y,w,h,cor) (círculo/elipse) | screen.drawLine(x1,y1,x2,y2,cor)
screen.drawText(texto,x,y,tamanho,cor) | screen.drawSprite(nome,x,y,w,h)
screen.setAlpha(0..1) | cores: "#RRGGBB" ou "rgb(...)"
keyboard.UP/DOWN/LEFT/RIGHT/SPACE/A..Z (true enquanto pressionada), keyboard.press.SPACE (só no frame em que apertou)
mouse.x, mouse.y, mouse.pressed, mouse.press
random(min,max), clamp(v,a,b), distance(x1,y1,x2,y2), time() (segundos), print(...) mostra no console.
Sprites são criados no editor de sprites e usados por nome.`;

export const DEFAULT_CODE = `// Bem-vindo! Use as setas para mover a bolinha.
let x = 0, y = 0, score = 0
let coin = { x: 50, y: 30 }

function init() {
  print("Jogo iniciado!")
}

function update() {
  if (keyboard.LEFT) x -= 2
  if (keyboard.RIGHT) x += 2
  if (keyboard.UP) y += 2
  if (keyboard.DOWN) y -= 2
  x = clamp(x, -screen.width/2, screen.width/2)
  y = clamp(y, -100, 100)
  if (distance(x, y, coin.x, coin.y) < 12) {
    score++
    coin = { x: random(-140, 140), y: random(-80, 80) }
  }
}

function draw() {
  screen.clear("#1b1630")
  screen.fillRound(coin.x, coin.y, 10, 10, "#ffd23f")
  screen.fillRound(x, y, 16, 16, "#b8ff3c")
  screen.drawText("Pontos: " + score, 0, 85, 12, "#ffffff")
}
`;

export function createRuntime(opts: {
  canvas: HTMLCanvasElement;
  files: Record<string, string>;
  sprites: SpriteMap;
  log: (msg: string, kind?: "log" | "error") => void;
}) {
  const { canvas, files, sprites, log } = opts;
  const ctx = canvas.getContext("2d")!;
  const keys: Record<string, boolean> = {};
  const press: Record<string, boolean> = {};
  const mouse = { x: 0, y: 0, pressed: false, press: false };
  const spriteCache: Record<string, HTMLCanvasElement> = {};
  for (const [name, s] of Object.entries(sprites)) {
    const c = document.createElement("canvas");
    c.width = s.w; c.height = s.h;
    const g = c.getContext("2d")!;
    s.pixels.forEach((p, i) => { if (p) { g.fillStyle = p; g.fillRect(i % s.w, Math.floor(i / s.w), 1, 1); } });
    spriteCache[name] = c;
  }
  const scale = () => canvas.height / 200;
  const tx = (x: number) => canvas.width / 2 + x * scale();
  const ty = (y: number) => canvas.height / 2 - y * scale();
  const screen = {
    get width() { return canvas.width / scale(); },
    height: 200,
    clear(c = "#000") { ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.fillRect(0, 0, canvas.width, canvas.height); },
    setAlpha(a: number) { ctx.globalAlpha = a; },
    fillRect(x: number, y: number, w: number, h: number, c = "#fff") { const s = scale(); ctx.fillStyle = c; ctx.fillRect(tx(x) - (w * s) / 2, ty(y) - (h * s) / 2, w * s, h * s); },
    drawRect(x: number, y: number, w: number, h: number, c = "#fff") { const s = scale(); ctx.strokeStyle = c; ctx.strokeRect(tx(x) - (w * s) / 2, ty(y) - (h * s) / 2, w * s, h * s); },
    fillRound(x: number, y: number, w: number, h: number, c = "#fff") { const s = scale(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(tx(x), ty(y), (w * s) / 2, (h * s) / 2, 0, 0, Math.PI * 2); ctx.fill(); },
    drawLine(x1: number, y1: number, x2: number, y2: number, c = "#fff") { ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(tx(x1), ty(y1)); ctx.lineTo(tx(x2), ty(y2)); ctx.stroke(); },
    drawText(t: unknown, x: number, y: number, size = 10, c = "#fff") { ctx.fillStyle = c; ctx.font = `${size * scale()}px "JetBrains Mono", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(t), tx(x), ty(y)); },
    drawSprite(name: string, x: number, y: number, w = 16, h = w) { const sp = spriteCache[name]; if (!sp) return; const s = scale(); ctx.imageSmoothingEnabled = false; ctx.drawImage(sp, tx(x) - (w * s) / 2, ty(y) - (h * s) / 2, w * s, h * s); },
  };
  const keyName = (e: KeyboardEvent) => ({ ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT", " ": "SPACE", Enter: "ENTER", Escape: "ESCAPE", Shift: "SHIFT" } as Record<string, string>)[e.key] ?? e.key.toUpperCase();
  const keyboard = new Proxy({ press } as Record<string, unknown>, { get: (t, k: string) => (k === "press" ? press : !!keys[k]) });
  const onDown = (e: KeyboardEvent) => { if (document.activeElement !== canvas) return; const k = keyName(e); if (!keys[k]) press[k] = true; keys[k] = true; e.preventDefault(); };
  const onUp = (e: KeyboardEvent) => { keys[keyName(e)] = false; };
  const pos = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * canvas.width; const py = ((e.clientY - r.top) / r.height) * canvas.height; mouse.x = (px - canvas.width / 2) / scale(); mouse.y = (canvas.height / 2 - py) / scale(); };
  const onMove = (e: MouseEvent) => pos(e);
  const onMDown = (e: MouseEvent) => { pos(e); mouse.pressed = true; mouse.press = true; canvas.focus(); };
  const onMUp = () => { mouse.pressed = false; };
  window.addEventListener("keydown", onDown); window.addEventListener("keyup", onUp);
  canvas.addEventListener("mousemove", onMove); canvas.addEventListener("mousedown", onMDown); window.addEventListener("mouseup", onMUp);

  const t0 = performance.now();
  const helpers = {
    screen, keyboard, mouse,
    random: (a = 0, b = 1) => a + Math.random() * (b - a),
    clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
    distance: (a: number, b: number, c: number, d: number) => Math.hypot(c - a, d - b),
    time: () => (performance.now() - t0) / 1000,
    print: (...a: unknown[]) => log(a.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(" ")),
  };
  let raf = 0;
  let stopped = false;
  const stop = () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); canvas.removeEventListener("mousemove", onMove); canvas.removeEventListener("mousedown", onMDown); window.removeEventListener("mouseup", onMUp); };
  try {
    const code = compileProject(files);
    const names = Object.keys(helpers);
    // eslint-disable-next-line no-new-func
    const factory = new Function(...names, `${code}\nreturn { init: typeof init==="function"?init:null, update: typeof update==="function"?update:null, draw: typeof draw==="function"?draw:null };`);
    const game = factory(...names.map((n) => (helpers as Record<string, unknown>)[n]));
    game.init?.();
    let last = performance.now(), acc = 0;
    const frame = (now: number) => {
      if (stopped) return;
      acc += Math.min(100, now - last); last = now;
      try {
        while (acc >= 1000 / 60) { game.update?.(); for (const k in press) delete press[k]; mouse.press = false; acc -= 1000 / 60; }
        ctx.globalAlpha = 1; game.draw?.();
      } catch (e) { log(String(e), "error"); stop(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  } catch (e) { log(String(e), "error"); stop(); }
  canvas.focus();
  return stop;
}

export function compileProject(files: Record<string, string>) {
  const order = Object.keys(files)
    .filter((p) => /\.(ts|js)$/.test(p))
    .sort((a, b) => Number(a === "main.ts") - Number(b === "main.ts") || a.localeCompare(b));
  return order
    .map((p) => {
      const src = (files[p] ?? "").replace(/^\s*import\s[^\n]*$/gm, "").replace(/^(\s*)export\s+(default\s+)?/gm, "$1");
      try {
        return `// ---- ${p} ----\n` + transform(src, { transforms: ["typescript"], filePath: p }).code;
      } catch (e) {
        throw new Error(`Erro em ${p}: ${(e as Error).message}`);
      }
    })
    .join("\n");
}
