import { useState } from "react";
import type { SpriteMap } from "@/lib/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PALETTE = ["#000000", "#ffffff", "#ff4fa3", "#b8ff3c", "#3cc8ff", "#ffd23f", "#ff6b35", "#8e5cff", "#5a4636", "#2e8b57", "#7f7f7f", ""];
const N = 16;

export function SpriteEditor({ sprites, onChange }: { sprites: SpriteMap; onChange: (s: SpriteMap) => void }) {
  const names = Object.keys(sprites);
  const [current, setCurrent] = useState(names[0] ?? "");
  const [color, setColor] = useState("#b8ff3c");
  const [newName, setNewName] = useState("");
  const [drawing, setDrawing] = useState(false);
  const sp = sprites[current];

  const paint = (i: number) => {
    if (!sp) return;
    const pixels = [...sp.pixels];
    pixels[i] = color;
    onChange({ ...sprites, [current]: { ...sp, pixels } });
  };
  const create = () => {
    const n = newName.trim().replace(/\W/g, "_");
    if (!n || sprites[n]) return;
    onChange({ ...sprites, [n]: { w: N, h: N, pixels: Array(N * N).fill("") } });
    setCurrent(n);
    setNewName("");
  };
  const remove = () => {
    const { [current]: _, ...rest } = sprites;
    onChange(rest);
    setCurrent(Object.keys(rest)[0] ?? "");
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div className="flex gap-2">
        <Input placeholder="nome do sprite (ex: heroi)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        <Button onClick={create}>Criar</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {names.map((n) => (
          <button key={n} onClick={() => setCurrent(n)} className={`rounded-md border px-3 py-1 font-mono text-sm ${n === current ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{n}</button>
        ))}
        {!names.length && <p className="text-sm text-muted-foreground">Crie seu primeiro sprite e use no código com <code className="font-mono text-primary">screen.drawSprite("nome", x, y, 16)</code></p>}
      </div>
      {sp && (
        <div className="flex flex-wrap items-start gap-6">
          <div className="grid select-none border border-border" style={{ gridTemplateColumns: `repeat(${N}, 1.25rem)`, backgroundImage: "repeating-conic-gradient(var(--muted) 0 25%, var(--secondary) 0 50%)", backgroundSize: "1.25rem 1.25rem" }} onMouseLeave={() => setDrawing(false)} onMouseUp={() => setDrawing(false)}>
            {sp.pixels.map((p, i) => (
              <div key={i} className="h-5 w-5 border border-border/20" style={{ background: p || undefined }} onMouseDown={() => { setDrawing(true); paint(i); }} onMouseEnter={() => drawing && paint(i)} />
            ))}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {PALETTE.map((c) => (
                <button key={c || "erase"} title={c || "borracha"} onClick={() => setColor(c)} className={`h-8 w-8 rounded-md border-2 ${color === c ? "border-primary" : "border-border"}`} style={{ background: c || undefined }}>{!c && "⌫"}</button>
              ))}
            </div>
            <input type="color" value={color || "#000000"} onChange={(e) => setColor(e.target.value)} className="h-8 w-full cursor-pointer rounded bg-transparent" />
            <Button variant="destructive" size="sm" onClick={remove}>Excluir sprite</Button>
          </div>
        </div>
      )}
    </div>
  );
}
