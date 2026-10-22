# Getting Started — PL / EN

## PL — Krok po kroku

### 1. Instalacja

```bash
npm install
```

Node >= 20.

### 2. Dev

```bash
npm run dev
```

Vite odpala `apps/playground` na `http://localhost:5173`. Gra przykładowoładuje się z menu → gra.

### 3. Stwórz własną scenę

Utwórz `apps/playground/src/scenes/MyScene.ts`:

```ts
import { Scene } from "@engine";

export class MyScene extends Scene {
  constructor(){ super("my"); }
  create(){
    this.createText("hello", 640, 360, "Cześć!", { fontSize:"24px", color:"#fff" }).setOrigin(0.5,0.5);
  }
  update(dt: number){
    if (this.getInput().isActionPressed("interact")) {
      this.getEvents().emit("request:scene", { to: "game" });
    }
  }
}
```

Zarejestruj w `main.ts`:

```ts
engine.registerScene(new MyScene());
```

### 4. Konfiguracja projektu JSON

Stwórz `project.json`:

```json
{
  "formatVersion": 1,
  "name": "MyGame",
  "game": { "width":1280, "height":720, "scaleMode":"fit", "backgroundColor":"#0f1419" },
  "assets": [{ "id":"hero", "type":"image", "src":"/assets/hero.png" }]
}
```

Załaduj w kodzie:

```ts
import { parseProjectJson } from "@engine";
const res = parseProjectJson(await fetch("/project.json").then(r=>r.text()));
if (!res.valid) throw new Error(res.errors.join("\n"));
```

### 5. Build

```bash
npm run build
# statyczne pliki w dist/ — wrzuć na dowolny hosting (Netlify, Vercel, S3, GitHub Pages)
```

### 6. WASM

Jeśli potrzebujesz heavy compute:

```ts
const engine = new Engine({ parent:"app", width:800, height:600, wasm:{ wasmUrl:"/wasm/core.wasm", required:false }});
await engine.getWasm().load();
const path = engine.getWasm().call("findPathAStar", grid, start, goal);
```

Zaimplementuj w `native/core/include/pathfinding.hpp` i przekompiluj.

---

## EN — Step by step

### 1. Install

```bash
npm install
```

### 2. Dev

```bash
npm run dev
```

### 3. Create a scene

```ts
import { Scene } from "@engine";
export class MyScene extends Scene {
  constructor(){ super("my"); }
  create(){
    this.createText("hello", 640, 360, "Hello!", { fontSize:"24px", color:"#fff" }).setOrigin(0.5,0.5);
  }
}
```

Register:

```ts
engine.registerScene(new MyScene());
engine.start("my");
```

### 4. Project JSON

Same schema — see `docs/api/README.md#projectformat`.

### 5. Build

```bash
npm run build
```

Host `dist/` anywhere.

### 6. Debug

Set `debug: true` in engine config to see FPS overlay. `pauseOnHidden:true` clamps `deltaTime` when tab hidden.
