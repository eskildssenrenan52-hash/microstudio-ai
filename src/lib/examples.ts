import { DEFAULT_CODE } from "./engine";

export const EXAMPLES: { name: string; desc: string; code: string }[] = [
  { name: "Pega moedas", desc: "Mova com as setas e colete moedas.", code: DEFAULT_CODE },
  {
    name: "Pong",
    desc: "Clássico: W/S contra a CPU.",
    code: `let p = 0, cpu = 0, bx = 0, by = 0, vx = 2, vy = 1.2, s1 = 0, s2 = 0
function update() {
  if (keyboard.W) p += 3
  if (keyboard.S) p -= 3
  p = clamp(p, -80, 80)
  cpu += clamp(by - cpu, -2, 2)
  bx += vx; by += vy
  if (by > 96 || by < -96) vy = -vy
  const edge = screen.width/2 - 12
  if (bx < -edge && Math.abs(by - p) < 22) { vx = Math.abs(vx) * 1.05 }
  if (bx > edge && Math.abs(by - cpu) < 22) { vx = -Math.abs(vx) * 1.05 }
  if (bx < -screen.width/2) { s2++; bx = 0; vx = 2 }
  if (bx > screen.width/2) { s1++; bx = 0; vx = -2 }
}
function draw() {
  screen.clear("#0d0b1a")
  screen.fillRect(-screen.width/2 + 8, p, 4, 36, "#b8ff3c")
  screen.fillRect(screen.width/2 - 8, cpu, 4, 36, "#ff4fa3")
  screen.fillRound(bx, by, 6, 6, "#ffffff")
  screen.drawText(s1 + "  :  " + s2, 0, 88, 14, "#ffffff")
}
`,
  },
  {
    name: "Chuva de estrelas",
    desc: "Partículas e cores animadas.",
    code: `let stars = []
function init() { for (let i = 0; i < 120; i++) stars.push({ x: random(-200, 200), y: random(-100, 100), v: random(0.5, 3) }) }
function update() {
  for (const s of stars) { s.y -= s.v; if (s.y < -100) { s.y = 100; s.x = random(-200, 200) } }
}
function draw() {
  screen.clear("#07051a")
  for (const s of stars) screen.fillRound(s.x, s.y, s.v, s.v, "hsl(" + (time()*40 + s.x) + ",90%,70%)")
  screen.drawText("Clique e use o mouse!", mouse.x, mouse.y, 8, "#ffffff")
}
`,
  },
];
