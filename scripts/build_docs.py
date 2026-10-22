#!/usr/bin/env python3
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "index.html"

P = lambda pl, en: (pl, en)

def esc(text):
    return html.escape(text, quote=False)

def inline(text):
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", text)

def lang_block(pl_html, en_html, tag="div", cls=""):
    pl_html, en_html = inline(pl_html), inline(en_html)
    c = f' class="{cls}"' if cls else ""
    return (f"<{tag}{c} data-pl>{pl_html}</{tag}>"
            f"<{tag}{c} data-en>{en_html}</{tag}>")

def cell(value):
    if isinstance(value, tuple):
        return lang_block(value[0], value[1], "span")
    return value

def code(lang, text):
    body = html.escape(text.strip("\n"))
    return (f'<div class="code"><div class="bar"><span>{esc(lang)}</span>'
            f'<button type="button" class="copy" aria-label="Copy code" data-label-pl="Kopiuj" data-label-en="Copy">Kopiuj</button></div>'
            f'<pre><code>{body}</code></pre></div>')

def table(head, rows, widths=None):
    head_html = "".join(f"<th>{cell(h)}</th>" for h in head)
    body = ""
    for row in rows:
        body += "<tr>" + "".join(f"<td>{cell(c)}</td>" for c in row) + "</tr>"
    return f'<div class="table-wrap"><table class="table"><thead><tr>{head_html}</tr></thead><tbody>{body}</tbody></table></div>'

def note(kind, title_pl, title_en, body_pl, body_en):
    icon = {"tip": "◆", "warn": "▲", "ok": "●", "info": "●"}.get(kind, "●")
    return (f'<div class="note {kind}"><span class="ic">{icon}</span><div>'
            f'<strong data-pl>{title_pl}</strong><strong data-en>{title_en}</strong>'
            f'{lang_block(body_pl, body_en, "p")}</div></div>')

def cards(items):
    inner = "".join(
        f'<div class="card"><h4>{lang_block(t[0], t[1], "span")}</h4>{lang_block(d[0], d[1], "p")}</div>'
        for t, d in items)
    return f'<div class="cards">{inner}</div>'

def steps(items):
    inner = ""
    for i, (title, desc) in enumerate(items, 1):
        inner += (f'<div class="step"><span class="num">{i}</span><div>'
                  f'<h4>{lang_block(title[0], title[1], "span")}</h4>'
                  f'{lang_block(desc[0], desc[1], "p")}</div></div>')
    return f'<div class="steps">{inner}</div>'

def render_blocks(blocks):
    out = []
    for b in blocks:
        kind = b[0]
        if kind == "h2":
            out.append(lang_block(b[1], b[2], "h2"))
        elif kind == "h3":
            out.append(lang_block(b[1], b[2], "h3"))
        elif kind == "p":
            out.append(lang_block(b[1], b[2], "p"))
        elif kind == "lead":
            out.append(lang_block(b[1], b[2], "p", "lead"))
        elif kind == "code":
            out.append(code(b[1], b[2]))
        elif kind == "table":
            out.append(table(b[1], b[2]))
        elif kind == "note":
            out.append(note(*b[1:]))
        elif kind == "ul":
            pl = "".join(f"<li>{x[0]}</li>" for x in b[1])
            en = "".join(f"<li>{x[1]}</li>" for x in b[1])
            out.append(lang_block(f"<ul>{pl}</ul>", f"<ul>{en}</ul>"))
        elif kind == "ol":
            pl = "".join(f"<li>{x[0]}</li>" for x in b[1])
            en = "".join(f"<li>{x[1]}</li>" for x in b[1])
            out.append(lang_block(f"<ol>{pl}</ol>", f"<ol>{en}</ol>"))
        elif kind == "cards":
            out.append(cards(b[1]))
        elif kind == "steps":
            out.append(steps(b[1]))
        elif kind == "hr":
            out.append('<div class="hr"></div>')
    return "\n".join(out)

GROUPS = [
    ("start", "Start", "Start"),
    ("basics", "Podstawy", "Essentials"),
    ("api", "API", "API"),
    ("advanced", "Zaawansowane", "Advanced"),
    ("more", "Więcej", "More"),
]

pages = []

def page(pid, group, title, lead, blocks, keywords="", nav=None):
    pages.append({
        "id": pid, "group": group, "title": title, "lead": lead,
        "blocks": blocks, "keywords": keywords, "nav": nav or title,
    })

page("intro", "start", P("Wprowadzenie", "Introduction"),
     P("Browser2DEngine to cienka warstwa TypeScript nad Phaserem 3.80: własne, spójne API, walidacja na granicy modułów i wymienny runtime.",
       "Browser2DEngine is a thin TypeScript layer over Phaser 3.80: its own consistent API, validation at module boundaries and a swappable runtime."),
     [
         ("h2", "Czym to jest", "What it is"),
         ("p", "Silnik nie reimplementuje rendera ani fizyki. <b>Phaser</b> odpowiada za WebGL/Canvas, loader, Arcade Physics i input. <b>Browser2DEngine</b> dodaje to, czego w gołym Phaserze brakuje w większym projekcie: walidowana konfiguracja, cykl życia scen, mapowanie akcji, jeden zegar, format projektu i debug.", "The engine does not reimplement rendering or physics. <b>Phaser</b> handles WebGL/Canvas, the loader, Arcade Physics and input. <b>Browser2DEngine</b> adds what plain Phaser lacks in a larger project: validated config, scene lifecycle, action mapping, a single clock, a project format and debugging."),
         ("cards", [
             ((P("Cienka warstwa", "Thin layer")), P("Adapter izoluje Phasera. W kodzie gry nie ma `this.add`, `this.input` ani `this.cameras`.", "The adapter isolates Phaser. Game code contains no `this.add`, `this.input` or `this.cameras`.")),
             ((P("Jeden zegar", "One clock")), P("Tylko `Phaser.Scene.update` produkuje deltaTime. Żadnego drugiego `requestAnimationFrame`.", "Only `Phaser.Scene.update` produces deltaTime. No second `requestAnimationFrame`.")),
             ((P("Walidacja", "Validation")), P("Zły config, duplikat sceny, brakująca tekstura — kontrolowany błąd z kontekstem, nie ciche NaN.", "Bad config, duplicate scene, missing texture — a controlled error with context, not a silent NaN.")),
             ((P("Wymienny runtime", "Swappable runtime")), P("Granica `WasmBridge` i interfejs adaptera pozwalają podmienić backend bez zmian w grach.", "The `WasmBridge` boundary and adapter interface allow swapping the backend without touching games.")),
         ]),
         ("h2", "Szybkie porównanie", "Quick comparison"),
         ("table", ["", P("Czysty Phaser", "Plain Phaser"), "Browser2DEngine"], [
             [P("Scena", "Scene"), "<code>extends Phaser.Scene</code>, ręczne <code>this.add</code>", "<code>extends Scene</code>, <code>createSprite()</code> + walidacja"],
             [P("Input", "Input"), "<code>keyboard.addKey</code> w każdej scenie", "<code>isActionDown(\"move-left\")</code> z konfiguracji"],
             [P("Kamera", "Camera"), "<code>cameras.main.startFollow</code> powtarzane", "<code>getCamera().follow(player)</code>"],
             [P("Zasoby", "Assets"), "<code>load.image</code> bez sprawdzania duplikatów", "<code>declareAssets()</code> → manifest, raport, GC"],
             [P("Zapis", "Persistence"), P("własny kod na <code>localStorage</code>", "hand-rolled <code>localStorage</code> code"), "<code>PlayerSaveRepository</code> + checksum + SQL"],
             [P("Czas", "Time"), "delta w ms, ręczne dzielenie i clamp", "<code>dt</code> w sekundach, clamp 0.1 s w silniku"],
         ]),
         ("note", "info", "Zakres", "Scope",
          "19 rozdziałów specyfikacji plus dziewięć rozszerzeń API i dwie fazy dodatkowe: <b>pipeline assetów</b> (manifest, walidacja, GC, raport rozmiarów) oraz <b>projekt i zapisy</b> (format v2, migracje, atomowy zapis, localStorage/IndexedDB/File System/HTTP, SQL). Edytor wizualny, audio w API, networking i system cząstek pozostają poza zakresem.",
          "19 specification chapters plus nine API extensions and two extra phases: the <b>asset pipeline</b> (manifest, validation, GC, size report) and <b>project and saves</b> (v2 format, migrations, atomic saves, localStorage/IndexedDB/File System/HTTP, SQL). A visual editor, audio in the API, networking and a particle system remain out of scope."),
         ("h2", "Stan projektu", "Project status"),
         ("table", [P("Obszar", "Area"), P("Stan", "State"), P("Dowód", "Evidence")], [
             [P("Typecheck", "Typecheck"), "PASS", "<code>tsc --noEmit</code> — 0 błędów"],
             [P("Testy", "Tests"), "465/465", P("39 plików, Vitest + jsdom, bez adaptera", "39 files, Vitest + jsdom, no adapter")],
             [P("Build", "Build"), "PASS", "<code>dist/</code> 351 kB gzip"],
             [P("Zgodność", "Compliance"), "100% MVP", "<code>docs/AUDIT_REPORT.md</code>"],
             [P("Kod silnika", "Engine code"), P("10,3k LOC", "10.3k LOC"), "<code>packages/engine/src</code>, bez komentarzy"],
         ]),
         ("note", "tip", "Od czego zacząć", "Where to start",
          "Przejdź do <b>Szybki start</b> (3 kroki), potem <b>Konfiguracja</b> i <b>Cykl życia</b>. Dopiero później input, fizyka i kamera.",
          "Go to <b>Quick start</b> (3 steps), then <b>Config</b> and <b>Lifecycle</b>. Only then input, physics and camera."),
     ], "start overview phaser co to jest silnik 2d adapter wstep"),

page("quickstart", "start", P("Szybki start", "Quick start"),
     P("Od pustego katalogu do działającej sceny w trzech krokach.", "From an empty directory to a running scene in three steps."),
     [
         ("steps", [
             ((P("Zainstaluj", "Install")), P("`npm install` pobiera Phasera, Vite i Vitest. Node 20+, zero zależności natywnych.", "`npm install` pulls Phaser, Vite and Vitest. Node 20+, zero native deps.")),
             ((P("Napisz scenę", "Write a scene")), P("Klasa dziedziczy po `Scene`, deklaruje zasoby w `preload`, tworzy obiekty w `create`.", "The class extends `Scene`, declares assets in `preload`, creates objects in `create`.")),
             ((P("Uruchom silnik", "Start the engine")), P("`createEngine({ parent })` + `registerScene` + `start(id)`. Reszta to już logika gry.", "`createEngine({ parent })` + `registerScene` + `start(id)`. The rest is game logic.")),
         ]),
         ("h2", "1. Instalacja i skrypty", "1. Install and scripts"),
         ("code", "Terminal", """
npm install
npm run dev        # Vite on :5173, HMR, playground
npm run build      # tsc --noEmit && vite build -> dist/
npm test           # 465 testów (Vitest + jsdom)
npm run typecheck  # sama kontrola typów
"""),
         ("p", "Build jest w 100% statyczny: <code>dist/index.html</code> + <code>dist/assets/*</code>. Wrzucasz na dowolny hosting plików — brak backendu i brak konfiguracji środowiska.", "The build is fully static: <code>dist/index.html</code> + <code>dist/assets/*</code>. Deploy to any file host — no backend, no env setup."),
         ("h2", "2. Pierwsza scena", "2. First scene"),
         ("code", "src/scenes/MyScene.ts", """
import { Scene } from "@engine";

export class MyScene extends Scene {
  constructor() {
    super("my");
  }

  preload(): void {
    this.declareAssets([
      { id: "hero", type: "image", src: "/assets/hero.png" },
    ]);
  }

  create(): void {
    this.player = this.createSprite("hero", {
      id: "player",
      x: 640,
      y: 360,
      body: { type: "dynamic", shape: "circle", radius: 14, collideWorldBounds: true },
      tags: ["player"],
    });

    this.getCamera().setBounds(0, 0, 2000, 1400);
    this.getCamera().follow(this.player);
    this.createText("WASD", { x: 16, y: 16, scrollFactor: 0, style: { fontSize: "14px" } });
  }

  update(): void {
    if (!this.player) return;
    const input = this.getInput();
    const vx = (Number(input.isActionDown("move-right")) - Number(input.isActionDown("move-left"))) * 220;
    const vy = (Number(input.isActionDown("move-down")) - Number(input.isActionDown("move-up"))) * 220;
    this.getPhysics().setVelocity(this.player, vx, vy);
  }
}
"""),
         ("note", "tip", "preload vs create", "preload vs create",
          "<code>declareAssets()</code> wyłącznie w <code>preload</code> — silnik musi zakolejkować pliki do <code>Phaser.Loader</code> przed startem ładowania. Wywołanie w <code>create</code> nie załaduje niczego.",
          "Call <code>declareAssets()</code> only in <code>preload</code> — the engine must queue files into <code>Phaser.Loader</code> before loading starts. Calling it in <code>create</code> loads nothing."),
         ("h2", "3. Start silnika", "3. Start the engine"),
         ("code", "src/main.ts", """
import { Engine } from "@engine";
import { MyScene } from "./scenes/MyScene";

const engine = createEngine({
  parent: "game-container",
  width: 1280,
  height: 720,
  backgroundColor: "#151515",
  scaleMode: "fit",
  debug: true,
});

engine.registerScene(new MyScene());
engine.start("my");
"""),
         ("code", "index.html", """
<div id="game-container" style="width:100%;height:100vh"></div>
<script type="module" src="/src/main.ts"></script>
"""),
         ("h2", "Co dalej", "What next"),
         ("ul", [P("<b>Konfiguracja</b> — wszystkie pola i walidacja", "<b>Config</b> — every field and validation"),
                 P("<b>Cykl życia</b> — start, przełączanie scen, pauza, stop", "<b>Lifecycle</b> — start, scene switching, pause, stop"),
                 P("<b>Input</b> — mapowanie akcji i wskaźnik", "<b>Input</b> — action mapping and pointer"),
                 P("<b>Przykład: Top-Down</b> — kompletna gra referencyjna", "<b>Example: Top-Down</b> — the complete reference game")]),
     ], "quickstart start instalacja pierwsza scena hello world"),

page("install", "start", P("Instalacja i struktura", "Install & structure"),
     P("Monorepo, skrypty i podział pakietów — co gdzie leży i dlaczego.", "Monorepo, scripts and package split — what lives where and why."),
     [
         ("h2", "Skrypty", "Scripts"),
         ("table", ["npm", P("Działanie", "Action"), P("Kiedy używać", "When")], [
             ["<code>run dev</code>", "Vite dev server :5173 + HMR + playground", P("Praca nad grą lub silnikiem", "Working on a game or the engine")],
             ["<code>run build</code>", "<code>tsc --noEmit</code> → <code>vite build</code> → <code>dist/</code>", P("Przed commitem i w CI", "Before commit and in CI")],
             ["<code>run typecheck</code>", "Kontrola typów bez emisji plików", P("Szybka pętla zwrotna", "Fast feedback loop")],
             ["<code>test</code>", P("Vitest, 465 testów, 39 plików", "Vitest, 465 tests, 39 files"), P("Po każdej zmianie logiki", "After any logic change")],
             ["<code>run preview</code>", "Serwuje produkcyjny <code>dist/</code>", P("Weryfikacja builda", "Verifying the build")],
         ]),
         ("h2", "Struktura repozytorium", "Repository layout"),
         ("code", "tree", """
browser2d-engine/
├─ apps/playground/           # aplikacja Vite, demo (MenuScene, GameScene)
│  ├─ public/assets/          # player.png, coin.png, tiles.png
│  └─ src/scenes/
├─ packages/
│  ├─ engine/                 # publiczne API
│  │  └─ src/
│  │     ├─ core/             # Engine, Scene, GameObject, Time, EventBus, Logger
│  │     ├─ systems/          # Input, Physics, Camera, Assets, SceneManager
│  │     ├─ adapters/         # PhaserAdapter (jedyne miejsce z Phaserem)
│  │     ├─ project-format/   # wersjonowany JSON
│  │     └─ wasm/             # WasmBridge
│  ├─ phaser-adapter/
│  ├─ project-format/
│  └─ wasm-bridge/
├─ native/core/               # C++23 (A*), CMake, Emscripten
├─ examples/top-down/         # project.json + sceny
├─ tests/                     # unit + integracyjne, setup.ts (mock canvas)
├─ docs/                      # ta dokumentacja + AUDIT_REPORT.md
└─ .github/workflows/ci.yml
"""),
         ("h2", "Podział pakietów", "Package split"),
         ("p", "W MVP cała logika żyje w <code>packages/engine/src</code> — jeden pakiet, jeden build, brak problemów z cyklicznymi zależnościami. Katalogi <code>packages/phaser-adapter</code>, <code>project-format</code> i <code>wasm-bridge</code> istnieją jako miejsce docelowe po ustabilizowaniu granic (zgodnie ze specyfikacją).", "In the MVP all logic lives in <code>packages/engine/src</code> — one package, one build, no circular dependency issues. The <code>packages/phaser-adapter</code>, <code>project-format</code> and <code>wasm-bridge</code> directories exist as the target location once boundaries stabilize (per the spec)."),
         ("table", [P("Katalog", "Directory"), P("Odpowiedzialność", "Responsibility"), P("Zależności", "Dependencies")], [
             ["<code>core/</code>", P("API publiczne, cykl życia, model obiektów", "Public API, lifecycle, object model"), P("brak (czysty TS)", "none (pure TS)")],
             ["<code>systems/</code>", P("Input, fizyka, kamera, zasoby, sceny", "Input, physics, camera, assets, scenes"), P("core + adapter", "core + adapter")],
             ["<code>adapters/</code>", P("Jedyny importer <code>phaser</code>", "The only <code>phaser</code> importer"), P("phaser", "phaser")],
             ["<code>project-format/</code>", P("Parsowanie i walidacja JSON", "JSON parsing and validation"), P("brak", "none")],
             ["<code>wasm/</code>", P("Opcjonalny most do WebAssembly", "Optional WebAssembly bridge"), P("brak", "none")],
         ]),
         ("note", "warn", "Wersje", "Versions",
          "Phaser jest przypięty do <code>3.80.1</code> (bez <code>^</code>). Adapter korzysta z wewnętrznych API Phasera, więc aktualizacja wymaga przeglądu <code>PhaserAdapter.ts</code> i uruchomienia testów.",
          "Phaser is pinned to <code>3.80.1</code> (no <code>^</code>). The adapter uses Phaser internals, so upgrading requires reviewing <code>PhaserAdapter.ts</code> and running the tests."),
     ], "install instalacja struktura monorepo pakiety skrypty"),

page("config", "basics", P("Konfiguracja", "Configuration"),
     P("Jedno miejsce na wszystkie parametry startowe, walidowane przed utworzeniem Phasera.", "One place for every startup parameter, validated before Phaser is created."),
     [
         ("h2", "Pełny przykład", "Full example"),
         ("code", "src/main.ts", """
import { Engine } from "@engine";

const engine = createEngine({
  parent: "game-container",
  width: 1280,
  height: 720,
  minWidth: 320,
  minHeight: 240,
  maxWidth: 1920,
  maxHeight: 1080,
  backgroundColor: "#151515",
  scaleMode: "fit",
  debug: true,
  pauseOnHidden: true,
  maxDeltaTime: 0.1,
  physics: { enabled: true, gravity: { x: 0, y: 0 }, debug: false },
  seed: 1337,
  fixedStep: { hz: 60, maxSteps: 5 },
  inputMap: {
    "move-up": ["ArrowUp", "KeyW"],
    "move-down": ["ArrowDown", "KeyS"],
    "move-left": ["ArrowLeft", "KeyA"],
    "move-right": ["ArrowRight", "KeyD"],
    interact: ["Space", "KeyE"],
  },
});
"""),
         ("h2", "Pola", "Fields"),
         ("table", [P("Pole", "Field"), "Typ / Type", P("Domyślnie", "Default"), P("Opis", "Description")], [
             ["<code>parent</code>", "<code>string | HTMLElement</code>", P("wymagane", "required"), P("Id elementu lub sam element; brak → <code>Error</code>", "Element id or element; missing → <code>Error</code>")],
             ["<code>width/height</code>", "<code>number</code>", "1280 / 720", P("Logiczny rozmiar sceny, zakres 1–8192", "Logical scene size, range 1–8192")],
             ["<code>minWidth/minHeight</code>", "<code>number</code>", "—", P("Dolne ograniczenie skalowania", "Lower scaling bound")],
             ["<code>maxWidth/maxHeight</code>", "<code>number</code>", "—", P("Górne ograniczenie skalowania", "Upper scaling bound")],
             ["<code>backgroundColor</code>", "<code>string</code>", "<code>#151515</code>", P("Hex konwertowany na liczbę dla Phasera", "Hex converted to a number for Phaser")],
             ["<code>scaleMode</code>", "<code>fit|fill|fixed|expand</code>", "<code>fit</code>", P("Mapowane na <code>Phaser.Scale</code>, <code>fit</code> zachowuje proporcje", "Mapped to <code>Phaser.Scale</code>; <code>fit</code> preserves ratio")],
             ["<code>debug</code>", "<code>boolean</code>", "false", P("Overlay FPS + poziom logów", "FPS overlay + log level")],
             ["<code>pauseOnHidden</code>", "<code>boolean</code>", "true", P("Pauza przy <code>visibilitychange</code>", "Pause on <code>visibilitychange</code>")],
             ["<code>maxDeltaTime</code>", "<code>number</code>", "0.1", P("Górny clamp <code>dt</code> w sekundach", "Upper <code>dt</code> clamp in seconds")],
             ["<code>seed</code>", "<code>number</code>", "1337", P("Ziarno <code>Random</code>; liczba całkowita ≥ 0", "Seed for <code>Random</code>; integer ≥ 0")],
             ["<code>fixedStep</code>", "<code>{ hz, maxSteps? }</code>", P("wyłączony", "disabled"), P("<code>hz</code> 1–480, <code>maxSteps</code> ≥ 1; włącza <code>fixedUpdate</code>", "<code>hz</code> 1–480, <code>maxSteps</code> ≥ 1; enables <code>fixedUpdate</code>")],
             ["<code>physics</code>", "<code>PhysicsOptions</code>", P("wyłączone", "disabled"), "<code>gravity</code>, <code>debug</code>"],
             ["<code>inputMap</code>", "<code>Record&lt;string, string[]&gt;</code>", P("WASD + strzałki", "WASD + arrows"), P("Akcja → kody <code>KeyboardEvent.code</code>", "Action → <code>KeyboardEvent.code</code> list")],
             ["<code>wasm</code>", "<code>WasmOptions</code>", "—", "<code>wasmUrl</code>, <code>required</code>, <code>jsUrl</code>"],
         ]),
         ("h2", "Walidacja", "Validation"),
         ("p", "Konstruktor nie tworzy Phasera, dopóki konfiguracja nie przejdzie walidacji. Dostajesz wszystkie błędy naraz, nie pierwszy z brzegu.", "The constructor does not create Phaser until the config passes validation. You get all errors at once, not just the first one."),
         ("code", "TypeScript", """
import { validateEngineConfig, resolveEngineConfig } from "@engine";

validateEngineConfig({ width: -5 });
// => ["parent is required", "width must be a positive number"]

try {
  resolveEngineConfig({ width: 800 } as never);
} catch (error) {
  console.error((error as Error).message);
}
"""),
         ("table", [P("Przypadek", "Case"), P("Zachowanie", "Behaviour")], [
             [P("brak <code>parent</code>", "missing <code>parent</code>"), "<code>\"parent is required\"</code>"],
             [P("<code>width</code> ≤ 0", "<code>width</code> ≤ 0"), "<code>\"width must be a positive number\"</code>"],
             [P("niepoprawny kolor", "invalid colour"), P("rzucane z animowanego kontekstu — <code>\"backgroundColor must be a hex colour\"</code>", "thrown with context — <code>\"backgroundColor must be a hex colour\"</code>")],
             [P("nieznany element", "unknown element"), P("<code>Error</code> z id, którego nie ma w DOM", "<code>Error</code> naming the missing DOM id")],
             [P("zły <code>scaleMode</code>", "bad <code>scaleMode</code>"), P("lista dozwolonych wartości w komunikacie", "allowed values listed in the message")],
             [P("ujemny <code>seed</code> lub niecałkowity", "negative or fractional <code>seed</code>"), P("<code>\"seed must be a non-negative integer\"</code>", "<code>\"seed must be a non-negative integer\"</code>")],
             [P("<code>fixedStep.hz</code> poza 1–480", "<code>fixedStep.hz</code> outside 1–480"), P("komunikat o zakresie <code>fixedStep.hz</code>", "a <code>fixedStep.hz</code> range message")],
         ]),
         ("h2", "Resize", "Resize"),
         ("p", "Silnik obserwuje kontener przez <code>ResizeObserver</code> oraz <code>window.resize</code>, wywołuje <code>game.scale.refresh()</code> i emituje <code>engine:resize</code> z nowymi wymiarami. Nie musisz nic robić w scenach.", "The engine watches the container via <code>ResizeObserver</code> plus <code>window.resize</code>, calls <code>game.scale.refresh()</code> and emits <code>engine:resize</code> with the new size. Nothing to do in scenes."),
         ("note", "ok", "Kryteria akceptacji", "Acceptance criteria",
          "Silnik montuje się w elemencie z konfiguracji, nie tworzy drugiego <code>canvas</code> przy ponownym starcie, <code>stop()</code> usuwa obserwatory i listenery, a błędna konfiguracja kończy się kontrolowanym wyjątkiem.",
          "The engine mounts into the configured element, does not create a second <code>canvas</code> on restart, <code>stop()</code> removes observers and listeners, and bad config ends in a controlled exception."),
     ], "config konfiguracja engine options parent width height scale mode walidacja"),

page("lifecycle", "basics", P("Cykl życia", "Lifecycle"),
     P("Kolejność wywołań od konstruktora do zniszczenia — i co dokładnie zwalnia każdy krok.", "Call order from constructor to destruction — and what each step releases."),
     [
         ("h2", "Przepływ", "Flow"),
         ("code", "diagram", """
createEngine(cfg) -> walidacja -> managery -> (brak Phasera)
registerScene(scene) -> mapa id -> scena
start(id) -> PhaserAdapter.createGame() -> Phaser.Game -> startScene(id)
startScene(id) -> shutdown(poprzednia) -> clearScene(id) -> preload -> create
pause() -> Time.pause + game.loop.sleep + emit engine:pause
resume() -> Time.resume + game.loop.wake + emit engine:resume
stop() -> destroy(scena) -> game.destroy(true) -> detach listenery
destroy() -> stop() + czyszczenie scen, eventow, assetow
"""),
         ("h2", "API", "API"),
         ("code", "TypeScript", """
import { Engine } from "@engine";

const engine = createEngine({ parent: "game-container" });

engine.registerScene(new MenuScene());
engine.registerScene(new GameScene());

engine.start("menu");
engine.startScene("game", { level: 1 });
engine.stopScene("game");

engine.pause();
engine.resume();

engine.stop();
engine.destroy();
"""),
         ("table", [P("Metoda", "Method"), P("Efekt", "Effect"), P("Odwracalne", "Reversible")], [
             ["<code>start(id)</code>", P("Tworzy <code>Phaser.Game</code> (raz) i uruchamia scenę", "Creates <code>Phaser.Game</code> (once) and boots the scene"), P("tak, <code>stop()</code>", "yes, <code>stop()</code>")],
             ["<code>startScene(id)</code>", P("Shutdown bieżącej, <code>preload</code> + <code>create</code> nowej", "Shuts down current, <code>preload</code> + <code>create</code> next"), P("tak", "yes")],
             ["<code>stopScene(id)</code>", P("Shutdown wskazanej sceny, stan gry znika", "Shuts down the given scene, game state is lost"), P("nie", "no")],
             ["<code>pause()</code>", P("Zatrzymuje <code>Time</code> i uśpienie pętli", "Stops <code>Time</code> and sleeps the loop"), P("tak", "yes")],
             ["<code>stop()</code>", P("Niszczy Phasera i wszystkie listenery", "Destroys Phaser and all listeners"), P("nie", "no")],
             ["<code>destroy()</code>", P("<code>stop()</code> + czyści mapy scen, eventy, cache zasobów", "<code>stop()</code> + clears scene maps, events, asset cache"), P("nie", "no")],
         ]),
         ("h2", "Co jest zwalniane", "What is released"),
         ("ul", [P("<code>ResizeObserver.disconnect()</code> i <code>window.removeEventListener(\"resize\")</code>", "<code>ResizeObserver.disconnect()</code> and <code>window.removeEventListener(\"resize\")</code>"),
                 P("<code>document.visibilitychange</code> — listener pauzy", "<code>document.visibilitychange</code> pause listener"),
                 P("Wszystkie key listenery w <code>InputManager.detach()</code>", "All key listeners in <code>InputManager.detach()</code>"),
                 P("Sceny Phasera, obiekty, tekstury w cache", "Phaser scenes, objects, cached textures"),
                 P("Subskrypcje <code>EventBus</code> dla ID sceny", "<code>EventBus</code> subscriptions for the scene id")]),
         ("note", "warn", "Podwójny start", "Double start",
          "<code>start()</code> na już działającym silniku nie tworzy drugiego <code>Phaser.Game</code> ani drugiego <code>canvas</code> — przełącza scenę. To udowodnione testem <code>engine creates a single game</code>.",
          "<code>start()</code> on an already running engine creates neither a second <code>Phaser.Game</code> nor a second <code>canvas</code> — it switches scenes. Proven by the <code>engine creates a single game</code> test."),
     ], "lifecycle cykl zycia start stop destroy pause resume rejestracja scen"),

page("time", "basics", P("Czas, timery i determinizm", "Time, timers and determinism"),
     P("Czas gry, czas rzeczywisty, clamp, pauza, skala czasu, stały krok, timery z anulowaniem i generator losowy z seedem — jeden spójny model zamiast ręcznej matematyki w każdej scenie.",
       "Game time, real time, clamping, pause, time scale, fixed step, cancellable timers and a seeded random generator — one coherent model instead of hand-rolled maths in every scene."),
     [
         ("h2", "Dwa zegary", "Two clocks"),
         ("p", "Silnik prowadzi dwa niezależne zegary. <b>Czas rzeczywisty</b> (<code>realDeltaTime</code>, <code>realElapsed</code>) to ścienna miara tego, ile trwała klatka po przycięciu do <code>maxDeltaTime</code>. <b>Czas gry</b> (<code>deltaTime</code>, <code>elapsed</code>) to ten sam przyrost pomnożony przez <code>timeScale</code> — i to jego używają sceny, komponenty, timery i animacje. Pauza zeruje czas gry, ale nie zatrzymuje licznika klatek, więc narzędzia i nakładki debug pozostają responsywne.",
          "The engine keeps two independent clocks. <b>Real time</b> (<code>realDeltaTime</code>, <code>realElapsed</code>) measures the wall-clock frame after clamping to <code>maxDeltaTime</code>. <b>Game time</b> (<code>deltaTime</code>, <code>elapsed</code>) is the same increment multiplied by <code>timeScale</code> — and that is what scenes, components, timers and animations consume. Pause zeroes game time but keeps the frame counter running, so tools and debug overlays stay responsive."),
         ("code", "diagram", """
Phaser loop  ->  InternalPhaserScene.update(timeMs, deltaMs)
                   time.update(deltaMs)
                     rawDeltaTime   = deltaMs / 1000
                     realDeltaTime  = min(rawDeltaTime, maxDeltaTime)
                     deltaTime      = realDeltaTime * timeScale      // 0 when paused
                     elapsed       += deltaTime
                     realElapsed   += realDeltaTime
                     accumulator   += deltaTime                      // fixed step only
                   scheduler.update(deltaTime)                        // timers
                   while (consumeFixedStep()) scene.fixedUpdate(fixedDelta)
                   scene.update(deltaTime)                            // input -> update -> behavior
                   events.emit("engine:update", { deltaTime, elapsed })"""),
         ("table", ["API", "Typ / Type", P("Znaczenie", "Meaning")], [
             ["<code>deltaTime</code>", "number", P("Sekundy od poprzedniej klatki, po clampie i skali czasu", "Seconds since the previous frame, after clamp and time scale")],
             ["<code>realDeltaTime</code>", "number", P("To samo bez <code>timeScale</code>; 0 gdy pauza", "The same without <code>timeScale</code>; 0 while paused")],
             ["<code>rawDeltaTime</code>", "number", P("Surowe <code>deltaMs / 1000</code> przed clampem", "Raw <code>deltaMs / 1000</code> before clamping")],
             ["<code>elapsed</code> / <code>gameTime</code>", "number", P("Suma czasu gry od startu lub <code>reset()</code>", "Sum of game time since start or <code>reset()</code>")],
             ["<code>realElapsed</code>", "number", P("Suma czasu rzeczywistego (nie zależy od pauzy)", "Sum of real time (pause independent)")],
             ["<code>frame</code>", "number", P("Licznik klatek, rośnie także w pauzie", "Frame counter, grows during pause too")],
             ["<code>maxDeltaTime</code>", "number", P("Górny limit przyrostu, domyślnie 0.1 s", "Upper delta limit, 0.1 s by default")],
             ["<code>timeScale</code>", "number", P("Mnożnik tempa; setter deleguje do <code>setTimeScale</code>", "Tempo multiplier; the setter delegates to <code>setTimeScale</code>")],
             ["<code>isPaused</code>", "boolean", P("Stan zegara gry", "Game clock state")],
             ["<code>isClamped</code>", "boolean", P("Czy ostatnia klatka została przycięta", "Whether the last frame was clamped")],
             ["<code>fixedDelta</code> / <code>fixedAlpha</code>", "number", P("Długość kroku i reszta akumulatora w zakresie 0..1", "Step length and accumulator remainder in 0..1")],
             ["<code>pendingFixedSteps</code>", "number", P("Ile kroków czeka w tej klatce", "How many steps are queued this frame")],
             ["<code>toState()</code>", "TimeState", P("Migawka wszystkich wartości do HUD, logów i testów", "Snapshot of every value for HUD, logs and tests")],
         ]),
         ("h2", "Pauza i skala czasu", "Pause and time scale"),
         ("p", "<code>engine.pause()</code> zatrzymuje zegar gry, usypia pętlę i emituje <code>engine:pause</code>; <code>engine.resume()</code> robi odwrotnie i zeruje akumulator stałego kroku, więc po wznowieniu nie ma serii zaległych kroków. <code>setTimeScale(x)</code> skaluje czas gry bez zatrzymywania renderu — używaj go do slow motion, hit-stopu i przewijania powtórek. Skala <code>0</code> jest równoważna pauzie logicznej: <code>deltaTime</code> wynosi wtedy 0, ale klatki nadal są rysowane.",
          "<code>engine.pause()</code> freezes the game clock, sleeps the loop and emits <code>engine:pause</code>; <code>engine.resume()</code> reverses that and clears the fixed-step accumulator so no backlog of steps fires at once. <code>setTimeScale(x)</code> scales game time without stopping rendering — use it for slow motion, hit-stop and replay scrubbing. A scale of <code>0</code> is a logic pause: <code>deltaTime</code> becomes 0 while frames keep rendering."),
         ("code", "TypeScript", """
engine.setTimeScale(0.25);
engine.on("engine:timeScale", ({ timeScale }) => hud.setText(`${timeScale.toFixed(2)}x`));

const time = scene.getTime();
if (time.isPaused) return;
time.timeScale = 1;
"""),
         ("note", "warn", "Skala czasu jest globalna", "The time scale is global",
          "Nie ma per-scena <code>timeScale</code>. Dwie sceny działające równolegle dzielą jeden zegar. Jeśli potrzebujesz lokalnego spowolnienia, trzymaj licznik w komponencie i mnóż przez niego własną deltę.",
          "There is no per-scene <code>timeScale</code>. Two scenes running side by side share one clock. If you need local slow motion, keep your own counter in a component and multiply your deltas yourself."),
         ("h2", "Stały krok aktualizacji", "Fixed update step"),
         ("p", "Fizyka i logika sieciowa wolą stały krok: wtedy ten sam kod daje ten sam wynik przy 30, 60 i 144 Hz. Włączasz go w konfiguracji, a sceny implementują <code>fixedUpdate(fixedDelta)</code>. Akumulator jest liczony z czasu gry, więc <code>timeScale</code> i pauza działają na niego naturalnie. Na jedną klatkę przypada maksymalnie <code>maxSteps</code> kroków, żeby po długiej pauzie nie wykonać tysiąca iteracji.",
          "Physics and network logic prefer a fixed step: the same code then yields the same result at 30, 60 and 144 Hz. Enable it in the config and implement <code>fixedUpdate(fixedDelta)</code> in your scene. The accumulator is driven by game time, so <code>timeScale</code> and pause affect it naturally. A single frame runs at most <code>maxSteps</code> steps, so a long stall never triggers a thousand iterations."),
         ("code", "TypeScript", """
const engine = createEngine({
  parent: container,
  fixedStep: { hz: 60, maxSteps: 5 }
});

class Simulation extends Scene {
  private ticks = 0;

  fixedUpdate(fixedDelta: number): void {
    this.ticks += 1;
    this.stepSimulation(fixedDelta);
  }

  update(deltaTime: number): void {
    this.interpolateWith(this.getTime().fixedAlpha, deltaTime);
  }
}
"""),
         ("table", [P("Ustawienie", "Setting"), P("Efekt", "Effect")], [
             [P("brak <code>fixedStep</code>", "no <code>fixedStep</code>"), P("<code>fixedDelta = 0</code>, hook nigdy nie jest wołany", "<code>fixedDelta = 0</code>, the hook is never called")],
             ["<code>hz: 60</code>", P("krok 16.67 ms, typowy dla fizyki i sieci", "16.67 ms step, typical for physics and networking")],
             ["<code>hz: 30</code>", P("krok 33.3 ms, tańszy dla ciężkich symulacji", "33.3 ms step, cheaper for heavy simulations")],
             ["<code>maxSteps</code>", P("Górna liczba kroków na klatkę; nadmiar jest odrzucany", "Upper steps per frame; the surplus is dropped")],
             [P("<code>fixedAlpha</code>", "<code>fixedAlpha</code>"), P("Reszta akumulatora — do interpolacji w renderze", "Accumulator remainder — for render interpolation")],
         ]),
         ("note", "info", "Kolejność w klatce", "Order inside a frame",
          "Timery tykają przed stałymi krokami, a <code>Scene.update</code> po nich. Dzięki temu logika w stałym kroku widzi już odliczone opóźnienia, a <code>update</code> może interpolować pomiędzy dwoma ostatnimi krokami.",
          "Timers tick before the fixed steps and <code>Scene.update</code> runs after them. Fixed-step logic therefore sees elapsed delays already applied, and <code>update</code> can interpolate between the last two steps."),
         ("h2", "Timery, opóźnienia i interwały", "Timers, delays and intervals"),
         ("p", "<code>Scheduler</code> to jedna kolejka zadań napędzana czasem gry. Każda scena dostaje własny <code>Timer</code> z właścicielem równym swojemu <code>id</code>, więc <code>shutdown()</code> automatycznie anuluje wszystko, co scena zaplanowała — nie trzeba pamiętać o ręcznym sprzątaniu. Callbacki lecą synchronicznie w klatce; wyjątek jest logowany i nie zatrzymuje pozostałych zadań. Zaległości po długiej klatce są ograniczone do czterech wywołań na zadanie.",
          "<code>Scheduler</code> is a single queue driven by game time. Every scene gets its own <code>Timer</code> owned by its <code>id</code>, so <code>shutdown()</code> cancels everything the scene scheduled — no manual bookkeeping. Callbacks run synchronously inside the frame; an exception is logged and does not stop the other tasks. Catch-up after a long frame is capped at four invocations per task."),
         ("code", "TypeScript", """
const timer = this.getTimer();

const delayed = timer.delay(0.5, () => this.openDoor());

const tick = timer.interval(2, () => this.spawnWave(), { repeat: 5 });

if (this.isDoorOpen()) {
  timer.cancel(delayed);
  tick.cancel();
}

timer.pending;   // ile zadań właściciela czeka
timer.clear();   // anuluj wszystko tej sceny
engine.getScheduler().update(dt);   // robi to silnik; wołaj tylko w testach
"""),
         ("table", ["API", P("Opis", "Description")], [
             ["<code>delay(s, cb, opts?)</code>", P("Jednorazowe opóźnienie; zwraca uchwyt z <code>cancel()</code>", "One-shot delay; returns a handle with <code>cancel()</code>")],
             ["<code>interval(s, cb, opts?)</code>", P("Powtarzanie; <code>opts.repeat</code> ogranicza liczbę wywołań", "Repeating task; <code>opts.repeat</code> caps invocations")],
             ["<code>opts.owner</code>", P("Grupa zadań anulowana jednym <code>cancelOwner()</code>", "Task group cancelled with one <code>cancelOwner()</code>")],
             ["<code>opts.onError</code>", P("Handler wyjątku zamiast samego logu", "Exception handler instead of the log alone")],
             ["<code>handle.cancelled</code>", P("Czy zadanie zostało już anulowane", "Whether the task was already cancelled")],
             ["<code>scheduler.has(id)</code>", "boolean", P("Czy zadanie nadal istnieje", "Whether the task still exists")],
             ["<code>scheduler.count(owner?)</code>", "number", P("Liczba zadań, globalnie lub per właściciel", "Number of tasks, globally or per owner")],
             ["<code>scheduler.errorCount</code>", "number", P("Ile wyjątków przechwycono", "How many exceptions were caught")],
         ]),
         ("note", "tip", "Nie mieszaj z <code>setTimeout</code>", "Do not mix with <code>setTimeout</code>",
          "Zadania na zegarze gry zatrzymują się w pauzie, respektują <code>timeScale</code>, są anulowalne i deterministyczne w testach. <code>setTimeout</code> nie ma żadnej z tych właściwości.",
          "Game-clock tasks stop when paused, respect <code>timeScale</code>, are cancellable and deterministic in tests. <code>setTimeout</code> has none of those properties."),
         ("h2", "Generator losowy z seedem", "Seeded random generator"),
         ("p", "<code>Random</code> to szybki PRNG (xorshift zaimplementowany na 32-bitowych operacjach), który daje identyczną sekwencję dla tego samego seeda na każdej platformie. Seed ustawiasz raz w konfiguracji silnika (<code>seed: 1337</code>), a sceny sięgają po wspólne źródło przez <code>this.getRandom()</code>. Do niezależnych strumieni — pogoda, przeciwnicy, loot — użyj <code>fork()</code>, żeby jedna zmiana nie przesuwała wszystkich kolejnych losowań.",
          "<code>Random</code> is a fast PRNG (xorshift over 32-bit integer operations) producing the identical sequence for the same seed on every platform. Set the seed once in the engine config (<code>seed: 1337</code>) and scenes reach the shared source via <code>this.getRandom()</code>. For independent streams — weather, enemies, loot — use <code>fork()</code> so one change does not shift every later draw."),
         ("code", "TypeScript", """
const random = this.getRandom();

const x = random.float(120, 1880);
const enemyType = random.pick(["grunt", "brute", "scout"]);
const crit = random.bool(0.15);
const loot = random.fork("loot");       // niezależny strumień

const saved = random.saveState();
// ... przewijanie, powtórka ...
random.loadState(saved);
"""),
         ("table", ["API", P("Zwraca", "Returns"), P("Uwagi", "Notes")], [
             ["<code>next()</code>", "number 0..1", P("Rdzeń generatora", "Generator core")],
             ["<code>float(min, max)</code>", "number", P("Zakres domknięty z obu stron; odwrócone granice rzucają", "Closed on both ends; inverted bounds throw")],
             ["<code>int(min, max)</code>", "number", P("Liczby całkowite, oba końce włącznie", "Integers, both ends inclusive")],
             ["<code>bool(p = 0.5)</code>", "boolean", P("Prawdopodobieństwo sukcesu", "Success probability")],
             ["<code>pick(list)</code>", "T", P("Pusta lista rzuca wyjątek", "An empty list throws")],
             ["<code>shuffle(list)</code>", "T[]", P("Kopia — źródło nie jest modyfikowane", "Copy — the source is untouched")],
             ["<code>saveState()/loadState()</code>", "number", P("Zapis i odtworzenie pozycji strumienia", "Save and restore the stream position")],
             ["<code>fork(salt)</code>", "Random", P("Nowy strumień wyprowadzony z bieżącego stanu", "A new stream derived from the current state")],
         ]),
         ("h2", "Utrata fokusu i długie klatki", "Focus loss and long frames"),
         ("p", "Polityka jest jawna i przewidywalna: przy <code>pauseOnHidden: true</code> przejście karty w tło zatrzymuje zegar gry, usypia pętlę i emituje <code>engine:pause</code>. Każdy powrót mierzy jedną długą klatkę, która i tak jest przycinana do <code>maxDeltaTime</code>. Gdy klatka zostanie przycięta, silnik emituje <code>engine:frameClamped</code> z surową i przyciętą deltą — podłącz do tego log albo licznik w HUD, żeby zobaczyć, kiedy gracz traci płynność.",
          "The policy is explicit and predictable: with <code>pauseOnHidden: true</code> moving the tab to the background freezes the game clock, sleeps the loop and emits <code>engine:pause</code>. The return produces one long frame that is still clamped to <code>maxDeltaTime</code>. Whenever a frame is clamped the engine emits <code>engine:frameClamped</code> with the raw and the clamped delta — wire it to a log or a HUD counter to see when the player loses smoothness."),
         ("code", "TypeScript", """
engine.on("engine:frameClamped", ({ rawDeltaTime, deltaTime }) => {
  console.warn(`frame clamped ${(rawDeltaTime * 1000).toFixed(0)}ms -> ${(deltaTime * 1000).toFixed(0)}ms`);
});
"""),
         ("table", [P("Sytuacja", "Situation"), P("Co robi silnik", "What the engine does"), P("Co widzi gra", "What the game sees")], [
             [P("karta w tle", "tab in background"), P("pauza zegara, sleep pętli", "clock paused, loop asleep"), P("<code>deltaTime = 0</code>, brak <code>update</code>", "<code>deltaTime = 0</code>, no <code>update</code>")],
             [P("powrót do karty", "return to tab"), P("<code>resume()</code>, akumulator wyzerowany", "<code>resume()</code>, accumulator cleared"), P("jedna normalna klatka", "one normal frame")],
             [P("klatka 300 ms", "300 ms frame"), P("<code>realDeltaTime</code> przycięte do 0.1 s", "<code>realDeltaTime</code> clamped to 0.1 s"), P("maks. 6 kroków @60 Hz", "max 6 steps @60 Hz")],
             [P("<code>timeScale = 0</code>", "<code>timeScale = 0</code>"), P("render działa, czas stoi", "render runs, time frozen"), P("<code>deltaTime = 0</code>", "<code>deltaTime = 0</code>")],
             [P("pauza z nakładki", "pause from an overlay"), P("<code>engine.pause()</code>", "<code>engine.pause()</code>"), P("<code>engine:pause</code> przed snem", "<code>engine:pause</code> before the sleep")],
         ]),
         ("h2", "Determinizm: co obiecujemy", "Determinism: what we promise"),
         ("p", "Ten sam seed, ten sam stały krok i ta sama sekwencja wejść dają ten sam przebieg symulacji w tej samej przeglądarce. Między przeglądarkami i systemami gwarancja jest słabsza — pełna lista ograniczeń i przepis na powtarzalną sesję są na stronie <a href=\"#determinism\">Determinizm</a>.",
          "The same seed, the same fixed step and the same input sequence produce the same simulation run in the same browser. Across browsers and operating systems the guarantee is weaker — the full list of limits and a recipe for reproducible sessions live on the <a href=\"#determinism\">Determinism</a> page."),
         ("h2", "Przykłady", "Examples"),
         ("code", "TypeScript", """
update(deltaTime: number): void {
  this.player.x += 220 * deltaTime;
  this.cooldown -= deltaTime;
  if (this.cooldown <= 0) this.shoot();
}

const score = Math.floor(this.getTime().elapsed) * 10;

this.getTimer().delay(1.2, () => this.getEvents().emit("round:start", {}));

const star = this.createEllipse(4, {
  x: this.getRandom().float(0, this.width),
  y: this.getRandom().float(0, this.height),
  color: 0x8ad7ff
});
"""),
         ("h2", "Dlaczego clamp", "Why clamp"),
         ("p", "Po powrocie z ukrytej karty <code>requestAnimationFrame</code> nie był wywoływany, więc pierwsza delta ma kilka sekund. Bez ograniczenia gracz przeskakuje przez ściany i pomija kolizje. Silnik tnie <code>deltaTime</code> do <code>maxDeltaTime</code> (0.1 s), a <code>pauseOnHidden</code> dodatkowo usypia pętlę przy <code>visibilitychange</code>.",
          "After returning from a hidden tab <code>requestAnimationFrame</code> was not called, so the first delta spans seconds. Without a limit the player jumps through walls and skips collisions. The engine clamps <code>deltaTime</code> to <code>maxDeltaTime</code> (0.1 s) and <code>pauseOnHidden</code> additionally sleeps the loop on <code>visibilitychange</code>."),
         ("note", "tip", "Deterministyczne testy", "Deterministic tests",
          "<code>Time</code>, <code>Scheduler</code> i <code>Random</code> są czystymi klasami bez dostępu do zegara systemowego. Wystarczy <code>time.update(16)</code> i <code>scheduler.update(dt)</code>, żeby przetestować każdy scenariusz bez czekania.",
          "<code>Time</code>, <code>Scheduler</code> and <code>Random</code> are pure classes with no access to the system clock. <code>time.update(16)</code> and <code>scheduler.update(dt)</code> are enough to test any scenario without waiting."),
     ], "czas time delta deltaTime clamp maxDeltaTime petla loop fps timeScale pauza pause fixed step fixedUpdate timer timery scheduler delay interval random seed determinizm determinism"),

page("scenes", "basics", P("Sceny", "Scenes"),
     P("Klasa bazowa, cztery punkty zaczepienia i reguły przełączania.", "Base class, four hooks and the switching rules."),
     [
         ("h2", "Minimalna scena", "Minimal scene"),
         ("code", "src/scenes/MenuScene.ts", """
import { Scene } from "@engine";

export class MenuScene extends Scene {
  constructor() {
    super("menu");
  }

  preload(): void {
    this.declareAssets([{ id: "logo", type: "image", src: "/assets/logo.png" }]);
  }

  create(): void {
    this.createText("TOP-DOWN", {
      x: 640,
      y: 200,
      originX: 0.5,
      originY: 0.5,
      depth: 10,
      style: { fontSize: "40px" },
    });
  }

  update(): void {
    if (this.getInput().isActionPressed("interact")) {
      this.getEvents().emit("request:scene", { to: "game" });
    }
  }

  shutdown(): void {
    this.getEvents().clearScene(this.id);
  }
}
"""),
         ("h2", "Punkty zaczepienia", "Hooks"),
         ("table", [P("Metoda", "Method"), P("Kiedy", "When"), P("Do czego", "Purpose")], [
             ["<code>preload()</code>", P("Przed loaderem", "Before the loader"), "<code>declareAssets()</code>"],
             ["<code>create()</code>", P("Po załadowaniu zasobów", "After assets load"), P("Obiekty, teksty, fizyka, kamera", "Objects, texts, physics, camera")],
             ["<code>update(dt)</code>", P("Każda klatka", "Every frame"), P("Logika gry; <code>dt</code> w sekundach", "Game logic; <code>dt</code> in seconds")],
             ["<code>fixedUpdate(dt)</code>", P("Stały krok, gdy <code>fixedStep</code> włączony", "Fixed step when <code>fixedStep</code> is enabled"), P("Deterministyczna symulacja; <code>dt</code> zawsze równa <code>fixedDelta</code>", "Deterministic simulation; <code>dt</code> always equals <code>fixedDelta</code>")],
             ["<code>shutdown()</code>", P("Przy wyjściu", "On exit"), P("Sprzątanie własnych eventów", "Cleaning your own events")],
         ]),
         ("h2", "Czas w scenie", "Time inside a scene"),
         ("p", "Scena nie czyta zegara systemowego. Dostaje trzy rzeczy: <code>getTime()</code> z bieżącą deltą i zegarem gry, <code>getTimer()</code> — kolejkę zadań przypisaną do tej sceny i czyszczoną w <code>shutdown()</code> — oraz <code>getRandom()</code> ze wspólnym, seedowanym strumieniem.",
          "A scene never reads the system clock. It gets three things: <code>getTime()</code> with the current delta and the game clock, <code>getTimer()</code> — a task queue owned by this scene and cleared on <code>shutdown()</code> — and <code>getRandom()</code> backed by the shared seeded stream."),
         ("code", "TypeScript", """
create(): void {
  this.getTimer().delay(0.8, () => this.spawnWave());
  this.getTimer().interval(4, () => this.spawnWave(), { repeat: 3 });
}

fixedUpdate(fixedDelta: number): void {
  this.simulate(fixedDelta);
}

update(deltaTime: number): void {
  this.animate(deltaTime);
}
"""),
         ("h2", "Przełączanie scen", "Switching scenes"),
         ("code", "TypeScript", """
const engine = createEngine({ parent: "game-container" });

engine.registerScene(new MenuScene());
engine.registerScene(new GameScene());

engine.getEvents().on("request:scene", ({ to }) => engine.startScene(to));

engine.start("menu");
engine.getScenes().getActiveSceneId();
engine.stopScene("game");
"""),
         ("p", "Przełączenie wywołuje <code>shutdown()</code> poprzedniej sceny, usuwa jej obiekty z rejestru i czyści subskrypcje eventów. Nowa scena przechodzi pełny cykl, więc <code>preload</code> wykonuje się ponownie tylko dla brakujących zasobów w cache.", "Switching calls the previous scene's <code>shutdown()</code>, removes its objects from the registry and clears event subscriptions. The new scene runs the full cycle, so <code>preload</code> re-runs only for assets missing from cache."),
         ("note", "warn", "Duplikat identyfikatora", "Duplicate identifier",
          "<code>registerScene()</code> z tym samym <code>id</code> rzuca natychmiast: <code>Scene with id \"game\" is already registered</code>. Nie ma cichego nadpisania — dwa obiekty o tym samym ID byłyby nieodwracalnym błędem stanu.",
          "<code>registerScene()</code> with an existing <code>id</code> throws immediately: <code>Scene with id \"game\" is already registered</code>. There is no silent override — two objects with the same ID would be an unrecoverable state bug."),
     ], "sceny sceny scene preload create update shutdown przelaczanie"),

page("objects", "basics", P("Obiekty i transformacje", "Objects and transforms"),
     P("Wrapper nad obiektami Phasera: własny stan, łańcuchowe settery i komponenty.", "A wrapper over Phaser objects: explicit state, chainable setters and components."),
     [
         ("h2", "Rodzaje", "Kinds"),
         ("table", [P("Klasa", "Class"), P("Dziedziczy", "Extends"), P("Dodatki", "Additions")], [
             ["<code>GameObject</code>", "—", "<code>id</code>, <code>name</code>, <code>transform</code>, komponenty"],
             ["<code>tags</code>", P("zbiór etykiet", "label set"), P("indeks w scenie, zapytania w O(1)", "scene index, O(1) queries")],
             ["<code>groups</code>", P("przynależność", "membership"), P("nazwane kolekcje z licznikiem", "named collections with a size")],
             ["<code>render</code>", P("opis wizualny", "visual descriptor"), "<code>sprite</code> | <code>text</code> | <code>rect</code> | <code>ellipse</code>"],
             ["<code>body</code>", P("opis fizyki", "physics descriptor"), "<code>dynamic</code> | <code>static</code>, <code>shape</code>, <code>radius</code>"],
             ["<code>Transform</code>", "—", "<code>x</code>, <code>y</code>, <code>rotation</code>, <code>scaleX/Y</code>, <code>translate()</code>, <code>clone()</code>"],
         ]),
         ("h2", "Tworzenie i modyfikacja", "Create and mutate"),
         ("code", "TypeScript", """
const hero = this.createSprite("hero", {
  id: "hero",
  x: 100,
  y: 100,
  alpha: 0.9,
  depth: 5,
  tags: ["player", "controllable"],
  body: { type: "dynamic", shape: "circle", radius: 14 },
});

hero.setPosition(120, 100).setRotation(Math.PI / 4).setScale(2);
hero.setAlpha(0.5).setDepth(10).setTint(0xff0000).setVisible(true);

this.createText("0/8", {
  id: "score",
  x: 16,
  y: 16,
  scrollFactor: 0,
  depth: 100,
  style: { fontSize: "18px" },
});

const zone = this.createRect(300, 20, { id: "zone", x: 400, y: 500, color: 0x2a2f3a });
const platform = this.createRect(300, 20, {
  id: "platform",
  x: 400,
  y: 560,
  color: 0x2a2f3a,
  body: { type: "static" },
});

const marker = this.createEllipse(12, { id: "marker", x: 200, y: 200, color: 0xe2b714 });
"""),
         ("h2", "Rejestr obiektów", "Object registry"),
         ("code", "TypeScript", """
this.getObject("hero");
this.getObjects();
this.objectCount();

this.findByName("hero");
this.findByTag("enemy");
this.findByTags(["enemy", "boss"], "all");
this.find((object) => object.x > 1000);

const enemies = this.group("enemies");
enemies.add(hero);
this.destroyObject("zone");
"""),
         ("h2", "Opis zamiast obiektu", "Descriptor instead of object"),
         ("p", "<code>GameObject</code> nie zna Phasera i nie trzyma żadnej instancji <code>Phaser.GameObjects</code>. Pole <code>render</code> to czysty opis: rodzaj, tekstura, tekst, wymiary, origin. Adapter czyta ten opis w <code>RenderPort</code> i tworzy obiekt Phasera, a w każdej klatce dostaje wyłącznie obiekty oznaczone jako brudne.", "<code>GameObject</code> knows nothing about Phaser and holds no <code>Phaser.GameObjects</code> instance. The <code>render</code> field is a plain descriptor: kind, texture, text, size, origin. The adapter reads it through <code>RenderPort</code>, creates the Phaser object and receives only dirty objects every frame."),
         ("code", "TypeScript", """
// opis — bez importu Phasera
const hero = this.createSprite("player", { id: "hero", x: 100, y: 100 });

// zmiana opisu oznacza obiekt jako brudny; adapter przebuduje tylko ten jeden
hero.setRender({ kind: "sprite", textureId: "player", displayWidth: 48, displayHeight: 48 });
"""),
         ("note", "tip", "Dlaczego opis, nie wrapper", "Why a descriptor, not a wrapper",
          "Wrapper z metodami <code>setVelocity</code>, <code>setTint</code> i <code>bindPhaserObject</code> mieszał warstwy i wymuszał Phasera w testach. Opis jest serializowalny, porównywalny i pozwala testować scenę bez canvasu, a adapter może być dowolny.",
          "A wrapper with <code>setVelocity</code>, <code>setTint</code> and <code>bindPhaserObject</code> mixed layers and forced Phaser into tests. A descriptor is serialisable, comparable and lets a scene be tested without a canvas, while the adapter can be anything."),
     ], "obiekty objects gameobject sprite text transform group komponenty"),

page("render", "basics", P("Renderowanie", "Rendering"),
     P("Bez własnego renderera: delegacja do Phasera, kontrolowana kolejność i czytelne błędy zasobów.", "No custom renderer: delegation to Phaser, controlled ordering and readable asset errors."),
     [
         ("h2", "Tworzenie obiektów wizualnych", "Creating visual objects"),
         ("code", "TypeScript", """
this.createSprite("hero", { x: 640, y: 360, originX: 0.5, originY: 0.5 });
this.createText("Score 0", { x: 16, y: 16, style: { fontSize: "16px", color: "#ffffff" } });
this.createRect(1280, 720, { x: 640, y: 360, color: 0x101418 });
this.createEllipse(12, { x: 200, y: 200, color: 0xe2b714 });
"""),
         ("h2", "Kolejność rysowania", "Draw order"),
         ("p", "<code>depth</code> decyduje o kolejności: mniejsza wartość rysowana pierwszy. Tło <code>0</code>, obiekty świata <code>10–90</code>, UI <code>100+</code>. Wartości są trzymane na wrapperze, więc kolejność nie zależy od tego, w jakiej kolejności utworzono obiekty.", "<code>depth</code> decides ordering: a smaller value draws first. Background <code>0</code>, world objects <code>10–90</code>, UI <code>100+</code>. Values live on the wrapper, so order does not depend on creation sequence."),
         ("code", "TypeScript", """
this.createRect(1280, 720, { x: 640, y: 360, color: 0x101418 }).setDepth(0);
this.createSprite("hero", { x: 640, y: 360 }).setDepth(50);
this.createText("0", { x: 16, y: 16, style: { fontSize: "18px" } }).setDepth(100);
"""),
         ("h2", "Skalowanie", "Scaling"),
         ("table", ["scaleMode", P("Zachowanie", "Behaviour"), P("Kiedy", "When")], [
             ["<code>fit</code>", P("Skaluje z zachowaniem proporcji, centruje", "Scales preserving ratio, centres"), P("Gry 2D, responsywny layout", "2D games, responsive layout")],
             ["<code>fill</code>", P("Wypełnia kontener, może przyciąć", "Fills the container, may crop"), P("Tła pełnoekranowe", "Fullscreen backgrounds")],
             ["<code>fixed</code>", P("Stały rozmiar, bez skalowania", "Fixed size, no scaling"), P("Pixel-art 1:1", "Pixel-art 1:1")],
             ["<code>expand</code>", P("Zmienia obszar gry zamiast skali", "Changes the game area instead of scale"), P("UI adaptacyjne", "Adaptive UI")],
         ]),
         ("note", "warn", "Brak tekstury", "Missing texture",
          "Brak tekstury nie wywala sceny: adapter rysuje <code>fallbackRadius</code> i <code>fallbackColor</code> z opisu, więc gra startuje nawet bez pliku. Błąd wczytywania trafia do <code>AssetManager.onError</code> z <code>id</code> i <code>src</code>, a <code>AssetError</code> jest rzucany przy rejestracji duplikatu.",
          "A missing texture does not kill the scene: the adapter draws <code>fallbackRadius</code> and <code>fallbackColor</code> from the descriptor, so the game starts even without the file. Loading failures go to <code>AssetManager.onError</code> with <code>id</code> and <code>src</code>, and <code>AssetError</code> is thrown when a duplicate is registered."),
     ], "render renderowanie sprite text depth origin alpha skalowanie"),

page("input", "basics", P("Wejście", "Input"),
     P("Akcje zamiast kodów klawiszy: jedna mapa w konfiguracji, spójne API w każdej scenie.", "Actions instead of key codes: one map in config, one consistent API in every scene."),
     [
         ("h2", "Mapa domyślna", "Default map"),
         ("table", [P("Akcja", "Action"), P("Kody", "Codes")], [
             ["<code>move-up</code>", "<code>ArrowUp</code>, <code>KeyW</code>"],
             ["<code>move-down</code>", "<code>ArrowDown</code>, <code>KeyS</code>"],
             ["<code>move-left</code>", "<code>ArrowLeft</code>, <code>KeyA</code>"],
             ["<code>move-right</code>", "<code>ArrowRight</code>, <code>KeyD</code>"],
             ["<code>interact</code>", "<code>Space</code>, <code>KeyE</code>"],
         ]),
         ("p", "Kody to wartości <code>KeyboardEvent.code</code>, więc mapa działa niezależnie od układu klawiatury: <code>KeyW</code> to fizyczny klawisz W także na AZERTY i QWERTZ.", "Codes are <code>KeyboardEvent.code</code> values, so the map is layout-independent: <code>KeyW</code> is the physical W key on AZERTY and QWERTZ too."),
         ("h2", "Odczyt stanu", "Reading state"),
         ("code", "TypeScript", """
const input = this.getInput();

if (input.isActionDown("move-left")) this.player.x -= 200 * dt;
if (input.isActionPressed("interact")) this.interact();
if (input.isActionReleased("interact")) this.release();

if (input.isKeyPressed("KeyR")) this.restart();
if (input.isKeyDown("ShiftLeft")) this.sprint = true;

const pointer = input.getPointer();
const world = input.getPointerWorldPosition();
if (pointer.isDown) this.spawnMarker(world.x, world.y);
"""),
         ("table", ["API", P("Znaczenie", "Meaning")], [
             ["<code>isActionDown(a)</code>", P("Wciśnięta teraz — ruch, sprint", "Held now — movement, sprint")],
             ["<code>isActionPressed(a)</code>", P("Wciśnięta w tej klatce — akcje jednorazowe", "Pressed this frame — one-shot actions")],
             ["<code>isActionReleased(a)</code>", P("Puszczona w tej klatce", "Released this frame")],
             ["<code>isKeyDown/Pressed/Released(code)</code>", P("Bezpośrednio po kodzie klawisza", "Directly by key code")],
             ["<code>getPointer()</code>", P("Pozycja ekranu, <code>worldX/Y</code>, <code>isDown</code>, <code>button</code>", "Screen position, <code>worldX/Y</code>, <code>isDown</code>, <code>button</code>")],
             ["<code>getPointerWorldPosition()</code>", P("Pozycja przeliczona przez kamerę", "Position converted through the camera")],
             ["<code>remapAction(a, codes)</code>", P("Zmiana mapy w czasie działania", "Change the map at runtime")],
         ]),
         ("h2", "Zmiana mapy", "Remapping"),
         ("code", "TypeScript", """
engine.getInput().remapAction("jump", ["Space", "KeyJ"]);
engine.getInput().setActionMap({ ...engine.getInput().getActionMap(), dash: ["ShiftLeft"] });
"""),
         ("note", "tip", "Utrata fokusu", "Focus loss",
          "Na <code>window.blur</code> silnik czyści wszystkie wciśnięte klawisze. Bez tego gracz wraca do karty z „przyklejonym” <code>KeyW</code> i postać biegnie w ścianę. Listenery są zdejmowane w <code>detach()</code> przy <code>stop()</code>.",
          "On <code>window.blur</code> the engine clears every held key. Without it, a player returning to the tab has a stuck <code>KeyW</code> and runs into a wall. Listeners are removed in <code>detach()</code> during <code>stop()</code>."),
     ], "input wejscie akcje mapa klawisze pointer mysz remap"),

page("physics", "basics", P("Fizyka", "Physics"),
     P("Arcade Physics bez owijania w drugi silnik: collidery, overlapy i granice świata.", "Arcade Physics without a second engine: colliders, overlaps and world bounds."),
     [
         ("h2", "Konfiguracja", "Setup"),
         ("code", "TypeScript", """
const engine = createEngine({
  parent: "game-container",
  physics: { enabled: true, gravity: { x: 0, y: 0 }, debug: false },
});
"""),
         ("p", "Top-down używa <code>gravity 0,0</code> — ruch wynika wyłącznie z prędkości ustawianej w scenie. Platformówka ustawia <code>gravity.y</code> na wartość dodatnią i korzysta z <code>setCollideWorldBounds()</code>.", "Top-down uses <code>gravity 0,0</code> — motion comes only from velocity set in the scene. A platformer sets <code>gravity.y</code> positive and relies on <code>setCollideWorldBounds()</code>."),
         ("h2", "Collider kontra overlap", "Collider vs overlap"),
         ("table", [P("Metoda", "Method"), P("Efekt", "Effect"), P("Typowe użycie", "Typical use")], [
             ["<code>addCollider(a, b, cb?)</code>", P("Blokuje przenikanie, koryguje pozycję", "Blocks penetration, corrects position"), P("Gracz–ściany, gracz–wróg", "Player–walls, player–enemy")],
             ["<code>addOverlap(a, b, cb?)</code>", P("Wykrywa kontakt, nie zatrzymuje", "Detects contact, does not stop"), P("Monety, strefy, drzwi", "Coins, zones, doors")],
         ]),
         ("code", "TypeScript", """
const physics = this.getPhysics();
physics.setWorldBounds(0, 0, 2000, 1400);

physics.addCollider(wallsGroup, player);
physics.addOverlap(coinsGroup, player, (playerObject, coin) => {
  this.getEvents().emit("game:collected", { id: coin.name });
  coin.disableBody(true, true);
});

physics.setImmovable(wall, true);
physics.setVelocity(enemy, 100, 0);
physics.setCollideWorldBounds(player, true);
physics.setBounce(ball, 0.8);
"""),
         ("h2", "Ciała statyczne i dynamiczne", "Static vs dynamic bodies"),
         ("p", "Bryła jest częścią opisu obiektu: <code>body: { type: \"static\" }</code> daje ścianę, <code>type: \"dynamic\"</code> — gracza lub wroga. Fizyka nigdy nie jest wołana na obiekcie Phasera z kodu gry: <code>getPhysics()</code> przyjmuje <code>GameObject</code> i tłumaczy go na <code>body</code> wewnątrz adaptera.", "The body is part of the object descriptor: <code>body: { type: \"static\" }</code> gives a wall, <code>type: \"dynamic\"</code> gives a player or enemy. Physics is never called on a Phaser object from game code: <code>getPhysics()</code> takes a <code>GameObject</code> and maps it to a <code>body</code> inside the adapter."),
         ("note", "tip", "Debug kolizji", "Collision debug",
          "Ustaw <code>physics.debug: true</code> w konfiguracji, aby zobaczyć obrysy ciał. To najszybszy sposób na znalezienie przesuniętego originu lub złego rozmiaru ciała.",
          "Set <code>physics.debug: true</code> in config to see body outlines. It is the fastest way to spot a shifted origin or a wrong body size."),
     ], "fizyka physics arcade collider overlap body velocity gravity bounds"),

page("camera", "basics", P("Kamera", "Camera"),
     P("Śledzenie, granice, zoom i konwersja współrzędnych — w jednym managerze na scenę.", "Follow, bounds, zoom and coordinate conversion — in one manager per scene."),
     [
         ("code", "TypeScript", """
const camera = this.getCamera();

camera.follow(player, 0.08, 0.08);
camera.setBounds(0, 0, 2000, 1400);
camera.setZoom(1.25);
camera.shake(120, 0.006);
camera.fadeIn(300);

const screen = camera.worldToScreen(1200, 800);
const back = camera.screenToWorld(screen.x, screen.y);
"""),
         ("h2", "Parametry", "Parameters"),
         ("table", [P("Metoda", "Method"), P("Znaczenie", "Meaning"), P("Uwagi", "Notes")], [
             ["<code>follow(target, lerpX, lerpY)</code>", P("Śledzi obiekt z wygładzeniem", "Follows an object with smoothing"), P("<code>1</code> = sztywno, <code>0.08</code> = płynnie", "<code>1</code> = rigid, <code>0.08</code> = smooth")],
             ["<code>setBounds(x, y, w, h)</code>", P("Zakres świata widoczny dla kamery", "World range visible to the camera"), P("Zapobiega pokazaniu pustki za mapą", "Prevents showing void outside the map")],
             ["<code>setZoom(z)</code>", "number", P("<code>1</code> = 1:1, <code>2</code> = dwukrotne powiększenie", "<code>1</code> = 1:1, <code>2</code> = double zoom")],
             ["<code>shake(durationMs, intensity)</code>", "number, number", P("Wstrząs — trafienie, eksplozja", "Shake — hit, explosion")],
             ["<code>worldToScreen(x, y)</code>", "number, number", P("Świat → ekran, np. dla UI", "World → screen, e.g. for UI")],
             ["<code>screenToWorld(x, y)</code>", "number, number", P("Ekran → świat, np. dla myszy", "Screen → world, e.g. for the mouse")],
         ]),
         ("h2", "Granice a świat fizyki", "Bounds vs physics world"),
         ("p", "Granice kamery i granice świata fizyki to dwie różne rzeczy. <code>getCamera().setBounds()</code> mówi, dokąd kamera może pojechać. <code>getPhysics().setWorldBounds()</code> mówi, gdzie kończą się kolizje. W praktyce ustawia się je na ten sam prostokąt — inaczej gracz zobaczy obszar, po którym nie może chodzić.", "Camera bounds and physics world bounds are two different things. <code>getCamera().setBounds()</code> says how far the camera may travel. <code>getPhysics().setWorldBounds()</code> says where collisions end. In practice both use the same rectangle — otherwise the player sees an area they cannot walk on."),
         ("note", "warn", "Śledzenie wrappera", "Following a wrapper",
          "<code>follow()</code> przyjmuje <code>GameObject</code> — adapter sam odnajduje odpowiadający obiekt Phasera w warstwie renderu. Kamerą steruje się więc tym samym obiektem, który przesuwa fizyka; nie ma drugiego źródła prawdy o pozycji.",
          "<code>follow()</code> takes a <code>GameObject</code> — the adapter finds the matching Phaser object in the render layer. The camera is driven by the same object that physics moves, so there is no second source of truth for position."),
     ], "kamera camera follow bounds zoom shake worldToScreen"),

page("audio", "basics", P("Audio", "Audio"),
     P("Cztery kanały głośności, wyciszanie, kolejka autoplay i sprzątanie dźwięków przy pauzie oraz zamknięciu sceny.",
       "Four volume channels, muting, an autoplay queue and sound cleanup on pause and scene shutdown."),
     [
         ("h2", "Model kanałów", "Channel model"),
         ("p", "Każdy dźwięk gra na jednym z czterech kanałów: <code>master</code>, <code>music</code>, <code>sfx</code> albo <code>ui</code>. Głośność końcowa to iloczyn trzech liczb: głośności głównej, głośności kanału i głośności pojedynczego odtwarzania. Dzięki temu suwak „muzyka” w ustawieniach gry nie musi znać głośności każdego utworu, a wyciszenie całości to jedna flaga.",
          "Every sound plays on one of four channels: <code>master</code>, <code>music</code>, <code>sfx</code> or <code>ui</code>. The effective volume is a product of three numbers: master volume, channel volume and per-playback volume. That way a “music” slider in the settings never needs to know the volume of each track, and muting everything is a single flag."),
         ("code", "TypeScript", """
const audio = engine.getAudio();

audio.play("pickup", { channel: "sfx", volume: 0.6 });
audio.playMusic("theme", { volume: 0.5 });

audio.setVolume("music", 0.3);      // 0..1, klampowane
audio.setMasterVolume(0.8);
audio.mute();
audio.unmute();
audio.toggleMute();
"""),
         ("table", [P("Kanał", "Channel"), P("Domyślnie", "Default"), P("Do czego", "Use it for")], [
             ["<code>master</code>", "1", P("Mnożnik globalny; suwak „głośność” w ustawieniach", "Global multiplier; the “volume” slider in settings")],
             ["<code>music</code>", "0.7", P("Muzyka w tle, jedna ścieżka naraz", "Background music, one track at a time")],
             ["<code>sfx</code>", "1", P("Efekty świata: trafienia, zbieranie, eksplozje", "World effects: hits, pickups, explosions")],
             ["<code>ui</code>", "0.9", P("Kliki, powiadomienia, dźwięki menu", "Clicks, notifications, menu sounds")],
         ]),
         ("p", "Głośność jest klampowana do zakresu 0–1, a wartości <code>NaN</code> i nieskończoności traktowane są jak 0. Zmiana głośności kanału albo wyciszenie natychmiast przelicza i wysyła nową głośność do wszystkich trwających odtwarzań — nie trzeba restartować dźwięku.",
          "Volume is clamped to 0–1, and <code>NaN</code> or infinities are treated as 0. Changing a channel volume or muting immediately recomputes and pushes the new volume to every live playback — no need to restart a sound."),
         ("h2", "Autoplay: dlaczego dźwięk milczy", "Autoplay: why the sound is silent"),
         ("p", "Przeglądarki nie pozwalają odtworzyć dźwięku przed interakcją użytkownika. Silnik nie udaje, że problemu nie ma: dopóki backend nie jest odblokowany, <code>play()</code> trafia do kolejki i zwraca uchwyt w stanie <code>pending</code>. Po pierwszym kliknięciu lub wciśnięciu klawisza adapter odblokowuje audio, a kolejka jest opróżniana w kolejności zgłoszeń.",
          "Browsers refuse to play audio before a user interaction. The engine does not pretend otherwise: until the backend is unlocked, <code>play()</code> goes into a queue and returns a handle in the <code>pending</code> state. On the first click or key press the adapter unlocks audio and the queue is flushed in call order."),
         ("code", "TypeScript", """
const audio = engine.getAudio();

audio.isUnlocked();                       // false przed interakcją
audio.onUnlock(() => hideSoundNotice());  // Twój własny baner „kliknij, aby włączyć dźwięk”
engine.on("audio:unlocked", ({ unlocked }) => logger.info(`audio unlocked: ${unlocked}`));

audio.play("theme", { channel: "music", loop: true });   // status: "pending"
audio.getPendingCount();                                 // 1
audio.unlock();                                          // ręczne odblokowanie, np. z własnego przycisku
"""),
         ("table", [P("Sytuacja", "Situation"), P("Zachowanie", "Behaviour")], [
             [P("Dźwięk przed odblokowaniem", "Sound before unlock"), P("trafia do kolejki, uchwyt ma status <code>pending</code>", "queued, the handle is <code>pending</code>")],
             [P("<code>stop()</code> na oczekującym dźwięku", "stop() while pending"), P("usuwa go z kolejki — nic nie zagra", "removes it from the queue — nothing plays")],
             [P("Pierwszy gest użytkownika", "First user gesture"), P("adapter odblokowuje backend, kolejka rusza", "the adapter unlocks the backend and flushes the queue")],
             [P("Backend odmówi odtworzenia", "Backend refuses playback"), P("<code>play()</code> zwraca <code>null</code>, brak wpisu w raporcie", "<code>play()</code> returns <code>null</code>, no dangling entry")],
             [P("Karta w tle", "Background tab"), P("<code>pauseOnHidden</code> pauzuje silnik i audio", "<code>pauseOnHidden</code> pauses the engine and audio")],
         ]),
         ("note", "info", "Nie obiecuj dźwięku przed gestem", "Do not promise sound before a gesture",
          "Nie planuj „muzyki od pierwszej klatki”. Zamiast tego pokaż dyskretny przycisk albo podpowiedź, a dźwięk włącz po pierwszym kliknięciu. Silnik odblokowuje audio także przy pierwszym klawiszu, więc gracz sterujący klawiaturą zwykle nie widzi żadnej przerwy.",
          "Do not plan “music from the first frame”. Show a discreet button or hint instead and start audio on the first click. The engine also unlocks on the first key press, so a keyboard player usually never notices a gap."),
         ("h2", "Uchwyty odtwarzania", "Playback handles"),
         ("p", "<code>play()</code> zwraca <code>SoundHandle</code> albo <code>null</code>. Uchwyt pozwala zatrzymać konkretny dźwięk i zmienić jego głośność, a także zna swój kanał, właściciela i stan. Nie przechowuj referencji do wewnętrznych obiektów backendu — po restarcie sceny nie mają sensu.",
          "<code>play()</code> returns a <code>SoundHandle</code> or <code>null</code>. The handle stops one specific sound, changes its volume, and knows its channel, owner and status. Do not keep references to backend internals — they are meaningless after a scene restart."),
         ("code", "TypeScript", """
const handle = scene.playSound("pickup", { volume: 0.6 });
handle?.statusName;      // "pending" | "playing" | "stopped"
handle?.channel;         // "sfx"
handle?.owner;           // "game" — id sceny
handle?.effectiveVolume; // master * channel * volume, 0 gdy wyciszone

handle?.setVolume(0.2);
handle?.stop();

audio.stopAsset("pickup");   // wszystkie odtwarzania danego assetu
audio.stopOwner("game");     // wszystkie dźwięki sceny
audio.stopAll();
"""),
         ("h2", "Pauza, wznowienie i sprzątanie", "Pause, resume and cleanup"),
         ("p", "Pauza silnika zatrzymuje czas gry, pętlę renderowania i audio. Wznowienie przywraca wszystkie odtwarzania, które były aktywne. Zamknięcie sceny nie może zostawić po sobie grającej muzyki ani echa wybuchu — dlatego każdy dźwięk zagrany przez scenę ma właściciela równego jej <code>id</code>, a <code>shutdown</code> woła <code>stopOwner</code>.",
          "Pausing the engine stops game time, the render loop and audio. Resuming restores every playback that was active. Closing a scene must not leave music or an explosion echo behind — so every sound played by a scene is owned by that scene id, and <code>shutdown</code> calls <code>stopOwner</code>."),
         ("code", "TypeScript", """
engine.pause();        // time.pause() + audio.pauseAll() + game.loop.sleep()
engine.resume();       // time.resume() + audio.resumeAll() + game.loop.wake()

// w scenie
create(): void {
  this.playMusic("theme");              // owner = "game"
  this.playSound("door-open");
}

shutdown(): void {
  // silnik i tak zawoła stopOwner("game"), ale możesz to zrobić wcześniej:
  this.stopMusic();
  this.stopSounds();
}
"""),
         ("table", [P("Zdarzenie", "Event"), P("Co robi silnik", "What the engine does")], [
             [P("<code>engine.pause()</code>", "<code>engine.pause()</code>"), P("pauzuje czas, audio i pętlę", "pauses time, audio and the loop")],
             [P("<code>engine.resume()</code>", "<code>engine.resume()</code>"), P("wznawia to, co było aktywne", "resumes what was active")],
             [P("Ukrycie karty", "Tab hidden"), P("to samo co <code>pause()</code>, gdy <code>pauseOnHidden</code>", "same as <code>pause()</code> when <code>pauseOnHidden</code> is on")],
             [P("Zamknięcie sceny", "Scene shutdown"), P("<code>stopOwner(sceneId)</code>", "<code>stopOwner(sceneId)</code>")],
             [P("<code>engine.destroy()</code>", "<code>engine.destroy()</code>"), P("<code>stopAll()</code> i odpięcie backendu", "<code>stopAll()</code> and backend detach")],
             [P("Zmiana sceny", "Scene switch"), P("poprzednia scena sprząta swoje dźwięki w <code>shutdown</code>", "the previous scene cleans its sounds in <code>shutdown</code>")],
         ]),
         ("h2", "Muzyka i płynne przejścia", "Music and smooth transitions"),
         ("p", "Silnik celowo nie ma wbudowanego crossfade — to kilka linii na tweenach i kanałach, a każdy zespół robi to inaczej. Wzorzec: jeden obiekt z liczbą, tween głośności kanału, a po zakończeniu podmiana utworu.",
          "The engine deliberately ships no built-in crossfade — it is a few lines of tweens and channels, and every team does it differently. The pattern: a small object holding a number, a tween on the channel volume, and a track swap when it finishes."),
         ("code", "TypeScript", """
const audio = this.getAudio();
const fade = { value: audio.getVolume("music") };

this.tween(fade, { value: 0 }, {
  duration: 0.6,
  easing: "quadOut",
  onUpdate: () => audio.setVolume("music", fade.value),
  onComplete: () => {
    audio.playMusic("boss-theme", { volume: 0.6 });
    this.tween(fade, { value: 0.6 }, {
      duration: 0.8,
      onUpdate: () => audio.setVolume("music", fade.value)
    });
  }
});
"""),
         ("h2", "Ograniczenia i pułapki", "Limits and pitfalls"),
         ("table", [P("Temat", "Topic"), P("Stan", "State")], [
             [P("Dźwięk przestrzenny (panner, odległość)", "Spatial audio (panner, distance)"), P("nieobsługiwany — brak w API i w adapterze", "not supported — not in the API or the adapter")],
             [P("Strumieniowanie długich plików", "Streaming long files"), P("cały plik trafia do cache; dziel muzykę na utwory", "the whole file is cached; split music into tracks")],
             [P("Fade i crossfade", "Fade and crossfade"), P("wzorzec na tweenach (wyżej), bez wbudowanego API", "a tween pattern (above), no built-in API")],
             [P("Audio w pliku HTML", "Audio in a single HTML file"), P("adapter dekoduje <code>data:audio</code> bezpośrednio, z pominięciem loadera", "the adapter decodes <code>data:audio</code> directly, bypassing the loader")],
             [P("Różnice WebAudio / HTML5", "WebAudio / HTML5 differences"), P("zależą od Phasera; <code>rate</code> może być ignorowane w HTML5", "Phaser-dependent; <code>rate</code> may be ignored in HTML5")],
             [P("iOS i przełącznik ciszy", "iOS and the silent switch"), P("dźwięk może być niesłyszalny mimo odblokowania", "audio may be inaudible even when unlocked")],
         ]),
         ("note", "warn", "Testuj na prawdziwym urządzeniu", "Test on a real device",
          "Polityki autoplay i przełącznik ciszy różnią się między Safari, Chrome i przeglądarkami w aplikacjach. Test w bezgłowej przeglądarce sprawdza logikę (kolejka, głośności, sprzątanie), nie słyszalność.",
          "Autoplay policies and the silent switch differ between Safari, Chrome and in-app browsers. A headless test verifies the logic (queue, volumes, cleanup), not audibility."),
     ], "audio dzwiek muzyka sfx kanaly glosnosc wyciszenie mute autoplay unlock kolejka pauza handle sound")

page("animation", "basics", P("Animacje i efekty", "Animations and effects"),
     P("Tweens właściwości z easingiem, sekwencje, animacje klatek i efekty kamery — z jednym zegarem i jednym modelem cyklu życia.",
       "Property tweens with easing, sequences, frame animations and camera effects — one clock, one lifecycle model."),
     [
         ("h2", "Animacje właściwości", "Property tweens"),
         ("p", "Tween zmienia liczby w obiekcie: pozycję, obrót, skalę, przezroczystość, głębię, kadr animacji, głośność, cokolwiek co jest liczbą. Scena ma własny <code>TweenManager</code>, więc animacje są aktualizowane tym samym zegarem co gra i giną razem ze sceną.",
          "A tween changes numbers inside an object: position, rotation, scale, alpha, depth, animation frame, volume — anything numeric. Each scene owns a <code>TweenManager</code>, so tweens advance on the game clock and die with the scene."),
         ("code", "TypeScript", """
const box = this.createRect(24, 24, { id: "box", x: 100, y: 100, color: 0x8ad7ff });

this.tween(box, { x: 400, alpha: 0.2 }, { duration: 0.8, easing: "cubicOut" });
this.tweenFrom(box, { scaleX: 0, scaleY: 0 }, { duration: 0.3, easing: "backOut" });

this.delay(0.5, () => this.getLogger().info("pół sekundy później"));
"""),
         ("table", [P("Opcja", "Option"), P("Znaczenie", "Meaning")], [
             ["<code>duration</code>", P("Czas w sekundach czasu gry; <code>0</code> kończy w pierwszej klatce", "Duration in game seconds; <code>0</code> finishes on the first frame")],
             ["<code>delay</code>", P("Opóźnienie przed startem, też w czasie gry", "Delay before the start, also game time")],
             ["<code>easing</code>", P("Nazwa z tabeli niżej albo własna funkcja <code>(t) =&gt; t</code>", "A name from the table below or a custom <code>(t) =&gt; t</code> function")],
             ["<code>repeat</code>", P("Liczba dodatkowych powtórzeń (2 = trzy przebiegi)", "Extra iterations (2 = three passes)")],
             ["<code>yoyo</code>", P("Co drugi przebieg gra wstecz", "Every second pass plays backwards")],
             ["<code>owner</code>", P("Właściciel do grupowego anulowania; w scenie domyślnie <code>scene.id</code>", "Owner for group cancellation; defaults to <code>scene.id</code> inside a scene")],
             ["<code>onStart / onUpdate / onRepeat / onComplete / onCancel</code>", P("Zdarzenia cyklu życia", "Lifecycle callbacks")],
             ["<code>target.alpha</code>", P("Przezroczystość oznaczana jako brudna — render odświeża się sam", "Alpha is marked dirty — the renderer refreshes itself")],
         ]),
         ("h2", "Easing", "Easing"),
         ("p", "Zestaw nazw pokrywa codzienne potrzeby: <code>linear</code>, <code>quad*</code>, <code>cubic*</code>, <code>quart*</code>, <code>sine*</code>, <code>expo*</code>, <code>circ*</code>, <code>back*</code>, <code>elastic*</code>, <code>bounce*</code>, każda w wariantach <code>In</code>, <code>Out</code> i <code>InOut</code>. Każda funkcja spełnia <code>f(0) = 0</code> i <code>f(1) = 1</code>, więc koniec animacji zawsze trafia dokładnie w wartość docelową.",
          "The name set covers day-to-day needs: <code>linear</code>, <code>quad*</code>, <code>cubic*</code>, <code>quart*</code>, <code>sine*</code>, <code>expo*</code>, <code>circ*</code>, <code>back*</code>, <code>elastic*</code>, <code>bounce*</code>, each in <code>In</code>, <code>Out</code> and <code>InOut</code> variants. Every function satisfies <code>f(0) = 0</code> and <code>f(1) = 1</code>, so an animation always lands exactly on its target value."),
         ("table", [P("Nazwa", "Name"), P("Charakter", "Character")], [
             ["<code>linear</code>", P("jednostajny — do obrotów i pasków postępu", "constant — rotation and progress bars")],
             ["<code>quadOut</code> / <code>cubicOut</code>", P("szybki start, łagodne wyhamowanie — UI i kamera", "fast start, soft landing — UI and camera")],
             ["<code>backOut</code>", P("lekkie przeregulowanie — pojawianie się elementów", "slight overshoot — elements appearing")],
             ["<code>elasticOut</code> / <code>bounceOut</code>", P("sprężyste dobicia — nagrody, podskoki", "springy settles — rewards, jumps")],
             ["<code>sineInOut</code>", P("łagodne „oddychanie” — pętle i yoyo", "gentle breathing — loops and yoyo")],
             ["<code>expoIn</code>", P("bardzo wolny start — wyjścia i zaniki", "very slow start — exits and fades")],
             [P("własna funkcja", "custom function"), P("dowolna <code>(t: number) =&gt; number</code> dla nietypowych krzywych", "any <code>(t: number) =&gt; number</code> for unusual curves")],
         ]),
         ("h2", "Sekwencje i wiele animacji naraz", "Sequences and parallel tweens"),
         ("p", "Sekwencja to lista kroków wykonywanych jeden po drugim, z poprawnym przenoszeniem nadwyżki czasu między krokami. Równoległość to po prostu kilka tweenów uruchomionych w tym samym momencie — nie trzeba do tego osobnego API.",
          "A sequence is a list of steps executed one after another, with leftover time carried correctly between steps. Parallelism is simply several tweens started at the same moment — no separate API needed."),
         ("code", "TypeScript", """
this.tweenSequence([
  { target: box, props: { x: 300 }, duration: 0.4, easing: "quadOut" },
  { target: box, props: { y: 260 }, duration: 0.3, easing: "backOut" },
  { target: box, props: { alpha: 0 }, duration: 0.2 }
], { repeat: 1, onComplete: () => this.destroyObject(box) });

this.tween(box, { rotation: Math.PI * 2 }, { duration: 1, easing: "linear" });
this.tween(box, { scaleX: 1.4 }, { duration: 0.5, yoyo: true, repeat: 1 });
"""),
         ("h2", "Cykl życia i anulowanie", "Lifecycle and cancellation"),
         ("p", "Tweeny są aktualizowane tylko wtedy, gdy płynie czas gry. Pauza silnika, ukrycie karty czy <code>timeScale = 0</code> zatrzymują je bez żadnych dodatkowych flag. Zamknięcie sceny anuluje wszystkie jej animacje, więc nie ma wycieków ani zapisów do zniszczonych obiektów.",
          "Tweens only advance while game time flows. Pausing the engine, hiding the tab or setting <code>timeScale = 0</code> freezes them with no extra flags. Scene shutdown cancels every tween it owns, so there are no leaks and no writes to destroyed objects."),
         ("code", "TypeScript", """
const tween = this.tween(box, { x: 500 }, { duration: 2 });

tween.pause();
tween.resume();
tween.progress;        // 0..1 w bieżącym przebiegu
tween.totalProgress;   // 0..1 w całej animacji z powtórzeniami
tween.cancel();        // woła onCancel, nie woła onComplete
tween.complete();      // natychmiast ustawia wartość końcową

this.getTweens().activeCount;
this.getTweens().stopOwner("game");
this.getTweens().stopAll();   // to samo robi shutdown sceny
"""),
         ("h2", "Animacje sprite'ów", "Sprite animations"),
         ("p", "Klatki opisujesz w manifeście zasobów razem z arkuszem. Silnik rejestruje je po załadowaniu pod kluczem <code>asset:animacja</code> i udostępnia cztery operacje: odtwarzanie, zatrzymanie, pauzę i ustawienie klatki. Stan animacji można odczytać, żeby na przykład przełączyć zachowanie po zakończeniu klipu.",
          "Frames live in the asset manifest next to the sheet. The engine registers them after loading under the key <code>asset:animation</code> and exposes four operations: play, stop, pause and seek. The state is readable, so you can switch behaviour when a clip finishes."),
         ("code", "TypeScript", """
preload(): void {
  this.declareAssets([{
    id: "hero",
    type: "spritesheet",
    src: "/assets/hero.png",
    frameWidth: 32,
    frameHeight: 32,
    animations: [
      { key: "idle", frames: [0, 1], frameRate: 4, repeat: -1 },
      { key: "walk", frames: [2, 3, 4, 5], frameRate: 10, repeat: -1 },
      { key: "hurt", frames: [10], frameRate: 1, repeat: 0 }
    ]
  }]);
}

create(): void {
  const hero = this.createSprite("hero", { id: "hero", x: 200, y: 200 });
  this.playAnimation(hero, "hero:walk", { restart: true });

  this.pauseAnimation(hero, true);
  this.pauseAnimation(hero, false);
  this.setFrame(hero, 3);            // zatrzymuje klip i pokazuje klatkę 3
  this.getAnimationState(hero);      // { key, frame, isPlaying, isPaused }
  this.stopAnimation(hero, "hero:walk");
}
"""),
         ("table", [P("Metoda sceny", "Scene method"), P("Efekt", "Effect")], [
             ["<code>playAnimation(obj, key, opts)</code>", P("<code>restart</code> odtwarza od początku, <code>frame</code> startuje od klatki, <code>rate</code> zmienia tempo", "<code>restart</code> replays, <code>frame</code> starts at a frame, <code>rate</code> changes speed")],
             ["<code>stopAnimation(obj, key?)</code>", P("zatrzymuje klip; z kluczem tylko gdy jest aktualny", "stops the clip; with a key only when it is current")],
             ["<code>pauseAnimation(obj, paused)</code>", P("pauza i wznowienie bez zmiany klatki", "freeze and resume without changing the frame")],
             ["<code>setFrame(obj, frame)</code>", P("seek: zatrzymuje klip i ustawia konkretną klatkę", "seek: stops the clip and shows a specific frame")],
             ["<code>getAnimationState(obj)</code>", P("bieżący klucz, klatka, czy gra i czy jest pauza", "current key, frame, playing and paused flags")],
         ]),
         ("h2", "Efekty ekranowe", "Screen effects"),
         ("p", "Kamera daje trzy klasyczne efekty: wstrząs, błysk i przenikanie. Wszystkie działają w czasie rzeczywistym kamery i nie wymagają dodatkowych obiektów w scenie. <code>resetEffects()</code> przerywa trwający efekt, np. gdy gracz wyjdzie z menu w trakcie fade'u.",
          "The camera offers three classic effects: shake, flash and fade. All run on the camera's own timeline and require no scene objects. <code>resetEffects()</code> interrupts a running effect, for example when the player leaves a menu mid-fade."),
         ("code", "TypeScript", """
this.getCamera().shake(120, 0.006);       // czas w ms, intensywność
this.getCamera().flash(90, 255, 255, 255);
this.getCamera().fadeOut(300, 0, 0, 0);   // do czerni
this.getCamera().fadeIn(300);
this.getCamera().resetEffects();
this.getCamera().supportsEffects();       // false dla minimalnego portu kamery
"""),
         ("table", [P("Efekt", "Effect"), P("Kiedy używać", "When to use"), P("Uwaga", "Caveat")], [
             [P("wstrząs", "shake"), P("trafienia, eksplozje, mocne zderzenia", "hits, explosions, heavy impacts"), P("intensywność 0.004–0.01; wyżej przeszkadza w czytaniu planszy", "intensity 0.004–0.01; higher disturbs readability")],
             [P("błysk", "flash"), P("zbieranie, trafienie krytyczne, teleport", "pickups, critical hits, teleport"), P("krótko (60–150 ms) i w kolorze semantycznym", "short (60–150 ms) and in a semantic colour")],
             [P("przenikanie", "fade"), P("zmiana sceny, wejście do menu", "scene change, entering a menu"), P("czas 250–400 ms; dłużej odczuwalnie spowalnia grę", "250–400 ms; longer feels sluggish")],
         ]),
         ("note", "tip", "Najpierw stan, potem ozdobnik", "State first, decoration second",
          "Animacja nie może być jedynym nośnikiem informacji. Gracz z wyłączonymi animacjami albo z padaczką światłoczułą musi wiedzieć, co się stało — kolor, ikona i dźwięk powinny działać także bez efektu.",
          "Animation must not be the only carrier of information. A player with animations disabled, or with photosensitive epilepsy, must still understand what happened — colour, icon and sound should work without the effect."),
         ("h2", "Wydajność", "Performance"),
         ("table", [P("Praktyka", "Practice"), P("Dlaczego", "Why")], [
             [P("Tweenuj kilka właściwości jednym tweenem", "Tween several properties in one tween"), P("jedno przejście po target, jedno oznaczenie „brudny”", "one pass over the target, one dirty flag")],
             [P("Nie animuj setek obiektów w każdej klatce", "Do not animate hundreds of objects per frame"), P("każda zmiana trafia do renderu", "every change reaches the renderer")],
             [P("Długie pętle rób na komponencie, nie na tweenie", "Use a component for long loops, not a tween"), P("mniej alokacji i jawny stan", "fewer allocations and explicit state")],
             [P("Anuluj animacje przy zniszczeniu obiektu", "Cancel animations when an object dies"), P("brak zapisów do martwych obiektów i brak wycieków", "no writes to dead objects, no leaks")],
             [P("Efekty kamery zamiast własnych nakładek", "Camera effects instead of custom overlays"), P("jeden draw call mniej i spójny czas", "one less draw call and consistent timing")],
         ]),
     ], "animacje animacje wlasciwosci tween easing sekwencje klatki sprite kamera shake flash fade efekty lifecycle")

page("assets", "basics", P("Zasoby i pipeline assetów", "Assets and the asset pipeline"),
     P("Manifest ze stabilnymi identyfikatorami, walidacja referencji, raport rozmiarów, anulowanie i ponawianie ładowania oraz jawne zasady zwalniania z cache.",
       "A manifest with stable identifiers, reference validation, a size report, cancellable and repeatable loading, and explicit cache release rules."),
     [
         ("h2", "Manifest zamiast luźnych ścieżek", "A manifest instead of loose paths"),
         ("p", "Każdy zasób ma <b>stabilny identyfikator</b> i jeden opis w manifeście. Kod gry sięga po <code>\"player\"</code>, nigdy po <code>\"/assets/player.png\"</code> — podmiana pliku, wersja językowa czy atlas nie wymagają zmian w scenach. <code>AssetManifest</code> jest czystą klasą: rejestruje deskryptory, wykrywa duplikaty, waliduje pola i liczy budżet rozmiarów, nie dotykając przeglądarki.",
          "Every asset has a <b>stable identifier</b> and a single manifest entry. Game code asks for <code>\"player\"</code>, never for <code>\"/assets/player.png\"</code> — swapping a file, adding a language variant or packing an atlas requires no scene changes. <code>AssetManifest</code> is a pure class: it registers descriptors, detects duplicates, validates fields and computes the size budget without touching the browser."),
         ("code", "TypeScript", """
import { AssetManifest } from "@engine";

const manifest = new AssetManifest([
  { id: "player", type: "image", src: "/assets/player.png", bytes: 18_432, license: { name: "CC0", author: "studio" } },
  { id: "coin", type: "image", src: "/assets/coin.png", bytes: 2_048 },
  { id: "hero", type: "spritesheet", src: "/assets/hero.png", frameWidth: 32, frameHeight: 32, frameCount: 16 },
  { id: "ui", type: "atlas", src: "/assets/ui.png", atlasJson: "/assets/ui.json" },
  { id: "bgm", type: "audio", src: "/assets/bgm.ogg", bytes: 1_200_000, group: "audio" },
  { id: "level-1", type: "json", src: "/assets/level-1.json" },
  { id: "map", type: "tilemap", src: "/assets/map.tmj" },
]);

manifest.count();
manifest.validate();
"""),
         ("h2", "Zasady identyfikatorów", "Identifier rules"),
         ("table", [P("Sytuacja", "Situation"), P("Wynik", "Result")], [
             [P("Id zgodne z <code>^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$</code>", "Id matching <code>^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$</code>"), P("akceptowane; <code>ui.menu-button_2</code> też", "accepted; <code>ui.menu-button_2</code> too")],
             [P("Ten sam <code>id</code> z innym <code>src</code>", "Same <code>id</code> with a different <code>src</code>"), P("<b>błąd</b> <code>duplicate-id</code> / wyjątek przy rejestracji", "<b>error</b> <code>duplicate-id</code> / throw on register")],
             [P("Ten sam <code>id</code> i ten sam opis", "Same <code>id</code> and same descriptor"), P("idempotentne — <code>registerMany</code> w dwóch scenach nie wybucha", "idempotent — <code>registerMany</code> in two scenes is safe")],
             [P("Dwa identyfikatory, ten sam plik", "Two ids, one file"), P("<b>ostrzeżenie</b> <code>duplicate-src</code>", "<b>warning</b> <code>duplicate-src</code>")],
             [P("Absolutny URL <code>https://…</code>", "Absolute <code>https://…</code> URL"), P("<b>ostrzeżenie</b> <code>external-url</code> — gra przestaje działać offline", "<b>warning</b> <code>external-url</code> — the game stops working offline")],
             [P("Brak <code>src</code> lub pusty <code>id</code>", "Missing <code>src</code> or empty <code>id</code>"), P("wyjątek już przy rejestracji, nie w trakcie gry", "throw at registration time, not during play")],
         ]),
         ("note", "info", "Deskryptory są zamrażane", "Descriptors are frozen",
          "<code>AssetManifest.register</code> zwraca <code>Object.freeze</code> na deskryptorze i na tablicy animacji. Identyfikator zasobu nie może się zmienić w czasie działania, bo psuje to cache i sprawdzanie referencji.",
          "<code>AssetManifest.register</code> returns an <code>Object.freeze</code>d descriptor and a frozen animation array. An asset id cannot drift at runtime, because that would break the cache and reference checks."),
         ("h2", "Obsługiwane typy i formaty", "Supported types and formats"),
         ("table", ["type", P("Wymagane pola", "Required fields"), P("Zalecany format", "Recommended format"), P("Loader", "Loader")], [
             ["<code>image</code>", ["<code>src</code>"], "PNG (alfa), WebP, JPEG, SVG", "<code>loader.image</code>"],
             ["<code>spritesheet</code>", ["<code>src</code>", "<code>frameWidth</code>", "<code>frameHeight</code>"], "PNG, siatka o stałym kroku", "<code>loader.spritesheet</code>"],
             ["<code>atlas</code>", ["<code>src</code>", "<code>atlasJson</code>"], "PNG + JSON (hash lub array)", "<code>loader.atlas</code>"],
             ["<code>audio</code>", ["<code>src</code>"], "OGG Vorbis + MP3 fallback", "<code>loader.audio</code>"],
             ["<code>json</code>", ["<code>src</code>"], "JSON zminifikowany", "<code>loader.json</code>"],
             ["<code>font</code>", ["<code>src</code>", "<code>atlasJson</code>"], "Bitmap font: PNG + <code>.fnt</code> (XML)", "<code>loader.bitmapFont</code>"],
             ["<code>tilemap</code>", ["<code>src</code>"], "Tiled JSON (<code>.tmj</code>/<code>.json</code>)", "<code>loader.tilemapTiledJSON</code>"],
         ]),
         ("p", "Dodatkowe pola opisowe: <code>bytes</code> (rozmiar pliku do raportu), <code>group</code> (grupowe zwalnianie), <code>license</code>, <code>optional</code>, <code>frameCount</code>, <code>margin</code>, <code>spacing</code>, <code>fontFamily</code>. Nieznane pola są ignorowane przez loader, ale zostają w manifeście — dzięki temu własne metadane narzędzi nie znikają.",
          "Extra descriptive fields: <code>bytes</code> (file size for the report), <code>group</code> (bulk release), <code>license</code>, <code>optional</code>, <code>frameCount</code>, <code>margin</code>, <code>spacing</code>, <code>fontFamily</code>. Unknown fields are ignored by the loader but kept in the manifest, so your own tooling metadata survives."),
         ("h2", "Animacje z arkusza", "Sheet animations"),
         ("p", "Animacje opisujesz w manifeście razem z arkuszem. Silnik rejestruje je po załadowaniu pod kluczem <code>asset:animacja</code>, więc dwie postacie mogą mieć niezależnie nazwane <code>walk</code> bez kolizji. Klatki mogą być indeksami numerycznymi albo nazwami klatek atlasu.",
          "Animations live next to the sheet in the manifest. The engine registers them after loading under the key <code>asset:animation</code>, so two characters can both have a <code>walk</code> clip without clashing. Frames may be numeric indices or atlas frame names."),
         ("code", "TypeScript", """
declareAssets([
  {
    id: "hero",
    type: "spritesheet",
    src: "/assets/hero.png",
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 12,
    animations: [
      { key: "idle", frames: [0, 1], frameRate: 4, repeat: -1 },
      { key: "walk", frames: [2, 3, 4, 5], frameRate: 10, repeat: -1 },
      { key: "hurt", frames: [10], frameRate: 1, repeat: 0 },
    ],
  },
]);

create(): void {
  const hero = this.createSprite("hero", { id: "hero", x: 200, y: 200 });
  this.playAnimation(hero, "hero:walk");
}

seek(): void {
  this.stopAnimation("hero");
}
"""),
         ("h2", "Walidacja i raport brakujących plików", "Validation and the missing-file report"),
         ("p", "<code>validate()</code> zwraca listę problemów z kodem, wagą i ścieżką. <code>checkReferences()</code> sprawdza, czy sceny i inne zasoby nie wskazują na nieistniejące identyfikatory — to najczęstsza przyczyna cichego braku tekstury. <code>report()</code> dokłada do tego realne błędy ładowania i podsumowanie rozmiarów.",
          "<code>validate()</code> returns issues with a code, severity and path. <code>checkReferences()</code> verifies that scenes and other assets do not point at identifiers that do not exist — the usual cause of a silently missing texture. <code>report()</code> adds real load failures and the size summary on top."),
         ("code", "TypeScript", """
const assets = engine.getAssets();

const issues = assets.validate({ requireLicenses: true });
const broken = assets.getManifest().checkReferences({
  "scene:game": ["player", "coin", "ui"],
  "scene:menu": ["logo"],
});

const report = assets.report();
report.counts;   // { total, ready, pending, failed }
report.failures; // [{ id, src, message }]
report.errors;   // duplicate-id, broken-reference, load-failed
report.sizes;    // totalBytes, byType, assets[]
"""),
         ("table", [P("Kod", "Code"), P("Waga", "Severity"), P("Znaczenie", "Meaning")], [
             ["<code>duplicate-id</code>", P("błąd", "error"), P("Identyfikator użyty dwa razy z różnym opisem", "Identifier used twice with different descriptors")],
             ["<code>duplicate-src</code>", P("ostrzeżenie", "warning"), P("Dwa identyfikatory wskazują ten sam plik", "Two ids point at the same file")],
             ["<code>invalid-id</code> / <code>unsupported-type</code>", P("błąd", "error"), P("Id poza wzorcem lub nieznany typ", "Id outside the pattern or unknown type")],
             ["<code>invalid-field</code>", P("błąd", "error"), P("Brak <code>frameWidth</code>, <code>atlasJson</code>, zły <code>bytes</code>", "Missing <code>frameWidth</code>, <code>atlasJson</code>, bad <code>bytes</code>")],
             ["<code>broken-reference</code>", P("błąd", "error"), P("Scena lub zasób wskazuje nieistniejący id", "A scene or asset points at a missing id")],
             ["<code>frame-out-of-range</code>", P("błąd", "error"), P("Klatka animacji poza <code>frameCount</code>", "Animation frame outside <code>frameCount</code>")],
             ["<code>external-url</code>", P("ostrzeżenie", "warning"), P("Zasób poza pakietem — brak trybu offline", "Asset outside the bundle — offline mode breaks")],
             ["<code>heavy-asset</code>", P("ostrzeżenie", "warning"), P("Plik lub suma przekracza budżet", "A file or the total exceeds the budget")],
             ["<code>load-failed</code>", P("błąd", "error"), P("404 lub błąd dekodowania zgłoszony przez backend", "404 or decoding failure reported by the backend")],
             ["<code>size-unknown</code>", P("ostrzeżenie", "warning"), P("Brak <code>bytes</code> i brak pomiaru z backendu", "No <code>bytes</code> and no measurement from the backend")],
         ]),
         ("h2", "Rozmiary i ciężkie zasoby", "Sizes and heavy assets"),
         ("p", "Budżet liczy się z pola <code>bytes</code>, a gdy go brakuje — z pomiaru backendu (dla tekstur to <code>szerokość × wysokość × 4</code> po dekodowaniu). Domyślne progi: 512 kB na obraz, 2 MB na plik audio, 8 MB łącznie. Przekroczenie progu nie blokuje gry, ale trafia do raportu jako <code>heavy-asset</code>, więc widać je w CI i w konsoli.",
          "The budget comes from the <code>bytes</code> field and falls back to a backend measurement (for textures that is <code>width × height × 4</code> decoded). Default limits: 512 kB per image, 2 MB per audio file, 8 MB in total. Crossing a limit does not block the game, but it shows up in the report as <code>heavy-asset</code>, so CI and the console both see it."),
         ("code", "TypeScript", """
const sizes = assets.sizeReport({ imageBytes: 256 * 1024, totalBytes: 4 * 1024 * 1024 });

sizes.totalBytes;
sizes.byType.image;
sizes.assets[0];        // { id, type, bytes } sorted by size
assets.formatSizes();   // ["bgm (audio): 1.14 MB", "player (image): 18.0 kB"]
"""),
         ("table", [P("Cel", "Goal"), P("Praktyka", "Practice")], [
             [P("Krótszy start", "Faster start"), P("Atlas zamiast dziesiątek pojedynczych PNG; mniej requestów i jedno dekodowanie", "One atlas instead of dozens of PNGs; fewer requests and one decode")],
             [P("Mniejszy transfer", "Smaller transfer"), P("WebP/AVIF dla obrazów, OGG dla audio; PNG tylko gdy alfa i piksele muszą być bezstratne", "WebP/AVIF for images, OGG for audio; PNG only when alpha and pixels must be lossless")],
             [P("Szybszy parse", "Faster parsing"), P("Minifikuj JSON, usuwaj komentarze i pola debugowe z danych poziomów", "Minify JSON, strip comments and debug fields from level data")],
             [P("Budżet w CI", "Budget in CI"), P("Nie przerywaj builda przy ostrzeżeniu, ale publikuj <code>sizes.totalBytes</code> jako metrykę", "Do not fail the build on a warning, but publish <code>sizes.totalBytes</code> as a metric")],
         ]),
         ("h2", "Anulowanie i ponawianie ładowania", "Cancelling and retrying loads"),
         ("p", "Stan każdego zasobu jest jawny: <code>idle → queued → loading → ready</code>, a po błędzie <code>failed</code>. <code>cancel()</code> działa tylko wtedy, gdy backend potrafi opróżnić kolejkę — Phaser nie przerywa żądań w locie, więc backend zgłasza <code>false</code> w trakcie ładowania i silnik nie udaje, że anulował. <code>retry()</code> ponawia wyłącznie nieudane pozycje.",
          "Every asset has an explicit status: <code>idle → queued → loading → ready</code> and <code>failed</code> after an error. <code>cancel()</code> only works when the backend can drop its queue — Phaser cannot abort in-flight requests, so the backend returns <code>false</code> while loading and the engine does not pretend otherwise. <code>retry()</code> re-queues only the failed entries."),
         ("code", "TypeScript", """
const assets = engine.getAssets();

assets.load(["player", "coin"]);
assets.status("player");       // "queued"

const cancelled = assets.cancel();
if (!cancelled) logger.warn("backend cannot cancel while loading");

assets.onError((error) => logger.error(error.message, error));
assets.retry();                 // tylko pozycje ze statusem "failed"
assets.retry(["coin"]);         // albo jawnie wskazane
"""),
         ("h2", "Zwalnianie zasobów i czyszczenie cache", "Releasing assets and clearing the cache"),
         ("p", "Zasoby trzyma się przez <b>uchwyty właścicieli</b>. Scena automatycznie obejmuje zasoby zadeklarowane w <code>preload()</code> i zwalnia je w <code>shutdown()</code>; ręczne <code>retain()</code> służy do zasobów współdzielonych. <code>gc()</code> usuwa z cache tylko te pozycje, których nikt już nie trzyma — więc przejście menu → gra → menu nie pobiera tych samych plików drugi raz.",
          "Assets are held through <b>owner handles</b>. A scene automatically holds everything declared in <code>preload()</code> and releases it on <code>shutdown()</code>; manual <code>retain()</code> covers shared assets. <code>gc()</code> only evicts entries nobody holds, so menu → game → menu never downloads the same files twice."),
         ("code", "TypeScript", """
assets.hold("ui", ["logo", "font-ui"]);   // uchwyt właściciela
assets.retain("bgm");                     // licznik ręczny

assets.gc();                              // zwalnia nieużywane
assets.release("bgm");
assets.releaseGroup("audio");             // cała grupa
assets.releaseOwner("ui");

assets.isRetained("logo");                // false po zwolnieniu uchwytu
"""),
         ("table", [P("Operacja", "Operation"), P("Efekt", "Effect")], [
             ["<code>hold(owner, ids)</code>", P("Dodaje identyfikatory do uchwytu właściciela", "Adds ids to an owner handle")],
             ["<code>releaseOwner(owner)</code>", P("Usuwa uchwyt i zwraca liczbę zwolnionych pozycji", "Drops the handle and returns how many were released")],
             ["<code>retain(id)</code> / <code>release(id)</code>", P("Licznik ręczny; <code>release</code> zwalnia dopiero przy zerze", "Manual counter; <code>release</code> only unloads at zero")],
             ["<code>releaseGroup(group)</code>", P("Zwalnia wszystkie zasoby z danym <code>group</code>", "Unloads every asset in a <code>group</code>")],
             ["<code>gc()</code>", P("Usuwa z cache to, czego nikt nie trzyma", "Evicts everything nobody holds")],
             ["<code>unload(id)</code>", P("Natychmiastowe usunięcie z cache (tekstura, JSON, audio)", "Immediate cache removal (texture, JSON, audio)")],
         ]),
         ("note", "warn", "Animacje nie są zwalniane automatycznie", "Animations are not released automatically",
          "Phaser trzyma rejestr animacji globalnie, także po usunięciu tekstury. Jeśli podmieniasz arkusze w czasie działania, wywołaj <code>anims.remove(key)</code> w adapterze albo zaplanuj restart sceny — inaczej klatki wskazują na usuniętą teksturę.",
          "Phaser keeps its animation registry globally, even after a texture is removed. If you hot-swap sheets at runtime, call <code>anims.remove(key)</code> in the adapter or restart the scene — otherwise frames point at a texture that no longer exists."),
         ("h2", "Licencje zasobów", "Asset licences"),
         ("p", "Pole <code>license</code> przenosi informację o pochodzeniu zasobu do manifestu, więc nie ginie w mailach. <code>validate({ requireLicenses: true })</code> zamienia brak wpisu w ostrzeżenie — dobre ustawienie dla gier komercyjnych, zbyt hałaśliwe dla prototypu. To nie jest porada prawna: sprawdź warunki każdej licencji, zwłaszcza wymóg atrybucji i copyleft.",
          "The <code>license</code> field moves provenance into the manifest so it cannot get lost in an email thread. <code>validate({ requireLicenses: true })</code> turns a missing entry into a warning — sensible for commercial games, too noisy for a prototype. This is not legal advice: check every licence, especially attribution and copyleft terms."),
         ("table", [P("Licencja", "Licence"), P("Typowe wymagania", "Typical obligations")], [
             ["CC0 / public domain", P("brak obowiązków, atrybucja mile widziana", "no obligations, attribution appreciated")],
             ["CC BY", P("atrybucja w grze lub w dokumentacji", "attribution in-game or in the docs")],
             ["CC BY-SA", P("atrybucja + udostępnienie utworu zależnego na tej samej licencji", "attribution + derivative work shared under the same licence")],
             ["OFL (fonty)", P("atrybucja, zachowanie pliku licencji, zakaz sprzedaży samego fontu", "attribution, keep the licence file, do not sell the font alone")],
             ["MIT / Apache-2.0 (kod i część assetów)", P("plik licencji i nota o prawach autorskich", "licence file and copyright notice")],
             ["Własna / komercyjna", P("sprawdź umowę: zakres, region, czas, prawo do modyfikacji", "read the contract: scope, territory, term, right to modify")],
         ]),
         ("code", "JSON", """
{
  "id": "bgm",
  "type": "audio",
  "src": "/assets/bgm.ogg",
  "bytes": 1200000,
  "group": "audio",
  "license": { "name": "CC BY 4.0", "author": "Nadia K.", "url": "https://example.com/licence" }
}
"""),
         ("h2", "Przygotowanie assetów na produkcję", "Preparing assets for production"),
         ("steps", [
             (P("Zbierz i nazwij", "Collect and name"), P("Jeden manifest, stabilne id, pliki w jednym katalogu publicznym. Nazwy plików mogą się zmieniać — id nie.", "One manifest, stable ids, files in one public directory. File names may change — ids may not.")),
             (P("Skompresuj świadomie", "Compress deliberately"), P("Obrazy: WebP (q≈80) lub PNG z optymalizacją; audio: OGG ~96–128 kb/s dla muzyki, WAV tylko dla krótkich efektów bez kompresji.", "Images: WebP (q≈80) or optimised PNG; audio: OGG ~96–128 kb/s for music, WAV only for very short uncompressed effects.")),
             (P("Spakuj w atlasy", "Pack atlases"), P("Wszystko, co rysuje się razem, trafia do jednego atlasu; UI osobno od świata, żeby nie ładować arkusza UI w scenie bez interfejsu.", "Everything drawn together goes into one atlas; keep UI separate from world art so a scene without UI never loads it.")),
             (P("Zmierz budżet", "Measure the budget"), P("<code>report().sizes</code> w CI lub w konsoli po starcie; ostrzeżenia <code>heavy-asset</code> traktuj jak dług do spłaty.", "<code>report().sizes</code> in CI or in the console after boot; treat <code>heavy-asset</code> warnings as debt.")),
             (P("Dodaj licencje", "Add licences"), P("Uzupełnij <code>license</code> przy każdym zasobie i włącz <code>requireLicenses</code> w walidacji przed wydaniem.", "Fill <code>license</code> for every asset and enable <code>requireLicenses</code> before shipping.")),
         ]),
     ], "zasoby assets manifest pipeline identyfikatory duplikaty walidacja referencje rozmiar budzet kompresja licencje cache zwalnianie anulowanie retry animacje atlas spritesheet font audio"),

page("json", "basics", P("Format projektu (JSON)", "Project format (JSON)"),
     P("Wersjonowany, walidowany format v2 rozdzielający sceny, zasoby i ustawienia — z migracją starszych plików, zachowaniem nieznanych pól i sumą kontrolną.",
       "A versioned, validated v2 format that separates scenes, assets and settings — with migrations for older files, preserved unknown fields and a checksum."),
     [
         ("h2", "Struktura v2", "v2 structure"),
         ("p", "Projekt dzieli się na <b>ustawienia</b>, <b>zasoby</b> i <b>sceny</b>. Ustawienia opisują canvas i determinizm, zasoby są listą deskryptorów w formacie manifestu, a scena to lista obiektów z opcjonalną kamerą i własnymi polami. Każdy poziom ma stabilne <code>id</code>, do którego odwołują się inne wpisy.",
          "A project splits into <b>settings</b>, <b>assets</b> and <b>scenes</b>. Settings describe the canvas and determinism, assets are manifest-style descriptors, and a scene is a list of objects with an optional camera and custom properties. Every level has a stable <code>id</code> that other entries reference."),
         ("code", "project.json", """
{
  "formatVersion": 2,
  "name": "TopDownDemo",
  "settings": {
    "width": 1280,
    "height": 720,
    "scaleMode": "fit",
    "backgroundColor": "#151515",
    "gravity": { "x": 0, "y": 900 },
    "seed": 1337,
    "fixedStepHz": 60
  },
  "assets": [
    { "id": "player", "type": "image", "src": "/assets/player.png", "bytes": 18432 },
    { "id": "coin", "type": "image", "src": "/assets/coin.png", "bytes": 2048 },
    { "id": "hero", "type": "spritesheet", "src": "/assets/hero.png", "frameWidth": 32, "frameHeight": 32 }
  ],
  "scenes": [
    {
      "id": "game",
      "camera": { "bounds": { "x": 0, "y": 0, "width": 2000, "height": 2000 }, "backgroundColor": "#0b0c0e" },
      "properties": { "spawn": "center" },
      "objects": [
        { "id": "player", "kind": "sprite", "asset": "player", "x": 200, "y": 200, "scaleX": 1, "scaleY": 1, "tags": ["player"], "body": { "type": "dynamic" } },
        { "id": "crystal-0", "kind": "sprite", "asset": "coin", "x": 420, "y": 220, "tags": ["crystal"] },
        { "id": "hud", "kind": "text", "x": 24, "y": 20, "text": "Crystals: 0 / 8", "tags": ["hud"] }
      ]
    }
  ]
}
"""),
         ("h2", "Znaczenie pól", "Field reference"),
         ("table", [P("Pole", "Field"), P("Wymagane", "Required"), P("Znaczenie", "Meaning")], [
             ["<code>formatVersion</code>", P("tak", "yes"), P("Wersja formatu; obecnie <code>2</code>", "Format version; currently <code>2</code>")],
             ["<code>name</code>", P("tak", "yes"), P("Nazwa projektu, niepusta", "Project name, non-empty")],
             ["<code>settings.width</code> / <code>height</code>", P("tak", "yes"), P("Rozmiar logiczny canvasu, dodatnie liczby całkowite", "Logical canvas size, positive integers")],
             ["<code>settings.scaleMode</code>", P("tak", "yes"), "jedno z <code>fit</code>, <code>fill</code>, <code>none</code>, <code>stretch</code>"],
             ["<code>settings.backgroundColor</code>", P("tak", "yes"), P("Kolor w formacie <code>#rrggbb</code>", "Colour as <code>#rrggbb</code>")],
             ["<code>settings.gravity</code>", P("nie", "no"), P("Wektor grawitacji przekazywany do fizyki", "Gravity vector passed to physics")],
             ["<code>settings.seed</code>", P("nie", "no"), P("Ziarno generatora losowego — powtarzalne rozgrywki", "Random seed — reproducible runs")],
             ["<code>settings.fixedStepHz</code>", P("nie", "no"), P("Częstotliwość kroku stałego; <code>null</code> wyłącza krok", "Fixed-step frequency; <code>null</code> disables stepping")],
             ["<code>assets[].id</code>", P("tak", "yes"), P("Stabilny identyfikator zasobu", "Stable asset identifier")],
             ["<code>scenes[].id</code>", P("tak", "yes"), P("Unikalny w projekcie identyfikator sceny", "Project-unique scene identifier")],
             ["<code>objects[].id</code>", P("tak", "yes"), P("Unikalny w scenie identyfikator obiektu", "Scene-unique object identifier")],
             ["<code>objects[].asset</code>", P("dla <code>sprite</code>", "for <code>sprite</code>"), P("Referencja do <code>assets[].id</code>", "Reference to <code>assets[].id</code>")],
             ["<code>objects[].body</code>", P("nie", "no"), P("<code>{ type: \"dynamic\"|\"static\", allowGravity?, immovable? }</code>", "<code>{ type: \"dynamic\"|\"static\", allowGravity?, immovable? }</code>")],
             ["<code>objects[].properties</code>", P("nie", "no"), P("Własne pole danych obiektu, zachowywane przy zapisie", "Custom object data, preserved on save")],
         ]),
         ("h2", "Walidacja", "Validation"),
         ("p", "<code>validateProject</code> sprawdza typy, zakresy i referencje w jednym przejściu i nie rzuca wyjątków — zwraca wynik. Błąd oznacza twarde odrzucenie (kodu nie ma jak uruchomić), ostrzeżenie to sygnał do decyzji (np. brak licencji, nieużywany zasób).",
          "<code>validateProject</code> checks types, ranges and references in a single pass and never throws — it returns a result. An error is a hard reject (there is nothing safe to run), a warning is a decision signal (missing licence, unused asset)."),
         ("code", "TypeScript", """
import { importProject, validateProject } from "@engine";

const result = importProject(text, { requireLicenses: true, verifyChecksum: true });

if (!result.valid) {
  for (const issue of result.errors) logger.error(`${issue.path}: ${issue.code} ${issue.message}`);
  return;
}

const project = result.project;
validateProject(project).warnings;
"""),
         ("table", [P("Błąd", "Error"), P("Kiedy", "When")], [
             ["<code>invalid-type</code>", P("Pole ma zły typ (np. <code>width</code> jako string)", "A field has the wrong type (e.g. <code>width</code> as a string)")],
             ["<code>missing-field</code> / <code>invalid-field</code>", P("Brak wymaganego pola lub wartość poza zakresem", "Missing required field or out-of-range value")],
             ["<code>duplicate-id</code>", P("Powtórzony <code>id</code> zasobu, sceny lub obiektu", "Repeated asset, scene or object <code>id</code>")],
             ["<code>broken-reference</code>", P("<code>objects[].asset</code> nie istnieje w <code>assets</code>", "<code>objects[].asset</code> does not exist in <code>assets</code>")],
             ["<code>invalid-color</code>", P("Kolor poza <code>#rrggbb</code>", "Colour outside <code>#rrggbb</code>")],
             ["<code>unsupported-version</code>", P("<code>formatVersion</code> spoza znanych migracji", "<code>formatVersion</code> outside known migrations")],
             ["<code>invalid-json</code>", P("Tekst nie jest poprawnym JSON-em", "The text is not valid JSON")],
             ["<code>checksum-mismatch</code>", P("Suma kontrolna nie zgadza się z treścią", "The checksum does not match the content")],
         ]),
         ("h2", "Nieznane pola są zachowywane", "Unknown fields are preserved"),
         ("p", "Prefiks <code>x-</code> i każde pole, którego schemat nie zna, ląduje w <code>unknownFields</code> na poziomie, na którym wystąpiło: korzenia, <code>settings</code>, sceny lub obiektu. Eksport dokłada je z powrotem. Dzięki temu własne metadane edytora, komentarze zespołu czy pola przyszłej wersji nie znikają po zapisie starszym narzędziem.",
          "The <code>x-</code> prefix and any field the schema does not know land in <code>unknownFields</code> at the level where they appeared: root, <code>settings</code>, scene or object. Export writes them back. That is how editor metadata, team comments or future-version fields survive a save by older tooling."),
         ("code", "JSON", """
{
  "formatVersion": 2,
  "name": "Demo",
  "x-tool": "level-editor-3",
  "settings": { "width": 1280, "height": 720, "scaleMode": "fit", "backgroundColor": "#151515", "x-note": "tuned on 16:9" },
  "assets": [],
  "scenes": []
}
"""),
         ("h2", "Migracje", "Migrations"),
         ("p", "Migracja to lista kroków <code>z wersji → do wersji</code>. <code>migrateProject</code> uruchamia je po kolei, więc plik v1 dojdzie do v2 jedną ścieżką, bez gałęzi specjalnych. Wynik mówi, czy migracja zaszła (<code>migrated</code>) i jakie kroki wykonano.",
          "A migration is a list of <code>from version → to version</code> steps. <code>migrateProject</code> runs them in order, so a v1 file reaches v2 through one path with no special branches. The result reports whether a migration happened (<code>migrated</code>) and which steps ran."),
         ("code", "TypeScript", """
import { importProject, migrateProject } from "@engine";

const upgrade = migrateProject(JSON.parse(text));
upgrade.migrated;                       // true dla formatVersion: 1
upgrade.applied;                        // [{ from: 1, to: 2 }]
upgrade.project.settings.width;

migrateProject({ ...upgrade.project, formatVersion: 99 });
// { ok: false, errors: [{ code: "unsupported-version" }] }
"""),
         ("table", [P("Wejście", "Input"), P("Wynik", "Result")], [
             [P("<code>formatVersion: 2</code>", "<code>formatVersion: 2</code>"), P("bez zmian, <code>migrated: false</code>", "untouched, <code>migrated: false</code>")],
             [P("<code>formatVersion: 1</code>", "<code>formatVersion: 1</code>"), P("<code>game.*</code> → <code>settings.*</code>, <code>migrated: true</code>", "<code>game.*</code> → <code>settings.*</code>, <code>migrated: true</code>")],
             [P("Brak <code>formatVersion</code>", "Missing <code>formatVersion</code>"), P("błąd <code>missing-field</code> — brak domysłu", "error <code>missing-field</code> — no guessing")],
             [P("Wersja przyszła (<code>99</code>)", "Future version (<code>99</code>)"), P("błąd <code>unsupported-version</code>", "error <code>unsupported-version</code>")],
         ]),
         ("h2", "Koperta z sumą kontrolną", "The checksummed envelope"),
         ("p", "Eksport domyślnie opakowuje projekt w kopertę z sumą kontrolną FNV-1a liczoną po <b>kanonicznym</b> JSON-ie (klucze sortowane). Koperta wykrywa uszkodzenie i ręczną edycję, nie jest podpisem — ktoś, kto chce oszukać, przeliczy sumę. Do ochrony przed celową modyfikacją potrzebny jest podpis po stronie serwera.",
          "Export wraps the project in an envelope with an FNV-1a checksum computed over <b>canonical</b> JSON (sorted keys). The envelope detects corruption and hand edits; it is not a signature — anyone determined can recompute it. Protection against deliberate tampering needs a server-side signature."),
         ("code", "JSON", """
{
  "format": "browser2d-project",
  "formatVersion": 2,
  "checksum": "a1b2c3d4",
  "project": { "formatVersion": 2, "name": "Demo", "settings": {}, "assets": [], "scenes": [] }
}
"""),
         ("code", "TypeScript", """
import { exportProject, importProject } from "@engine";

const text = exportProject(project);                    // koperta z sumą
const bare = exportProject(project, { envelope: false });
const back = importProject(text);                        // verifyChecksum domyślnie true
back.checksum;                                           // { expected, actual, valid }
importProject(text, { verifyChecksum: false }).valid;    // pomiń weryfikację
"""),
         ("note", "tip", "Format v1 nadal się czyta", "The v1 format still reads",
          "Stare pliki v1 (<code>game: { width, height }</code>) są migrowane przy imporcie, więc projekt zapisany poprzednią wersją silnika otworzy się bez ręcznej edycji. Nowe zapisy zawsze powstają w v2.",
          "Old v1 files (<code>game: { width, height }</code>) are migrated on import, so a project saved by the previous engine version opens without manual edits. New saves are always written as v2."),
     ], "json projekt format formatVersion walidacja migracja envelope checksum unknownFields ustawienia sceny zasoby")

page("saves", "basics", P("Projekt i zapisy gracza", "Project data and player saves"),
     P("Atomowy zapis projektu, osobne zapisy postępu, kopie zapasowe i odzyskiwanie po awarii — z adapterami localStorage, IndexedDB, File System i HTTP.",
       "Atomic project saves, separate progress saves, backups and crash recovery — with localStorage, IndexedDB, File System and HTTP adapters."),
     [
         ("h2", "Dwa różne światy danych", "Two different data worlds"),
         ("p", "Projekt (sceny, zasoby, ustawienia) i postęp gracza (poziom, punkty, ekwipunek) mają inne cykle życia, inną częstotliwość zapisu i inne konsekwencje błędu. Trzymanie ich w jednym pliku kończy się tym, że zapis stanu rozgrywki nadpisuje dane edytora. Silnik rozdziela je twardo: <b>projekt</b> żyje w repozytorium projektu, <b>postęp</b> w repozytorium zapisów gracza.",
          "The project (scenes, assets, settings) and player progress (level, score, inventory) have different lifecycles, different write frequencies and different failure costs. Keeping them in one file ends with a gameplay save overwriting editor data. The engine separates them hard: the <b>project</b> lives in the project repository, <b>progress</b> in the player-save repository."),
         ("table", [P("Aspekt", "Aspect"), P("Projekt", "Project"), P("Zapis gracza", "Player save")], [
             [P("Właściciel", "Owner"), P("autor gry / edytor", "the game author / editor"), P("gracz", "the player")],
             [P("Klucz", "Key"), "<code>project:default</code>", "<code>save:&lt;playerId&gt;:&lt;slot&gt;</code>"],
             [P("Częstotliwość", "Frequency"), P("rzadko, ręcznie", "rarely, manual"), P("co checkpoint, przy wyjściu", "per checkpoint, on exit")],
             [P("Walidacja", "Validation"), P("pełny schemat v2", "full v2 schema"), P("wersja zapisu + suma kontrolna", "save version + checksum")],
             [P("Konsekwencja błędu", "Failure cost"), P("utrata pracy autora", "loss of authored work"), P("powtórzenie fragmentu rozgrywki", "replaying a section")],
         ]),
         ("h2", "Magazyny: jeden interfejs, pięć backendów", "Stores: one interface, five backends"),
         ("p", "<code>SaveStore</code> to pięć metod: <code>read</code>, <code>write</code>, <code>remove</code>, <code>keys</code>, <code>clear</code>. Wszystkie operacje są asynchroniczne, więc ten sam kod działa w przeglądarce i w Node. Wybór magazynu to jedna linia, a nie przebudowa warstwy zapisu.",
          "<code>SaveStore</code> is five methods: <code>read</code>, <code>write</code>, <code>remove</code>, <code>keys</code>, <code>clear</code>. Every operation is asynchronous, so the same code runs in the browser and in Node. Choosing a store is one line, not a rewrite of the persistence layer."),
         ("code", "TypeScript", """
import {
  LocalStorageStore, IndexedDbStore, FileSystemStore, HttpStore, MemoryStore,
  PlayerSaveRepository, ProjectRepository, exportProject, importProject,
} from "@engine";

const store = new LocalStorageStore("b2d:");          // prosty, ~5 MB, synchroniczny pod spodem
const durable = new IndexedDbStore({ dbName: "b2d", storeName: "entries" });

const repository = new ProjectRepository(store);
const saves = new PlayerSaveRepository(store);
"""),
         ("table", [P("Magazyn", "Store"), P("Kiedy używać", "When to use"), P("Ograniczenia", "Limits")], [
             ["<code>MemoryStore</code>", P("testy i podglądy bez trwałości", "tests and previews without persistence"), P("znika po odświeżeniu", "gone on reload")],
             ["<code>LocalStorageStore</code>", P("szybki start, małe zapisy", "fast start, small saves"), P("~5 MB, blokuje wątek UI, tylko stringi", "~5 MB, blocks the UI thread, strings only")],
             ["<code>IndexedDbStore</code>", P("duże zapisy, dane binarne", "large saves, binary data"), P("API asynchroniczne, dostępne po <code>isAvailable()</code>", "async API, check <code>isAvailable()</code>")],
             ["<code>FileSystemStore</code>", P("Node, CLI, narzędzia edytorskie", "Node, CLIs, editor tooling"), P("import <code>node:fs/promises</code> wstrzykiwany przez loader", "<code>node:fs/promises</code> injected through a loader")],
             ["<code>HttpStore</code>", P("zapisy po stronie serwera, wiele urządzeń", "server-side saves, multiple devices"), P("wymaga endpointu REST, token opcjonalny", "needs a REST endpoint, token optional")],
         ]),
         ("h2", "Atomowy zapis projektu", "Atomic project save"),
         ("p", "<code>ProjectRepository.save</code> nie nadpisuje pliku w miejscu. Najpierw waliduje projekt, potem pisze kopię tymczasową <code>project:default.tmp</code>, czyta ją z powrotem i weryfikuje sumę kontrolną, robi kopię poprzedniej wersji jako <code>.backup</code>, a dopiero na końcu commituje. Jeśli którykolwiek krok zawiedzie, poprzedni stan zostaje nietknięty, a plik tymczasowy jest usuwany.",
          "<code>ProjectRepository.save</code> never overwrites in place. It validates the project, writes a temporary copy at <code>project:default.tmp</code>, reads it back and verifies the checksum, stores the previous version as <code>.backup</code>, and only then commits. If any step fails, the previous state stays untouched and the temp file is removed."),
         ("code", "TypeScript", """
const result = await repository.save(project);

result.ok;        // false => nic nie zostało nadpisane
result.issues;    // błędy walidacji albo { code: "write-failed" | "verify-failed" }

const loaded = await repository.load();      // { ok, project, migrated, warnings }
await repository.restoreBackup();            // cofnij ostatni zapis
await repository.save(project, { keepBackup: false });
"""),
         ("steps", [
             (P("Walidacja", "Validate"), P("Projekt przechodzi ten sam schemat co import. Błąd = stop, bez dotykania magazynu.", "The project goes through the same schema as import. An error means stop, without touching the store.")),
             (P("Zapis tymczasowy", "Temp write"), P("Dane lądują pod <code>project:default.tmp</code>, nigdy pod klucz docelowy.", "Data lands under <code>project:default.tmp</code>, never under the target key.")),
             (P("Odczyt zwrotny", "Read back"), P("Silnik czyta plik i liczy sumę kontrolną — wykrywa obcięty zapis i pełny dysk.", "The engine reads the file and recomputes the checksum — catching truncated writes and full disks.")),
             (P("Kopia poprzedniej wersji", "Previous-version backup"), P("Obecny <code>project:default</code> staje się <code>.backup</code>.", "The current <code>project:default</code> becomes <code>.backup</code>.")),
             (P("Commit", "Commit"), P("Dopiero teraz temp trafia pod klucz docelowy, a temp jest kasowany. Błąd commitu przywraca backup.", "Only now does temp move to the target key and temp is removed. A commit failure restores the backup.")),
         ]),
         ("h2", "Zapis gracza", "Player save"),
         ("p", "Zapis gracza ma nagłówek z wersją, identyfikatorem gracza, slotem, znacznikiem czasu i sumą kontrolną obliczoną z <code>progress</code>. Przy odczycie silnik najpierw weryfikuje sumę, potem migruje brakującą wersję, a na końcu zwraca obiekt. Uszkodzony zapis nie wywala gry — dostajesz <code>SaveCorruptionError</code> i decydujesz, czy zaoferować nową grę.",
          "A player save carries a header with the version, player id, slot, timestamp and a checksum computed over <code>progress</code>. On load the engine verifies the checksum, migrates a missing version and then returns the object. A corrupted save does not crash the game — you get a <code>SaveCorruptionError</code> and decide whether to offer a new game."),
         ("code", "TypeScript", """
await saves.save("player-1", "slot-1", { level: 3, coins: 120, inventory: ["key", "rope"] });

const { save, migrated, warning } = await saves.load("player-1", "slot-1");
save.progress.coins;   // 120
save.checksum;         // "3f9a1c02"
save.updatedAt;        // ISO timestamp

await saves.list("player-1");    // [{ slot, updatedAt, bytes }]
await saves.remove("player-1", "slot-1");

try {
  await saves.load("player-1", "slot-1");
} catch (error) {
  if (error instanceof SaveCorruptionError) startNewGame();
}
"""),
         ("table", [P("Pole", "Field"), P("Znaczenie", "Meaning")], [
             ["<code>version</code>", P("Wersja formatu zapisu; starsze są migrowane przy odczycie", "Save format version; older ones are migrated on load")],
             ["<code>playerId</code> / <code>slot</code>", P("Tożsamość zapisu; trafiają do klucza <code>save:playerId:slot</code>", "Save identity; used in the <code>save:playerId:slot</code> key")],
             ["<code>updatedAt</code>", P("ISO 8601, ustawiany przez silnik przy każdym zapisie", "ISO 8601, set by the engine on every write")],
             ["<code>progress</code>", P("Dowolny serializowalny obiekt gry — bez funkcji i klas", "Any serialisable game object — no functions or classes")],
             ["<code>checksum</code>", P("FNV-1a z kanonicznego JSON-a <code>progress</code>", "FNV-1a of the canonical JSON of <code>progress</code>")],
         ]),
         ("note", "warn", "Co wolno wkładać do zapisu", "What may go into a save",
          "Tylko dane: liczby, stringi, tablice, obiekty z kluczami tekstowymi. Nie wkładaj instancji klas, <code>Map</code>, <code>Date</code>, cyklicznych referencji ani referencji do obiektów sceny — po odświeżeniu strony nie istnieją, a suma kontrolna i tak liczona jest z JSON-a. Zapisuj identyfikatory, nie obiekty.",
          "Data only: numbers, strings, arrays, objects with string keys. Do not put class instances, <code>Map</code>, <code>Date</code>, cyclic references or scene objects into a save — they do not exist after a reload, and the checksum is computed from JSON anyway. Store identifiers, not objects."),
         ("h2", "Import, eksport i integralność", "Import, export and integrity"),
         ("code", "TypeScript", """
import { exportProject, importProject, checksumText } from "@engine";

const file = exportProject(project);                 // koperta + suma
const parsed = importProject(file, { requireLicenses: true });

parsed.valid;      // false przy uszkodzeniu lub złej referencji
parsed.migrated;   // true, gdy plik był w v1
parsed.warnings;   // np. missing-license, unused-asset
checksumText("cokolwiek");                            // ta sama suma, bez projektu
"""),
         ("table", [P("Scenariusz", "Scenario"), P("Zachowanie silnika", "Engine behaviour")], [
             [P("Plik obcięty w połowie", "File truncated halfway"), P("<code>invalid-json</code> — brak częściowego wczytania", "<code>invalid-json</code> — nothing partially loaded")],
             [P("Ręczna edycja koperty", "Hand-edited envelope"), P("<code>checksum-mismatch</code> z oczekiwaną i rzeczywistą sumą", "<code>checksum-mismatch</code> with expected and actual checksums")],
             [P("Obiekt wskazuje brakujący zasób", "Object references a missing asset"), P("<code>broken-reference</code> w <code>errors</code>", "<code>broken-reference</code> in <code>errors</code>")],
             [P("Plik w formacie v1", "File in v1 format"), P("migracja do v2, <code>migrated: true</code>", "migrated to v2, <code>migrated: true</code>")],
             [P("Uszkodzony zapis gracza", "Corrupted player save"), P("<code>SaveCorruptionError</code>, gra działa dalej", "<code>SaveCorruptionError</code>, the game keeps running")],
         ]),
         ("h2", "Autosave i kopie odzyskiwania", "Autosave and recovery copies"),
         ("p", "Autosave należy do gry, nie do silnika — bo tylko gra wie, kiedy stan jest spójny. Wzorzec, który się sprawdza: zapis przy zmianie sceny, przy checkpointcie i przy <code>visibilitychange</code>, zawsze z ograniczeniem częstotliwości, żeby nie zapisywać 60 razy na sekundę.",
          "Autosave belongs to the game, not the engine — only the game knows when state is consistent. The pattern that works: save on scene change, on checkpoint and on <code>visibilitychange</code>, always rate-limited so you never write 60 times a second."),
         ("code", "TypeScript", """
let pending: Promise<void> | null = null;
let lastWrite = 0;

const autosave = (progress: unknown): void => {
  const now = Date.now();
  if (pending || now - lastWrite < 2_000) return;
  lastWrite = now;
  pending = saves.save("player-1", "auto", progress).then(
    () => { pending = null; },
    (error) => { pending = null; logger.warn(`autosave failed: ${error.message}`); },
  );
};

this.getEvents().on("scene:changed", () => autosave(this.snapshot()));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") autosave(this.snapshot());
});
"""),
         ("p", "Kopię odzyskiwania robi <code>keepBackup</code>: po każdym udanym zapisie projektu poprzednia wersja leży pod <code>.backup</code> i można ją przywrócić jednym wywołaniem. Dla zapisów gracza rolę kopii pełni osobny slot — taniej i prościej niż wersjonowanie w miejscu.",
          "Recovery copies come from <code>keepBackup</code>: after every successful project save the previous version sits under <code>.backup</code> and can be restored with one call. For player saves a separate slot plays that role — cheaper and simpler than in-place versioning."),
         ("h2", "Zapisy przez HTTP", "Saves over HTTP"),
         ("p", "<code>HttpStore</code> gada z prostym REST-em: <code>GET /v1/entries</code>, <code>GET|PUT|DELETE /v1/entries/{key}</code>, <code>GET /v1/health</code>. Ten sam kontrakt realizuje referencyjny serwer z <code>tools/save-server</code>. 404 przy odczycie oznacza „brak wpisu”, nie błąd.",
          "<code>HttpStore</code> speaks plain REST: <code>GET /v1/entries</code>, <code>GET|PUT|DELETE /v1/entries/{key}</code>, <code>GET /v1/health</code>. The reference server in <code>tools/save-server</code> implements the same contract. A 404 on read means “no entry”, not an error."),
         ("code", "bash", """
node tools/save-server/server.mjs --port=8788 --backend=file --dir=./saves
node tools/save-server/server.mjs --backend=postgres --dialect=postgres --table=b2d_entries
node tools/save-server/server.mjs --print-schema=mysql
"""),
         ("code", "TypeScript", """
import { HttpStore, PlayerSaveRepository } from "@engine";

const store = new HttpStore({
  baseUrl: "https://save.example.com",
  token: "secret",          // wysyłane jako Authorization: Bearer
  timeoutMs: 5_000,
});

const saves = new PlayerSaveRepository(store);
await saves.save("player-1", "slot-1", { level: 4 });
"""),
         ("note", "info", "Klucze są walidowane po obu stronach", "Keys are validated on both sides",
          "Klucz musi pasować do <code>^[A-Za-z0-9:._~-]{1,191}$</code> — ten sam wzorzec stosuje klient i serwer, więc nie da się zapisać klucza, którego serwer nie przyjmie, ani wstrzyknąć ścieżki przez <code>../</code>.",
          "A key must match <code>^[A-Za-z0-9:._~-]{1,191}$</code> — the client and the server use the same pattern, so you cannot write a key the server rejects or smuggle a path through <code>../</code>."),
     ], "zapisy save projekt project repository atomowy backup autosave odzyskiwanie localStorage indexeddb filesystem http integralnosc suma kontrolna migracja slot gracz")

page("events", "basics", P("Zdarzenia", "Events"),
     P("EventBus z automatycznym czyszczeniem subskrypcji przy zmianie sceny.", "An EventBus that cleans its subscriptions automatically on scene changes."),
     [
         ("h2", "API", "API"),
         ("code", "TypeScript", """
const off = engine.getEvents().on("game:collected", ({ score }) => {
  this.updateHud(score);
});

off();

engine.getEvents().emit("game:collected", { score: 3 });

this.getEvents().subscribeForScene(this.id, "enemy:died", (payload) => {
  this.addScore(payload.points);
});
"""),
         ("table", [P("Metoda", "Method"), P("Opis", "Description")], [
             ["<code>on(event, handler)</code>", P("Subskrypcja globalna, zwraca funkcję odpinającą", "Global subscription, returns an unsubscribe function")],
             ["<code>subscribeForScene(sceneId, event, handler)</code>", P("Subskrypcja powiązana ze sceną — usuwana przy <code>shutdown</code>", "Scene-bound subscription — removed on <code>shutdown</code>")],
             ["<code>emit(event, payload)</code>", P("Rozgłoszenie do kopii listy słuchaczy", "Dispatch over a copy of the listener list")],
             ["<code>clearScene(sceneId)</code>", P("Usuwa wszystkie subskrypcje sceny", "Removes every subscription of a scene")],
             ["<code>clearAll()</code>", P("Reset przy <code>destroy()</code>", "Reset on <code>destroy()</code>")],
         ]),
         ("h2", "Zdarzenia systemowe", "System events"),
         ("table", [P("Nazwa", "Name"), P("Payload", "Payload")], [
             ["<code>engine:started</code>", "<code>{ width, height }</code>"],
             ["<code>engine:stopped</code>", "—"],
             ["<code>engine:pause</code> / <code>engine:resume</code>", "—"],
             ["<code>engine:resize</code>", "<code>{ width, height }</code>"],
             ["<code>engine:update</code>", "<code>{ deltaTime, elapsed }</code>"],
             ["<code>scene:created</code> / <code>scene:start</code> / <code>scene:shutdown</code>", "<code>{ id }</code>"],
         ]),
         ("note", "tip", "Dlaczego kopia listy", "Why a copy",
          "<code>emit()</code> iteruje po kopii tablicy słuchaczy, więc odpięcie subskrypcji w trakcie obsługi zdarzenia nie psuje iteracji. To ta sama klasa błędów, która w naiwnych implementacjach gubi ostatniego słuchacza.",
          "<code>emit()</code> iterates a copy of the listener array, so unsubscribing inside a handler cannot break the iteration. It is the same class of bug that makes naive implementations drop the last listener."),
     ], "zdarzenia events eventbus on emit subscribe clearScene"),

page("debug", "basics", P("Debugowanie i profilowanie", "Debugging and profiling"),
     P("Cztery warstwy: liczby na overlayu, panel logów z filtrami, widoki przestrzenne i raport diagnostyczny do pliku — bez zależności zewnętrznych.",
       "Four layers: numbers on the overlay, a filterable log panel, spatial views and a diagnostic report you can save to a file — no external dependencies."),
     [
         ("h2", "Cztery warstwy", "Four layers"),
         ("p", "Debug w przeglądarce musi odpowiadać na trzy pytania: <b>czy to wolno działa</b>, <b>co się właśnie stało</b> i <b>gdzie to jest na ekranie</b>. Silnik rozdziela je na cztery niezależne warstwy, żeby jedna nie ciągnęła kosztu drugiej. Wyłączenie debugowania jednym wywołaniem <code>engine.setDebug(false)</code> gasi overlay, chowa panel logów, zatrzymuje profiler i czyści widoki — nie zostawia po sobie nasłuchujących timerów.",
          "Debugging in the browser has to answer three questions: <b>is it slow</b>, <b>what just happened</b> and <b>where is it on screen</b>. The engine splits them into four independent layers so that one never pays the cost of another. Turning debugging off with a single <code>engine.setDebug(false)</code> hides the overlay, hides the log panel, stops the profiler and clears the views — it leaves no listening timers behind."),
         ("table", [P("Warstwa", "Layer"), P("API", "API"), P("Co pokazuje", "What it shows"), P("Koszt, gdy wyłączona", "Cost when off")], [
             [P("Liczby", "Numbers"), "<code>engine.getDebugOverlay()</code>", P("fps, czas klatki, skala czasu, aktywna scena, obiekty, ciała, pary kolizji, pamięć, audio, najdroższe znaczniki", "fps, frame time, time scale, active scene, objects, bodies, collision pairs, memory, audio, the most expensive markers"), P("brak węzła DOM", "no DOM node at all")],
             ["Logi", "<code>engine.getLogger()</code><br><code>engine.getLogs()</code>", P("bufor 400 wpisów z poziomem, kontekstem i danymi", "a 400-entry buffer with level, context and payload"), P("panel nie rysuje", "the panel does not draw")],
             [P("Widoki", "Views"), "<code>engine.getDebugViews()</code>", P("obrysy colliderów, siatka, osie, granice kamery", "collider outlines, grid, axes, camera bounds"), P("warstwa grafiki pusta", "empty graphics layer")],
             [P("Raport", "Report"), "<code>engine.getDiagnostics()</code>", P("jeden JSON z całym stanem i listą <code>findings</code>", "one JSON with the whole state and a <code>findings</code> list"), P("serializacja tylko na żądanie", "serialised on demand only")],
         ]),
         ("note", "info", "Bufor logów działa zawsze", "The log buffer always runs", "Logi zbierają się nawet przy <code>debug: false</code>, bo panel i raport są tańsze niż odtworzenie sytuacji, w której użytkownik zgłosił błąd. Poziom <code>debug</code> jest wtedy wyciszony, więc do bufora trafia tylko <code>info</code> i wyżej.",
          "Logs are collected even with <code>debug: false</code>, because a panel and a report are cheaper than reconstructing the situation in which a user reported a bug. The <code>debug</code> level is muted then, so only <code>info</code> and above reach the buffer."),

         ("h2", "Overlay", "Overlay"),
         ("code", "TypeScript", """
const engine = createEngine({ parent: "game-container", debug: true });
const overlay = engine.getDebugOverlay();

overlay.setLabels({ objects: "obiekty", bodies: "ciała", pairs: "pary" });
overlay.getLines();
overlay.getFps();
overlay.getMemory();

engine.setDebug(true);
engine.setDebug(false);
"""),
         ("p", "Linie overlayu powstają w kolejności: fps i czas klatki, przejście czasu rzeczywistego w grę, scena z licznikami, pamięć, stan audio, najdroższe znaczniki profilera i dowolne linie dopisane przez grę. Format jest tekstowy, więc da się go porównać w teście lub wysłać razem ze zgłoszeniem błędu.",
          "Overlay lines are produced in order: fps and frame time, real-to-game time conversion, scene with counters, memory, audio state, the most expensive profiler markers and any lines the game added. The format is plain text, so it can be compared in a test or attached to a bug report."),
         ("table", [P("Linia", "Line"), P("Przykład", "Example"), P("Skąd", "Source")], [
             [P("fps i czas klatki", "fps and frame time"), "<code>62 fps · 16.67 ms</code>", P("średnia z okna 500 ms", "average over a 500 ms window")],
             [P("czas rzeczywisty → gra", "real time → game"), "<code>frame 16.67 ms → 8.33 ms · x2.00</code>", "<code>realDeltaTime</code>, <code>deltaTime</code>, <code>timeScale</code>"],
             [P("Scena", "Scene"), "<code>scene game · 81 objects · 22 bodies · 9 pairs</code>", P("rejestr sceny i statystyki fizyki", "scene registry and physics stats")],
             [P("Pamięć", "Memory"), "<code>memory 13.6 MB / 1020.4 MB</code>", "<code>performance.memory</code>"],
             ["Audio", "<code>audio on · 1 h · 0 q</code>", P("uchwyty i kolejka autoplay", "handles and the autoplay queue")],
             ["Prof", "<code>prof engine.scene 0.42 ms · tweens 0.11 ms</code>", "<code>Profiler</code>"],
         ]),
         ("note", "warn", "Pamięć nie w każdej przeglądarce", "Memory is not in every browser", "<code>performance.memory</code> istnieje w Chromium i nie jest standardem. W Firefoksie i Safari overlay pokaże <code>n/a</code> zamiast zera — celowo, bo zero sugerowałoby, że pamięć jest zmierzona.",
          "<code>performance.memory</code> exists in Chromium and is not a standard. In Firefox and Safari the overlay prints <code>n/a</code> instead of zero — deliberately, because zero would suggest the memory was measured."),

         ("h2", "Logi: poziomy, kontekst, sinki", "Logs: levels, context, sinks"),
         ("code", "TypeScript", """
const logger = engine.getLogger();
const detach = logger.addSink((entry) => metrics.push(entry));

logger.debug("booting", { width: 1280 });
logger.info("scene registered", { id: "menu" });

const sceneLogger = logger.child("game");
sceneLogger.warn("asset missing, using fallback", { id: "coin" });

detach();
logger.sinkCount();
"""),
         ("p", "Każdy wpis ma <code>id</code>, <code>time</code>, <code>level</code>, <code>context</code>, <code>message</code> i opcjonalne <code>data</code>. Wyjątek rzucony w sinku nie przerywa pętli logowania — leci do konsoli jako <code>Log sink failed</code>, a pozostałe sinki dostają wpis. To ta sama zasada izolacji, co w <code>EventBus</code>.",
          "Every entry has <code>id</code>, <code>time</code>, <code>level</code>, <code>context</code>, <code>message</code> and optional <code>data</code>. An exception thrown inside a sink does not break the logging loop — it is reported to the console as <code>Log sink failed</code> and the remaining sinks still receive the entry. It is the same isolation rule as in <code>EventBus</code>."),
         ("table", [P("Metoda", "Method"), P("Zwraca", "Returns"), P("Zachowanie", "Behaviour")], [
             ["<code>debug/info/warn/error</code>", "<code>void</code>", P("Poniżej progu nic nie robi — zero alokacji wpisu", "Below the threshold nothing happens — no entry is allocated")],
             ["<code>child(context)</code>", "<code>Logger</code>", P("Współdzieli sinki i próg, prefiksuje kontekst", "Shares sinks and threshold, prefixes the context")],
             ["<code>addSink(fn)</code>", "<code>() =&gt; void</code>", P("Zwraca funkcję odpinającą", "Returns an unsubscribe function")],
             ["<code>sinkCount()</code>", "<code>number</code>", P("Ile sinków jest podpiętych", "How many sinks are attached")],
             ["<code>setLevel/getLevel</code>", "<code>void</code> / <code>LogLevel</code>", P("Próg dla tego loggera i jego dzieci", "Threshold for this logger and its children")],
         ]),

         ("h2", "Panel logów z filtrami", "The filterable log panel"),
         ("code", "TypeScript", """
const panel = engine.getLogPanel();

engine.setDebug(true);

panel.setFilter({ levels: ["warn", "error"], context: "game", text: "asset" });
panel.toggleLevel("info");
panel.setLabels({ title: "Logi", filter: "Filtruj…", clear: "Wyczyść", empty: "Brak wpisów" });
panel.isVisible();
"""),
         ("table", [P("Filtr", "Filter"), P("Typ", "Type"), P("Znaczenie", "Meaning")], [
             ["<code>minLevel</code>", "<code>LogLevel</code>", P("Od tego poziomu w górę", "That level and above")],
             ["<code>levels</code>", "<code>LogLevel[]</code>", P("Dokładny zbiór poziomów; nadpisuje <code>minLevel</code>", "Exact set of levels; overrides <code>minLevel</code>")],
             ["<code>context</code>", "<code>string</code>", P("Fragment kontekstu, bez wielkości liter", "Context fragment, case-insensitive")],
             ["<code>text</code>", "<code>string</code>", P("Szuka w treści, kontekście i <code>data</code>", "Searches message, context and <code>data</code>")],
         ]),
         ("note", "tip", "Panel nie miga", "The panel does not flicker", "Odświeżanie jest dławione do 120 ms i pomijane, gdy wersja bufora się nie zmieniła. Kliknięcie poziomu wymusza przerysowanie natychmiast, więc filtr reaguje w tej samej klatce, w której go ustawiono.",
          "Refreshes are throttled to 120 ms and skipped when the buffer version has not changed. Clicking a level forces an immediate redraw, so the filter reacts in the frame it was set."),

         ("h2", "Widoki: collidery, siatka, osie, granice kamery", "Views: colliders, grid, axes, camera bounds"),
         ("code", "TypeScript", """
const views = engine.getDebugViews();

views.set({ colliders: true, grid: true, gridSize: 32 });
views.toggle("axes");
views.get();
views.getSupport();
views.sync();
views.clear();
"""),
         ("table", [P("Klucz", "Key"), P("Co rysuje", "What it draws"), P("Uwagi", "Notes")], [
             ["<code>colliders</code>", P("Obrysy wszystkich ciał fizyki", "Outlines of every physics body"), P("aktywne i nieaktywne ciała, kolorem typu", "active and inactive bodies, coloured by type")],
             ["<code>grid</code>", P("Siatkę co <code>gridSize</code> pikseli", "A grid every <code>gridSize</code> pixels"), P("kotwiczona w punkcie 0,0 świata", "anchored at world 0,0")],
             ["<code>axes</code>", P("Osie X i Y przez początek świata", "X and Y axes through the world origin"), P("pomaga przy odwróconej skali", "helps with a flipped scale")],
             ["<code>cameraBounds</code>", P("Prostokąt granic kamery", "The camera bounds rectangle"), P("widać różnicę względem granic fizyki", "shows the difference from physics bounds")],
         ]),
         ("note", "warn", "Wsparcie zależy od adaptera", "Support depends on the adapter", "<code>getSupport()</code> mówi, które widoki adapter potrafi narysować. Adapter Phasera potrafi wszystkie cztery; atrapa w testach deklaruje własny zestaw, więc kod gry nie zakłada, że widok istnieje.",
          "<code>getSupport()</code> reports which views the adapter can draw. The Phaser adapter can draw all four; the test double declares its own set, so game code never assumes a view exists."),

         ("h2", "Ostrzeżenia o zasobach", "Asset warnings"),
         ("code", "TypeScript", """
const scene = engine.getScenes().getActiveScene();

const diagnosis = engine.getAssets().diagnose({
  usedIds: scene?.getDeclaredAssetIds() ?? [],
  references: { project: project.assets.map((asset) => asset.id) },
});

diagnosis.unused;
diagnosis.missing;
diagnosis.failed;
diagnosis.unlicensed;
diagnosis.heaviest;
"""),
         ("table", [P("Pole", "Field"), P("Znaczenie", "Meaning")], [
             ["<code>unused</code>", P("Zarejestrowane, ale nie deklarowane przez żadną scenę — ważą w bundlu bez powodu", "Registered but not declared by any scene — they weigh on the bundle for nothing")],
             ["<code>missing</code>", P("Scena albo projekt odwołuje się do nieistniejącego <code>id</code>", "A scene or the project references an unknown <code>id</code>")],
             ["<code>failed</code>", P("Ładowanie zakończyło się błędem i nie zostało ponowione", "Loading failed and was not retried")],
             ["<code>unlicensed</code>", P("Brak wpisu <code>license</code> — wymagane przy <code>requireLicenses</code>", "No <code>license</code> entry — required with <code>requireLicenses</code>")],
             ["<code>heaviest</code>", P("Największe zasoby po <code>bytes</code> lub rozmiarze data URI", "Largest assets by <code>bytes</code> or data-URI size")],
         ]),
         ("note", "ok", "Dlaczego to nie jest tylko kosmetyka", "Why this is not cosmetic", "Nieużywany zasób to kilobajty wysyłane każdemu graczowi, a brak licencji to problem prawny wykryty po wydaniu. Raport liczy rozmiar także z data URI, więc wpis bez zadeklarowanego <code>bytes</code> nie znika z zestawienia jako „nieznany”.",
          "An unused asset is kilobytes shipped to every player, and a missing licence is a legal problem discovered after release. The report also measures data-URI payloads, so an entry without an explicit <code>bytes</code> does not slip out of the summary as “unknown”."),

         ("h2", "Znaczniki profilera", "Profiler markers"),
         ("code", "TypeScript", """
const profiler = engine.getProfiler();

profiler.begin("ai.pathfinding");
this.computePaths();
profiler.end("ai.pathfinding");

profiler.record("serialize", 1.4);

const snapshot = profiler.snapshot();
snapshot.fps;
snapshot.frameTime;
snapshot.stats[0];
"""),
         ("table", [P("Znacznik", "Marker"), P("Mierzy", "Measures")], [
             ["<code>engine.time</code>", P("Aktualizację zegara i clamp", "Clock update and clamp")],
             ["<code>engine.scheduler</code>", P("Zadania opóźnione i interwały", "Delayed tasks and intervals")],
             ["<code>engine.input</code>", P("Odczyt wejścia, akcje, pointer", "Input read, actions, pointer")],
             ["<code>engine.fixed</code>", P("Wszystkie kroki stałe w klatce", "Every fixed step in the frame")],
             ["<code>engine.plugins</code>", P("Systemy wszystkich aktywnych pluginów", "Systems of every active plugin")],
             ["<code>engine.scene</code>", P("Całą fazę scen: fizyka, tweeny, komponenty, <code>update</code>, sync renderu", "The whole scene phase: physics, tweens, components, <code>update</code>, render sync")],
             ["<code>physics.readback</code>", P("Odczyt pozycji z ciał fizyki do transformacji", "Reading body positions back into transforms")],
             ["<code>tweens</code>", P("Aktualizację tweenów sceny", "Scene tween update")],
             ["<code>components</code>", P("Komponenty w kolejności faz", "Components in phase order")],
             ["<code>destroy</code>", P("Sprzątanie obiektów oznaczonych do usunięcia", "Cleanup of objects queued for destruction")],
             ["<code>render.sync</code>", P("Przeniesienie transformacji do warstwy renderu", "Pushing transforms to the render layer")],
         ]),
         ("note", "tip", "Koszt, gdy profiler jest wyłączony", "Cost when the profiler is off", "<code>begin</code> i <code>end</code> zwracają się natychmiast, gdy profiler jest wyłączony, więc znaczniki mogą zostać w kodzie na stałe. Włączasz go przez <code>debug: true</code> w konfiguracji albo <code>engine.getProfiler().setEnabled(true)</code>.",
          "<code>begin</code> and <code>end</code> return immediately when the profiler is disabled, so markers can stay in the code permanently. Enable it with <code>debug: true</code> in the config or <code>engine.getProfiler().setEnabled(true)</code>."),

         ("h2", "Raport diagnostyczny", "The diagnostic report"),
         ("code", "TypeScript", """
const diagnostics = engine.getDiagnostics();

diagnostics.report();
diagnostics.toJSON();
await diagnostics.copy();
diagnostics.download();

engine.getDiagnosticsReport().findings;
"""),
         ("table", [P("Sekcja", "Section"), P("Zawartość", "Content")], [
             ["<code>engine</code>", P("Wersja silnika, nazwa adaptera, stan cyklu życia", "Engine version, adapter name, lifecycle state")],
             ["<code>config</code>, <code>time</code>", P("Surowa konfiguracja i pełny stan zegara", "Raw config and the full clock state")],
             ["<code>scene</code>", P("Aktywna scena, liczba obiektów, grupy, animacje, deklarowane zasoby", "Active scene, object count, groups, animations, declared assets")],
             ["<code>assets</code>", P("Raport pipeline'u plus wynik <code>diagnose()</code>", "Pipeline report plus the <code>diagnose()</code> result")],
             ["<code>audio</code>, <code>physics</code>, <code>wasm</code>", P("Kanały i kolejka, ciała i pary, stan modułu", "Channels and queue, bodies and pairs, module state")],
             ["<code>profiler</code>, <code>logs</code>, <code>memory</code>", P("Migawka profilera, podsumowanie logów, pamięć", "Profiler snapshot, log summary, memory")],
             ["<code>plugins</code>", P("Liczniki, stany i audyt uprawnień pluginów", "Counts, states and the plugin permission audit")],
             ["<code>environment</code>", P("Przeglądarka, język, DPI, viewport, rdzenie, kontekst bezpieczny", "Browser, language, DPI, viewport, cores, secure context")],
             ["<code>findings</code>", P("Gotowe wnioski z kodem i wagą", "Ready-made findings with a code and a severity")],
         ]),
         ("table", [P("Kod wniosku", "Finding code"), P("Kiedy", "When")], [
             ["<code>assets-failed</code> / <code>assets-missing</code> / <code>assets-unused</code> / <code>assets-unlicensed</code>", P("Zasoby: błąd, brak referencji, brak użycia, brak licencji", "Assets: failure, dangling reference, no usage, no licence")],
             ["<code>audio-detached</code> / <code>audio-locked</code> / <code>audio-pending</code>", P("Brak backendu audio, brak gestu użytkownika, kolejka autoplay", "No audio backend, no user gesture yet, autoplay queue")],
             ["<code>wasm-failed</code>", P("Moduł WASM nie wstał i działa fallback TypeScript", "The WASM module did not start and the TypeScript fallback is running")],
             ["<code>frame-rate-low</code>", P("poniżej 30 fps w oknie pomiaru", "below 30 fps over the measurement window")],
             ["<code>logs-error</code>", P("W buforze są wpisy poziomu <code>error</code>", "The buffer contains <code>error</code> entries")],
             ["<code>scene-empty</code>", P("Aktywna scena nie ma obiektów po <code>create()</code>", "The active scene has no objects after <code>create()</code>")],
             ["<code>memory-high</code>", P("Zajęta pamięć przekracza próg", "Used memory exceeds the threshold")],
             ["<code>insecure-context</code>", P("Strona nie działa po HTTPS lub na <code>localhost</code>", "The page is not served over HTTPS or from <code>localhost</code>")],
         ]),
         ("note", "info", "Raport nie zgaduje sprzętu", "The report does not guess hardware", "W raporcie są liczniki, wersje i środowisko, ale nie ma deklaracji typu „ta gra działa w 60 fps na X”. Taki wniosek wymaga pomiaru na konkretnej maszynie, więc silnik podaje dane wejściowe, a nie obietnice.",
          "The report carries counters, versions and environment, but it never states “this game runs at 60 fps on X”. That claim requires a measurement on a specific machine, so the engine ships inputs, not promises."),

         ("h2", "Klawisze w playgroundzie", "Hotkeys in the playground"),
         ("table", [P("Klawisz", "Key"), P("Działanie", "Action")], [
             ["<code>U</code>", P("Overlay z liczbami", "Overlay with numbers")],
             ["<code>L</code>", P("Panel logów", "Log panel")],
             ["<code>K</code>", P("Obrysy colliderów", "Collider outlines")],
             ["<code>G</code>", P("Siatka", "Grid")],
             ["<code>X</code>", P("Osie", "Axes")],
             ["<code>B</code>", P("Granice kamery", "Camera bounds")],
             ["<code>Y</code>", P("Pobranie raportu diagnostycznego", "Download the diagnostic report")],
         ]),
         ("note", "ok", "Wszystko na publicznym API", "Everything through the public API", "Playground nie sięga do wnętrza adaptera: panel, widoki i raport są zwykłymi metodami <code>Engine</code>. Dzięki temu te same wywołania działają w grze poza playgroundem i w teście jednostkowym.",
          "The playground never reaches into the adapter: the panel, the views and the report are ordinary <code>Engine</code> methods. The same calls therefore work in a game outside the playground and in a unit test."),
     ], "debug debugowanie logger poziomy overlay fps logi panel filtry collidery siatka osie granice kamery profiler diagnostyka raport zasoby ostrzezenia")

page("api-engine", "api", P("Engine", "Engine"), P("Punkt wejścia silnika: konfiguracja, sceny, cykl życia i dostęp do managerów.", "Engine entry point: configuration, scenes, lifecycle and manager access."),
     [
         ("code", "TypeScript", """
// punkt kompozycji: Engine dostaje fabrykę adaptera, więc rdzeń nie zna Phasera
const engine = createEngine({ parent: "game-container" });

class Engine {
  constructor(options: EngineOptions, adapterFactory: AdapterFactory);

  registerScene(scene: Scene): this;
  getScenes(): SceneManager;

  start(initialSceneId?: string, data?: unknown): this;
  startScene(id: string, data?: unknown): void;
  stopScene(id: string): void;
  getActiveScene(): Scene | null;

  pause(): void;
  resume(): void;
  setTimeScale(scale: number): this;
  stop(): void;
  destroy(): void;

  setDebug(enabled: boolean): void;

  getEvents(): EventBus;
  getInput(): InputManager;
  getAssets(): AssetManager;
  getPhysics(): PhysicsManager;
  getCamera(): CameraManager;
  getTime(): Time;
  getTimer(): Timer;
  getScheduler(): Scheduler;
  getRandom(): Random;
  getWasm(): WasmBridge;
  getLogger(): Logger;

  getProfiler(): Profiler;
  getLogs(): LogBuffer;
  getLogPanel(): LogPanel;
  getDebugOverlay(): DebugOverlay;
  getDebugViews(): DebugViews;
  getDiagnostics(): Diagnostics;
  getDiagnosticsReport(): DiagnosticsReport;
}
"""),
         ("note", "info", "Punkt kompozycji", "Composition root",
          "<code>Engine</code> nie importuje Phasera. <code>createEngine()</code> to gotowa fabryka z <code>createPhaserAdapter</code>; własny runtime to funkcja <code>(config, deps) =&gt; RuntimeAdapter</code> przekazana do konstruktora. Dlatego cykl życia silnika da się przetestować na atrapie adaptera (test <code>Engine.test.ts</code>).",
          "<code>Engine</code> does not import Phaser. <code>createEngine()</code> is a ready factory using <code>createPhaserAdapter</code>; a custom runtime is a <code>(config, deps) =&gt; RuntimeAdapter</code> function passed to the constructor. That is why the engine lifecycle can be tested against a fake adapter (<code>Engine.test.ts</code>)."),
         ("table", [P("Metoda", "Method"), P("Zwraca", "Returns"), P("Uwagi", "Notes")], [
             ["<code>registerScene</code>", "<code>this</code>", P("Duplikat <code>id</code> → <code>Error</code>", "Duplicate <code>id</code> → <code>Error</code>")],
             ["<code>start</code>", "<code>this</code>", P("Tworzy Phasera raz; kolejne wywołanie tylko przełącza", "Creates Phaser once; further calls only switch")],
             ["<code>startScene</code>", "<code>void</code>", P("Shutdown poprzedniej sceny", "Shuts down the previous scene")],
             ["<code>pause/resume</code>", "<code>void</code>", P("Idempotentne; zatrzymują zegar gry i pętlę", "Idempotent; freeze the game clock and the loop")],
             ["<code>setTimeScale</code>", "<code>this</code>", P("Emituje <code>engine:timeScale</code>", "Emits <code>engine:timeScale</code>")],
             ["<code>getTimer</code>", "<code>Timer</code>", P("Właściciel <code>engine</code>; zadania czyszczone w <code>destroy()</code>", "Owner <code>engine</code>; tasks cleared in <code>destroy()</code>")],
             ["<code>getScheduler</code>", "<code>Scheduler</code>", P("Wspólna kolejka zadań całego silnika", "The single task queue of the engine")],
             ["<code>getRandom</code>", "<code>Random</code>", P("Seed z konfiguracji, jeden strumień na silnik", "Seeded from the config, one stream per engine")],
             ["<code>getDebugOverlay</code>", "<code>DebugOverlay</code>", P("Liczby na ekranie; <code>getLines()</code> zwraca je jako tekst", "On-screen numbers; <code>getLines()</code> returns them as text")],
             ["<code>getLogs</code>", "<code>LogBuffer</code>", P("Bufor 400 wpisów; zawsze zbiera", "A 400-entry buffer; always collecting")],
             ["<code>getLogPanel</code>", "<code>LogPanel</code>", P("Panel DOM z filtrami; montowany w kontenerze gry", "DOM panel with filters; mounted in the game container")],
             ["<code>getDebugViews</code>", "<code>DebugViews</code>", P("Collidery, siatka, osie, granice kamery", "Colliders, grid, axes, camera bounds")],
             ["<code>getProfiler</code>", "<code>Profiler</code>", P("Znaczniki systemów silnika i własne", "Engine system markers plus your own")],
             ["<code>getDiagnosticsReport</code>", "<code>DiagnosticsReport</code>", P("Skrót: <code>getDiagnostics().report()</code>", "Shorthand for <code>getDiagnostics().report()</code>")],
             ["<code>stop</code>", "<code>void</code>", P("Woła <code>adapter.destroy()</code>, zdejmuje listenery", "Calls <code>adapter.destroy()</code>, removes listeners")],
             ["<code>destroy</code>", "<code>void</code>", P("<code>stop</code> + czyszczenie rejestrów", "<code>stop</code> + registry cleanup")],
         ]),
     ], "api engine konstruktor metody register start stop destroy"),

page("api-scene", "api", P("Scene", "Scene"), P("Klasa bazowa scen: cykl życia, fabryki obiektów i dostęp do managerów.", "Scene base class: lifecycle, object factories and manager access."),
     [
         ("code", "TypeScript", """
abstract class Scene {
  readonly id: string;

  declareAssets(assets: AssetDescriptor[]): void;

  preload?(): void | Promise<void>;
  abstract create(): void | Promise<void>;
  update?(deltaTime: number): void;
  shutdown?(): void;

  createObject(options?: GameObjectOptions): GameObject;
  createSprite(textureId: string, options?: SpriteOptions): GameObject;
  createText(text: string, options?: TextOptions): GameObject;
  createRect(width: number, height: number, options: ShapeOptions): GameObject;
  createEllipse(radius: number, options: ShapeOptions): GameObject;

  destroyObject(target: GameObject | string): boolean;
  destroyAllObjects(): void;
  activateObject(target: GameObject | string): void;
  deactivateObject(target: GameObject | string): void;

  getObject<T extends GameObject>(id: string): T | undefined;
  getObjects(): GameObject[];
  objectCount(): number;
  find(predicate: ObjectPredicate): GameObject | undefined;
  findAll(predicate: ObjectPredicate): GameObject[];
  findByName(name: string): GameObject | undefined;
  findByTag(tag: string): GameObject[];
  findByTags(tags: readonly string[], mode?: TagFilterMode): GameObject[];
  group(name: string): Group;
  getGroupMembers(name: string): GameObject[];
  getSystemOrder(): readonly string[];

  getInput(): InputManager;
  getPhysics(): PhysicsManager;
  getCamera(): CameraManager;
  getAssets(): AssetManager;
  getAudio(): AudioManager;
  getTweens(): TweenManager;
  getEvents(): EventBus;
  getTime(): Time;
  getLogger(): Logger;

  tween(target: object, props: Record<string, number>, options?: TweenOptions): Tween;
  tweenFrom(target: object, props: Record<string, number>, options?: TweenOptions): Tween;
  tweenSequence(steps: TweenStep[], options?: SequenceOptions): TweenSequence;
  delay(seconds: number, onComplete?: (tween: Tween) => void, options?: TweenOptions): Tween;

  playSound(assetId: string, options?: PlaySoundOptions): SoundHandle | null;
  playMusic(assetId: string, options?: PlaySoundOptions): SoundHandle | null;
  stopMusic(): void;
  stopSounds(owner?: string): number;
  setChannelVolume(channel: AudioChannel, value: number): void;

  playAnimation(target: GameObject | string, key: string, options?: AnimationPlayOptions): boolean;
  stopAnimation(target: GameObject | string, key?: string): void;
  pauseAnimation(target: GameObject | string, paused?: boolean): void;
  setFrame(target: GameObject | string, frame: number | string): boolean;
  getAnimationState(target: GameObject | string): AnimationState | null;
}
"""),
         ("note", "tip", "Stan sceny", "Scene state",
          "Rejestr obiektów, indeksy tagów, subskrypcje eventów, tweeny i dźwięki sceny są czyszczone przy <code>shutdown()</code>. W trakcie życia sceny usuwaj obiekty przez <code>destroyObject()</code> — w środku <code>update()</code> żądanie trafia do kolejki i jest realizowane po zakończeniu klatki.",
           "The object registry, tag indexes, event subscriptions, scene-owned tweens and sounds are cleared on <code>shutdown()</code>. During the scene's lifetime remove objects through <code>destroyObject()</code> — inside <code>update()</code> the request is queued and fulfilled after the frame ends."),
     ], "api scene klasa metody fabryki"),

page("api-object", "api", P("GameObject i pochodne", "GameObject and subclasses"), P("Model obiektów: stan, transformacja i komponenty.", "Object model: state, transform and components."),
     [
         ("code", "TypeScript", """
class GameObject {
  readonly id: string;
  name: string;
  readonly tags: Set<string>;
  readonly groups: Set<string>;
  readonly transform: Transform;
  readonly children: GameObject[];
  parent: GameObject | null;
  render: RenderDescriptor | null;
  body: BodyDescriptor | null;
  visible: boolean;
  active: boolean;
  alpha: number;
  depth: number;
  readonly world: Transform;

  setPosition(x: number, y: number): this;
  setRotation(radians: number): this;
  setScale(x: number, y?: number): this;
  setVisible(value: boolean): this;
  setActive(value: boolean): this;
  setAlpha(value: number): this;
  setDepth(value: number): this;
  setRender(render: RenderDescriptor | null): this;

  addTag(tag: string): this;
  removeTag(tag: string): this;
  hasTag(tag: string): boolean;
  hasAnyTag(tags: readonly string[]): boolean;
  hasAllTags(tags: readonly string[]): boolean;

  addChild(child: GameObject): this;
  removeChild(child: GameObject): boolean;

  add<T extends Component>(component: T): T;
  get<T extends Component>(ctor: ComponentClass<T>): T | undefined;
  has(ctor: ComponentClass): boolean;
  remove(ctor: ComponentClass): boolean;
  getComponents(): Component[];

  destroy(): void;
}
"""),
         ("table", [P("Element", "Element"), P("Kiedy używać", "When to use")], [
             ["<code>GameObject</code>", P("Każdy byt sceny: gracz, ściana, HUD, znacznik", "Every scene entity: player, wall, HUD, marker")],
             ["<code>tags</code>", P("Zapytania grupowe i trigger bez własnych list", "Group queries and triggers without own lists")],
             ["<code>children</code>", P("Broń w dłoni, HUD w kamerze, efekty nad jednostką", "A weapon in hand, HUD on camera, effects over a unit")],
             ["<code>Component</code>", P("Zachowanie i stan doklejany do obiektu", "Behaviour and state attached to an object")],
         ]),
     ], "api gameobject sprite text group komponenty transform"),

page("api-managers", "api", P("Managery", "Managers"), P("Input, fizyka, kamera, zasoby — sygnatury i kontrakty.", "Input, physics, camera, assets — signatures and contracts."),
     [
         ("h2", "InputManager", "InputManager"),
         ("code", "TypeScript", """
isKeyDown(code: string): boolean;
isKeyPressed(code: string): boolean;
isKeyReleased(code: string): boolean;

isActionDown(action: string): boolean;
isActionPressed(action: string): boolean;
isActionReleased(action: string): boolean;

getPointer(): PointerState;
getPointerPosition(): { x: number; y: number };
getPointerWorldPosition(): { x: number; y: number };

getActionMap(): Record<string, string[]>;
setActionMap(map: Record<string, string[]>): void;
remapAction(action: string, codes: string[]): void;
"""),
         ("h2", "PhysicsManager", "PhysicsManager"),
         ("code", "TypeScript", """
setWorldBounds(x: number, y: number, width: number, height: number): void;
addCollider(a: unknown, b: unknown, callback?: ColliderCallback): void;
addOverlap(a: unknown, b: unknown, callback?: ColliderCallback): void;
setImmovable(target: unknown, immovable: boolean): void;
setVelocity(target: unknown, x: number, y: number): void;
setCollideWorldBounds(target: unknown, enabled: boolean): void;
setBounce(target: unknown, value: number): void;
"""),
         ("h2", "CameraManager", "CameraManager"),
         ("code", "TypeScript", """
follow(target: GameObject | null, lerpX?: number, lerpY?: number): void;
stopFollow(): void;
setBounds(x: number, y: number, width: number, height: number): void;
setZoom(zoom: number): void;
getZoom(): number;
getCenter(): { x: number; y: number };
setBackgroundColor(color: string | number): void;
worldToScreen(x: number, y: number): { x: number; y: number };

shake(durationMs?: number, intensity?: number): void;
flash(durationMs?: number, red?: number, green?: number, blue?: number): void;
fadeIn(durationMs?: number, red?: number, green?: number, blue?: number): void;
fadeOut(durationMs?: number, red?: number, green?: number, blue?: number): void;
resetEffects(): void;
supportsEffects(): boolean;
"""),
         ("h2", "AudioManager", "AudioManager"),
         ("code", "TypeScript", """
// odtwarzanie
play(assetId: string, options?: PlaySoundOptions): SoundHandle | null;
playMusic(assetId: string, options?: PlaySoundOptions): SoundHandle | null;
stopMusic(): void;
getMusic(): SoundHandle | null;
stop(handle: SoundHandle | null): boolean;
stopAsset(assetId: string): number;
stopOwner(owner: string): number;
stopAll(): void;

// głośność i wyciszenie
setVolume(channel: "master" | "music" | "sfx" | "ui", value: number): void;
setMasterVolume(value: number): void;
getVolume(channel?: "master" | "music" | "sfx" | "ui"): number;
getVolumes(): Record<AudioChannel, number>;
setMuted(muted: boolean): void;
mute(): void;
unmute(): void;
toggleMute(): boolean;
isMuted(): boolean;

// autoplay i cykl życia
isUnlocked(): boolean;
unlock(): boolean;
onUnlock(listener: (unlocked: boolean) => void): () => void;
getPendingCount(): number;
pauseAll(): void;
resumeAll(): void;
isPaused(): boolean;
getState(): AudioState;
attach(port: AudioPort): void;
detach(): void;
isAttached(): boolean;

// SoundHandle
handle.stop(): void;
handle.setVolume(volume: number): void;
handle.statusName; // "pending" | "playing" | "stopped"
handle.effectiveVolume;
handle.owner;
"""),
         ("h2", "TweenManager", "TweenManager"),
         ("code", "TypeScript", """
to(target: object, props: Record<string, number>, options?: TweenOptions): Tween;
from(target: object, props: Record<string, number>, options?: TweenOptions): Tween;
delay(seconds: number, onComplete?: (tween: Tween) => void, options?: TweenOptions): Tween;
sequence(steps: TweenStep[], options?: SequenceOptions): TweenSequence;
update(deltaTime: number): void;
pause(): void;
resume(): void;
cancel(tween: Tween): boolean;
stopOwner(owner: string): number;
stopAll(): void;
readonly size: number;
readonly sequenceCount: number;
readonly activeCount: number;
readonly isPaused: boolean;

// Tween
pause(): this; resume(): this; cancel(): this; complete(): this; restart(): this;
readonly progress: number;
readonly totalProgress: number;
readonly values: Record<string, number>;
readonly isPlaying: boolean;
readonly isFinished: boolean;
readonly stateName: "idle" | "running" | "paused" | "completed" | "cancelled";
"""),
         ("h2", "AssetManager", "AssetManager"),
         ("code", "TypeScript", """
// deklaracja i stan
declare(assets: AssetDescriptor[]): void;
register(descriptor: AssetDescriptor): AssetDescriptor;
getManifest(): AssetManifest;
getAll(): AssetDescriptor[];
status(id: string): AssetStatus;            // idle | queued | loading | ready | failed
isLoaded(id: string): boolean;
hasTexture(id: string): boolean;

// ładowanie
load(ids?: string[]): void;
retry(ids?: string[]): string[];
cancel(): boolean;
onLoad(handler: (id: string) => void): () => void;
onError(handler: (error: AssetLoadError) => void): () => void;

// zwalnianie
hold(owner: string, ids: string[]): void;
releaseOwner(owner: string): number;
retain(id: string): void;
release(id: string): number;
releaseGroup(group: string): number;
gc(): string[];
unload(id: string): void;

// raporty
validate(options?: { requireLicenses?: boolean }): AssetIssue[];
report(): AssetPipelineReport;
sizeReport(limits?: Partial<AssetSizeLimits>): AssetSizeReport;
formatSizes(): string[];
diagnose(options?: { usedIds?: Iterable<string>; references?: AssetReferenceMap }): AssetDiagnostics;
"""),
     ], "api managery input physics camera assets sygnatury"),

page("api-bus", "api", P("EventBus, Logger, WasmBridge", "EventBus, Logger, WasmBridge"), P("Pozostałe klasy publiczne z pełnymi sygnaturami.", "The remaining public classes with full signatures."),
     [
         ("h2", "EventBus", "EventBus"),
         ("code", "TypeScript", """
on<T>(event: string, handler: (payload: T) => void): () => void;
subscribeForScene<T>(sceneId: string, event: string, handler: (payload: T) => void): () => void;
emit<T>(event: string, payload: T): void;
clearScene(sceneId: string): void;
clearAll(): void;
listenerCount(event: string): number;
"""),
         ("h2", "Logger", "Logger"),
         ("code", "TypeScript", """
type LogLevel = "debug" | "info" | "warn" | "error";

new Logger(context: string, minLevel?: LogLevel);
debug(message: string, data?: unknown): void;
info(message: string, data?: unknown): void;
warn(message: string, data?: unknown): void;
error(message: string, data?: unknown): void;
child(context: string): Logger;
"""),
         ("h2", "Scheduler", "Scheduler"),
         ("code", "TypeScript", """
delay(seconds: number, callback: () => void, options?: TaskOptions): TaskHandle;
interval(seconds: number, callback: () => void, options?: TaskOptions): TaskHandle;
update(deltaTime: number): void;
cancel(handle: TaskHandle): void;
cancelOwner(owner: string): number;
clear(): void;
has(id: number): boolean;
count(owner?: string): number;
readonly errorCount: number;
"""),
         ("h2", "Timer", "Timer"),
         ("code", "TypeScript", """
new Timer(scheduler: Scheduler, owner: string);
delay(seconds: number, callback: () => void, options?: TimerOptions): TaskHandle;
interval(seconds: number, callback: () => void, options?: TimerOptions & { repeat?: number }): TaskHandle;
cancel(handle: TaskHandle): void;
clear(): number;
readonly pending: number;
"""),
         ("h2", "Random", "Random"),
         ("code", "TypeScript", """
new Random(seed?: number);
next(): number;
float(min?: number, max?: number): number;
int(min: number, max: number): number;
bool(probability?: number): boolean;
sign(): -1 | 1;
pick<T>(items: readonly T[]): T;
shuffle<T>(items: readonly T[]): T[];
saveState(): number;
loadState(state: number): this;
reset(): this;
fork(salt: string | number): Random;
readonly seed: number;
"""),
         ("h2", "WasmBridge", "WasmBridge"),
         ("code", "TypeScript", """
load(): Promise<boolean>;
isReady(): boolean;
call<T>(name: string, ...args: unknown[]): T;
dispose(): void;
"""),
         ("note", "tip", "Zachowanie bez WASM", "Behaviour without WASM",
          "Gdy <code>required: false</code>, <code>load()</code> zwraca <code>false</code> zamiast rzucać, a <code>call()</code> zwraca <code>undefined</code>. Gra działa dalej na ścieżce TypeScript — brak modułu nie jest błędem krytycznym.",
          "With <code>required: false</code>, <code>load()</code> returns <code>false</code> instead of throwing and <code>call()</code> returns <code>undefined</code>. The game keeps running on the TypeScript path — a missing module is not fatal."),
     ], "api eventbus logger wasmbridge scheduler timer random sygnatury"),

page("api-debug", "api", P("Debug i diagnostyka", "Debug and diagnostics"), P("Pełne sygnatury klas debugowania: overlay, bufor logów, panel, widoki, profiler i raport.", "Full signatures of the debugging classes: overlay, log buffer, panel, views, profiler and report."),
     [
         ("h2", "DebugOverlay", "DebugOverlay"),
         ("code", "TypeScript", """
new DebugOverlay(enabled?: boolean, labels?: Partial<OverlayLabels>);
mount(parent: HTMLElement): void;
setEnabled(enabled: boolean): void;
isEnabled(): boolean;
setActiveScene(name: string): void;
setExtra(lines: string[]): void;
setStats(stats: OverlayStats): void;
setLabels(labels: Partial<OverlayLabels>): void;
update(timeMs: number): void;
getFps(): number;
getMemory(): MemoryInfo | null;
getLines(): string[];
unmount(): void;
destroy(): void;

// OverlayStats (wszystko opcjonalne)
deltaTime?: number; realDeltaTime?: number; objects?: number; bodies?: number;
colliders?: number; timeScale?: number; paused?: boolean; audio?: string;
profile?: { name: string; ms: number }[]; extra?: string[];
"""),
         ("h2", "LogBuffer", "LogBuffer"),
         ("code", "TypeScript", """
new LogBuffer(capacity?: number);        // domyślnie 400, minimum 1
push(entry: LogEntry): void;
all(): readonly LogEntry[];
last(count?: number): LogEntry[];
size(): number;
droppedCount(): number;
getCapacity(): number;
setCapacity(capacity: number): void;
counts(): Record<LogLevel, number>;
summary(): LogSummary;                    // total, dropped, counts
filter(filter?: LogFilter): LogEntry[];
clear(): void;
subscribe(listener: () => void): () => void;
getVersion(): number;                     // rośnie przy każdej zmianie
toJSON(): LogSummary & { entries: LogEntry[] };
"""),
         ("note", "info", "Po co wersja", "Why a version", "Panel pyta bufor o wersję i przerysowuje listę tylko wtedy, gdy coś się zmieniło. Bez tego filtr i tak działałby poprawnie, ale panel odświeżałby DOM 8 razy na sekundę bez powodu.",
          "The panel asks the buffer for its version and redraws only when something changed. Without it the filter would still be correct, but the panel would touch the DOM eight times a second for nothing."),
         ("h2", "LogPanel", "LogPanel"),
         ("code", "TypeScript", """
new LogPanel(buffer: LogBuffer, options?: LogPanelOptions);
mount(parent: HTMLElement): void;
setVisible(visible: boolean): void;
toggle(): boolean;
isVisible(): boolean;
setLabels(labels: Partial<LogPanelLabels>): void;
setFilter(filter: LogFilter): void;
toggleLevel(level: LogLevel): void;
update(timeMs: number): void;
refresh(force?: boolean): void;
destroy(): void;

// LogPanelOptions
labels?: Partial<LogPanelLabels>; height?: number; width?: number; minLevel?: LogLevel;
"""),
         ("h2", "DebugViews", "DebugViews"),
         ("code", "TypeScript", """
new DebugViews(getRender: () => RenderPort | null, getPhysics: () => PhysicsPort | null);
get(): DebugViewState;
set(patch: Partial<DebugViewState>): DebugViewState;
toggle(key: DebugViewKey): DebugViewState;
reset(): DebugViewState;                  // wszystkie widoki wyłączone
isActive(): boolean;
getSupport(): DebugViewSupport;
sync(): void;                             // przenosi stan do portów
clear(): void;                            // czyści warstwę grafiki
"""),
         ("h2", "Profiler", "Profiler"),
         ("code", "TypeScript", """
new Profiler(enabled?: boolean, windowSize?: number);   // okno minimum 2 klatki
setEnabled(enabled: boolean): void;
isEnabled(): boolean;
begin(name: string): void;
end(name: string): number;
record(name: string, milliseconds: number): number;
startFrame(): void;
endFrame(): void;
getFrameNumber(): number;
getLastFrame(): Record<string, number>;
getFrameTime(): number;
getFps(): number;
getAverage(name: string): number;
getStats(): ProfileStat[];                // posortowane po total, malejąco
snapshot(): ProfileSnapshot;
reset(): void;
"""),
         ("h2", "Diagnostics", "Diagnostics"),
         ("code", "TypeScript", """
new Diagnostics(source: DiagnosticsSource);
report(): DiagnosticsReport;
toJSON(): string;
copy(): Promise<boolean>;
download(fileName?: string): boolean;     // domyślnie b2d-diagnostics-<czas>.json
static createEnvironment(): DiagnosticsEnvironment;
"""),
         ("note", "tip", "Raport da się odczytać maszynowo", "The report is machine-readable", "<code>format</code> i <code>version</code> są stałe, więc CI może sprawdzać <code>findings</code> bez parsowania tekstu. <code>copy()</code> zwraca <code>false</code>, gdy przeglądarka odmówi dostępu do schowka — wtedy zostaje <code>download()</code>.",
          "<code>format</code> and <code>version</code> are fixed, so CI can inspect <code>findings</code> without parsing text. <code>copy()</code> returns <code>false</code> when the browser denies clipboard access — <code>download()</code> is the fallback."),
     ], "api debug diagnostyka overlay logbuffer logpanel debugviews profiler diagnostics sygnatury"),

page("api-plugins", "api", P("Pluginy", "Plugins"), P("Sygnatury hosta pluginów, kontekstu, rejestrów i parsera zakresów wersji.", "Signatures of the plugin host, the context, the registries and the version-range parser."),
     [
         ("h2", "PluginHost", "PluginHost"),
         ("code", "TypeScript", """
new PluginHost(options: PluginHostOptions);

install(plugin: PluginDefinition): PluginStatus;
activate(id: string): Promise<void>;
activateAll(): Promise<void>;
deactivate(id: string): Promise<void>;
uninstall(id: string): Promise<void>;
dispose(): Promise<void>;

update(deltaTime: number): void;            // tyka systemy pluginów
get(id: string): PluginStatus | undefined;
has(id: string): boolean;
list(): PluginStatus[];
summary(): PluginSummary;

getSystems(): readonly PluginSystemDescriptor[];
enableSystem(owner: string, name: string): boolean;
getImporters(): ImporterRegistry;
getPanels(): PanelRegistry;

// PluginHostOptions
engineVersion: string;
logger: Logger;
events: EventBus;
services: { scenes, assets, storage?, storagePrefix? };
maxFailures?: number;                        // domyślnie 3
"""),
         ("h2", "PluginContext", "PluginContext"),
         ("code", "TypeScript", """
type PluginContext = {
  readonly manifest: PluginManifest;
  readonly engineVersion: string;
  readonly logger: Logger;
  readonly systems: { register(name, handler, options?): void };
  readonly importers: { register(importer: PluginImporter): void };
  readonly panels: { register(panel: PluginPanel): void };
  readonly events: { on<T>(event, handler): () => void; emit<T>(event, payload): void };
  readonly scenes: { list(): string[]; activeId(): string | null };
  readonly assets: { ids(): string[]; isLoaded(id: string): boolean };
  readonly storage: { get; set; remove; keys; clear };
  onDispose(disposer: () => void): void;
};
"""),
         ("h2", "Rejestry", "Registries"),
         ("code", "TypeScript", """
// SystemRegistry
register(owner, name, handler, options?: { order?, maxFailures? }): void;
removeOwner(owner): number;
update(deltaTime): SystemRunError[];
enable(owner, name): boolean;
list(): readonly PluginSystemDescriptor[];

// ImporterRegistry
register(owner, importer: { id, extensions, import(data, options?) }): void;
removeOwner(owner): number;
find(extension): PluginImporter | null;
import(extension, data, options?): unknown;
list(): readonly PluginImporterDescriptor[];

// PanelRegistry
register(owner, panel: { id, title, order?, mount(parent) }): void;
removeOwner(owner): number;
mount(id, parent: HTMLElement): boolean;
unmount(id): boolean;
list(): readonly PluginPanelDescriptor[];
"""),
         ("h2", "Zakresy wersji", "Version ranges"),
         ("code", "TypeScript", """
parseVersion(input: string): ParsedVersion | null;
compareVersions(a: string, b: string): number;
isValidRange(range: string): boolean;
satisfiesRange(version: string, range: string): boolean;

satisfiesRange("0.1.2", "^0.1.0");        // true
satisfiesRange("1.4.0", "^1.0.0 || ^2.0.0"); // true
satisfiesRange("1.5.0", ">=1.0.0 <2.0.0");   // true
"""),
         ("note", "info", "Zakres wspierany przez silnik", "Ranges the engine understands", "<code>*</code>, dokładna wersja, <code>=</code>, <code>^</code>, <code>~</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>, koniunkcja po spacji i alternatywa przez <code>||</code>. Wersje przedpremierowe są porównywane, ale nie mają osobnej semantyki zakresów.",
          "<code>*</code>, an exact version, <code>=</code>, <code>^</code>, <code>~</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>, <code>&lt;=</code>, whitespace conjunction and <code>||</code> alternatives. Prereleases compare correctly but have no separate range semantics."),
         ("h2", "Błędy", "Errors"),
         ("code", "TypeScript", """
class PluginError extends Error { code: PluginErrorCode; pluginId: string; issues: PluginManifestIssue[]; }
class PluginPermissionError extends PluginError { permission: string; }

type PluginErrorCode =
  | "invalid-manifest" | "duplicate-id" | "incompatible-engine"
  | "missing-dependency" | "dependency-cycle" | "permission-denied"
  | "activate-failed" | "deactivate-failed" | "runtime-error"
  | "system-disabled" | "duplicate-importer" | "unknown-importer" | "duplicate-panel";
"""),
         ("h2", "Zdarzenia", "Events"),
         ("table", [P("Zdarzenie", "Event"), P("Payload", "Payload")], [
             ["<code>plugin:installed</code>", "<code>{ id, version }</code>"],
             ["<code>plugin:activated</code> / <code>plugin:deactivated</code> / <code>plugin:uninstalled</code>", "<code>{ id }</code>"],
             ["<code>plugin:failed</code>", "<code>{ id, code, message }</code>"],
             ["<code>plugin:system-error</code>", "<code>{ id, system, message }</code>"],
             ["<code>plugin:system-disabled</code>", "<code>{ id, system }</code>"],
             ["<code>plugin:&lt;id&gt;:&lt;event&gt;</code>", P("cokolwiek wyemituje plugin", "whatever the plugin emits")],
         ]),
     ], "api plugins pluginhost kontekst rejestry systemy importery panele semver zakresy bledy zdarzenia"),

page("api-types", "api", P("Typy", "Types"), P("Publiczne typy i interfejsy wyeksportowane z pakietu.", "Public types and interfaces exported from the package."),
     [
         ("code", "TypeScript", """
type ScaleMode = "fit" | "fill" | "fixed" | "expand";
type LogLevel = "debug" | "info" | "warn" | "error";
type AssetType = "image" | "spritesheet" | "atlas" | "audio" | "json" | "font" | "tilemap";

interface EngineOptions {
  parent: string | HTMLElement;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  backgroundColor?: string;
  scaleMode?: ScaleMode;
  debug?: boolean;
  pauseOnHidden?: boolean;
  maxDeltaTime?: number;
  physics?: PhysicsOptions;
  inputMap?: Record<string, string[]>;
  seed?: number;
  fixedStep?: FixedStepConfig;
  wasm?: WasmOptions;
}

interface AssetLicense {
  name: string;
  author?: string;
  url?: string;
}

interface AssetDescriptor {
  id: string;
  type: AssetType;
  src: string;
  bytes?: number;
  optional?: boolean;
  group?: string;
  license?: AssetLicense;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  margin?: number;
  spacing?: number;
  atlasJson?: string;
  animations?: readonly AssetAnimation[];
  fontFamily?: string;
  data?: unknown;
}

interface FixedStepConfig {
  hz: number;
  maxSteps?: number;
}

interface TimeState {
  elapsed: number;
  realElapsed: number;
  deltaTime: number;
  realDeltaTime: number;
  frame: number;
  timeScale: number;
  paused: boolean;
  fixedDelta: number;
  fixedAlpha: number;
}

interface TaskHandle {
  readonly id: number;
  readonly cancelled: boolean;
  cancel(): void;
}

interface TaskOptions {
  owner?: string;
  repeat?: number;
  onError?: (error: unknown, taskId: number) => void;
}

interface SpriteOptions {
  originX?: number;
  originY?: number;
  alpha?: number;
  depth?: number;
  tint?: number;
}

interface PhysicsSpriteOptions extends SpriteOptions {
  collideWorldBounds?: boolean;
  immovable?: boolean;
}

interface ProjectConfig {
  formatVersion: 2;
  name: string;
  settings: ProjectSettings;
  assets: AssetDescriptor[];
  scenes: SceneDefinition[];
  unknownFields?: Record<string, unknown>;
}

type DebugViewKey = "colliders" | "grid" | "axes" | "cameraBounds";

interface DebugViewState {
  colliders: boolean;
  grid: boolean;
  gridSize: number;
  axes: boolean;
  cameraBounds: boolean;
}

interface LogFilter {
  minLevel?: LogLevel;
  levels?: readonly LogLevel[];
  context?: string;
  text?: string;
}

interface AssetDiagnostics {
  registered: string[];
  unused: string[];
  missing: string[];
  failed: string[];
  unlicensed: string[];
  heaviest: { id: string; bytes: number | null }[];
}

interface ProfileSnapshot {
  enabled: boolean;
  frame: number;
  samples: number;
  fps: number;
  frameTime: number;
  stats: ProfileStat[];
  lastFrame: Record<string, number>;
}
"""),
     ], "api typy types interfaces engineoptions assetdescriptor projectconfig debugview logfilter profiler diagnostics"),

page("arch", "advanced", P("Architektura", "Architecture"), P("Przepływ sterowania i granice modułów — co może zależeć od czego.", "Control flow and module boundaries — what may depend on what."),
     [
         ("code", "diagram", """
aplikacja (gra)
  |
  v
Engine --------------------- EventBus
  |  |  |  |  |  |
  |  |  |  |  |  +-------- WasmBridge ---> core.wasm (opcjonalnie)
  |  |  |  |  +----------- CameraManager
  |  |  |  +-------------- PhysicsManager --> Phaser.Arcade
  |  |  +----------------- InputManager
  |  +-------------------- AssetManager ----> Phaser.Loader
  +----------------------- SceneManager
                              |
                              v
                       PhaserAdapter ---------> Phaser.Game
                              |
                              v
                        Phaser.Scene (jedyna petla)
"""),
         ("h2", "Reguły", "Rules"),
         ("ul", [P("<code>adapters/</code> to jedyne miejsce z <code>import ... from \"phaser\"</code>", "<code>adapters/</code> is the only place with <code>import ... from \"phaser\"</code>"),
                 P("<code>core/</code> nie zna Phasera — można je testować w Node", "<code>core/</code> does not know Phaser — testable in Node"),
                 P("<code>Time</code> jest jedynym źródłem <code>deltaTime</code>", "<code>Time</code> is the single source of <code>deltaTime</code>"),
                 P("<code>AssetManager</code> kolejkuje pliki tylko w <code>preload</code>", "<code>AssetManager</code> queues files only in <code>preload</code>"),
                 P("Rdzeń <code>core/</code>, <code>components/</code>, <code>systems/</code> nie importuje Phasera — pilnuje tego test izolacji i reguła ESLint", "Core <code>core/</code>, <code>components/</code>, <code>systems/</code> never import Phaser — enforced by an isolation test and an ESLint rule")]),
         ("h2", "Koszt warstwy", "Cost of the layer"),
         ("table", [P("Operacja", "Operation"), P("Narzut", "Overhead")], [
             [P("Wywołanie <code>update</code> sceny", "Scene <code>update</code> call"), P("jedno wywołanie funkcji + clamp; ~0", "one function call + clamp; ~0")],
             [P("<code>setPosition</code>", "<code>setPosition</code>"), P("zapis dwóch pól + <code>syncToPhaser</code>", "two field writes + <code>syncToPhaser</code>")],
             [P("<code>emit</code>", "<code>emit</code>"), P("kopia tablicy słuchaczy (bezpieczeństwo iteracji)", "listener array copy (iteration safety)")],
             [P("Dostęp do managera", "Manager access"), P("odczyt z kontekstu sceny, bez alokacji", "read from scene context, no allocation")],
         ]),
         ("note", "info", "Dlaczego nie ECS", "Why not ECS",
          "ECS ma sens przy tysiącach jednorodnych encji. Gra 2D z ręcznie tworzonymi obiektami jest czytelniejsza bez systemów i archetypów — a wrapper + komponenty pokrywa 90% przypadków.",
          "ECS pays off with thousands of homogeneous entities. A 2D game with hand-authored objects reads better without systems and archetypes — a wrapper plus components covers 90% of cases."),
     ], "architektura architecture adapter warstwy przeplyw"),

page("wasm", "advanced", P("C++23 / WebAssembly", "C++23 / WebAssembly"), P("Opcjonalny punkt integracji: A* w C++ kompilowany do WASM, wołany z TypeScriptu.", "Optional integration point: A* in C++ compiled to WASM, called from TypeScript."),
     [
         ("h2", "Kiedy ma sens", "When it pays off"),
         ("table", [P("Zadanie", "Task"), P("TypeScript", "TypeScript"), P("WASM", "WASM"), P("Wniosek", "Verdict")], [
             [P("A* na siatce 128×128", "A* on a 128×128 grid"), "~1.5 ms", "~0.2 ms", P("WASM wygrywa przy dużej siatce", "WASM wins on large grids")],
             [P("Aktualizacja 50 encji", "50 entity updates"), "~0.05 ms", "~0.15 ms", P("narzut mostu większy niż zysk", "bridge overhead exceeds the gain")],
             [P("Ruch gracza", "Player movement"), "~0.001 ms", P("—", "—"), P("zostaje w TS", "stays in TS")],
         ]),
         ("h2", "Budowa", "Build"),
         ("code", "Bash", """
emcmake cmake -S native/core -B build-wasm -DCMAKE_BUILD_TYPE=Release
cmake --build build-wasm
cp build-wasm/core.wasm build-wasm/core.js apps/playground/public/wasm/
"""),
         ("h2", "Użycie", "Usage"),
         ("code", "TypeScript", """
const engine = createEngine({
  parent: "game-container",
  wasm: { wasmUrl: "/wasm/core.wasm", jsUrl: "/wasm/core.js", required: false },
});

const ready = await engine.getWasm().load();

if (ready) {
  const path = engine.getWasm().call<number[]>("findPathAStar", grid, 0, 0, 63, 63);
  this.followPath(path);
} else {
  this.followPath(this.findPathInTypeScript(grid));
}
"""),
         ("note", "warn", "Kolejność", "Ordering",
          "MVP nie wymaga WASM. Najpierw profiluj, potem przenoś. Przeniesienie logiki bez pomiaru to najczęstszy sposób na spowolnienie gry przez koszt kopiowania danych przez granicę modułu.",
          "The MVP does not require WASM. Profile first, move later. Moving logic without measurement is the most common way to slow a game down through data copying across the module boundary."),
     ], "wasm c++ cpp emscripten a* pathfinding native"),

page("perf", "advanced", P("Wydajność", "Performance"), P("Co realnie kosztuje, jak to zmierzyć i kiedy wynik jest regresją, a nie szumem.", "What actually costs time, how to measure it, and when a number is a regression rather than noise."),
     [
         ("h2", "Budżet klatki", "Frame budget"),
         ("table", [P("Zakres", "Range"), P("Budżet", "Budget"), P("Uwagi", "Notes")], [
             ["60 FPS", "16.6 ms", P("Standard dla 2D", "Standard for 2D")],
             ["120 FPS", "8.3 ms", P("Wymaga lekkiej logiki", "Requires light logic")],
             ["30 FPS", "33.3 ms", P("Fallback na słabym sprzęcie", "Fallback on weak hardware")],
         ]),
         ("p", "Budżet to sufit dla całej klatki: logika gry, fizyka, animacje, audio i rysowanie. Silnik nie obiecuje, że dowolna gra zmieści się w 16.6 ms — obiecuje, że poda liczby, które pozwolą to sprawdzić bez zgadywania.",
          "The budget is a ceiling for the whole frame: game logic, physics, animations, audio and drawing. The engine does not promise that any game fits into 16.6 ms — it promises to hand over the numbers that let you check it without guessing."),
         ("h2", "Zasady", "Rules"),
         ("ul", [P("Nie twórz obiektów w <code>update</code> — zmieniaj istniejące", "Do not create objects in <code>update</code> — mutate existing ones"),
                 P("Trzymaj tekstury w atlasie: mniej zmian stanu renderera", "Keep textures in an atlas: fewer renderer state changes"),
                 P("Zamiast setek tekstów użyj jednego obiektu tekstowego z wielolinijkowym stringiem", "Instead of hundreds of texts use one text object with a multiline string"),
                 P("Fizyka tylko dla obiektów, które jej potrzebują", "Physics only for objects that need it"),
                 P("Grupuj zapisy do <code>EventBus</code> — każdy <code>emit</code> to kopia listy", "Batch <code>EventBus</code> writes — every <code>emit</code> copies the list")]),
         ("note", "tip", "Najpierw profil, potem optymalizacja", "Profile first, optimise second", "Silnik ma wbudowany profiler i 17 benchmarków. Zmiana bez pomiaru przed i po jest zgadywaniem, a zgadywanie w optymalizacji kosztuje więcej czasu niż pomiar.",
          "The engine ships a built-in profiler and 17 benchmarks. A change without a measurement before and after is guesswork, and guesswork in optimisation costs more time than measurement."),

         ("h2", "Profiler w grze", "The profiler in the game"),
         ("code", "TypeScript", """
const profiler = engine.getProfiler();

update(dt: number): void {
  profiler.begin("ai.pathfinding");
  this.pathfinding.step(dt);
  profiler.end("ai.pathfinding");

  profiler.begin("ai.steering");
  this.steering.step(dt);
  profiler.end("ai.steering");
}

const snapshot = profiler.snapshot();
const worst = snapshot.stats[0];
worst.name;
worst.total;
worst.average;
worst.max;
"""),
         ("p", "Profiler trzyma okno ostatnich 120 klatek. Dla każdego znacznika podaje liczbę wywołań, sumę, maksimum i średnią w oknie, a <code>stats</code> jest posortowane po czasie sumarycznym — pierwszy wpis to zwykle właściwy podejrzany. Overlay wypisuje trzy najdroższe znaczniki w linii <code>prof</code>.",
          "The profiler keeps a window of the last 120 frames. For every marker it reports the call count, total, maximum and average inside the window, and <code>stats</code> is sorted by total time — the first entry is usually the real suspect. The overlay prints the three most expensive markers on the <code>prof</code> line."),
         ("table", [P("Metoda", "Method"), P("Zwraca", "Returns"), P("Kiedy używać", "When to use")], [
             ["<code>begin(name)</code> / <code>end(name)</code>", "<code>void</code> / <code>number</code>", P("Bloki w kodzie, które mają swoją nazwę", "Named blocks in the code")],
             ["<code>record(name, ms)</code>", "<code>number</code>", P("Pomiar z zewnątrz, np. z <code>performance.now()</code>", "An external measurement, e.g. from <code>performance.now()</code>")],
             ["<code>getAverage(name)</code>", "<code>number</code>", P("Średnia z okna dla jednego znacznika", "Window average for one marker")],
             ["<code>snapshot()</code>", "<code>ProfileSnapshot</code>", P("Raport: fps, czas klatki, statystyki, ostatnia klatka", "Report: fps, frame time, stats, last frame")],
             ["<code>getLastFrame()</code>", "<code>Record&lt;string, number&gt;</code>", P("Czasy znaczników z dokładnie ostatniej klatki", "Marker timings from exactly the last frame")],
             ["<code>setEnabled(false)</code>", "<code>void</code>", P("Znaczniki zostają, pomiar znika", "Markers stay, measurement disappears")],
         ]),
         ("note", "info", "Znaczniki silnika", "Engine markers", "Silnik mierzy <code>engine.time</code>, <code>engine.scheduler</code>, <code>engine.input</code>, <code>engine.fixed</code>, <code>engine.scene</code>, a wewnątrz sceny <code>physics.readback</code>, <code>tweens</code>, <code>components</code>, <code>destroy</code> i <code>render.sync</code>. Twoje znaczniki lądują w tej samej tabeli, więc od razu widać, czy droższa jest twoja logika, czy narzut silnika.",
          "The engine measures <code>engine.time</code>, <code>engine.scheduler</code>, <code>engine.input</code>, <code>engine.fixed</code>, <code>engine.scene</code> and, inside the scene, <code>physics.readback</code>, <code>tweens</code>, <code>components</code>, <code>destroy</code> and <code>render.sync</code>. Your markers land in the same table, so you immediately see whether your logic or the engine overhead is the expensive part."),

         ("h2", "Benchmarki", "Benchmarks"),
         ("code", "Bash", """
npm run bench            # 17 przypadków, wynik do benchmarks/latest.json
npm run bench:check      # porównanie z benchmarks/baseline.json
npm run bench:baseline   # zapis aktualnego wyniku jako nowej bazy
"""),
         ("p", "Benchmarki działają w środowisku Node, bez przeglądarki i bez Phasera, więc mierzą kod silnika, a nie wydajność WebGL. Każdy przypadek ma fazę rozgrzewającą i stały czas próbkowania; wynik to mediana przepustowości w hercach, nie pojedynczy najlepszy przebieg.",
          "Benchmarks run in Node, without a browser and without Phaser, so they measure engine code rather than WebGL throughput. Every case has a warm-up phase and a fixed sampling duration; the result is the median throughput in hertz, not a single best run."),
         ("table", [P("Grupa", "Group"), P("Przypadki", "Cases"), P("Co mierzy", "What it measures")], [
             ["objects", "4", P("Tworzenie 2 000 obiektów, aktualizacja transformacji, usuwanie", "Creating 2 000 objects, updating transforms, destroying")],
             ["queries", "4", P("Indeks, szukanie po <code>id</code>, po jednym i po dwóch tagach", "Index, lookup by <code>id</code>, by one and by two tags")],
             ["collisions", "3", P("Rejestracja par, dispatch 5 000 wywołań, broad-phase AABB", "Pair registration, dispatching 5 000 callbacks, AABB broad phase")],
             ["tilemap", "2", P("Import mapy 128×128 i zebranie punktów spawnu", "Importing a 128×128 map and collecting spawn points")],
             ["assets", "4", P("Rejestracja i walidacja 500 zasobów, raport rozmiarów, diagnostyka użycia", "Registering and validating 500 assets, size report, usage diagnostics")],
         ]),
         ("code", "json", """
{
  "format": "b2d-benchmarks",
  "version": 1,
  "environment": { "node": "v20.20.2", "platform": "linux-x64", "cpu": "...", "cores": 2, "recordedAt": "..." },
  "benchmarks": [
    { "group": "objects", "name": "create 2 000 objects", "hz": 2034.2, "meanMs": 0.4947, "medianMs": 0.4917, "iterations": 2027 }
  ]
}
"""),
         ("note", "warn", "Liczby nie są obietnicą", "The numbers are not a promise", "Wynik zależy od procesora, wersji Node i tego, co robi reszta maszyny. Plik <code>latest.json</code> zapisuje model procesora i wersję Node właśnie po to, żeby porównywać wyniki z tej samej maszyny, a nie ogłaszać ranking sprzętu.",
          "The result depends on the CPU, the Node version and what else the machine is doing. <code>latest.json</code> records the CPU model and the Node version precisely so you compare runs from the same machine instead of publishing a hardware ranking."),

         ("h2", "Progi regresji", "Regression thresholds"),
         ("p", "Regresją jest spadek przepustowości o więcej niż 40% względem zapisanej bazy, przy tej samej maszynie. Tolerancja jest szeroka, bo pomiar na współdzielonym środowisku potrafi skakać o kilkadziesiąt procent — zmierzone na tej maszynie wahania między dwoma kolejnymi przebiegami sięgały 27%. Próg ma łapać zmianę rzędu wielkości, a nie szum, więc nie jest zaostrzany na siłę.",
          "A regression is a throughput drop of more than 40% against the recorded baseline on the same machine. The tolerance is wide because a measurement on a shared environment can swing by tens of percent — on this machine two consecutive runs differed by up to 27%. The threshold is meant to catch an order-of-magnitude change rather than noise, so it is not tightened for show."),
         ("code", "text", """
Benchmark comparison (tolerance 40%)
  baseline: 2026-10-22T14:08:41.219Z · Intel(R) Xeon(R) Processor @ 2.60GHz · node v20.20.2
  latest:   2026-10-22T14:08:41.219Z · Intel(R) Xeon(R) Processor @ 2.60GHz · node v20.20.2

  benchmark                                             baseline hz   current hz    delta
  objects/create 2 000 objects                          2034          2035          +0.1%
  collisions/dispatch 5 000 overlap callbacks           596701        601124        +0.7%

All benchmarks within tolerance
"""),
         ("code", "yaml", """
- run: npm ci
- run: npm run typecheck
- run: npm test
- run: npm run bench
- run: npm run bench:check
"""),
         ("note", "tip", "Kiedy podnieść bazę", "When to raise the baseline", "Świadomą zmianę wydajności zapisuje się przez <code>npm run bench:baseline</code> w tym samym commicie, który ją wprowadza. Dzięki temu <code>bench:check</code> zawsze porównuje dwie wersje tej samej maszyny i tego samego środowiska.",
          "A deliberate performance change updates the baseline with <code>npm run bench:baseline</code> in the very commit that introduces it. That way <code>bench:check</code> always compares two revisions of the same machine and the same environment."),

         ("h2", "Build", "Build"),
         ("p", "Produkcyjny bundle to ok. 351 kB gzip, z czego większość stanowi Phaser. Wersja jednoplikowa (wszystko inline, także zasoby jako data URI) waży ok. 1.6 MB i nie wymaga serwera. Gdy projekt urośnie, rozbij go przez <code>build.rollupOptions.output.manualChunks</code> — Phaser zmienia się rzadko i może być cache'owany osobno od kodu gry.",
          "The production bundle is about 351 kB gzip, most of it Phaser. The single-file build (everything inline, assets included as data URIs) weighs about 1.6 MB and needs no server. As the project grows, split it via <code>build.rollupOptions.output.manualChunks</code> — Phaser changes rarely and can be cached separately from game code."),
     ], "wydajnosc performance fps budzet klatki optymalizacja profiler benchmarki regresja prog pomiar")

page("sql", "advanced", P("Bazy danych: SQL, MySQL i PostgreSQL", "Databases: SQL, MySQL and PostgreSQL"),
     P("Ten sam magazyn zapisów na plikach, w PostgreSQL i MySQL — z generowanym DDL, parametryzowanymi zapytaniami i serwerem referencyjnym.",
       "The same save store over files, PostgreSQL and MySQL — with generated DDL, parameterised queries and a reference server."),
     [
         ("h2", "Dlaczego SQL, a nie plik", "Why SQL instead of files"),
         ("p", "Magazyn plikowy wystarcza jednej instancji i jednemu użytkownikowi. Gdy zapisy mają przeżyć restart maszyny, obsłużyć kilka instancji za load balancerem albo trafić do kopii zapasowej razem z resztą systemu, potrzebna jest baza. <code>SqlSaveStore</code> implementuje ten sam interfejs <code>SaveStore</code>, więc gra nie wie, gdzie leży stan — zmienia się jedna linia w kompozycji.",
          "A file store is enough for one instance and one user. Once saves must survive machine loss, work behind a load balancer or land in the same backup as the rest of the system, a database is needed. <code>SqlSaveStore</code> implements the same <code>SaveStore</code> interface, so the game never knows where state lives — one line in the composition root changes."),
         ("table", [P("Wymaganie", "Requirement"), P("Plik", "File"), P("SQL", "SQL")], [
             [P("Jedna instancja, jeden gracz", "One instance, one player"), P("wystarcza", "enough"), P("też działa", "works too")],
             [P("Kilka instancji aplikacji", "Several app instances"), P("wymaga wspólnego wolumenu", "needs a shared volume"), P("naturalne", "natural")],
             [P("Kopie zapasowe i audyt", "Backups and auditing"), P("ręczne", "manual"), P("pg_dump / mysqldump, replikacja", "pg_dump / mysqldump, replication")],
             [P("Wiele tysięcy zapisów", "Thousands of saves"), P("katalog plików", "a directory of files"), P("indeks po kluczu", "index by key")],
             [P("Zero infrastruktury", "Zero infrastructure"), P("tak", "yes"), P("potrzebny serwer", "needs a server")],
         ]),
         ("h2", "Docelowy schemat", "The target schema"),
         ("p", "Jedna tabela, trzy kolumny: klucz, wartość i znacznik aktualizacji. Wartość to cały JSON zapisu lub projektu — silnik nie rozkłada go na kolumny, bo schemat gry zmienia się częściej niż schemat bazy. DDL generuje <code>sqlSchema()</code> i ten sam DDL wypisuje serwer referencyjny.",
          "One table, three columns: key, value and an update timestamp. The value is the whole save or project JSON — the engine does not spread it into columns, because a game schema changes more often than a database schema. <code>sqlSchema()</code> generates the DDL, and the reference server prints exactly the same DDL."),
         ("code", "bash", """
node tools/save-server/server.mjs --print-schema=postgres

CREATE TABLE IF NOT EXISTS b2d_entries (entry_key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS b2d_entries_updated_idx ON b2d_entries (updated_at);
"""),
         ("code", "sql", """
-- mysql
CREATE TABLE IF NOT EXISTS b2d_entries (
  entry_key VARCHAR(191) PRIMARY KEY,
  value LONGTEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX b2d_entries_updated_idx ON b2d_entries (updated_at);
"""),
         ("table", [P("Element", "Element"), P("PostgreSQL", "PostgreSQL"), P("MySQL", "MySQL")], [
             ["<code>entry_key</code>", "<code>TEXT PRIMARY KEY</code>", "<code>VARCHAR(191) PRIMARY KEY</code>"],
             ["<code>value</code>", "<code>TEXT</code>", "<code>LONGTEXT</code>"],
             ["<code>updated_at</code>", "<code>TIMESTAMPTZ DEFAULT now()</code>", "<code>TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE</code>"],
             [P("Miejsce na klucz", "Key length"), P("bez limitu, indeks btree", "unlimited, btree index"), P("191 znaków — do utf8mb4 kluczy", "191 chars — for utf8mb4 keys")],
             [P("Silnik / strona kodowa", "Engine / charset"), P("natywna", "native"), "<code>InnoDB</code>, <code>utf8mb4</code>"],
         ]),
         ("h2", "Jak podłączyć bazę", "How to connect a database"),
         ("p", "Silnik nie zna sterowników do baz — dostaje obiekt z metodą <code>query(sql, params)</code>. Dzięki temu nie ma w bundlu ani <code>pg</code>, ani <code>mysql2</code>, a testy mogą podstawić klienta w pamięci. Na serwerze wystarczy kilkanaście linii.",
          "The engine does not know database drivers — it accepts an object with a <code>query(sql, params)</code> method. That is why neither <code>pg</code> nor <code>mysql2</code> ends up in the bundle, and tests can inject an in-memory client. On the server a dozen lines are enough."),
         ("code", "TypeScript", """
import pg from "pg";
import { SqlSaveStore, PlayerSaveRepository } from "@engine";
import { sqlSchema } from "@engine";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const client = {
  async query(text: string, params: readonly unknown[] = []) {
    const result = await pool.query(text, params as unknown[]);
    return { rows: result.rows, affectedRows: result.rowCount ?? undefined };
  },
};

const store = new SqlSaveStore(client, { dialect: "postgres", table: "b2d_entries" });
await store.init();

await client.query(sqlSchema({ dialect: "postgres", table: "b2d_entries" })[0]);

const saves = new PlayerSaveRepository(store);
await saves.save("player-1", "slot-1", { level: 7 });
"""),
         ("code", "TypeScript", """
import mysql from "mysql2/promise";
import { SqlSaveStore } from "@engine";

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 10 });

const client = {
  async query(text: string, params: readonly unknown[] = []) {
    const [rows] = await pool.query(text, params as unknown[]);
    return Array.isArray(rows)
      ? { rows: rows as Record<string, unknown>[] }
      : { rows: [], affectedRows: (rows as { affectedRows?: number }).affectedRows };
  },
};

const store = new SqlSaveStore(client, { dialect: "mysql", table: "b2d_entries" });
await store.init();
"""),
         ("table", [P("Wersja", "Version"), P("Zapytanie", "Statement")], [
             ["<code>sqlGet</code>", "<code>SELECT value FROM t WHERE entry_key = $1</code>"],
             ["<code>sqlSet</code> (postgres)", "<code>INSERT … ON CONFLICT (entry_key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()</code>"],
             ["<code>sqlSet</code> (mysql)", "<code>INSERT … ON DUPLICATE KEY UPDATE value = VALUES(value)</code>"],
             ["<code>sqlDelete</code>", "<code>DELETE FROM t WHERE entry_key = $1</code>"],
             ["<code>sqlKeys</code>", "<code>SELECT entry_key FROM t ORDER BY entry_key</code>"],
             ["<code>sqlClear</code>", "<code>DELETE FROM t</code>"],
         ]),
         ("note", "warn", "Parametry, nie konkatenacja", "Parameters, not concatenation", "Wszystkie wartości idą jako parametry zapytania, a nazwa tabeli przechodzi walidację <code>^[a-z][a-z0-9_]*$</code> przed interpolacją. Nie buduj SQL-a ze stringów pochodzących z zapisu gry — klucz z apostrofem nie może zamknąć literału.",
          "Every value goes in as a query parameter, and the table name passes a <code>^[a-z][a-z0-9_]*$</code> check before interpolation. Never build SQL from strings that come out of a save file — a key with an apostrophe must not be able to close a literal."),
         ("h2", "Serwer referencyjny", "The reference server"),
         ("p", "<code>tools/save-server/server.mjs</code> to kilkaset linii Node bez zależności w domyślnym trybie plikowym. Backend SQL włącza się zmienną środowiskową, a sterowniki są ładowane dynamicznie — jeśli ich nie ma, serwer powie to wprost zamiast wywalić się przy imporcie.",
          "<code>tools/save-server/server.mjs</code> is a few hundred lines of dependency-free Node in the default file mode. The SQL backend is enabled with an environment variable and drivers are loaded dynamically — if they are missing, the server says so plainly instead of blowing up on import."),
         ("code", "bash", """
# pliki (domyślnie)
SAVE_DIR=./saves PORT=8788 node tools/save-server/server.mjs

# PostgreSQL
SAVE_BACKEND=postgres SAVE_DIALECT=postgres SAVE_TABLE=b2d_entries \\
  DATABASE_URL=postgres://user:pass@localhost:5432/game node tools/save-server/server.mjs

# MySQL
SAVE_BACKEND=mysql SAVE_DIALECT=mysql DATABASE_URL=mysql://user:pass@localhost:3306/game \\
  node tools/save-server/server.mjs

# tylko DDL
node tools/save-server/server.mjs --print-schema=postgres
"""),
         ("table", [P("Zmienna", "Variable"), P("Domyślnie", "Default"), P("Znaczenie", "Meaning")], [
             ["<code>PORT</code> / <code>HOST</code>", "<code>8788</code> / <code>127.0.0.1</code>", P("Adres nasłuchu", "Listen address")],
             ["<code>SAVE_BACKEND</code>", "<code>file</code>", "<code>file</code>, <code>postgres</code>, <code>mysql</code>"],
             ["<code>SAVE_DIALECT</code>", P("jak backend", "same as backend"), "<code>postgres</code> lub <code>mysql</code>"],
             ["<code>SAVE_TABLE</code>", "<code>b2d_entries</code>", P("Nazwa tabeli", "Table name")],
             ["<code>SAVE_DIR</code>", "<code>./saves</code>", P("Katalog dla backendu plikowego", "Directory for the file backend")],
             ["<code>SAVE_TOKEN</code>", P("brak", "none"), P("Wymagany nagłówek <code>Authorization: Bearer</code>", "Required <code>Authorization: Bearer</code> header")],
             ["<code>SAVE_ORIGIN</code>", "<code>*</code>", P("Dozwolone <code>Origin</code> dla CORS", "Allowed <code>Origin</code> for CORS")],
             ["<code>SAVE_MAX_BODY</code>", "<code>1048576</code>", P("Limit rozmiaru żądania w bajtach", "Request size limit in bytes")],
         ]),
         ("h2", "Transakcje, współbieżność i spójność", "Transactions, concurrency and consistency"),
         ("p", "Pojedynczy zapis to jedno <code>INSERT … ON CONFLICT</code>, więc jest atomowy bez transakcji. Problem pojawia się przy odczycie i modyfikacji w wielu krokach („dodaj monetę do ekwipunku”) — wtedy trzeba transakcji z blokadą wiersza, inaczej dwa równoległe zapisy nadpiszą się nawzajem.",
          "A single write is one <code>INSERT … ON CONFLICT</code>, so it is atomic without a transaction. The problem appears with multi-step read-modify-write (“add a coin to the inventory”) — that needs a transaction with a row lock, otherwise two concurrent saves overwrite each other."),
         ("code", "sql", """
BEGIN;
SELECT value FROM b2d_entries WHERE entry_key = 'save:player-1:slot-1' FOR UPDATE;
UPDATE b2d_entries SET value = '{"level":8,"coins":121}' WHERE entry_key = 'save:player-1:slot-1';
COMMIT;
"""),
         ("table", [P("Zjawisko", "Phenomenon"), P("Konsekwencja", "Consequence"), P("Środek", "Mitigation")], [
             [P("Zgubiona aktualizacja", "Lost update"), P("Ostatni zapis wygrywa, postęp znika", "Last write wins, progress vanishes"), P("<code>FOR UPDATE</code> lub wersja w rekordzie", "<code>FOR UPDATE</code> or a version field")],
             [P("Podwójny zapis autosave", "Double autosave"), P("Dwa razy ta sama zmiana", "The same change twice"), P("Idempotentny klucz + serializacja po stronie klienta", "Idempotent key + client-side serialisation")],
             [P("Retry po timeoucie", "Retry after timeout"), P("Zapis mógł się udać", "The write may have succeeded"), P("Klucz naturalny (player+slot), więc powtórka nic nie psuje", "Natural key (player+slot), so a retry is harmless")],
             [P("Brak indeksu", "Missing index"), P("Pełny skan przy <code>keys()</code>", "Full scan on <code>keys()</code>"), P("Klucz jest PK, <code>updated_at</code> ma indeks", "The key is the PK, <code>updated_at</code> is indexed")],
         ]),
         ("h2", "Migracje schematu bazy", "Database schema migrations"),
         ("p", "Tabela z kluczem i JSON-em rzadko wymaga migracji — nowe pola lądują w JSON-ie i przechodzą przez migracje <b>formatu zapisu</b>. Migracja bazy jest potrzebna, gdy zmienia się nazwa tabeli, typ wartości albo dochodzi kolumna pomocnicza (np. <code>player_id</code> do raportów).",
          "A table holding a key and JSON rarely needs migration — new fields land in the JSON and go through <b>save-format</b> migrations. A database migration is needed when the table name changes, the value type changes, or a helper column appears (e.g. <code>player_id</code> for reporting)."),
         ("code", "sql", """
ALTER TABLE b2d_entries ADD COLUMN player_id VARCHAR(64) NULL;
UPDATE b2d_entries
   SET player_id = split_part(substring(entry_key from 6), ':', 1)
 WHERE entry_key LIKE 'save:%' AND player_id IS NULL;
CREATE INDEX b2d_entries_player_idx ON b2d_entries (player_id);
"""),
         ("steps", [
             (P("Zapisz DDL w repo", "Keep the DDL in the repo"), P("Wygenerowany przez <code>--print-schema</code> plik wersjonowany razem z kodem — to źródło prawdy dla nowego środowiska.", "The file produced by <code>--print-schema</code>, versioned with the code — the source of truth for a new environment.")),
             (P("Zmieniaj przyrostowo", "Change incrementally"), P("Każda migracja: <code>ALTER</code> + wypełnienie danych + indeks. Bez kasowania tabeli przy każdej zmianie.", "Each migration: <code>ALTER</code> + data backfill + index. Never drop the table on every change.")),
             (P("Testuj na kopii", "Test on a copy"), P("Migracja na zrzucie produkcyjnym, zmierzona czasowo — <code>ALTER</code> na dużej tabeli potrafi zablokować zapisy.", "Run migrations on a production dump and measure — an <code>ALTER</code> on a big table can block writes.")),
             (P("Migracje formatu osobno", "Format migrations separately"), P("Wersja zapisu w JSON-ie i wersja schematu bazy to dwie niezależne osie.", "The save version inside JSON and the database schema version are two independent axes.")),
         ]),
         ("h2", "Wydajność i utrzymanie", "Performance and maintenance"),
         ("table", [P("Temat", "Topic"), P("Praktyka", "Practice")], [
             [P("Pula połączeń", "Connection pool"), P("Jedna pula na proces, nie połączenie na żądanie; <code>connectionLimit</code> dopasowany do limitu serwera.", "One pool per process, not a connection per request; <code>connectionLimit</code> matched to the server limit.")],
             [P("Rozmiar zapisu", "Save size"), P("Trzymaj zapis w dziesiątkach kilobajtów. Duże rzeczy (mapy, assety) należą do projektu, nie do postępu.", "Keep a save in the tens of kilobytes. Large things (maps, assets) belong to the project, not to progress.")],
             [P("Timeouty", "Timeouts"), P("Ustaw <code>statement_timeout</code> i timeout klienta; zapis bez limitu blokuje kolejkę.", "Set <code>statement_timeout</code> and a client timeout; an unbounded write blocks the queue.")],
             [P("Retencja", "Retention"), P("Czyść stare sloty zadaniem cyklicznym, nie przy każdym odczycie.", "Prune old slots with a scheduled job, not on every read.")],
             [P("Backup", "Backup"), P("<code>pg_dump</code>/<code>mysqldump</code> według harmonogramu i test odtworzenia — backup bez testu nie jest backupem.", "<code>pg_dump</code>/<code>mysqldump</code> on a schedule plus a restore test — an untested backup is not a backup.")],
             [P("Uprawnienia", "Privileges"), P("Aplikacja potrzebuje <code>SELECT/INSERT/UPDATE/DELETE</code> na jednej tabeli, nie <code>SUPERUSER</code>.", "The app needs <code>SELECT/INSERT/UPDATE/DELETE</code> on one table, not <code>SUPERUSER</code>.")],
         ]),
         ("h2", "Diagnostyka", "Troubleshooting"),
         ("table", [P("Objaw", "Symptom"), P("Przyczyna", "Cause"), P("Naprawa", "Fix")], [
             [P("<code>relation … does not exist</code>", "<code>relation … does not exist</code>"), P("Brak <code>init()</code> albo DDL nie został wykonany", "No <code>init()</code> or the DDL was never executed"), P("Uruchom <code>store.init()</code> albo wgraj DDL z <code>--print-schema</code>", "Call <code>store.init()</code> or apply the DDL from <code>--print-schema</code>")],
             [P("<code>Driver pg not installed</code>", "<code>Driver pg not installed</code>"), P("Backend SQL bez sterownika", "SQL backend without a driver"), P("<code>npm i pg</code> lub <code>npm i mysql2</code> w projekcie serwera", "<code>npm i pg</code> or <code>npm i mysql2</code> in the server project")],
             [P("<code>Invalid SQL table name</code>", "<code>Invalid SQL table name</code>"), P("Nazwa z wielką literą, myślnikiem lub kropką", "Name with a capital, dash or dot"), P("Wzorzec <code>^[a-z][a-z0-9_]*$</code>, np. <code>b2d_entries</code>", "Pattern <code>^[a-z][a-z0-9_]*$</code>, e.g. <code>b2d_entries</code>")],
             [P("Klucz za długi w MySQL", "Key too long in MySQL"), P("Klucz dłuższy niż 191 znaków", "Key longer than 191 chars"), P("Skróć identyfikatory gracza i slotu; limit waliduje też <code>HttpStore</code>", "Shorten player and slot ids; <code>HttpStore</code> validates the same limit")],
             [P("Zapis gubi się przy dwóch instancjach", "A save is lost with two instances"), P("Brak blokady w read-modify-write", "No lock in read-modify-write"), P("Transakcja z <code>FOR UPDATE</code> albo zapis całego stanu", "A transaction with <code>FOR UPDATE</code>, or write the whole state")],
             [P("CORS blokuje przeglądarkę", "CORS blocks the browser"), P("Zły <code>SAVE_ORIGIN</code>", "Wrong <code>SAVE_ORIGIN</code>"), P("Ustaw dokładny origin gry, nie <code>*</code>, jeśli używasz tokenu", "Set the exact game origin instead of <code>*</code> when a token is used")],
         ]),
         ("note", "info", "Co jest przetestowane", "What is covered by tests",
          "Ścieżka plikowa serwera jest sprawdzona end-to-end przez HTTP (health, PUT, GET, LIST, DELETE, 404 po usunięciu). Warstwa SQL jest pokryta testami jednostkowymi z klientem w pamięci oraz testem zgodności, który porównuje SQL generowany przez TypeScript z SQL-em serwera znak w znak — więc oba backendy nie mogą się rozjechać po cichu.",
          "The file path of the server is verified end-to-end over HTTP (health, PUT, GET, LIST, DELETE, 404 after removal). The SQL layer is covered by unit tests with an in-memory client plus a parity test that compares the SQL generated by TypeScript with the server SQL character for character — so the two backends cannot silently drift apart."),
     ], "sql baza danych mysql postgresql postgres baza zapisy tabela ddl migracja transakcja pooling indeks klucz serwer http")

page("tests", "advanced", P("Testy i CI", "Tests and CI"), P("545 testów w 47 plikach, zero przeglądarki w pętli, plus 17 benchmarków w Node i trzy zestawy end-to-end: scenariusze regresyjne, matryca urządzeń i matryca przeglądarek. Publiczne API, cykl życia silnika, host pluginów, wersje pakietów i narzędzia wydania testowane bez adaptera.", "545 tests across 47 files, zero browser in the loop, plus 17 benchmarks in Node and three end-to-end suites: regression scenarios, a device matrix and a browser matrix. The public API, the engine lifecycle, the plugin host, package versions and the release tooling are tested without the adapter."),
     [
         ("h2", "Uruchamianie", "Running"),
         ("code", "Bash", """
npm test
npm run test:watch
npm run typecheck
npm run build
"""),
         ("h2", "Struktura testów", "Test layout"),
         ("table", [P("Plik", "File"), P("Zakres", "Scope")], [
             ["<code>tests/unit/Time.test.ts</code>", P("clamp, timeScale, pauza, stały krok, elapsed", "clamp, timeScale, pause, fixed step, elapsed")],
             ["<code>tests/unit/Scheduler.test.ts</code>", P("delay, interval, anulowanie, właściciel, błędy", "delay, interval, cancellation, owner, errors")],
             ["<code>tests/unit/Random.test.ts</code>", P("powtarzalność seeda, zakresy, <code>fork</code>, stan", "seed reproducibility, ranges, <code>fork</code>, state")],
             ["<code>tests/unit/EventBus.test.ts</code>", P("subskrypcje, odpinanie, izolacja błędów", "subscriptions, unsubscribe, error isolation")],
             ["<code>tests/unit/GameObject.test.ts</code>", P("hierarchia, transformacje świata, tagi, komponenty", "hierarchy, world transforms, tags, components")],
             ["<code>tests/unit/Components.test.ts</code>", P("cykl życia i kolejność faz", "lifecycle and phase order")],
             ["<code>tests/unit/SceneObjects.test.ts</code>", P("spawn, deferred destroy, zapytania, grupy, sync", "spawn, deferred destroy, queries, groups, sync")],
             ["<code>tests/unit/Scene.test.ts</code>", P("cykl <code>create/update/shutdown</code>", "<code>create/update/shutdown</code> cycle")],
             ["<code>tests/unit/PublicApi.test.ts</code>", P("stabilność eksportów, typów i izolacja adaptera", "export/type stability and adapter isolation")],
             ["<code>tests/unit/Engine.test.ts</code>", P("cykl życia silnika na atrapie adaptera", "engine lifecycle on a fake adapter")],
             ["<code>tests/unit/InputManager.test.ts</code>", P("port wejścia, akcje, pointer, blur", "input port, actions, pointer, blur")],
             ["<code>tests/unit/AssetManager.test.ts</code>", P("rejestracja, kolejka, backend tekstur, refcount", "registration, queue, texture backend, refcount")],
             ["<code>tests/unit/AssetManifest.test.ts</code>", P("identyfikatory, duplikaty, referencje, budżet rozmiarów", "identifiers, duplicates, references, size budget")],
             ["<code>tests/unit/AssetPipeline.test.ts</code>", P("statusy, anulowanie, retry, GC, raport", "statuses, cancel, retry, GC, report")],
             ["<code>tests/unit/TiledMap.test.ts</code>", P("import Tiled: warstwy, kafelki, obiekty", "Tiled import: layers, tiles, objects")],
             ["<code>tests/unit/ProjectFormat.test.ts</code>", P("format v1: wersja, duplikaty, brakujące pola", "v1 format: version, duplicates, missing fields")],
             ["<code>tests/unit/ProjectSchema.test.ts</code>", P("schemat v2: typy, zakresy, referencje, nieznane pola", "v2 schema: types, ranges, references, unknown fields")],
             ["<code>tests/unit/ProjectMigration.test.ts</code>", P("v1 → v2, koperta, suma kontrolna, wersja przyszła", "v1 → v2, envelope, checksum, future version")],
             ["<code>tests/unit/ProjectRepository.test.ts</code>", P("zapis atomowy, weryfikacja, backup, przywracanie", "atomic save, verification, backup, restore")],
             ["<code>tests/unit/SaveStores.test.ts</code>", P("memory, localStorage, HTTP, zapisy gracza, uszkodzenie", "memory, localStorage, HTTP, player saves, corruption")],
             ["<code>tests/unit/SqlSaveStore.test.ts</code>", P("DDL i zapytania dla obu dialektów, zgodność z serwerem", "DDL and queries for both dialects, server parity")],
             ["<code>tests/unit/Easing.test.ts</code>", P("28 krzywych: zakresy, wartości graniczne, własne funkcje (8 testów)", "28 curves: ranges, endpoints, custom functions (8 tests)")],
             ["<code>tests/unit/Tween.test.ts</code>", P("interpolacja, delay, repeat/yoyo, cancel, sekwencje, właściciele (28 testów)", "interpolation, delay, repeat/yoyo, cancel, sequences, owners (28 tests)")],
             ["<code>tests/unit/AudioManager.test.ts</code>", P("kanały, głośności, mute, kolejka autoplay, sprzątanie", "channels, volumes, mute, autoplay queue, cleanup")],
             ["<code>tests/unit/SceneEffects.test.ts</code>", P("tweeny i dźwięki sceny, animacje klatek, efekty kamery", "scene tweens and sounds, frame animations, camera effects")],
             ["<code>tests/unit/RenderPort.test.ts</code>", P("kompletność delegacji portu renderu", "render port delegation completeness")],
             ["<code>tests/unit/EngineConfig.test.ts</code>", P("walidacja <code>EngineOptions</code>", "<code>EngineOptions</code> validation")],
             ["<code>tests/unit/Profiler.test.ts</code>", P("okno próbek, znaczniki, wyłączanie, sortowanie statystyk (9 testów)", "sample window, markers, disabling, stat sorting (9 tests)")],
             ["<code>tests/unit/LogBuffer.test.ts</code>", P("pojemność, obcinanie, filtry poziomu, kontekstu i tekstu, wersjonowanie (13 testów)", "capacity, trimming, level/context/text filters, versioning (13 tests)")],
             ["<code>tests/unit/LogPanel.test.ts</code>", P("filtry, liczniki poziomów, etykiety, widoczność, sprzątanie DOM (9 testów)", "filters, level counters, labels, visibility, DOM cleanup (9 tests)")],
             ["<code>tests/unit/DebugViews.test.ts</code>", P("stan widoków, przełączanie, wsparcie adaptera, synchronizacja (7 testów)", "view state, toggling, adapter support, syncing (7 tests)")],
             ["<code>tests/unit/DebugOverlay.test.ts</code>", P("linie overlayu, fps, pamięć, etykiety PL/EN (6 testów)", "overlay lines, fps, memory, PL/EN labels (6 tests)")],
             ["<code>tests/unit/Diagnostics.test.ts</code>", P("sekcje raportu, wnioski, eksport JSON, pobieranie pliku (8 testów)", "report sections, findings, JSON export, file download (8 tests)")],
             ["<code>tests/unit/AssetDiagnostics.test.ts</code>", P("nieużywane, brakujące i bez licencji zasoby, rozmiary z data URI (10 testów)", "unused, missing and unlicensed assets, sizes from data URIs (10 tests)")],
             ["<code>tests/unit/Plugins.test.ts</code>", P("manifest, zależności, cykle, uprawnienia, systemy, importery, panele, sprzątanie (34 testy)", "manifest, dependencies, cycles, permissions, systems, importers, panels, teardown (34 tests)")],
             ["<code>tests/unit/PlaygroundAssets.test.ts</code>", P("ścieżki zasobów względem <code>b2d-base</code>, data URI, stan URL (10 testów)", "asset paths against <code>b2d-base</code>, data URIs, URL state (10 tests)")],
             ["<code>tests/unit/HostingConfig.test.ts</code>", P("hash inline skryptów dla CSP, brak <code>unsafe-inline</code> w <code>script-src</code> (5 testów)", "inline script hashes for CSP, no <code>unsafe-inline</code> in <code>script-src</code> (5 tests)")],
             ["<code>tests/unit/Semver.test.ts</code>", P("parsowanie wersji, porównania, zakresy <code>^</code>, <code>~</code>, <code>&gt;=</code>, alternatywy (15 testów)", "version parsing, comparisons, <code>^</code>, <code>~</code>, <code>&gt;=</code> ranges, alternatives (15 tests)")],
             ["<code>tests/unit/DebugSurface.test.ts</code>", P("integracja debugowania w silniku: profilowanie, widoki per port, panel logów w DOM, raport diagnostyczny (9 testów)", "debugging wired into the engine: profiling, per-port views, DOM log panel, diagnostics report (9 tests)")],
             ["<code>tests/unit/ApiSnapshot.test.ts</code>", P("snapshot 316 eksportów, rozróżnienie dodania i usunięcia symbolu, zgodność wersji z <code>package.json</code> (3 testy)", "a 316-export snapshot, added/removed symbol distinction, version parity with <code>package.json</code> (3 tests)")],
             ["<code>tests/unit/Resilience.test.ts</code>", P("błędy sieci, uszkodzony i przyszły zapis, dowolne śmieci w imporcie projektu (9 testów)", "network errors, corrupted and future saves, arbitrary garbage on project import (9 tests)")],
             ["<code>tests/unit/Stability.test.ts</code>", P("kanały funkcji, kompletność rejestru, zgodność raportu ze stałymi wersji (9 testów)", "feature channels, registry completeness, report parity with the version constants (9 tests)")],
             ["<code>tests/unit/Deprecation.test.ts</code>", P("rejestr deprecacji, jedno powiadomienie na sesję, format komunikatu (6 testów)", "deprecation registry, one notice per session, message format (6 tests)")],
             ["<code>tests/unit/WorkspaceVersions.test.ts</code>", P("lockstep wersji, przypięte zależności wewnętrzne, semver, kontrakt changelogu i ADR (8 testów)", "version lockstep, pinned internal dependencies, semver, the changelog and ADR contract (8 tests)")],
             ["<code>tests/unit/MigrateTool.test.ts</code>", P("migracja projektu i zapisu z tekstu: idempotencja, wersja z przyszłości, śmieci, licencje (11 testów)", "project and save migration from text: idempotence, future versions, garbage, licences (11 tests)")],
             ["<code>tests/integration/engine.test.ts</code>", P("rejestracja scen, przełączanie, pojedynczy <code>game</code>", "scene registration, switching, single <code>game</code>")],
         ]),
         ("h2", "Mock canvasu", "Canvas mock"),
         ("code", "TypeScript", """
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
  return {
    canvas: this,
    fillRect: () => undefined,
    clearRect: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => undefined,
    createImageData: () => [],
    setTransform: () => undefined,
    drawImage: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    measureText: () => ({ width: 0 }),
    fillText: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    rotate: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    fill: () => undefined,
  } as never;
};
"""),
         ("h2", "Benchmarki", "Benchmarks"),
         ("p", "Benchmarki mają osobny config, bo działają w środowisku <code>node</code> — bez DOM-u, bez mocka canvasu i bez Phasera. Dzięki temu mierzą kod silnika, a nie narzut jsdom. Przypadki są zwykłym plikiem testowym, więc uruchamiają się tą samą komendą co reszta, tylko innym configiem.",
          "Benchmarks have a separate config because they run in the <code>node</code> environment — no DOM, no canvas mock, no Phaser. They therefore measure engine code instead of jsdom overhead. The cases are an ordinary test file, so they run with the same command as everything else, just a different config."),
         ("code", "TypeScript", """
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["benchmarks/**/*.test.ts"]
  }
});
"""),
         ("code", "TypeScript", """
import { runBenchmarks } from "./runner";
import { BENCHMARK_CASES } from "./cases";

test("benchmarks", () => {
  const report = runBenchmarks(BENCHMARK_CASES);
  expect(report.benchmarks.length).toBe(BENCHMARK_CASES.length);
});
"""),
         ("note", "info", "Dlaczego własny runner", "Why a custom runner", "Wbudowany tryb <code>vitest bench</code> nie ma reportera JSON, a jego przypadki dzielą wspólny JIT, więc liczby potrafią być zaniżone. <code>benchmarks/runner.ts</code> robi rozgrzewkę, próbkuje przez stały czas i zwraca medianę — wynik jest porównywalny między przebiegami i trafia do pliku.",
          "The built-in <code>vitest bench</code> mode has no JSON reporter and its cases share one JIT, so the numbers can come out understated. <code>benchmarks/runner.ts</code> warms up, samples for a fixed duration and returns the median — the result is comparable between runs and lands in a file."),
         ("h2", "Scenariusze end-to-end", "End-to-end scenarios"),
         ("p", "Trzy zestawy, każdy na prawdziwym <code>dist</code> i prawdziwej przeglądarce. Nie testują jednostek — testują to, co widzi gracz: czy płótno wstaje, czy sterowanie przesuwa gracza, czy zapis wraca po odświeżeniu.",
          "Three suites, each running the real <code>dist</code> in a real browser. They do not test units — they test what the player sees: whether the canvas boots, whether input moves the player, whether a save survives a refresh."),
         ("table", [P("Zestaw", "Suite"), P("Komenda", "Command"), P("Zakres", "Scope")], [
             ["<code>e2e-scenarios</code>", "<code>npm run test:scenarios</code>", P("2 scenariusze, 31 sprawdzeń: rozgrywka, pauza, wyciszenie, przykłady, panel debugowania, zapis po odświeżeniu, restart, brakujący asset", "2 scenarios, 31 checks: gameplay, pause, mute, examples, debug panel, save after refresh, restart, missing asset")],
             ["<code>e2e-matrix</code>", "<code>npm run test:matrix</code>", P("7 profili urządzeń, proporcja kadru, przewijanie, cele dotykowe, modal, reduced motion, resize", "7 device profiles, canvas ratio, scrolling, touch targets, modal, reduced motion, resize")],
             ["<code>e2e-compat</code>", "<code>npm run test:compat</code>", P("Chromium i Firefox po 12 sprawdzeń: start, WebGL lub canvas 2D, sterowanie, pauza, język, CSP bez naruszeń", "Chromium and Firefox with 12 checks each: boot, WebGL or canvas 2D, input, pause, language, CSP without violations")],
         ]),
         ("note", "tip", "Dlaczego bot, a nie skrypt pozycji", "Why a bot, not a position script",
          "Pierwsza wersja scenariusza wciskała klawisz na stałą liczbę milisekund i sprawdzała współrzędną. W headless Chromium pętla bywa dławiona (<code>getFps() === 0</code>), więc wynik zależał od maszyny. Dziś bot schodzi do celu po osi z martwą strefą 12 px i przerywa po 6 s bez postępu — mierzy zachowanie, nie timing.",
          "The first version held a key for a fixed number of milliseconds and asserted a coordinate. In headless Chromium the loop can be throttled (<code>getFps() === 0</code>), so the result depended on the machine. Today the bot walks to the target axis by axis with a 12 px dead zone and aborts after 6 s without progress — it measures behaviour, not timing."),
         ("h2", "Matryca urządzeń i przeglądarek", "Device and browser matrix"),
         ("code", "Bash", """
npm run test:matrix
npm run test:compat
node scripts/e2e-compat.mjs --engine=firefox
"""),
         ("p", "Pełny opis profili, wspieranych wersji i znanych ograniczeń jest na stronie <a href=\"#compat\">Przeglądarki i ograniczenia</a>. Tutaj wystarczy jedna zasada: pominięty silnik (np. WebKit bez bibliotek systemowych) jest raportowany jako pominięty, nigdy jako zaliczony.",
          "The full description of profiles, supported versions and known limitations lives on <a href=\"#compat\">Browsers and limitations</a>. One rule is enough here: a skipped engine (e.g. WebKit without system libraries) is reported as skipped, never as passed."),
         ("h2", "Audyt licencji w CI", "Licence audit in CI"),
         ("code", "Bash", """
npm run audit:licenses:check
"""),
         ("p", "Brama sprawdza <code>package-lock.json</code> i katalog zasobów gry. Wynik na dziś: 308 pakietów (2 runtime), 308 dozwolonych, 0 do przeglądu, 0 nieznanych, 0 niedozwolonych. Polityka i procedura dodania zależności: <a href=\"#policy\">Wersjonowanie i zgłaszanie błędów</a>.",
          "The gate checks <code>package-lock.json</code> and the game asset catalogue. Today's result: 308 packages (2 runtime), 308 allowed, 0 for review, 0 unknown, 0 forbidden. The policy and the steps for adding a dependency: <a href=\"#policy\">Versioning and bug reporting</a>."),
         ("h2", "CI", "CI"),
         ("code", "yaml", """
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run bench:check
      - run: npm run build
      - run: npm run bundle:check
      - run: npm run audit:licenses:check
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium firefox
      - run: npm run build
      - run: npm run test:scenarios
      - run: npm run test:matrix
      - run: npm run test:compat
      - run: npm run test:hosting
"""),
     ], "testy tests vitest ci pipeline jsdom build typecheck benchmarki regresja"),

page("example", "more", P("Gra referencyjna: Top-Down", "Reference game: Top-Down"), P("Kompletna gra na publicznym API: ruch, kolizje, zbieranie, HUD, menu i restart.", "A complete game on the public API: movement, collisions, collecting, HUD, menu and restart."),
     [
         ("h2", "Co zawiera", "What it contains"),
         ("table", [P("Element", "Element"), P("Implementacja", "Implementation")], [
             [P("Ruch w 4 kierunkach", "4-direction movement"), P("komponent <code>PlayerController</code> w fazie <code>physics</code>, 220 px/s", "<code>PlayerController</code> component in the <code>physics</code> phase, 220 px/s")],
             [P("Ściany", "Walls"), P("<code>body: { type: \"static\" }</code> + <code>addCollider</code> na tagu <code>wall</code>", "<code>body: { type: \"static\" }</code> + <code>addCollider</code> over the <code>wall</code> tag")],
             [P("Zbieranie", "Collecting"), P("8 kryształów, <code>addOverlap</code> na obiekt → <code>game:collected</code>", "8 crystals, per-object <code>addOverlap</code> → <code>game:collected</code>")],
             [P("HUD", "HUD"), P("tekst z <code>scrollFactor: 0</code>, aktualizowany przez <code>setRender</code>", "text with <code>scrollFactor: 0</code>, updated through <code>setRender</code>")],
             [P("Menu i pauza", "Menu and pause"), P("<code>MenuScene</code> ↔ <code>GameScene</code>, <code>Esc</code>", "<code>MenuScene</code> ↔ <code>GameScene</code>, <code>Esc</code>")],
             [P("Restart", "Restart"), P("<code>R</code> → <code>startScene(\"game\")</code>", "<code>R</code> → <code>startScene(\"game\")</code>")],
         ]),
         ("h2", "Fragment sceny", "Scene excerpt"),
         ("code", "apps/playground/src/scenes/GameScene.ts", """
create(): void {
  this.getPhysics().setWorldBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  this.getCamera().setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const player = this.createSprite("player", {
    id: "player",
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    displayWidth: 32,
    displayHeight: 32,
    body: { type: "dynamic", shape: "circle", radius: 14, collideWorldBounds: true },
    tags: ["player"],
    depth: 10,
  });
  player.add(new PlayerController(220));
  this.getCamera().follow(player, 0.08, 0.08);

  const crystals = this.group("crystals");
  for (const [index, spot] of CRYSTAL_SPOTS.entries()) {
    const crystal = this.createSprite("coin", {
      x: spot.x,
      y: spot.y,
      body: { type: "static" },
      tags: ["crystal"],
    });
    crystal.add(new Bobbing(6, 700 + index * 60));
    crystals.add(crystal);

    const handle = this.getPhysics().addOverlap(player, crystal, (_target, hit) => this.collect(hit));
    this.colliders.set(crystal, handle);
  }

  this.getPhysics().addCollider(player, this.findByTag("wall"));
  this.hud = this.createText("0 / 8", { x: 16, y: 16, scrollFactor: 0, depth: 100 });
}
"""),
         ("h2", "Sterowanie", "Controls"),
         ("p", "<span class=\"kbd\">WASD</span> lub <span class=\"kbd\">↑←↓→</span> ruch, <span class=\"kbd\">R</span> restart, <span class=\"kbd\">M</span> menu, <span class=\"kbd\">N</span> wyciszenie, <span class=\"kbd\">[</span> <span class=\"kbd\">]</span> tempo, <span class=\"kbd\">P</span> pauza.", "<span class=\"kbd\">WASD</span> or <span class=\"kbd\">↑←↓→</span> to move, <span class=\"kbd\">R</span> restart, <span class=\"kbd\">M</span> menu, <span class=\"kbd\">N</span> mute, <span class=\"kbd\">[</span> <span class=\"kbd\">]</span> tempo, <span class=\"kbd\">P</span> pause."),
         ("h2", "Audio, animacje i efekty w grze", "Audio, animation and effects in the game"),
         ("p", "Gra referencyjna ćwiczy cały zestaw z fazy 9: dźwięk zbierania z kanału <code>sfx</code>, iskrę animowaną klipem z manifestu, tweeny etykiety <code>+1</code>, błysk i wstrząs kamery przy zebraniu, wyciszenie globalne pod <code>N</code> oraz ikonę stanu dźwięku w HUD. Demonstracja świadomie nie ma muzyki w tle — jedno <code>.wav</code> wystarcza, żeby pokazać kanały i wyciszenie, a bundel zostaje mały.",
          "The reference game exercises the whole phase 9 set: a pickup sound on the <code>sfx</code> channel, a spark animated by a clip declared in the manifest, tweens of the <code>+1</code> label, a camera flash and shake on every pickup, global mute under <code>N</code> and a sound-state icon in the HUD. The demo deliberately ships no background music — one <code>.wav</code> is enough to show channels and mute while keeping the bundle small."),
         ("table", [P("Element", "Element"), P("Mechanizm", "Mechanism")], [
             [P("Dźwięk zbierania", "Pickup sound"), "<code>this.playSound(\"pickup\", { volume: 0.6 })</code>"],
             [P("Iskra", "Spark"), "<code>playAnimation(spark, \"spark:spin\")</code> + dwa tweeny w pętli"],
             [P("Kryształ po zebraniu", "Collected crystal"), P("komponent <code>CollectEffect</code>: skala 1 → 1,6 i zanik w 0,18 s", "the <code>CollectEffect</code> component: scale 1 → 1.6 and fade over 0.18 s")],
             [P("Etykieta +1", "Label +1"), "<code>this.tween(label, { y, alpha: 0 }, ...)</code> + <code>TimedDestroy(0.7)</code>"],
             [P("Efekt kamery", "Camera effect"), "<code>flash(90, ...)</code> i <code>shake(110, 0.004)</code> przy każdym zebraniu"],
             [P("Wyciszenie", "Mute"), "<code>N</code> → <code>getAudio().toggleMute()</code>, ikona 🔊/🔇 w HUD"],
             [P("Sprzątanie", "Cleanup"), P("<code>internalShutdown()</code>: <code>stopOwner()</code> dźwięków sceny i <code>stopAll()</code> tweenów", "<code>internalShutdown()</code>: <code>stopOwner()</code> for scene sounds and <code>stopAll()</code> for tweens")],
         ]),
         ("code", "apps/playground/src/scenes/GameScene.ts", """
private createSpark(): void {
  const spark = this.createSprite("spark", {
    id: "spark",
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2 - 90,
    displayWidth: 40,
    displayHeight: 40,
    depth: 8,
    tags: ["fx"],
  });
  this.playAnimation(spark, "spark:spin");
  this.tween(spark, { rotation: Math.PI * 2 }, { duration: 3.2, repeat: -1, easing: "linear" });
  this.tween(spark, { y: spark.y - 26 }, { duration: 1.4, yoyo: true, repeat: -1, easing: "sineInOut" });
}

private collect(crystal: GameObject): void {
  if (crystal.destroyed || !crystal.isActiveInHierarchy) return;
  this.crystalColliders.get(crystal)?.destroy();
  this.crystalColliders.delete(crystal);
  this.getPhysics().detachBody(crystal);
  crystal.remove(Bobbing);
  crystal.removeTag("collectible").addTag("collected");
  crystal.add(new CollectEffect(0.18));
  this.crystals = this.crystals.filter((entry) => entry !== crystal);
  this.score += 1;
  this.collected.push(crystal.id);
  this.playSound("pickup", { volume: 0.6 });
  this.getCamera().flash(90, 226, 183, 20);
  this.getCamera().shake(110, 0.004);
  this.spawnScoreLabel(crystal);
  this.updateHud();
}
"""),
         ("h2", "Playground i modal przykładów", "Playground and examples modal"),
         ("p", "Playground ma minimalistyczny szkielet wspólny z tą dokumentacją: pasek z logo, przełącznik języka, motyw, podgląd gry i pasek stanu. Nad planszą leży przycisk <b>Przykłady</b> (skrót <code>E</code>), który otwiera modal z katalogiem scenariuszy.", "The playground shares a minimalist shell with this documentation: a bar with logo, language switch, theme, the game view and a status line. Above the canvas sits the <b>Examples</b> button (shortcut <code>E</code>) which opens a modal with the scenario catalogue."),
         ("table", [P("Skrót", "Shortcut"), P("Działanie", "Action")], [
             ["<code>E</code>", P("Otwiera modal przykładów", "Opens the examples modal")],
             ["<code>F</code>", P("Pełny ekran planszy", "Fullscreen canvas")],
             ["<code>P</code>", P("Pauza i wznowienie silnika", "Pause and resume the engine")],
             ["<code>R</code> / <code>M</code>", P("Restart scenariusza / powrót do menu", "Restart scenario / back to menu")],
             ["<code>N</code>", P("Wyciszenie i przywrócenie dźwięku", "Mute and unmute audio")],
             ["<code>[</code> <code>]</code> <code>\\</code>", P("Tempo 0,5x / 2x / 1x", "Tempo 0.5x / 2x / 1x")],
             ["<code>Esc</code>", P("Zamyka modal", "Closes the modal")],
             ["<code>↑</code> <code>↓</code> <code>Enter</code>", P("Nawigacja i uruchomienie przykładu", "Navigate and run an example")],
         ]),
         ("p", "Katalog przykładów jest danymi: każdy wpis to <code>id</code>, tytuł i opis w PL/EN, tagi, <code>status</code> oraz <code>scene</code>. Dodanie scenariusza to jedna pozycja w <code>apps/playground/src/examples.ts</code> plus scena — modal i wyszukiwarka aktualizują się same.", "The example catalogue is data: every entry has an <code>id</code>, a PL/EN title and description, tags, a <code>status</code> and a <code>scene</code>. Adding a scenario is one entry in <code>apps/playground/src/examples.ts</code> plus a scene — the modal and its filter update themselves."),
         ("code", "apps/playground/src/examples.ts", """
{
  id: "level-json",
  index: "05",
  title: { pl: "Poziom z JSON", en: "Level from JSON" },
  description: {
    pl: "Wczytanie projektu przez formatVersion i walidację błędów.",
    en: "Loading a project through formatVersion and error validation."
  },
  tags: ["project-format", "assets"],
  status: "planned"
}
"""),
         ("h2", "Czas i losowość w przykładzie", "Time and randomness in the example"),
         ("p", "Gra pokazuje model czasu w praktyce. Kropki pojawiają się w stałym kroku co 60 kroków symulacji i w burzach co 5 sekund na timerze sceny, więc ich rytm nie zależy od liczby klatek. Pozycje pochodzą z <code>getRandom()</code> z seedem <code>1337</code>, więc po restarcie układ jest identyczny. Klawisze <code>[</code> i <code>]</code> zmieniają skalę czasu, a HUD pokazuje aktualny mnożnik obok wyniku.",
          "The game demonstrates the time model in practice. Sparkles appear in the fixed step every 60 simulation ticks and in bursts every 5 seconds from the scene timer, so their rhythm does not depend on the frame count. Positions come from <code>getRandom()</code> seeded with <code>1337</code>, so a restart reproduces the same layout. The <code>[</code> and <code>]</code> keys change the time scale and the HUD shows the current multiplier next to the score."),
         ("table", [P("Element", "Element"), P("Mechanizm", "Mechanism")], [
             [P("Kropki co 60 kroków", "Sparkles every 60 ticks"), "<code>Scene.fixedUpdate</code> + <code>fixedStep.hz = 60</code>"],
             [P("Burza co 5 s", "Burst every 5 s"), "<code>getTimer().interval(5, ...)</code>"],
             [P("Pozycje kropek", "Sparkle positions"), "<code>getRandom().float(...)</code>"],
             [P("Tempo gry", "Game tempo"), "<code>[</code> = 0.5x, <code>]</code> = 2x, <code>&#92;</code> = 1x"],
             [P("Pauza", "Pause"), "<code>P</code> → <code>engine.pause()/resume()</code>"],
         ]),
         ("note", "tip", "Otwieranie modala pauzuje grę", "Opening the modal pauses the game",
          "Silnik dostaje <code>pause()</code> przy otwarciu i <code>resume()</code> przy zamknięciu, ale tylko wtedy, gdy przed otwarciem działał. Dzięki temu przeglądanie przykładów nie przewija rozgrywki.",
          "The engine is paused when the modal opens and resumed on close, but only if it was running before. Browsing examples never advances gameplay."),
         ("note", "tip", "Ćwiczenie", "Exercise",
          "Dodaj wroga: <code>createSprite(\"player\", { body: { type: \"dynamic\" }, tags: [\"enemy\"] })</code>, komponent z fazą <code>physics</code>, który normalizuje wektor do gracza i ustawia 120 px/s, oraz <code>addCollider(player, this.findByTag(\"enemy\"))</code>.",
          "Add an enemy: <code>createSprite(\"player\", { body: { type: \"dynamic\" }, tags: [\"enemy\"] })</code>, a component in the <code>physics</code> phase that normalises the vector toward the player and sets 120 px/s, plus <code>addCollider(player, this.findByTag(\"enemy\"))</code>."),
     ], "przyklad example gra top-down demo playground timery random fixed step timeScale pauza"),

page("recipes", "more", P("Przepisy", "Recipes"), P("Gotowe rozwiązania typowych zadań — do skopiowania.", "Ready-made solutions for common tasks — copy and go."),
     [
         ("h2", "Pauza z nakładką", "Pause with overlay"),
         ("code", "TypeScript", """
update(): void {
  if (this.getInput().isKeyPressed("Escape")) {
    const paused = this.getTime().isPaused;
    paused ? this.getTime().resume() : this.getTime().pause();
    this.getObject("pause-overlay")?.setVisible(!paused);
  }
}
"""),
         ("h2", "Licznik i rytm niezależny od klatek", "A timer and a rhythm independent of frames"),
         ("code", "TypeScript", """
create(): void {
  this.getTimer().interval(1, () => this.spawnWave(), { repeat: 3 });
  this.getTimer().delay(0.4, () => this.getCamera().flash(120, 255, 255, 255));
}

update(): void {
  if (this.getInput().isActionPressed("pause")) this.getTime().pause();
}

fixedUpdate(fixedDelta: number): void {
  this.simulation.Tick(fixedDelta);
}
"""),
         ("p", "Timer sceny liczy czas gry, więc pauza i <code>timeScale</code> działają na niego tak samo jak na <code>update()</code>. Wszystkie zadania sceny są anulowane przy <code>shutdown()</code> — nie trzeba ich trzymać w polach.",
          "A scene timer counts game time, so pause and <code>timeScale</code> affect it exactly like <code>update()</code>. All scene tasks are cancelled in <code>shutdown()</code>, so there is no need to keep handles in fields."),
         ("h2", "Zwolnione tempo i hit-stop", "Slow motion and hit-stop"),
         ("code", "TypeScript", """
slowMotion(scale: number, seconds: number): void {
  const time = this.getTime();
  const previous = time.timeScale;
  time.setTimeScale(scale);
  this.delay(seconds, () => time.setTimeScale(previous));
}

hitStop(): void {
  this.slowMotion(0.15, 0.08);
  this.getCamera().shake(90, 0.005);
}
"""),
         ("p", "<code>deltaTime</code> jest skalowany, więc tweeny, timery i <code>elapsed</code> zwalniają razem z grą, a <code>realDeltaTime</code> zostaje rzeczywisty — na nim liczysz efekty interfejsu, które mają trwać tyle samo czasu niezależnie od tempa gry.",
          "<code>deltaTime</code> is scaled, so tweens, timers and <code>elapsed</code> slow down together with the game, while <code>realDeltaTime</code> stays real — use it for UI effects that should last the same wall-clock time regardless of game speed."),
         ("h2", "Drzwi otwierane kontaktem", "Contact-triggered door"),
         ("code", "TypeScript", """
const door = this.createRect(40, 80, {
  id: "door",
  x: 800,
  y: 400,
  color: 0x3a4d3a,
  body: { type: "static" },
  depth: 10,
});

this.getPhysics().addOverlap(this.getObject("player"), door, () => {
  if (this.opened) return;
  this.opened = true;
  this.getEvents().emit("door:open", { id: "door" });
  this.destroyObject("door");
});
"""),
         ("h2", "Ekran ładowania", "Loading screen"),
         ("code", "TypeScript", """
preload(): void {
  this.declareAssets(ASSETS);
  this.getAssets().onError((error) => {
    document.title = `Missing ${error.assetId}`;
  });
}

create(): void {
  const report = this.getAssets().report();
  document.title = report.counts.failed > 0 ? `${report.counts.failed} assets failed` : "Ready";
}
"""),
         ("h2", "Wczytanie poziomu z JSON", "Loading a level from JSON"),
         ("code", "TypeScript", """
async create(): Promise<void> {
  const raw = await fetch("/levels/level-1.json").then((response) => response.text());
  const result = importProject(raw, { verifyChecksum: true });
  if (!result.valid) throw new Error(result.errors.map((issue) => issue.message).join("\\n"));

  for (const asset of result.project.assets) {
    this.getAssets().declare([asset]);
  }

  for (const object of result.project.scenes[0]?.objects ?? []) {
    this.createSprite(object.asset ?? "missing", { id: object.id, x: object.x, y: object.y });
  }
}
"""),
         ("h2", "Slow motion przy trafieniu", "Slow motion on hit"),
         ("code", "TypeScript", """
hit(): void {
  this.getTime().setTimeScale(0.25);
  this.getTimer().delay(0.12, () => this.getTime().setTimeScale(1));
}
"""),
         ("h2", "Fala wrogów co kilka sekund", "Enemy wave every few seconds"),
         ("code", "TypeScript", """
create(): void {
  this.getTimer().delay(1.5, () => this.spawnWave());
  this.getTimer().interval(6, () => this.spawnWave(), { repeat: 4 });
}

shutdown(): void {
  this.getTimer().clear();
}

private spawnWave(): void {
  for (let index = 0; index < 5; index += 1) {
    this.spawnEnemy();
  }
  this.getEvents().emit("wave:spawned", { at: this.getTime().elapsed });
}
"""),
         ("h2", "Anulowanie zaplanowanych zadań", "Cancelling scheduled work"),
         ("code", "TypeScript", """
private bossTimer: TaskHandle | null = null;

startBossPhase(): void {
  this.bossTimer = this.getTimer().delay(10, () => this.failLevel());
}

skipBossPhase(): void {
  this.bossTimer?.cancel();
  this.bossTimer = null;
}

private failLevel(): void {
  this.getEvents().emit("level:failed", { reason: "timeout" });
}
"""),
         ("h2", "Deterministyczne losowanie", "Deterministic random draws"),
         ("code", "TypeScript", """
create(): void {
  const random = this.getRandom();
  for (let index = 0; index < 20; index += 1) {
    this.createEllipse(6, {
      id: `star-${index}`,
      x: random.float(0, this.width),
      y: random.float(0, this.height),
      color: 0x8ad7ff,
      tags: ["star"],
    });
  }
  this.getLogger().debug("map generated", { seed: random.seed });
}
"""),
         ("h2", "Przełączanie scen przez event", "Scene switching via events"),
         ("code", "TypeScript", """
engine.getEvents().on("request:scene", ({ to }) => engine.startScene(to));

this.getEvents().subscribeForScene(this.id, "request:scene", ({ to }) => {
  this.getLogger().info("leaving scene", { to });
});
"""),
     ], "przepisy recipes pauza drzwi loading json slow motion timery timer delay interval random seed anulowanie"),

page("troubleshooting", "more", P("Diagnostyka", "Troubleshooting"), P("Czarny ekran, brak canvasu i błędy startu — co sprawdzić po kolei.", "Black screen, missing canvas and boot errors — what to check first."),
     [
         ("p", "Playground pokazuje nakładkę <b>„Silnik nie wystartował”</b> z treścią wyjątku, gdy moduł gry rzuci błąd, gdy canvas nie powstanie w 8 sekund albo gdy nie uda się załadować modułu. Zamiast zgadywać, czytaj tę linię.", "The playground shows a <b>“The engine failed to start”</b> overlay with the exception text when the game module throws, when no canvas appears within 8 seconds, or when a module fails to load. Read that line instead of guessing."),
         ("table", [P("Objaw", "Symptom"), P("Przyczyna", "Cause"), P("Naprawa", "Fix")], [
             [P("Nakładka: <code>Nie udało się załadować modułu: …/src/main.ts</code>", "Overlay: <code>Failed to load module: …/src/main.ts</code>"), P("Serwer dev nie działa lub sesja wygasła — pliki <code>/src/*.ts</code> nie są serwowane", "The dev server is down or the session expired — <code>/src/*.ts</code> is not served"), P("Uruchom ponownie serwer; jeśli to nie pomaga, użyj builda: <code>npm run build:preview</code>", "Restart the server; if that fails use the build: <code>npm run build:preview</code>")],
             [P("Nakładka: <code>Failed to fetch dynamically imported module</code>", "Overlay: <code>Failed to fetch dynamically imported module</code>"), P("Brak <code>node_modules</code> po restarcie środowiska — Vite nie rozwiąże <code>phaser</code>", "Missing <code>node_modules</code> after an environment restart — Vite cannot resolve <code>phaser</code>"), "<code>npm install</code> + restart"],
             [P("Nakładka: <code>does not provide an export named …</code>", "Overlay: <code>does not provide an export named …</code>"), P("Typ zaimportowany jako wartość (eksport typów znika po transpilacji)", "A type imported as a value (type exports vanish after transpilation)"), P("Użyj <code>import type</code>", "Use <code>import type</code>")],
             [P("Czarny prostokąt, brak nakładki", "Black rectangle, no overlay"), P("Scena wystartowała, ale nie utworzyła obiektów", "The scene started but created no objects"), P("Sprawdź <code>create()</code> i logi sceny", "Check <code>create()</code> and scene logs")],
             [P("Gracz nie reaguje na klawisze", "Player ignores keys"), P("Kody <code>KeyboardEvent.code</code> podane wprost do Phasera", "<code>KeyboardEvent.code</code> passed straight to Phaser"), P("Silnik mapuje je przez <code>resolveKeyCode</code>", "The engine maps them via <code>resolveKeyCode</code>")],
             [P("Overlap nigdy się nie odpala", "Overlap never fires"), P("Trigger w zwykłej <code>Group</code> bez ciała fizycznego", "Trigger in a plain <code>Group</code> without a physics body"), P("Użyj <code>physics.add.staticGroup()</code>", "Use <code>physics.add.staticGroup()</code>")],
             [P("<code>Phaser scene \"x\" not found</code>", "<code>Phaser scene \"x\" not found</code>"), P("<code>startScene</code> przed gotowością gry", "<code>startScene</code> before the game is ready"), P("Silnik kolejkuje start do zdarzenia <code>READY</code>", "The engine defers the start to the <code>READY</code> event")],
         ]),
         ("h2", "Brakujący zasób, błąd sieci, zły projekt", "Missing asset, network error, broken project"),
         ("p", "Brak jednej tekstury nie zatrzymuje gry: zasób ląduje w stanie <code>failed</code> z komunikatem, scena tworzy pozostałe obiekty, a raport assetów nazywa plik. Sprawdzone scenariuszem <code>missing-asset</code> — gra startuje, ale raport pokazuje <code>failed: player</code>.",
          "One missing texture does not stop the game: the asset lands in the <code>failed</code> state with a message, the scene builds the remaining objects, and the asset report names the file. Verified by the <code>missing-asset</code> scenario — the game boots, yet the report shows <code>failed: player</code>."),
         ("code", "Browser console", """
engine.getAssets().report().failures;   // [{ id, src, message }]
engine.getAssets().diagnose({
  usedIds: ["player", "coin"],                                  // bez tego lista unused jest pusta
  references: { gameplay: ["player", "coin"], ui: ["logo"] }     // czego brakuje w manifeście
});
engine.getAssets().retry("player");     // ponów jedno ładowanie
"""),
         ("table", [P("Objaw", "Symptom"), P("Przyczyna", "Cause"), P("Naprawa", "Fix")], [
             [P("Zasób w <code>failed</code>, w sieci 404", "Asset in <code>failed</code>, 404 on the network"), P("Zła ścieżka bazowa po wdrożeniu w podkatalogu", "Wrong base path after deploying into a subdirectory"), P("Sprawdź <code>meta[name=\"b2d-base\"]</code>; ścieżki buduje <code>assetUrl()</code>, nigdy literały", "Check <code>meta[name=\"b2d-base\"]</code>; paths come from <code>assetUrl()</code>, never literals")],
             [P("<code>diagnose().missing</code> niepuste", "<code>diagnose().missing</code> is not empty"), P("Obiekt wskazuje id, którego nie ma w manifeście", "An object references an id absent from the manifest"), P("Dodaj wpis do manifestu albo popraw <code>asset</code> w obiekcie", "Add the manifest entry or fix the object's <code>asset</code>")],
             [P("<code>diagnose().unlicensed</code> niepuste", "<code>diagnose().unlicensed</code> is not empty"), P("Brak pola <code>license</code> w manifeście", "A missing <code>license</code> field in the manifest"), P("Uzupełnij licencję — import z <code>requireLicenses: true</code> tego nie przepuści", "Fill in the licence — an import with <code>requireLicenses: true</code> rejects it")],
             [P("Gra działa, potem przestaje ładować", "The game works, then stops loading"), P("Utracone połączenie w trakcie sesji", "Connection lost mid-session"), P("Nasłuchuj <code>online</code> i wywołaj <code>retry()</code>; stan gry nie zależy od sieci", "Listen for <code>online</code> and call <code>retry()</code>; game state does not depend on the network")],
         ]),
         ("code", "TypeScript", """
window.addEventListener("online", () => {
  void engine.getAssets().retryFailed();
});

const result = importProject(text, { requireLicenses: true });

if (!result.ok) {
  for (const problem of result.errors) {
    engine.getLogger().error(`${problem.code} @ ${problem.path}: ${problem.message}`);
  }
}
"""),
         ("note", "info", "Import nigdy nie rzuca", "Import never throws",
          "<code>importProject()</code> i <code>validateProject()</code> zwracają wynik nawet dla śmieci: pustego tekstu, urwanego JSON-a, <code>null</code> i liczby. Niepoprawny projekt nie wywala aplikacji edytora — trafia do listy błędów z kodem i ścieżką. Testy: <code>tests/unit/Resilience.test.ts</code>.",
          "<code>importProject()</code> and <code>validateProject()</code> return a result even for garbage: empty text, truncated JSON, <code>null</code> and a number. A broken project does not crash the editor — it lands in an error list with code and path. Tests: <code>tests/unit/Resilience.test.ts</code>."),
         ("h2", "Podgląd bez serwera", "Preview without a server"),
         ("p", "Plik <code>playground.html</code> w katalogu głównym zawiera cały silnik, sceny i zasoby w jednym dokumencie: jeden klasyczny <code>&lt;script&gt;</code> (bez <code>type=\"module\"</code>), zero importów, zero <code>blob:</code>, a tekstury jako <code>data:image/png;base64</code>. Klasyczny skrypt nie wymaga serwera modułów ani pozwolenia CSP na <code>blob:</code>, więc startuje także w sandboxowanym podglądzie pliku. Działa z <code>file://</code>, bez internetu, bez dev-serwera i bez CORS.", "The <code>playground.html</code> file in the repository root contains the whole engine, scenes and assets in a single document: one classic <code>&lt;script&gt;</code> tag (no <code>type=\"module\"</code>), zero imports, zero <code>blob:</code>, and textures embedded as <code>data:image/png;base64</code>. A classic script needs neither a module server nor a CSP allowance for <code>blob:</code>, so it also boots inside a sandboxed file preview. It runs from <code>file://</code>, offline, with no dev server and no CORS."),
         ("code", "Bash", """
npm run build:single   # build + inline bundle + assets -> playground.html
open playground.html   # albo upusc plik na przegladarke
"""),
         ("table", [P("Sposób", "Method"), P("Wymaga serwera", "Needs server"), P("Kiedy", "When")], [
             ["<code>npm run dev</code>", P("tak, Vite :5173", "yes, Vite :5173"), P("Praca nad kodem, HMR", "Development with HMR")],
             ["<code>npm run build:preview</code>", P("tak, statyczny :5175", "yes, static :5175"), P("Weryfikacja builda", "Verifying the build")],
             ["<code>playground.html</code>", P("nie", "no"), P("Podgląd pliku, offline, brak sieci", "File preview, offline, no network")],
         ]),
         ("note", "tip", "Dlaczego jeden plik", "Why a single file",
          "Podglądy plików w sandboxie serwują statyczny HTML i nie uruchamiają TypeScriptu ani serwera modułów — żądanie <code>/src/main.ts</code> kończy się błędem. Bundle w jednym pliku nie wykonuje żadnego żądania sieciowego, więc startuje zawsze.",
          "Sandbox file previews serve static HTML and run neither TypeScript nor a module server — a request for <code>/src/main.ts</code> fails. A single-file bundle issues no network request at all, so it always boots."),
         ("h2", "Diagnostyka w konsoli", "Console diagnostics"),
         ("code", "Browser console", """
engine.isRunning();
engine.getScenes().getActiveSceneId();
engine.getConfig();
engine.getInput().isActionDown("move-right");
engine.getAdapter().getGame().scene.getScene("game").scene.isActive();
"""),
         ("note", "warn", "Kolejność inicjalizacji", "Initialisation order",
          "<code>Phaser.Game</code> bootuje asynchronicznie. Sceny są dodawane dopiero po zdarzeniu <code>READY</code>, a <code>startScene</code> wywołane wcześniej jest kolejkowane. Każdy obiekt sceny wymaga wcześniejszego <code>initInternal</code>, dlatego adapter ustawia kontekst w <code>init()</code>, a nie w <code>create()</code>.",
          "<code>Phaser.Game</code> boots asynchronously. Scenes are added only after the <code>READY</code> event, and an earlier <code>startScene</code> call is queued. Every scene object requires a prior <code>initInternal</code>, which is why the adapter sets the context in <code>init()</code>, not in <code>create()</code>."),
     ], "diagnostyka troubleshooting czarny ekran black screen blad startu debug canvas"),

page("audit", "more", P("Zgodność ze specyfikacją", "Specification compliance"), P("Wynik audytu 19 rozdziałów specyfikacji, checklisty MVP, dziewięciu rozszerzeń API oraz faz 7–9, 14, 15, 17 i 19 (zasoby, projekt, zapisy, SQL, animacje, audio, debugowanie, pluginy, jakość, kompatybilność, wersjonowanie i wydania).", "Audit result across 19 specification chapters, the MVP checklist, the nine API extensions and phases 7–9, 14, 15, 17 and 19 (assets, project, saves, SQL, animation, audio, debugging, plugins, quality, compatibility, versioning and releases)."),
     [
         ("table", [P("Obszar", "Area"), P("Wymaganie", "Requirement"), P("Stan", "State"), P("Dowód", "Evidence")], [
             ["1", P("Konfiguracja i walidacja", "Config and validation"), "PASS", "<code>config.ts</code>, <code>Engine.ts</code>"],
             ["2", P("Cykl życia", "Lifecycle"), "PASS", "<code>start/stop/destroy</code>, test <code>single game</code>"],
             ["3", P("Pętla i czas", "Loop and time"), "PASS", P("<code>Time.ts</code>: clamp 0.1 s, <code>timeScale</code>, stały krok", "<code>Time.ts</code>: clamp 0.1 s, <code>timeScale</code>, fixed step")],
             ["4", P("Sceny", "Scenes"), "PASS", "<code>Scene.ts</code>, <code>SceneManager.ts</code>"],
             ["5", P("Obiekty", "Objects"), "PASS", "<code>GameObject.ts</code>, <code>Transform.ts</code>"],
             ["6", P("Renderowanie", "Rendering"), "PASS", P("delegacja do Phasera", "Phaser delegation")],
             ["7", P("Input", "Input"), "PASS", "<code>InputManager.ts</code>, mapowanie akcji"],
             ["8", P("Fizyka", "Physics"), "PASS", "<code>PhysicsManager.ts</code>, collider/overlap"],
             ["9", P("Kamera", "Camera"), "PASS", "<code>CameraManager.ts</code>"],
             ["10", P("Zasoby", "Assets"), "PASS", P("<code>assets/AssetManifest.ts</code>, <code>systems/AssetManager.ts</code>", "<code>assets/AssetManifest.ts</code>, <code>systems/AssetManager.ts</code>")],
             ["11", P("Format projektu", "Project format"), "PASS", P("<code>project/</code>, <code>formatVersion: 2</code> + migracja z v1", "<code>project/</code>, <code>formatVersion: 2</code> + v1 migration")],
             ["12", P("Zdarzenia", "Events"), "PASS", "<code>EventBus.ts</code>"],
             ["13", P("Debug", "Debug"), "PASS", P("<code>Logger.ts</code>, <code>DebugOverlay.ts</code>, <code>debug/</code> (5 klas), 68 testów", "<code>Logger.ts</code>, <code>DebugOverlay.ts</code>, <code>debug/</code> (5 classes), 68 tests")],
             ["14", P("Gra referencyjna", "Reference game"), "PASS", "<code>apps/playground</code>"],
             ["15", P("Testy", "Tests"), "PASS", "545/545, 47 plików + 3 zestawy e2e"],
             ["16", P("Typecheck", "Typecheck"), "PASS", "<code>tsc --noEmit</code>"],
             ["17", P("Build", "Build"), "PASS", "<code>dist/</code> 351 kB gzip, single-file 1.6 MB"],
             ["18", P("Struktura monorepo", "Monorepo structure"), "PASS", "<code>apps/</code>, <code>packages/</code>"],
             ["19", P("WASM opcjonalnie", "WASM optional"), "PASS", "<code>WasmBridge</code>, <code>required: false</code>"],
             ["20", P("Stabilne interfejsy publiczne", "Stable public interfaces"), "PASS", P("<code>PublicApi.test.ts</code>, <code>expectTypeOf</code>", "<code>PublicApi.test.ts</code>, <code>expectTypeOf</code>")],
             ["21", P("Cykl życia obiektów", "Object lifecycle"), "PASS", P("<code>createObject</code>, <code>activate</code>, <code>deactivate</code>, <code>destroy</code>", "<code>createObject</code>, <code>activate</code>, <code>deactivate</code>, <code>destroy</code>")],
             ["22", P("Bezpieczne usuwanie w update", "Safe destroy during update"), "PASS", P("kolejka <code>pendingDestroy</code>, test 17 przypadków", "queue <code>pendingDestroy</code>, 17 test cases")],
             ["23", P("Tagi, grupy, zapytania", "Tags, groups, queries"), "PASS", "<code>ObjectIndex.ts</code>, <code>Group</code>"],
             ["24", P("Hierarchia i transformacje", "Hierarchy and transforms"), "PASS", P("<code>children</code>, <code>world</code>, <code>isActiveInHierarchy</code>", "<code>children</code>, <code>world</code>, <code>isActiveInHierarchy</code>")],
             ["25", P("Cykl komponentów i kolejność systemów", "Component lifecycle and system order"), "PASS", "<code>Component.ts</code>, <code>SYSTEM_ORDER</code>"],
             ["26", P("Ocena ECS na prototypie", "ECS prototype evaluation"), P("OCENIONY", "EVALUATED"), P("<code>scripts/bench-ecs.mjs</code>, decyzja: nie wdrażać", "<code>scripts/bench-ecs.mjs</code>, decision: do not adopt")],
             ["27", P("Logika oddzielona od renderu", "Logic separated from rendering"), "PASS", P("sześć portów w <code>core/ports.ts</code>, test izolacji", "six ports in <code>core/ports.ts</code>, isolation test")],
             ["28", P("Testy API bez adaptera", "Adapter-free API tests"), "PASS", P("atrapy portów i adaptera w <code>tests/helpers/</code>", "port and adapter fakes in <code>tests/helpers/</code>")],
             ["29", P("Ujednolicony czas gry i rzeczywisty", "Unified game and real time"), "PASS", P("<code>deltaTime</code>, <code>realDeltaTime</code>, <code>elapsed</code>, <code>realElapsed</code>, <code>frame</code>", "<code>deltaTime</code>, <code>realDeltaTime</code>, <code>elapsed</code>, <code>realElapsed</code>, <code>frame</code>")],
             ["30", P("Timery, opóźnienia, interwały, anulowanie", "Timers, delays, intervals, cancellation"), "PASS", P("<code>Scheduler.ts</code>, <code>Timer.ts</code>, 14 testów", "<code>Scheduler.ts</code>, <code>Timer.ts</code>, 14 tests")],
             ["31", P("Pauza, wznowienie, skala czasu", "Pause, resume, time scale"), "PASS", P("<code>engine.pause/resume</code>, <code>setTimeScale</code>, <code>engine:timeScale</code>", "<code>engine.pause/resume</code>, <code>setTimeScale</code>, <code>engine:timeScale</code>")],
             ["32", P("Utrata fokusu i długie klatki", "Focus loss and long frames"), "PASS", P("<code>pauseOnHidden</code>, clamp, <code>engine:frameClamped</code>", "<code>pauseOnHidden</code>, clamp, <code>engine:frameClamped</code>")],
             ["33", P("Opcjonalny stały krok aktualizacji", "Optional fixed update step"), "PASS", P("<code>fixedStep.hz</code>, <code>Scene.fixedUpdate</code>, <code>fixedAlpha</code>", "<code>fixedStep.hz</code>, <code>Scene.fixedUpdate</code>, <code>fixedAlpha</code>")],
             ["34", P("Generator losowy z seedem", "Seeded random generator"), "PASS", P("<code>Random.ts</code>, <code>seed</code> w konfiguracji, 12 testów", "<code>Random.ts</code>, <code>seed</code> in the config, 12 tests")],
             ["35", P("Udokumentowane granice determinizmu", "Documented determinism limits"), "PASS", P("strona <a href=\"#determinism\">Determinizm</a>", "the <a href=\"#determinism\">Determinism</a> page")],
             ["36", P("Manifest zasobów i stabilne id", "Asset manifest and stable ids"), "PASS", "<code>AssetManifest.ts</code>, 17 testów"],
             ["37", P("Wykrywanie duplikatów i zepsutych referencji", "Duplicate and broken-reference detection"), "PASS", P("<code>duplicate-id</code>, <code>duplicate-src</code>, <code>broken-reference</code>", "<code>duplicate-id</code>, <code>duplicate-src</code>, <code>broken-reference</code>")],
             ["38", P("Anulowanie i ponawianie ładowania", "Cancellable and repeatable loading"), "PASS", P("<code>cancel()</code>, <code>retry()</code>, testy 18", "<code>cancel()</code>, <code>retry()</code>, 18 tests")],
             ["39", P("Zwalnianie zasobów i GC cache", "Asset release and cache GC"), "PASS", P("<code>hold/releaseOwner/retain/gc/releaseGroup</code>", "<code>hold/releaseOwner/retain/gc/releaseGroup</code>")],
             ["40", P("Raport rozmiarów i ciężkie zasoby", "Size report and heavy assets"), "PASS", P("<code>sizeReport</code>, <code>heavy-asset</code>, <code>formatSizes</code>", "<code>sizeReport</code>, <code>heavy-asset</code>, <code>formatSizes</code>")],
             ["41", P("Import Tiled (opcjonalny)", "Optional Tiled import"), "PASS", "<code>assets/TiledMap.ts</code>, 7 testów"],
             ["42", P("Licencje i formaty udokumentowane", "Licences and formats documented"), "PASS", P("strona <a href=\"#assets\">Zasoby</a>", "the <a href=\"#assets\">Assets</a> page")],
             ["43", P("Schemat v2 z podziałem sceny/zasoby/ustawienia", "v2 schema splitting scenes/assets/settings"), "PASS", "<code>project/Schema.ts</code>, 12 testów"],
             ["44", P("Walidacja typów, pól i referencji", "Type, field and reference validation"), "PASS", "<code>project/Validate.ts</code>"],
             ["45", P("Migracje i zachowanie nieznanych pól", "Migrations and preserved unknown fields"), "PASS", "<code>project/Migrate.ts</code>, <code>unknownFields</code>, 14 testów"],
             ["46", P("Atomowy zapis i kopie odzyskiwania", "Atomic save and recovery copies"), "PASS", "<code>project/Repository.ts</code>, 11 testów"],
             ["47", P("Zapisy gracza oddzielone od projektu", "Player saves separated from the project"), "PASS", "<code>save/PlayerSave.ts</code>, <code>SaveCorruptionError</code>"],
             ["48", P("Adaptery IndexedDB, localStorage, File System, HTTP", "IndexedDB, localStorage, File System, HTTP adapters"), "PASS", "<code>save/SaveStore.ts</code>, 15 testów"],
             ["49", P("SQL / MySQL / PostgreSQL", "SQL / MySQL / PostgreSQL"), "PASS", "<code>save/SqlSaveStore.ts</code>, <code>tools/save-server/</code>, 9 testów zgodności"],
             ["50", P("Audio: muzyka, efekty, kanały, głośność, wyciszenie", "Audio: music, effects, channels, volume, mute"), "PASS", P("<code>audio/AudioManager.ts</code>, 20 testów", "<code>audio/AudioManager.ts</code>, 20 tests")],
             ["51", P("Ograniczenia autoplay", "Autoplay restrictions"), "PASS", P("kolejka <code>pending</code>, <code>unlock()</code>, <code>audio:unlocked</code>", "<code>pending</code> queue, <code>unlock()</code>, <code>audio:unlocked</code>")],
             ["52", P("Animacje właściwości, easing, anulowanie, sekwencje", "Property animations, easing, cancel, sequences"), "PASS", P("<code>animation/Tween.ts</code>, <code>TweenManager.ts</code>, 36 testów", "<code>animation/Tween.ts</code>, <code>TweenManager.ts</code>, 36 tests")],
             ["53", P("Animacje sprite'ów i kontrola klatek", "Sprite animations and frame control"), "PASS", P("<code>playAnimation</code>, <code>setFrame</code>, <code>getAnimationState</code>", "<code>playAnimation</code>, <code>setFrame</code>, <code>getAnimationState</code>")],
             ["54", P("Wstrząs, fade, flash i proste efekty ekranowe", "Shake, fade, flash and simple screen effects"), "PASS", P("<code>CameraManager.flash/fadeOut/resetEffects</code>", "<code>CameraManager.flash/fadeOut/resetEffects</code>")],
             ["55", P("Stop dźwięku i animacji przy pauzie oraz zniszczeniu sceny", "Stop audio and animation on pause and scene teardown"), "PASS", P("<code>pauseAll/resumeAll</code>, <code>stopOwner</code>, <code>stopAll</code> tweenów", "<code>pauseAll/resumeAll</code>, <code>stopOwner</code>, tween <code>stopAll</code>")],
             ["56", P("Przykłady i testy cyklu życia animacji", "Examples and animation lifecycle tests"), "PASS", P("playground: dźwięk, iskra, tweeny, wyciszenie; <code>SceneEffects.test.ts</code>", "playground: sound, spark, tweens, mute; <code>SceneEffects.test.ts</code>")],
             ["57", P("Overlay: FPS, czas klatki, liczba obiektów, pamięć", "Overlay: FPS, frame time, object count, memory"), "PASS", P("<code>DebugOverlay</code>, 6 testów; pamięć jako <code>n/a</code> poza Chromium", "<code>DebugOverlay</code>, 6 tests; memory reported as <code>n/a</code> outside Chromium")],
             ["58", P("Panel logów z filtrami i poziomami", "Log panel with filters and levels"), "PASS", P("<code>LogBuffer</code> + <code>LogPanel</code>, 22 testy", "<code>LogBuffer</code> + <code>LogPanel</code>, 22 tests")],
             ["59", P("Widoki colliderów, osi, granic kamery i siatki", "Collider, axes, camera-bounds and grid views"), "PASS", P("<code>DebugViews</code>, <code>getSupport()</code> per adapter, 7 testów", "<code>DebugViews</code>, <code>getSupport()</code> per adapter, 7 tests")],
             ["60", P("Ostrzeżenia o nieużywanych i brakujących zasobach", "Warnings about unused and missing assets"), "PASS", P("<code>AssetManager.diagnose()</code>, kody <code>assets-*</code>, 10 testów", "<code>AssetManager.diagnose()</code>, <code>assets-*</code> codes, 10 tests")],
             ["61", P("Znaczniki profilera dla systemów silnika", "Profiler markers for engine systems"), "PASS", P("10 znaczników, okno 120 klatek, <code>Profiler</code> 9 testów", "10 markers, 120-frame window, <code>Profiler</code> 9 tests")],
             ["62", P("Eksport raportu diagnostycznego", "Diagnostic report export"), "PASS", P("<code>Diagnostics</code> JSON + pobieranie pliku, 8 testów", "<code>Diagnostics</code> JSON + file download, 8 tests")],
             ["63", P("Benchmarki obiektów, kolizji, tilemap i rozmiaru zasobów", "Benchmarks for objects, collisions, tilemap and asset size"), "PASS", P("17 przypadków, <code>benchmarks/latest.json</code>, <code>bench:check</code> z tolerancją 40%", "17 cases, <code>benchmarks/latest.json</code>, <code>bench:check</code> with a 40% tolerance")],
             ["64", P("Progi regresji bez deklaracji sprzętowych", "Regression thresholds without hardware claims"), "PASS", P("porównanie do zapisanej bazy na tej samej maszynie; raport zapisuje CPU i wersję Node", "comparison against a recorded baseline on the same machine; the report stores CPU and Node version")],
             ["65", P("Punkty rozszerzeń: systemy, importery, panele", "Extension points: systems, importers, panels"), "PASS", P("<code>SystemRegistry</code>, <code>ImporterRegistry</code>, <code>PanelRegistry</code>; wbudowany importer <code>tiled</code>", "<code>SystemRegistry</code>, <code>ImporterRegistry</code>, <code>PanelRegistry</code>; the built-in <code>tiled</code> importer")],
             ["66", P("Manifest pluginu: id, wersja, zależności, zgodność silnika", "Plugin manifest: id, version, dependencies, engine compatibility"), "PASS", P("<code>validatePluginManifest</code>, <code>satisfiesRange</code>, 15 testów semver", "<code>validatePluginManifest</code>, <code>satisfiesRange</code>, 15 semver tests")],
             ["67", P("Obsługa błędów podczas ładowania i działania", "Error handling during load and run"), "PASS", P("stany <code>failed</code>, kody <code>PluginError</code>, auto-wyłączanie systemów, 34 testy", "<code>failed</code> state, <code>PluginError</code> codes, system auto-disable, 34 tests")],
             ["68", P("Uprawnienia i granice zaufania", "Permissions and trust boundaries"), "PASS", P("capability-gating kontekstu + jawna dokumentacja, że manifest nie izoluje kodu", "context capability gating plus explicit documentation that the manifest does not isolate code")],
             ["69", P("Przykładowy plugin i szablon pakietu", "Example plugin and package template"), "PASS", "<code>examples/plugins/session-stats</code>, <code>templates/plugin</code>"],
             ["70", P("Katalog pluginów dopiero po stabilizacji API", "Plugin catalogue only after API stabilisation"), "ODŁOŻONE", "DEFERRED", P("warunki startu wypisane na stronie <a href=\"#plugins\">Pluginy</a>", "starting conditions listed on the <a href=\"#plugins\">Plugins</a> page")],
             ["71", P("Osobne konfiguracje dev/produkcja", "Separate dev and production configs"), "PASS", "<code>vite.config.ts</code> + <code>vite.prod.config.ts</code> + <code>config/</code>"],
             ["72", P("Poprawne base path i zasoby", "Correct base path and assets"), "PASS", P("<code>base: \"./\"</code>, <code>B2D_BASE</code>, meta <code>b2d-base</code>, <code>assetUrl()</code>", "<code>base: \"./\"</code>, <code>B2D_BASE</code>, <code>b2d-base</code> meta, <code>assetUrl()</code>")],
             ["73", P("Zachowanie po odświeżeniu", "Behaviour after refresh"), "PASS", P("stan w <code>?example=…&amp;lang=…</code>, <code>index.html</code> <code>no-cache</code>, <code>404.html</code>", "state in <code>?example=…&amp;lang=…</code>, <code>index.html</code> <code>no-cache</code>, <code>404.html</code>")],
             ["74", P("Raport rozmiaru i progi regresji", "Size report and regression thresholds"), "PASS", "<code>dist/release.json</code>, <code>bundle:check</code> 10% / 35% / 5%"],
             ["75", P("Eksport samodzielnej gry", "Self-contained game export"), "PASS", "<code>release/game</code> + 7 konfiguracji hostingów + <code>CHECKSUMS.txt</code>"],
             ["76", P("Ekran błędu startowego z diagnostyką", "Startup error screen with diagnostics"), "PASS", P("15 pól diagnostyki, kopiowanie, pobieranie; scenariusz <code>missing-bundle</code>", "15 diagnostics fields, copy and download; the <code>missing-bundle</code> scenario")],
             ["77", P("Testy HTTPS, CSP i konfiguracji hostingów", "Tests of HTTPS, CSP and hosting configs"), "PASS", P("8 scenariuszy: root, podkatalog, CSP, HTTPS, cache, refresh, brak bundla, 404", "8 scenarios: root, subpath, CSP, HTTPS, cache, refresh, missing bundle, 404")],
             ["78", P("Eksport desktopowy po stabilizacji webu", "Desktop export after web stabilisation"), "ODŁOŻONE", "DEFERRED", P("wymaga drugiego modelu aktualizacji i podpisów kodu", "needs a second update model and code signing")],
             ["79", P("Testy poza ścieżką szczęśliwą", "Tests beyond the happy path"), "PASS", P("545 testów w 47 plikach; m.in. <code>DebugSurface</code>, <code>ApiSnapshot</code>, <code>Resilience</code>, <code>Stability</code>, <code>Deprecation</code>, <code>WorkspaceVersions</code>, <code>MigrateTool</code>", "545 tests in 47 files; including <code>DebugSurface</code>, <code>ApiSnapshot</code>, <code>Resilience</code>, <code>Stability</code>, <code>Deprecation</code>, <code>WorkspaceVersions</code>, <code>MigrateTool</code>")],
             ["80", P("Regresyjne scenariusze kluczowych akcji", "Regression scenarios of key user actions"), "PASS", P("2 scenariusze, 31 sprawdzeń: rozgrywka, pauza, wyciszenie, zapis po odświeżeniu, restart, brakujący asset", "2 scenarios, 31 checks: gameplay, pause, mute, save after refresh, restart, missing asset")],
             ["81", P("Matryca rozmiarów ekranu i dotyku", "Screen-size and touch matrix"), "PASS", P("7 profili × ~12 sprawdzeń, cele dotykowe ≥ 24 px, brak poziomego przewijania", "7 profiles × ~12 checks, touch targets ≥ 24 px, no horizontal scroll")],
             ["82", P("Matryca przeglądarek", "Browser matrix"), "PASS", P("Chromium 12/12 (WebGL), Firefox 12/12 (canvas 2D), WebKit pominięty z podanym powodem", "Chromium 12/12 (WebGL), Firefox 12/12 (canvas 2D), WebKit skipped with a stated reason")],
             ["83", P("Brakujące zasoby, błędy sieci, niepoprawne projekty", "Missing assets, network errors, invalid projects"), "PASS", P("<code>Resilience.test.ts</code> + scenariusz <code>missing-asset</code>: gra startuje, raport wskazuje plik, brak wyjątków", "<code>Resilience.test.ts</code> + the <code>missing-asset</code> scenario: the game boots, the report names the file, no exceptions")],
             ["84", P("Audyt zależności i kontrola licencji", "Dependency audit and licence control"), "PASS", P("308 pakietów, 0 naruszeń; <code>audit:licenses:check</code> jako brama CI", "308 packages, 0 violations; <code>audit:licenses:check</code> as a CI gate")],
             ["85", P("Limity i walidacja importowanych danych", "Limits and validation of imported data"), "PASS", P("14 limitów, kody <code>limit-exceeded</code> i <code>unsafe-key</code>, 22 testy", "14 limits, <code>limit-exceeded</code> and <code>unsafe-key</code> codes, 22 tests")],
             ["86", P("Polityka zgodności API i migracji formatu", "API compatibility and format migration policy"), "PASS", P("<a href=\"#policy\">Wersjonowanie i migracje</a>, snapshot 316 symboli, <code>API_LEVEL</code>", "<a href=\"#policy\">Versioning and migrations</a>, a 316-symbol snapshot, <code>API_LEVEL</code>")],
             ["87", P("Lista przeglądarek, ograniczenia i procedura zgłoszeń", "Supported browsers, limitations and bug reporting"), "PASS", P("<a href=\"#compat\">Przeglądarki i ograniczenia</a>, <a href=\"#policy\">Zgłaszanie błędów</a>", "<a href=\"#compat\">Browsers and limitations</a>, <a href=\"#policy\">Bug reporting</a>")],
             ["88", P("Semantyczne wersjonowanie publicznych pakietów", "Semantic versioning of public packages"), "PASS", P("<code>scripts/versions.mjs</code>, <a href=\"#releases\">Wydania</a>, <code>WorkspaceVersions.test.ts</code>", "<code>scripts/versions.mjs</code>, <a href=\"#releases\">Releases</a>, <code>WorkspaceVersions.test.ts</code>")],
             ["89", P("Kanał stabilny i osobny status funkcji eksperymentalnych", "Stable channel and a separate status for experimental features"), "PASS", P("<code>stability.ts</code>: 21 funkcji w trzech kanałach, <code>getStabilityReport()</code>, <code>Stability.test.ts</code>", "<code>stability.ts</code>: 21 features in three channels, <code>getStabilityReport()</code>, <code>Stability.test.ts</code>")],
             ["90", P("Changelog, szablon release notes i automatyczne artefakty", "Changelog, release-notes template and automated artifacts"), "PASS", P("<code>CHANGELOG.md</code>, <code>docs/RELEASE_NOTES_TEMPLATE.md</code>, <code>scripts/release.mjs --artifacts</code>", "<code>CHANGELOG.md</code>, <code>docs/RELEASE_NOTES_TEMPLATE.md</code>, <code>scripts/release.mjs --artifacts</code>")],
             ["91", P("Polityka deprecacji API i narzędzia migracji formatu", "API deprecation policy and format migration tools"), "PASS", P("<code>deprecation.ts</code>, <code>engine.warnDeprecated()</code>, <code>scripts/migrate.mjs</code>, <code>MigrateTool</code>", "<code>deprecation.ts</code>, <code>engine.warnDeprecated()</code>, <code>scripts/migrate.mjs</code>, <code>MigrateTool</code>")],
             ["92", P("Zgodne wersje pakietów w monorepo", "Consistent package versions in the monorepo"), "PASS", P("4 pakiety w lockstepie, przypięte zależności wewnętrzne, brama <code>versions:check</code>", "4 packages in lockstep, pinned internal dependencies, the <code>versions:check</code> gate")],
             ["93", P("Wyniki testów i benchmarków dołączane do wydań", "Test and benchmark results shipped with releases"), "PASS", P("<code>release/artifacts/{wersja}/</code>: <code>test-results.json</code>, <code>benchmarks.json</code>, <code>CHECKSUMS.txt</code>, <code>index.json</code>", "<code>release/artifacts/{version}/</code>: <code>test-results.json</code>, <code>benchmarks.json</code>, <code>CHECKSUMS.txt</code>, <code>index.json</code>")],
             ["94", P("Lista długu technicznego i decyzji architektonicznych", "Technical debt and architecture decision list"), "PASS", P("<code>docs/TECH_DEBT.md</code> (14 otwartych, 4 spłacone), <code>docs/adr/</code> (9 rekordów), <a href=\"#debt\">strona</a>", "<code>docs/TECH_DEBT.md</code> (14 open, 4 repaid), <code>docs/adr/</code> (9 records), the <a href=\"#debt\">page</a>")],
         ]),
         ("note", "ok", "Poza zakresem MVP", "Out of MVP scope",
          "Edytor wizualny, networking, system cząstek, shadery i eksport na desktop — świadomie poza zakresem, żeby zakres pozostał weryfikowalny. Zapisy stanu, tilemapy, SQL, animacje, audio i debugowanie są już w zakresie (poz. 41–64).",
          "Visual editor, networking, particle system, shaders and desktop export — deliberately out of scope so the scope stays verifiable. Save states, tilemaps, SQL, animation, audio and debugging are now in scope (items 41–64)."),
         ("p", "Pełne tabele kryteriów: <code>docs/AUDIT_REPORT.md</code> i <code>docs/MVP_CHECKLIST.md</code>.", "Full criteria tables: <code>docs/AUDIT_REPORT.md</code> and <code>docs/MVP_CHECKLIST.md</code>."),
     ], "zgodnosc audit checklist mvp raport"),

page("plugins", "advanced", P("Pluginy i rozszerzenia", "Plugins and extensions"), P("Cztery punkty rozszerzeń, manifest z wersjonowaniem i zależnościami, izolacja błędów oraz jawne granice zaufania — bez udawania piaskownicy.", "Four extension points, a manifest with versioning and dependencies, error isolation, and explicit trust boundaries — without pretending to be a sandbox."),
     [
         ("h2", "Czym jest plugin", "What a plugin is"),
         ("p", "Plugin to zwykły obiekt z manifestem i funkcją <code>activate()</code>. Nie ma własnego procesu ani kontekstu JS — dzięki temu instalacja jest natychmiastowa, a debugowanie nie wymaga mostków. Cena jest jedna i trzeba ją powiedzieć wprost: kod pluginu działa w tej samej przeglądarce co gra, więc <b>manifest nie jest piaskownicą</b>.",
          "A plugin is a plain object with a manifest and an <code>activate()</code> function. It gets no process and no separate JS context, so installation is instant and debugging needs no bridges. There is one price and it must be stated plainly: plugin code runs in the same browser context as the game, so <b>the manifest is not a sandbox</b>."),
         ("code", "TypeScript", """
import type { PluginDefinition } from "@engine";

export const plugin: PluginDefinition = {
  manifest: {
    id: "autosave",
    version: "1.2.0",
    engine: "^0.1.0",
    name: "Autosave",
    author: "studio",
    dependencies: { "session-stats": "^1.0.0" },
    permissions: ["systems", "storage", "events"]
  },
  activate(context) {
    context.events.on("game:collected", () => context.storage.set("dirty", "1"));
    context.systems.register("autosave", (deltaTime) => {
      // deltaTime in seconds, already scaled by timeScale
    }, { order: 300 });
    context.onDispose(() => context.logger.debug("autosave disposed"));
  },
  deactivate() {
    return undefined;
  }
};
"""),
         ("table", [P("Pole", "Field"), P("Wymagane", "Required"), P("Znaczenie", "Meaning")], [
             ["<code>id</code>", P("tak", "yes"), P("Kebab-case, unikalny w silniku; prefiksuje zdarzenia i klucze pamięci", "Kebab-case, unique per engine; prefixes events and storage keys")],
             ["<code>version</code>", P("tak", "yes"), P("Wersja pluginu, sprawdzana przez zakresy zależności", "Plugin version, checked by dependency ranges")],
             ["<code>engine</code>", P("tak", "yes"), P("Zakres wersji silnika, np. <code>^0.1.0</code>", "Engine version range, for example <code>^0.1.0</code>")],
             ["<code>name</code>, <code>description</code>, <code>author</code>", P("nie", "no"), P("Metadane do listy pluginów i raportu", "Metadata for the plugin list and the report")],
             ["<code>dependencies</code>", P("nie", "no"), P("Mapa <code>id → zakres</code>; aktywacja idzie od zależności", "Map <code>id → range</code>; activation follows dependencies")],
             ["<code>permissions</code>", P("nie", "no"), P("Deklaracja capabilities; brak wpisu = brak dostępu do API kontekstu", "Capability declaration; no entry means no access to the context API")],
         ]),

         ("h2", "Cykl życia", "Lifecycle"),
         ("p", "Instalacja waliduje tylko sam manifest i unikalność <code>id</code> — celowo, żeby katalog pluginów mógł zainstalować cały zestaw, a potem aktywować go w kolejności zależności. Zgodność wersji silnika i zależności jest sprawdzana przy aktywacji: niezgodny plugin kończy w stanie <code>failed</code> z kodem błędu, a gra działa dalej.",
          "Installation validates only the manifest itself and <code>id</code> uniqueness — deliberately, so a catalogue can install a whole set and then activate it in dependency order. Engine compatibility and dependencies are checked during activation: an incompatible plugin ends in the <code>failed</code> state with an error code, and the game keeps running."),
         ("code", "TypeScript", """
const engine = createEngine({ parent: "game", plugins: [plugin] });

engine.getPlugins().list();
engine.getPlugins().get("autosave");
engine.getPlugins().activate("autosave");
engine.getPlugins().deactivate("autosave");
engine.getPlugins().install(other);
engine.installPlugin(third);
"""),
         ("table", [P("Stan", "State"), P("Kiedy", "When"), P("Co można zrobić", "What you can do")], [
             ["<code>installed</code>", P("po <code>install()</code>, przed aktywacją", "after <code>install()</code>, before activation"), P("aktywować, odinstalować", "activate, uninstall")],
             ["<code>active</code>", P("po udanym <code>activate()</code>", "after a successful <code>activate()</code>"), P("dezaktywować; systemy tykają", "deactivate; systems tick")],
             ["<code>inactive</code>", P("po <code>deactivate()</code>", "after <code>deactivate()</code>"), P("aktywować ponownie", "activate again")],
             ["<code>failed</code>", P("błąd manifestu, wersji, zależności lub <code>activate()</code>", "manifest, version, dependency or <code>activate()</code> failure"), P("naprawić i aktywować ponownie", "fix and activate again")],
         ]),
         ("note", "warn", "Kolejność i cykle", "Order and cycles", "Zależności aktywują się przed zależnym pluginem. Cykl (<code>a → b → a</code>) jest wykrywany i kończy się kodem <code>dependency-cycle</code> zamiast nieskończonej rekurencji. Dezaktywacja idzie w odwrotną stronę: najpierw zależni, potem zależność.",
          "Dependencies activate before the dependent plugin. A cycle (<code>a → b → a</code>) is detected and ends with <code>dependency-cycle</code> instead of infinite recursion. Deactivation runs the other way: dependents first, then the dependency."),

         ("h2", "Punkty rozszerzeń", "Extension points"),
         ("table", [P("Punkt", "Point"), P("Uprawnienie", "Permission"), P("Co dodaje", "What it adds")], [
             [P("Systemy", "Systems"), "<code>systems</code>", P("Funkcja tykająca co klatkę, z kolejnością i budżetem błędów", "A per-frame function with an order and a failure budget")],
             [P("Importery", "Importers"), "<code>importers</code>", P("Nowy format pliku → dane gry (np. własny format mapy)", "A new file format → game data (for example a custom map format)")],
             [P("Panele", "Panels"), "<code>panels</code>", P("Panel DOM dla edytora albo narzędzi deweloperskich", "A DOM panel for the editor or developer tools")],
             [P("Zdarzenia", "Events"), "<code>events</code>", P("Nasłuch dowolnego zdarzenia i emisja w przestrzeni nazw pluginu", "Listen to any event and emit inside the plugin namespace")],
             [P("Sceny i zasoby", "Scenes and assets"), "<code>scenes</code>, <code>assets</code>", P("Tylko odczyt: lista scen, aktywna scena, id zasobów, status ładowania", "Read-only: scene list, active scene, asset ids, load status")],
             [P("Pamięć", "Storage"), "<code>storage</code>", P("Klucz-wartość w <code>localStorage</code>, prefiksowany identyfikatorem pluginu", "Key-value in <code>localStorage</code>, prefixed with the plugin id")],
         ]),
         ("code", "TypeScript", """
activate(context) {
  context.systems.register("ai", (dt) => {
    context.storage.set("lastDt", String(dt));
  }, { order: 250, maxFailures: 5 });

  context.importers.register({
    id: "png-map",
    extensions: ["pngmap"],
    import: (data) => JSON.parse(String(data))
  });

  context.panels.register({
    id: "autosave-panel",
    title: "Autosave",
    order: 20,
    mount: (parent) => {
      const box = document.createElement("div");
      box.textContent = "autosave on";
      parent.appendChild(box);
      return () => box.remove();
    }
  });

  context.events.emit("ready", { at: context.engineVersion });
}
"""),
         ("note", "tip", "Nazwy zdarzeń", "Event names", "<code>context.events.emit(\"ready\")</code> trafia do <code>plugin:autosave:ready</code>. Plugin nie może podszyć się pod zdarzenie silnika, ale może słuchać każdego — także <code>engine:update</code> i <code>scene:start</code>.",
          "<code>context.events.emit(\"ready\")</code> lands on <code>plugin:autosave:ready</code>. A plugin cannot impersonate an engine event, but it may listen to any of them — including <code>engine:update</code> and <code>scene:start</code>."),

         ("h2", "Uprawnienia i granice zaufania", "Permissions and trust boundaries"),
         ("p", "Uprawnienia ograniczają <b>API kontekstu</b>, nie język. Plugin z pustą listą uprawnień nadal może wywołać <code>fetch</code>, sięgnąć do <code>window</code> albo podmienić globalne <code>JSON</code>, bo JavaScript nie ma tu granicy. Manifest jest więc deklaracją i śladem audytowym, a nie mechanizmem bezpieczeństwa.",
          "Permissions gate the <b>context API</b>, not the language. A plugin with an empty permission list can still call <code>fetch</code>, reach into <code>window</code> or patch the global <code>JSON</code>, because JavaScript offers no boundary there. The manifest is therefore a declaration and an audit trail, not a security mechanism."),
         ("table", [P("Uprawnienie", "Permission"), P("Odblokowuje", "Unlocks"), P("Czego nie chroni", "What it does not protect")], [
             ["<code>systems</code>", P("rejestrację funkcji w pętli", "registering a frame function"), P("czasu CPU, dostępu do DOM", "CPU time, DOM access")],
             ["<code>importers</code>", P("rejestrację parserów plików", "registering file parsers"), P("dostępu do sieci i plików", "network and file access")],
             ["<code>panels</code>", P("montowanie DOM w kontenerze gry", "mounting DOM inside the game container"), P("reszty dokumentu", "the rest of the document")],
             ["<code>events</code>", P("nasłuch i emisję w przestrzeni nazw", "listening and namespaced emitting"), P("podszycia się pod cudze zdarzenia", "impersonating other events")],
             ["<code>storage</code>", P("własne klucze w <code>localStorage</code>", "own keys in <code>localStorage</code>"), P("odczytu innych kluczy przez <code>localStorage</code>", "reading other keys via <code>localStorage</code>")],
         ]),
         ("note", "warn", "Zasada instalacji", "Installation rule", "Instaluj wyłącznie pluginy, którym ufasz jak własnemu kodowi. Dla kodu obcego potrzebny jest <code>iframe</code> z sandboxem albo <code>Worker</code> i mostek przez <code>postMessage</code> — to świadomie poza zakresem tej fazy, bo taka izolacja zmienia model API (brak współdzielonej pamięci, asynchroniczność każdego wywołania).",
          "Install only plugins you trust as much as your own code. Untrusted code needs a sandboxed <code>iframe</code> or a <code>Worker</code> with a <code>postMessage</code> bridge — deliberately out of scope for this phase, because such isolation changes the API model (no shared memory, every call becomes asynchronous)."),
         ("p", "Wiążące reguły, których pilnuje host: emisja zdarzeń jest prefiksowana identyfikatorem, klucze pamięci są prefiksowane (<code>b2d:plugin:&lt;id&gt;:</code>), rejestracje są przypisane do właściciela i znikają przy dezaktywacji, a nazwy systemów, importerów i paneli muszą być unikalne w obrębie właściciela.",
          "Hard rules the host enforces: emitted events are prefixed with the plugin id, storage keys are prefixed (<code>b2d:plugin:&lt;id&gt;:</code>), registrations belong to an owner and disappear on deactivation, and system, importer and panel names must be unique per owner."),

         ("h2", "Obsługa błędów", "Error handling"),
         ("table", [P("Kod", "Code"), P("Kiedy", "When")], [
             ["<code>invalid-manifest</code>", P("brak pola, zły <code>id</code>, zła wersja lub zakres", "missing field, bad <code>id</code>, bad version or range")],
             ["<code>duplicate-id</code>", P("plugin albo system o tej nazwie już istnieje", "a plugin or system with that name already exists")],
             ["<code>incompatible-engine</code>", P("zakres <code>engine</code> nie obejmuje działającej wersji", "the <code>engine</code> range does not cover the running version")],
             ["<code>missing-dependency</code>", P("brak zależności albo niespełniony zakres", "missing dependency or unsatisfied range")],
             ["<code>dependency-cycle</code>", P("cykl w grafie zależności", "a cycle in the dependency graph")],
             ["<code>permission-denied</code>", P("użycie capability bez uprawnienia", "capability used without a permission")],
             ["<code>activate-failed</code> / <code>deactivate-failed</code>", P("wyjątek w kodzie pluginu", "an exception in plugin code")],
             ["<code>duplicate-importer</code> / <code>duplicate-panel</code>", P("kolizja nazwy lub rozszerzenia", "name or extension collision")],
         ]),
         ("code", "TypeScript", """
engine.getPlugins().get("autosave");
// { id, name, version, state: "failed", permissions, dependencies,
//   systems: 0, importers: 0, panels: 0, failures: 1,
//   lastError: "incompatible-engine: Plugin \\"autosave@1.2.0\\" requires engine \\"^0.1.0\\" but 0.2.0 is running" }

engine.getEvents().on("plugin:failed", ({ id, code }) => report(id, code));
engine.getEvents().on("plugin:system-error", ({ id, system, message }) => report(id, system, message));
engine.getEvents().on("plugin:system-disabled", ({ id, system }) => disableUi(id, system));
"""),
         ("p", "Wyjątek w systemie nie zatrzymuje pętli: host łapie go, liczy niepowodzenie i po trzech kolejnych (albo po <code>maxFailures</code> z rejestracji) wyłącza ten system, emitując <code>plugin:system-disabled</code>. Pozostałe systemy i cała gra działają dalej. Wyjątek w <code>activate()</code> wycofuje rejestracje wykonane przed nim, więc nie zostają martwe wpisy w rejestrach.",
          "An exception in a system does not stop the loop: the host catches it, counts a failure and after three in a row (or the registration's <code>maxFailures</code>) disables that system, emitting <code>plugin:system-disabled</code>. Other systems and the whole game keep running. An exception in <code>activate()</code> rolls back the registrations made before it, so no dead entries stay in the registries."),

         ("h2", "Diagnostyka i audyt", "Diagnostics and audit"),
         ("code", "TypeScript", """
const plugins = engine.getPlugins();

plugins.summary();
// { total: 1, active: 1, failed: 0, systems: 1, importers: 1, panels: 1,
//   audit: [{ id: "autosave", version: "1.2.0", state: "active",
//             permissions: ["systems", "storage", "events"], dependencies: [] }] }

plugins.getSystems();
plugins.getPanels().list();
plugins.getImporters().list();
engine.getDiagnosticsReport().plugins.audit;
"""),
         ("p", "Raport diagnostyczny zawiera sekcję <code>plugins</code> z licznikami i audytem uprawnień, więc zgłoszenie błędu od gracza mówi od razu, jakie pluginy działały. Cykl życia pluginów jest też widoczny w logach (<code>Engine:Plugins</code>) i w zdarzeniach <code>plugin:installed/activated/deactivated/uninstalled</code>.",
          "The diagnostic report carries a <code>plugins</code> section with counts and the permission audit, so a player bug report immediately shows which plugins were running. The plugin lifecycle is also visible in the logs (<code>Engine:Plugins</code>) and in the <code>plugin:installed/activated/deactivated/uninstalled</code> events."),

         ("h2", "Przykład i szablon pakietu", "Example and package template"),
         ("table", [P("Ścieżka", "Path"), P("Co pokazuje", "What it shows")], [
             ["<code>examples/plugins/session-stats</code>", P("Kompletny plugin: system, panel, zdarzenia, pamięć; uruchamiany w playgroundzie", "A complete plugin: system, panel, events, storage; running in the playground")],
             ["<code>templates/plugin</code>", P("Szablon pakietu: <code>package.json</code>, <code>tsconfig.json</code>, <code>src/index.ts</code>, README z regułami", "Package template: <code>package.json</code>, <code>tsconfig.json</code>, <code>src/index.ts</code>, README with the rules")],
         ]),
         ("code", "bash", """
# 1. skopiuj szablon
cp -r templates/plugin packages/my-plugin
# 2. ustaw unikalne id i zakres silnika w src/index.ts
# 3. sprawdź typy
npx tsc --noEmit
# 4. opublikuj jako pakiet z peerDependencies na silnik
npm publish --access public
"""),
         ("note", "info", "Co widzi gracz", "What the player sees", "Panel pluginu ląduje w popoverze debugowania playgroundu (<code>#debug-plugins</code>), a licznik <code>Active: 1/1</code> pochodzi z <code>summary()</code>. Ten sam mechanizm jest miejscem na panele przyszłego edytora z fazy 12.",
          "A plugin panel shows up inside the playground debug popover (<code>#debug-plugins</code>), and the <code>Active: 1/1</code> counter comes from <code>summary()</code>. The same mechanism is the slot for the future editor panels from phase 12."),

         ("h2", "Katalog pluginów", "Plugin catalogue"),
         ("p", "Katalogu nie ma i w tej fazie nie będzie. Publikowanie listy pluginów ma sens dopiero wtedy, gdy API jest stabilne: dziś każda zmiana pola kontekstu łamie pluginy zewnętrzne, a katalog bez polityki zgodności byłby obietnicą bez pokrycia. Warunki startu katalogu: zamrożone <code>PluginContext</code> i manifest w wersji 1.0, polityka semver dla silnika, testy zgodności na dwóch wersjach silnika i podpisane pakiety.",
          "There is no catalogue and this phase will not add one. A plugin list only makes sense once the API is stable: today any change to the context shape breaks outside plugins, and a catalogue without a compatibility policy would be a promise with nothing behind it. The starting conditions: a frozen <code>PluginContext</code> and manifest at 1.0, a semver policy for the engine, compatibility tests across two engine versions and signed packages."),

         ("h2", "Testy", "Tests"),
         ("p", "Host ma 34 testy jednostkowe, a parser zakresów wersji 15. Pokrywają walidację manifestu, kolejność i cykle zależności, odmowę uprawnień, izolację błędów systemów wraz z automatycznym wyłączaniem, rejestrację importerów i paneli, sprzątanie po dezaktywacji oraz raport audytowy.",
          "The host has 34 unit tests and the version-range parser 15. They cover manifest validation, dependency order and cycles, permission denial, system error isolation with automatic disabling, importer and panel registration, teardown after deactivation, and the audit report."),
     ], "plugins plugin rozszerzenia manifest zaleznosci uprawnienia permissions piaskownica trust granice zaufania importer panel system katalog template")
page("deploy", "advanced", P("Build i publikacja", "Build and deployment"), P("Dwie konfiguracje, względne ścieżki bazowe, raport rozmiaru z progami, samodzielny eksport gry, ekran błędu startowego z diagnostyką i przetestowane konfiguracje hostingów.", "Two configurations, relative base paths, a size report with thresholds, a self-contained game export, a startup error screen with diagnostics, and tested hosting configurations."),
     [
         ("h2", "Dwie konfiguracje", "Two configurations"),
         ("p", "Development i produkcja mają osobne pliki, bo różnią się prawie wszystkim: serwer deweloperski potrzebuje HMR i szerokich nagłówków, a build produkcyjny — względnej ścieżki bazowej, minifikacji i deterministycznej listy plików.",
          "Development and production use separate files because almost everything differs: the dev server needs HMR and permissive headers, while the production build needs a relative base path, minification and a deterministic file list."),
         ("table", [P("Plik", "File"), P("Kiedy", "When"), P("Co ustawia", "What it sets")], [
             ["<code>vite.config.ts</code>", P("<code>npm run dev</code>", "<code>npm run dev</code>"), P("root <code>apps/playground</code>, HMR, <code>allowedHosts</code>, serwowanie <code>/docs</code>", "root <code>apps/playground</code>, HMR, <code>allowedHosts</code>, serving <code>/docs</code>")],
             ["<code>vite.prod.config.ts</code>", P("<code>npm run build</code>", "<code>npm run build</code>"), P("<code>base</code>, minify, target <code>es2020</code>, jeden chunk, kopiowanie <code>docs/</code>", "<code>base</code>, minify, target <code>es2020</code>, a single chunk, copying <code>docs/</code>")],
             ["<code>config/paths.ts</code>", P("oba", "both"), P("wspólne ścieżki i aliasy <code>@engine</code>, <code>@project-format</code>, <code>@phaser-adapter</code>, <code>@wasm-bridge</code>", "shared paths and the <code>@engine</code>, <code>@project-format</code>, <code>@phaser-adapter</code>, <code>@wasm-bridge</code> aliases")],
             ["<code>config/build-meta.ts</code>", P("oba", "both"), P("wstrzykuje <code>b2d-build</code>, <code>b2d-built-at</code>, <code>b2d-base</code>, <code>b2d-mode</code>", "injects <code>b2d-build</code>, <code>b2d-built-at</code>, <code>b2d-base</code>, <code>b2d-mode</code>")],
         ]),
         ("code", "bash", """
npm run dev            # vite --config vite.config.ts
npm run build          # tsc --noEmit && vite build --config vite.prod.config.ts && release-manifest
npm run build          # domyślnie B2D_BASE=./         (dowolny podkatalog)
npm run build:site     # B2D_BASE=/ npm run build      (serwowanie z katalogu głównego)
npm run build:single   # playground.html bez sieci
"""),

         ("h2", "Ścieżka bazowa i odświeżanie", "Base path and refresh"),
         ("p", "Build produkcyjny używa <code>base: \"./\"</code>, więc katalog z grą można wrzucić na <code>/</code>, <code>/game/</code> albo <code>/2026/build-7/</code> bez przebudowy. Każdy adres zasobu jest liczony od <code>index.html</code>, a nie od korzenia domeny.",
          "The production build uses <code>base: \"./\"</code>, so the game directory can live at <code>/</code>, <code>/game/</code> or <code>/2026/build-7/</code> without a rebuild. Every asset URL resolves from <code>index.html</code>, not from the domain root."),
         ("code", "TypeScript", """
const meta = document.querySelector<HTMLMetaElement>('meta[name="b2d-base"]');
const base = meta?.content?.endsWith("/") ? meta.content : `${meta?.content ?? "/"}/`;
assetUrl("player", "/assets/player.png");   // "./assets/player.png" · "/game/assets/player.png"
"""),
         ("table", [P("Sytuacja", "Situation"), P("Co się dzieje", "What happens")], [
             [P("Odświeżenie strony", "Page refresh"), P("stan siedzi w parametrach <code>?example=menu&amp;lang=en</code>, więc wraca ten sam przykład i język", "state lives in <code>?example=menu&amp;lang=en</code>, so the same example and language come back")],
             [P("Nowy build, stary cache", "New build, stale cache"), P("<code>index.html</code> jest <code>no-cache</code>, pliki <code>assets/*</code> mają hash w nazwie i cache roczny", "<code>index.html</code> is <code>no-cache</code>, <code>assets/*</code> files carry a content hash and a one-year cache")],
             [P("Nieznany adres", "Unknown address"), P("<code>404.html</code> z linkiem powrotnym; <b>nie</b> przepisujemy go na <code>index.html</code>", "<code>404.html</code> with a back link; it is <b>not</b> rewritten to <code>index.html</code>")],
             [P("Gra w podkatalogu", "Game in a subdirectory"), P("działa bez zmian w kodzie — wystarczy przenieść katalog", "works without code changes — just move the directory")],
         ]),
         ("note", "warn", "Dlaczego bez SPA fallback", "Why no SPA fallback", "Przepisanie <code>/dowolna/ścieżka</code> na <code>index.html</code> daje stronę, której względne <code>./assets/…</code> wskazuje na nieistniejący katalog. Gra nie ma routingu po ścieżkach — stan jest w query stringu — więc reguła <code>try_files … /index.html</code> tylko maskuje błąd. Zamiast tego nieznane adresy kończą się <code>404.html</code>.",
          "Rewriting <code>/any/path</code> to <code>index.html</code> yields a page whose relative <code>./assets/…</code> points at a directory that does not exist. The game has no path routing — state lives in the query string — so a <code>try_files … /index.html</code> rule only hides the bug. Unknown addresses end at <code>404.html</code> instead."),

         ("h2", "Raport rozmiaru", "Size report"),
         ("p", "Build zapisuje <code>dist/release.json</code> z rozmiarem, gzipem, brotli i sumą SHA-256 każdego pliku. <code>bundle-report</code> porównuje to z zapisaną bazą i wyłapuje przyrost, zanim trafi na produkcję.",
          "The build writes <code>dist/release.json</code> with size, gzip, brotli and a SHA-256 for every file. <code>bundle-report</code> compares it with a recorded baseline and catches growth before it reaches production."),
         ("code", "bash", """
npm run bundle:report     # tabela + porównanie z bazą
npm run bundle:check      # egzekwuje progi, exit 1 przy regresji
npm run bundle:baseline   # zapisz nową bazę
node scripts/bundle-report.mjs --tolerance=0.05 --file-tolerance=0.2
"""),
         ("table", [P("Próg", "Threshold"), P("Domyślnie", "Default"), P("Znaczenie", "Meaning")], [
             [P("suma gzip", "total gzip"), "10%", P("przyrost całego katalogu dystrybucji", "growth of the whole distribution directory")],
             [P("pojedynczy plik", "single file"), "35%", P("dotyczy plików większych niż 16 kB", "applies to files larger than 16 kB")],
             ["<code>playground.html</code>", "5%", P("wersja jednoplikowa, porównywana osobno", "the single-file build, compared separately")],
         ]),
         ("note", "info", "Aktualny stan", "Current numbers", "Kod gry: <b>1623 kB</b> (373 kB gzip). Katalog dystrybucji z dokumentacją: 19 plików, <b>612 kB gzip</b>. Wersja jednoplikowa: <b>1622 kB</b>. Sama dokumentacja to 183 kB gzip z tej sumy — dlatego jest raportowana osobno.",
          "Game code: <b>1623 kB</b> (373 kB gzip). The distribution directory including docs: 19 files, <b>612 kB gzip</b>. Single-file build: <b>1622 kB</b>. Docs alone account for 183 kB gzip of that total, which is why they are reported separately."),

         ("h2", "Eksport samodzielnej gry", "Self-contained game export"),
         ("code", "bash", """
npm run build && npm run export:game
# release/game/            gotowy katalog do wgrania
# release/game/hosting/    nginx, apache, netlify, vercel, firebase, _headers
# release/game/release.json, CHECKSUMS.txt
"""),
         ("p", "Eksport kopiuje build, liczy sumy kontrolne i generuje konfiguracje hostingów z <b>hashem CSP</b> wyliczonym z faktycznej treści inline skryptu startowego. Hash zmienia się razem z plikiem, więc polityka nie rozjedzie się z buildem.",
          "The export copies the build, computes checksums and generates hosting configurations with a <b>CSP hash</b> derived from the actual content of the inline startup script. The hash changes with the file, so the policy cannot drift from the build."),

         ("h2", "Ekran błędu startowego", "Startup error screen"),
         ("p", "Czarna plansza jest niedopuszczalna. Jeśli moduł gry się nie wykona, w miejscu sceny pojawia się komunikat, przyczyna i pełna diagnostyka środowiska — niezależnie od tego, czy zawiódł serwer, CSP czy WebGL.",
          "A black canvas is unacceptable. If the game module does not run, the stage shows a message, the cause and full environment diagnostics — whether the server, the CSP or WebGL failed."),
         ("table", [P("Pole diagnostyki", "Diagnostics field"), P("Po co", "Why")], [
             ["<code>build</code>, <code>mode</code>, <code>base</code>", P("czy gracz na pewno ma nowy build i właściwą ścieżkę", "whether the player really has the new build and the right path")],
             ["<code>url</code>, <code>protocol</code>, <code>secureContext</code>", P("http vs https, podkatalog, parametry", "http vs https, subdirectory, parameters")],
             ["<code>userAgent</code>, <code>viewport</code>", P("przeglądarka i rozmiar, także dla zgłoszeń z telefonów", "browser and size, including phone reports")],
             ["<code>webgl2</code>, <code>webgl</code>, <code>canvas</code>", P("czy środowisko ma grafikę i czy canvas powstał", "whether the environment has graphics and whether a canvas appeared")],
             ["<code>resources</code>", P("konkretne adresy z HTTP ≥ 400 i typem treści", "specific URLs with HTTP ≥ 400 and the content type")],
             ["<code>error</code>", P("ostatni wyjątek ze stosem", "the last exception with its stack")],
         ]),
         ("code", "text", """
build: 0.1.0+20261022-144115
mode: production
base: ./
url: https://example.com/game/?example=menu&lang=en
protocol: https:
secureContext: true
viewport: 1440x900 @1
webgl2: true · webgl: true
canvas: false
resources: https://example.com/game/assets/index-fF3ZEsj2.js → HTTP 404
error: Failed to fetch dynamically imported module
"""),
         ("note", "tip", "Trzy przyciski", "Three buttons", "„Spróbuj ponownie” dodaje <code>?reload=</code> i przeładowuje stronę, „Kopiuj diagnostykę” wkłada raport do schowka, a „Pobierz raport” zapisuje <code>b2d-diagnostics.txt</code>. Wszystko działa bez modułów, także gdy JavaScript aplikacji nigdy nie wystartował.",
          "“Try again” appends <code>?reload=</code> and reloads, “Copy diagnostics” puts the report on the clipboard and “Download report” saves <code>b2d-diagnostics.txt</code>. All of it works without modules, even when the app JavaScript never started."),

         ("h2", "HTTPS, CSP i nagłówki", "HTTPS, CSP and headers"),
         ("p", "HTTPS jest wymagane, a nie zalecane: <code>AudioContext</code>, niektóre API przeglądarki i <code>SharedArrayBuffer</code> zmieniają zachowanie poza kontekstem bezpiecznym. Polityka CSP nie zawiera <code>'unsafe-inline'</code> dla skryptów — dozwolony jest tylko własny bundle i inline skrypt startowy po hashu.",
          "HTTPS is required, not recommended: <code>AudioContext</code>, some browser APIs and <code>SharedArrayBuffer</code> behave differently outside a secure context. The CSP carries no <code>'unsafe-inline'</code> for scripts — only the first-party bundle and the hashed inline startup script are allowed."),
         ("code", "text", """
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'sha256-…';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  media-src 'self' data: blob:;
  connect-src 'self';
  object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'
"""),
         ("p", "<code>style-src 'unsafe-inline'</code> jest konieczne, bo Phaser ustawia style na elementach canvas i DOM; hash w <code>style-src</code> wyłączyłby tę furtkę zgodnie ze specyfikacją CSP. Audio i tekstury korzystają z <code>data:</code> oraz <code>blob:</code>, dlatego oba schematy są dozwolone w <code>img-src</code> i <code>media-src</code>.",
          "<code>style-src 'unsafe-inline'</code> is necessary because Phaser sets inline styles on canvas and DOM elements; a hash in <code>style-src</code> would disable that escape hatch per the CSP specification. Audio and textures use <code>data:</code> and <code>blob:</code>, hence both schemes are allowed in <code>img-src</code> and <code>media-src</code>."),

         ("h2", "Testy hostingu", "Hosting tests"),
         ("p", "Konfiguracje nie są opisane „na słowo honoru” — osiem scenariuszy uruchamia prawdziwą przeglądarkę przeciw serwerowi z wybranymi nagłówkami. Każdy sprawdza, że canvas powstał, ekran błędu się nie pokazał, konsola jest czysta i żadne żądanie nie skończyło się błędem.",
          "The configurations are not documented on trust — eight scenarios run a real browser against a server with chosen headers. Each one verifies that a canvas appeared, the error screen stayed hidden, the console is clean and no request failed."),
         ("code", "bash", """
npm run test:hosting
# http-root      · mount /            · baza ścieżek i brak błędów
# http-subpath   · mount /game/       · zasoby pod /game/assets/
# csp-strict     · CSP z hashem       · zero naruszeń polityki
# https-csp      · TLS self-signed    · secureContext === true
# cache-immutable· nagłówki cache     · index no-cache, assets immutable
# refresh-state  · ?example=menu      · stan przeżywa reload
# missing-bundle · zablokowany JS     · widoczny ekran błędu + diagnostyka
# unknown-path   · /nie-ma-takiej     · 404.html ze statusem 404
"""),
         ("table", [P("Scenariusz", "Scenario"), P("Co mogłoby się zepsuć bez testu", "What would break without the test")], [
             [P("subpath", "subpath"), P("absolutne <code>/assets/…</code> w kodzie — gra działa tylko w korzeniu domeny", "absolute <code>/assets/…</code> in code — the game only works at the domain root")],
             [P("csp-strict", "csp-strict"), P("cichy błąd CSP i biała plansza bez komunikatu", "a silent CSP failure and a white stage with no message")],
             [P("refresh-state", "refresh-state"), P("powrót do domyślnego przykładu po F5", "falling back to the default example after F5")],
             [P("missing-bundle", "missing-bundle"), P("czarna plansza, gdy plik JS nie dojdzie", "a black stage when the JS file does not arrive")],
         ]),

         ("h2", "Typowe hostingi", "Common hosts"),
         ("table", [P("Hosting", "Host"), P("Plik", "File"), P("Najczęstsza pułapka", "Most common trap")], [
             ["nginx", "<code>hosting/nginx.conf</code>", P("brak <code>types { application/wasm wasm; }</code> przy WASM", "missing <code>types { application/wasm wasm; }</code> with WASM")],
             ["Apache", "<code>.htaccess</code>", P("mod_headers i mod_mime muszą być włączone", "mod_headers and mod_mime must be enabled")],
             ["Netlify", "<code>netlify.toml</code>", P("<code>publish</code> musi wskazywać katalog z <code>index.html</code>", "<code>publish</code> must point at the directory holding <code>index.html</code>")],
             ["Cloudflare Pages", "<code>_headers</code>", P("plik musi leżeć w katalogu publikacji", "the file must sit in the publish directory")],
             ["Vercel", "<code>vercel.json</code>", P("bez <code>rewrites</code> — inaczej 404 maskuje brak zasobu", "no <code>rewrites</code> — otherwise a 404 masks a missing asset")],
             ["Firebase", "<code>firebase.json</code>", P("<code>public: \".\"</code> względem katalogu gry", "<code>public: \".\"</code> relative to the game directory")],
             ["S3 + CloudFront", P("—", "—"), P("ręcznie ustaw <code>Content-Type</code> dla <code>.js</code> i <code>.wasm</code>, włącz HTTPS", "set <code>Content-Type</code> for <code>.js</code> and <code>.wasm</code> manually and enable HTTPS")],
         ]),
         ("note", "warn", "Czego jeszcze nie ma", "What is not there yet", "Eksport desktopowy (Electron/Tauri) jest świadomie odłożony do czasu stabilizacji wersji webowej: wymaga drugiego modelu aktualizacji, podpisów kodu i osobnej macierzy testów. Nie obiecujemy go, dopóki web nie jest zamknięty.",
          "Desktop export (Electron/Tauri) is deliberately deferred until the web build is stable: it needs a second update model, code signing and a separate test matrix. We do not promise it while the web target is still open."),
     ], "build publikacja deploy hosting wdrozenie base path csp 404 eksport bundle rozmiar rozmiar bundla https naglowki cache manifest")

page("determinism", "advanced", P("Determinizm i jego granice", "Determinism and its limits"),
     P("Co dokładnie jest powtarzalne w przeglądarce, co zależy od sprzętu i jak zbudować sesję, którą można odtworzyć bit w bit.",
       "What is reproducible in a browser, what depends on the hardware, and how to build a session you can replay bit for bit."),
     [
         ("h2", "Po co determinizm", "Why determinism"),
         ("p", "Powtarzalna symulacja to nie akademicki wymóg: dzięki niej bug zjawia się drugi raz z tymi samymi danymi, test integracyjny porównuje wyniki zamiast czekać na szczęście, a powtórki i cofanie czasu są tanie. W przeglądarce determinizm jest jednak ograniczony przez środowisko, a nie przez silnik — dlatego granice są tu opisane wprost, zamiast obiecywane.",
          "A reproducible simulation is not an academic requirement: it makes a bug reappear with the same data, lets an integration test compare results instead of waiting for luck, and makes replays and rewind cheap. In a browser determinism is limited by the environment rather than the engine — so the boundaries are stated here explicitly instead of being promised."),
         ("h2", "Trzy poziomy gwarancji", "Three levels of guarantee"),
         ("table", [P("Poziom", "Level"), P("Warunek", "Condition"), P("Gwarancja", "Guarantee")], [
             [P("Test jednostkowy", "Unit test"), P("czyste klasy: <code>Time</code>, <code>Scheduler</code>, <code>Random</code>", "pure classes: <code>Time</code>, <code>Scheduler</code>, <code>Random</code>"), P("w pełni powtarzalne, bit w bit, na każdym komputerze", "fully reproducible, bit for bit, on any machine")],
             [P("Ta sama przeglądarka", "Same browser"), P("ten sam seed, stały krok, zapis wejść, bez <code>Date.now()</code> w logice", "same seed, fixed step, recorded input, no <code>Date.now()</code> in logic"), P("ta sama symulacja przy dowolnym FPS", "the same simulation at any frame rate")],
             [P("Różne przeglądarki i systemy", "Different browsers and OSes"), P("ten sam seed i wejście", "same seed and input"), P("zwykle ta sama ścieżka, ale bez gwarancji bit w bit", "usually the same path, but no bit-for-bit guarantee")],
         ]),
         ("h2", "Co jest deterministyczne", "What is deterministic"),
         ("ul", [
             (P("<code>Random</code> — xorshift na <code>Math.imul</code> i <code>&gt;&gt;&gt; 0</code>, więc operacje są całkowite i niezależne od platformy.", "<code>Random</code> — xorshift built on <code>Math.imul</code> and <code>&gt;&gt;&gt; 0</code>, so every operation is integer and platform independent.")),
             (P("Stały krok: <code>fixedStep.hz</code> daje identyczne przyrosty czasu w każdej klatce, niezależnie od odświeżania ekranu.", "The fixed step: <code>fixedStep.hz</code> produces identical time increments every frame, regardless of display refresh.")),
             (P("Kolejność faz komponentów: <code>input → behavior → physics → animation → render</code>, a wewnątrz fazy stabilne sortowanie po <code>order</code>.", "The component phase order: <code>input → behavior → physics → animation → render</code>, and a stable <code>order</code> sort inside a phase.")),
             (P("Kolejka niszczenia: obiekty zniszczone w trakcie klatki znikają dopiero po jej zakończeniu, więc indeksy nie zmieniają się w połowie iteracji.", "The destroy queue: objects destroyed mid-frame disappear only after the frame, so indices never shift halfway through an iteration.")),
             (P("Timery: opóźnienia liczone z czasu gry, zaległości ograniczone do czterech wywołań na zadanie.", "Timers: delays measured in game time, catch-up capped at four invocations per task.")),
         ]),
         ("h2", "Co nie jest deterministyczne", "What is not deterministic"),
         ("table", [P("Źródło", "Source"), P("Dlaczego", "Why"), P("Co zrobić", "What to do")], [
             [P("Liczba klatek", "Frame count"), P("<code>requestAnimationFrame</code> zależy od odświeżania, obciążenia i throttlingu kart", "<code>requestAnimationFrame</code> depends on refresh rate, load and tab throttling"), P("<code>fixedStep</code> + <code>fixedUpdate</code>; <code>update</code> tylko do interpolacji", "<code>fixedStep</code> + <code>fixedUpdate</code>; <code>update</code> for interpolation only")],
             [P("Czas ścienny", "Wall-clock time"), P("<code>Date.now()</code>, <code>performance.now()</code> i zegar systemowy bywają korygowane", "<code>Date.now()</code>, <code>performance.now()</code> and the system clock are corrected"), P("nigdy nie czytaj zegara w logice sceny — używaj <code>getTime()</code>", "never read the clock in scene logic — use <code>getTime()</code>")],
             [P("Liczby zmiennoprzecinkowe", "Floating point"), P("<code>+ - * /</code> są IEEE-754, ale <code>Math.sin/cos/pow</code> mogą różnić się o ULP między silnikami JS", "<code>+ - * /</code> are IEEE-754, but <code>Math.sin/cos/pow</code> may differ by a ULP across JS engines"), P("w kodzie sieciowym i powtórkach używaj tabel lub <code>Math.fround</code>; nie porównuj floatów na równość", "in network code and replays use lookup tables or <code>Math.fround</code>; never compare floats for equality")],
             [P("Kolizje w Phaserze", "Phaser collisions"), P("Arcade wykonuje kroki w rytmie klatek i rozwiązuje nakładania iteracyjnie", "Arcade steps with the frame and resolves overlaps iteratively"), P("przy fizyce sieciowej licz na serwerze albo dodaj własną warstwę stałego kroku", "for networked physics, simulate on the server or add your own fixed-step layer")],
             [P("GPU", "GPU"), P("kolejność rysowania i zaokrąglenia rasteryzacji zależą od sterownika", "draw order and rasterisation rounding depend on the driver"), P("determinizm dotyczący tylko logiki, nie pikseli", "determinism concerns logic, not pixels")],
             [P("Zdarzenia systemowe", "System events"), P("utrata fokusu, usypianie laptopa, zmiana rozmiaru okna", "focus loss, laptop sleep, window resizing"), P("<code>pauseOnHidden</code> i <code>maxDeltaTime</code> tłumią skutki", "<code>pauseOnHidden</code> and <code>maxDeltaTime</code> absorb the impact")],
         ]),
         ("h2", "Przepis na powtarzalną sesję", "Recipe for a reproducible session"),
         ("steps", [
             (P("Ustaw seed i stały krok", "Set the seed and the fixed step"), P("<code>createEngine({ seed: 1337, fixedStep: { hz: 60 } })</code> — jedno miejsce, zero rozproszonej konfiguracji.", "<code>createEngine({ seed: 1337, fixedStep: { hz: 60 } })</code> — one place, no scattered configuration.")),
             (P("Całą logikę prowadź w <code>fixedUpdate</code>", "Drive all logic from <code>fixedUpdate</code>"), P("Ruch, SI, kolizje i losowania wyłącznie w stałym kroku; <code>update</code> służy do interpolacji i UI.", "Movement, AI, collisions and random draws only in the fixed step; <code>update</code> is for interpolation and UI.")),
             (P("Losuj z jednego źródła", "Draw from one source"), P("<code>this.getRandom()</code> zamiast <code>Math.random()</code>; niezależne strumienie przez <code>fork()</code>.", "<code>this.getRandom()</code> instead of <code>Math.random()</code>; independent streams via <code>fork()</code>.")),
             (P("Nagraj wejście", "Record input"), P("Zapisuj <code>(tick, action, phase)</code>, nie pozycje obiektów — powtórka odtwarza symulację od zera.", "Store <code>(tick, action, phase)</code>, not object positions — a replay re-simulates from scratch.")),
             (P("Porównuj stan, nie piksele", "Compare state, not pixels"), P("Test integracyjny porównuje <code>toState()</code> i pozycje po N krokach; zrzuty ekranu tylko jako dowód wizualny.", "An integration test compares <code>toState()</code> and positions after N steps; screenshots only as visual evidence.")),
         ]),
         ("code", "TypeScript", """
const engine = createEngine({
  parent: container,
  seed: 20240607,
  fixedStep: { hz: 60, maxSteps: 5 }
});

class Simulation extends Scene {
  private replay: InputFrame[] = [];
  private tick = 0;

  fixedUpdate(fixedDelta: number): void {
    const frame = this.replay[this.tick];
    if (frame) frame.actions.forEach((action) => this.apply(action));
    this.simulate(fixedDelta);
    this.tick += 1;
  }

  snapshot(): string {
    return JSON.stringify({
      tick: this.tick,
      time: this.getTime().toState(),
      player: this.getObject("player")?.transform.toJSON()
    });
  }
}
"""),
         ("h2", "Jak to testować", "How to test it"),
         ("p", "Test nie potrzebuje przeglądarki ani czekania: <code>Time</code> przyjmuje <code>deltaMs</code> jako argument, <code>Scheduler</code> ma <code>update(dt)</code>, a <code>Random</code> jest zwykłym obiektem. Ten sam scenariusz puszczony dwa razy musi dać identyczny wynik, a scenariusz z inną liczbą klatek — identyczny stan po tych samych krokach stałych.",
          "The test needs neither a browser nor waiting: <code>Time</code> takes <code>deltaMs</code> as an argument, <code>Scheduler</code> exposes <code>update(dt)</code> and <code>Random</code> is a plain object. The same scenario run twice must produce an identical result, and a scenario with a different frame count must produce an identical state after the same fixed steps."),
         ("code", "TypeScript", """
const run = (frameDelta: number): string => {
  const time = new Time(0.1);
  time.setFixedStep(60, 5);
  const random = new Random(1337);
  const scene = new Simulation();
  for (let frame = 0; frame < 600; frame += 1) {
    time.update(frameDelta);
    while (time.consumeFixedStep()) scene.step(time.fixedDelta, random);
  }
  return scene.snapshot();
};

expect(run(16)).toBe(run(16));
expect(run(33)).toBe(run(16));
"""),
         ("note", "warn", "Granica, której nie da się usunąć", "A limit you cannot remove",
          "Nawet z seedem i stałym krokiem wynik może się różnić między przeglądarkami, jeśli logika używa funkcji transcendentalnych, fizyki Phasera albo czasu ściennego. Silnik nie udaje, że tego nie ma: gwarantuje powtarzalność tam, gdzie zależy ona od niego, i dokumentuje resztę.",
          "Even with a seed and a fixed step the result can differ across browsers if the logic uses transcendental functions, Phaser physics or wall-clock time. The engine does not pretend otherwise: it guarantees reproducibility where it is under its control and documents the rest."),
     ], "determinizm determinism powtarzalnosc replay seed fixed step przegladarka floating point"),

CSS = (Path(__file__).resolve().parent / "_docs.css").read_text(encoding="utf-8")
JS = (Path(__file__).resolve().parent / "_docs.js").read_text(encoding="utf-8")

def word_count(text):
    return len(re.findall(r"[\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+", re.sub(r"<[^>]+>", " ", text)))

page("hierarchy", "basics", P("Hierarchia obiektów", "Object hierarchy"),
     P("Rodzic, dzieci i transformacje dziedziczone — bez ręcznego przeliczania pozycji w każdej klatce.", "Parents, children and inherited transforms — without manual position maths every frame."),
     [
         ("h2", "Model", "Model"),
         ("p", "Każdy <code>GameObject</code> ma <code>transform</code> lokalny oraz <code>parent</code> i <code>children</code>. Pozycja globalna jest liczona leniwie w getterze <code>world</code>: dopóki nic się nie zmieni, wynik jest cache'owany, a zmiana unieważnia tylko poddrzewo.", "Every <code>GameObject</code> owns a local <code>transform</code> plus <code>parent</code> and <code>children</code>. The global position is computed lazily in the <code>world</code> getter: while nothing changes the result is cached, and a change invalidates only that subtree."),
         ("code", "TypeScript", """
const ship = this.createSprite("ship", { id: "ship", x: 400, y: 300 });

const turret = this.createEllipse(6, { id: "turret", x: 0, y: -18, color: 0xe2b714 });
ship.addChild(turret);

ship.setPosition(500, 300);
turret.world.x; // 500
turret.world.y; // 282 — pozycja lokalna złożona z rodzicem
"""),
         ("h2", "Reguły składania", "Composition rules"),
         ("table", [P("Właściwość", "Property"), P("Dziecko", "Child"), P("Jak liczone", "How it is computed")], [
             [P("Pozycja", "Position"), "x, y", P("obrót i skala rodzica stosowane do offsetu lokalnego", "parent rotation and scale applied to the local offset")],
             ["rotation", P("suma", "sum"), "parent.rotation + local.rotation"],
             ["scaleX / scaleY", P("iloczyn", "product"), "parent.scale * local.scale"],
             [P("Widoczność", "Visibility"), "visible", P("nie dziedziczy — steruje nią <code>active</code>", "not inherited — driven by <code>active</code>")],
         ]),
         ("code", "TypeScript", """
// obrót rodzica obraca offset dziecka
ship.setRotation(Math.PI / 2);
turret.world.x; // 500 + (-18) * sin(90°) = 482

// skala rodzica skaluje child
ship.setScale(2);
"""),
         ("h2", "Aktywacja w drzewie", "Tree activation"),
         ("p", "<code>active</code> wyłącza obiekt razem z całą gałęzią. Flaga <code>isActiveInHierarchy</code> jest propagowana w dół przy każdej zmianie, a komponenty nieaktywnych obiektów nie trafiają do pętli — nie płacisz za martwe poddrzewa.", "<code>active</code> disables an object together with its whole branch. The <code>isActiveInHierarchy</code> flag is propagated downwards on every change, and components of inactive objects never reach the update loop — dead subtrees cost nothing."),
         ("code", "TypeScript", """
const group = this.createObject({ id: "enemies" });
const enemy = this.createSprite("player", { id: "enemy" });
group.addChild(enemy);

this.deactivateObject(group);
enemy.isActiveInHierarchy; // false — komponent enemy nie dostaje onUpdate
"""),
         ("h2", "Usuwanie", "Destroying"),
         ("p", "<code>destroyObject()</code> usuwa obiekt razem z potomkami, w kolejności od liści. Każdy zniszczony obiekt dostaje szansę na <code>onDestroy</code> w komponentach i znika z indeksów tagów oraz grup w tej samej operacji.", "<code>destroyObject()</code> removes an object together with its descendants, leaf-first. Every destroyed object gets its component <code>onDestroy</code> hook and leaves the tag and group indexes in the same operation."),
         ("note", "warn", "Przepinanie rodzica", "Reparenting",
          "Zmiana rodzica zachowuje transform lokalny, nie globalny — obiekt może wizualnie przeskoczyć. Jeśli chcesz zachować pozycję świata, zapisz <code>child.world</code> przed <code>addChild</code> i ustaw offset lokalny względem nowego rodzica.",
          "Changing the parent keeps the local transform, not the global one — the object may visually jump. To preserve world position, read <code>child.world</code> before <code>addChild</code> and set the local offset relative to the new parent."),
         ("note", "tip", "Koszt", "Cost",
          "Zmiana transformacji rodzica unieważnia poddrzewo w O(rozmiar poddrzewa), odczyt <code>world</code> to O(1) po pierwszym przeliczeniu. Dla płaskich scen (bez dzieci) koszt jest identyczny jak przy pojedynczym obiekcie.",
          "A parent transform change invalidates the subtree in O(subtree size); reading <code>world</code> is O(1) after the first recomputation. For flat scenes (no children) the cost equals a single object."),
     ], "hierarchia hierarchy parent child dzieci transformacje dziedziczone world"),

page("components", "basics", P("Komponenty i kolejność systemów", "Components and system order"),
     P("Zachowanie doklejane do obiektów, jeden kontrakt cyklu życia i deterministyczna kolejność faz w klatce.", "Behaviour attached to objects, one lifecycle contract and deterministic phase order within a frame."),
     [
         ("h2", "Kontrakt", "Contract"),
         ("code", "TypeScript", """
import { Component, type SystemPhase } from "@engine";

export class PlayerController extends Component {
  phase: SystemPhase = "physics";

  onAttach?(): void;      // komponent trafił na obiekt
  onEnable?(): void;      // obiekt i przodkowie aktywni
  onDisable?(): void;     // dezaktywacja lub wyłączenie
  onUpdate?(dt: number): void;
  onDetach?(): void;      // zdjęty z obiektu
  onDestroy?(): void;     // obiekt zniszczony

  onUpdate(_dt: number): void {
    const scene = this.scene;
    const owner = this.owner;
    if (!scene || !owner) return;
    const input = scene.getInput();
    const vx = Number(input.isActionDown("move-right")) - Number(input.isActionDown("move-left"));
    const vy = Number(input.isActionDown("move-down")) - Number(input.isActionDown("move-up"));
    scene.getPhysics().setVelocity(owner, vx * 220, vy * 220);
  }
}
"""),
         ("table", [P("Hook", "Hook"), P("Kiedy", "When"), P("Uwagi", "Notes")], [
             ["onAttach", P("po dodaniu do obiektu", "after being added to an object"), P("zawsze przed <code>onEnable</code>", "always before <code>onEnable</code>")],
             ["onEnable", P("obiekt aktywny w drzewie", "object active in the tree"), P("także przy <code>setEnabled(true)</code>", "also on <code>setEnabled(true)</code>")],
             ["onDisable", P("dezaktywacja lub wyłączenie", "deactivation or disable"), P("symetrycznie do <code>onEnable</code>", "symmetric to <code>onEnable</code>")],
             ["onUpdate", P("każda klatka w swojej fazie", "every frame in its phase"), P("tylko gdy <code>enabled</code> i aktywny", "only when <code>enabled</code> and active")],
             ["onDetach", P("przy <code>remove()</code>", "on <code>remove()</code>"), P("obiekt żyje dalej", "the object keeps living")],
             ["onDestroy", P("przy zniszczeniu obiektu", "when the object is destroyed"), P("po <code>onDisable</code>", "after <code>onDisable</code>")],
         ]),
         ("h2", "Fazy", "Phases"),
         ("p", "Każdy komponent deklaruje <code>phase</code> i opcjonalny <code>order</code>. Kolejność faz jest stała i publiczna — dzięki temu animacja zawsze widzi pozycję po fizyce, a render po animacji.", "Every component declares a <code>phase</code> and an optional <code>order</code>. The phase order is fixed and public — animation always sees post-physics positions, and rendering sees post-animation state."),
         ("code", "TypeScript", """
export const SYSTEM_ORDER = ["input", "behavior", "physics", "animation", "render"] as const;

new PlayerController();           // phase = "physics"
new Bobbing(6, 700);              // phase = "animation"
new HudSync().setOrder(-100);     // wcześniej w swojej fazie
"""),
         ("h2", "Kolejność w klatce", "Order within a frame"),
         ("ol", [
             (P("komponenty fazy <code>input</code>", "<code>input</code> phase components")),
             (P("<code>Scene.update()</code> — logika gry", "<code>Scene.update()</code> — game logic")),
             (P("komponenty <code>behavior</code>", "<code>behavior</code> components")),
             (P("komponenty <code>physics</code> (prędkości, impulsy)", "<code>physics</code> components (velocities, impulses)")),
             (P("komponenty <code>animation</code>", "<code>animation</code> components")),
             (P("komponenty <code>render</code>", "<code>render</code> components")),
             (P("opróżnienie kolejki zniszczeń", "destroy queue flush")),
             (P("synchronizacja brudnych obiektów z adapterem", "sync of dirty objects with the adapter")),
         ]),
         ("note", "tip", "Dlaczego nie <code>Scene.update</code>", "Why not everything in <code>Scene.update</code>",
          "<code>Scene.update</code> jest wygodne dla całej logiki sceny, ale komponent działa niezależnie od sceny i może być testowany w izolacji. Scena bez komponentów nadal działa — komponenty są opcjonalną warstwą, nie wymogiem.",
          "<code>Scene.update</code> is convenient for scene-wide logic, but a component is independent of the scene and testable in isolation. A scene without components still works — components are an optional layer, not a requirement."),
         ("note", "warn", "Jeden komponent na typ", "One component per type",
          "Kluczem jest konstruktor, więc druga instancja tego samego typu zastępuje pierwszą (stara dostaje <code>onDetach</code>). Do wielu instancji użyj różnych klas albo listy w jednym komponencie.",
          "The key is the constructor, so a second instance of the same type replaces the first (the old one gets <code>onDetach</code>). For multiple instances use distinct classes or a list inside one component."),
         ("note", "warn", "Błąd w komponencie", "A failing component",
          "Wyjątek z <code>onUpdate</code> jest logowany przez <code>Logger.error</code> i nie przerywa klatki — reszta sceny działa dalej. To celowe: jedna zła animacja nie może zabić rozgrywki.",
          "An exception from <code>onUpdate</code> is logged via <code>Logger.error</code> and does not break the frame — the rest of the scene keeps running. That is deliberate: one broken animation cannot kill gameplay."),
     ], "komponenty components cykl zycia lifecycle fazy systemy kolejnosc order"),

page("ports", "advanced", P("Adapter i porty", "Adapter and ports"),
     P("Pięć portów i jeden kontrakt runtime oddzielają logikę od Phasera. Rdzeń kompiluje się bez Phasera, a testy działają na atrapach.", "Five ports and one runtime contract separate logic from Phaser. The core compiles without Phaser and tests run against fakes."),
     [
         ("h2", "Kontrakt adaptera", "The adapter contract"),
         ("table", [P("Port", "Port"), P("Odpowiada za", "Responsible for"), P("Implementacja", "Implementation")], [
             ["<code>RenderPort</code>", P("tworzenie, aktualizacja i niszczenie obiektów wizualnych", "creating, updating and destroying visual objects"), "<code>PhaserRenderLayer</code>"],
             ["<code>PhysicsPort</code>", P("bryły, prędkości, kolizje, odczyt pozycji", "bodies, velocities, colliders, position readback"), "<code>PhaserPhysicsBackend</code>"],
             ["<code>CameraPort</code>", P("kamera, zoom, granice, wstrząsy", "camera, zoom, bounds, shake"), "<code>PhaserCameraBackend</code>"],
             ["<code>InputPort</code>", P("klawisze, pointer, blur", "keys, pointer, blur"), "<code>PhaserInputBackend</code>"],
             ["<code>AssetBackend</code>", P("kolejka ładowania i tekstury", "load queue and textures"), "<code>PhaserAssetBackend</code>"],
             ["<code>RuntimeAdapter</code>", P("gra, sceny, pauza, zniszczenie", "game, scenes, pause, teardown"), "<code>PhaserAdapter</code>"],
         ]),
         ("code", "TypeScript", """
export interface RenderPort {
  create(object: GameObject): void;
  destroy(object: GameObject): void;
  sync(objects: readonly GameObject[]): void;
  clear(): void;
}

export interface PhysicsPort {
  setWorldBounds(x: number, y: number, width: number, height: number): void;
  attachBody(object: GameObject): void;
  detachBody(object: GameObject): void;
  readPosition(object: GameObject): Vec2 | null;
  setVelocity(object: GameObject, vx: number, vy: number): void;
  addCollider(a: ColliderPair, b: ColliderPair, handler?: CollisionHandler): ColliderHandle;
  addOverlap(a: ColliderPair, b: ColliderPair, handler: CollisionHandler): ColliderHandle;
}
"""),
         ("h2", "Adapter bez Phasera", "An adapter without Phaser"),
         ("p", "Scena nie wie, kto ją rysuje. Poniższy adapter nic nie rysuje i wystarcza do testów integracyjnych całej logiki — łącznie z hierarchią, tagami i kolejką zniszczeń.", "A scene does not know who draws it. The adapter below draws nothing and is enough to integration-test all the logic — including hierarchy, tags and the destroy queue."),
         ("code", "TypeScript", """
const render: RenderPort = {
  create: (object) => log.push(["create", object.id]),
  destroy: (object) => log.push(["destroy", object.id]),
  sync: (objects) => log.push(["sync", objects.length]),
  clear: () => log.push(["clear"]),
};

scene.initInternal(ctx, { render });
scene.internalCreate();
scene.internalUpdate(0.016);
"""),
         ("h2", "Render: opis, nie obiekt", "Render: descriptor, not object"),
         ("table", [P("Rodzaj", "Kind"), P("Pola", "Fields")], [
             ["<code>sprite</code>", "<code>textureId</code>, <code>frame</code>, <code>displayWidth/Height</code>, <code>fallbackRadius</code>, <code>fallbackColor</code>"],
             ["<code>text</code>", "<code>text</code>, <code>style</code>"],
             ["<code>rect</code>", "<code>width</code>, <code>height</code>, <code>color</code>, <code>strokeColor</code>, <code>fillAlpha</code>"],
             ["<code>ellipse</code>", "<code>radius</code>, <code>color</code>, <code>strokeColor</code>, <code>fillAlpha</code>"],
         ]),
         ("p", "W każdej klatce scena przekazuje adapterowi tylko obiekty z ustawioną flagą <code>renderDirty</code>. Zmiana opisu (<code>setRender</code>, <code>setText</code>) inkrementuje <code>renderRevision</code> — warstwa renderu przebudowuje wtedy jeden obiekt, a nie całą scenę.", "Every frame the scene hands the adapter only objects with the <code>renderDirty</code> flag set. Changing the descriptor (<code>setRender</code>) increments <code>renderRevision</code> — the render layer then rebuilds a single object instead of the whole scene."),
         ("h2", "Fizyka i odczyt zwrotny", "Physics and readback"),
         ("p", "Bryła jest opisem: <code>body: { type: \"dynamic\" | \"static\", shape, radius, collideWorldBounds }</code>. Po kroku fizyki adapter czyta pozycję z powrotem do obiektu domenowego, dzięki czemu <code>object.x</code> zawsze zgadza się z tym, co widać — bez dwóch źródeł prawdy.", "The body is a descriptor: <code>body: { type: \"dynamic\" | \"static\", shape, radius, collideWorldBounds }</code>. After the physics step the adapter reads the position back into the domain object, so <code>object.x</code> always matches what is on screen — no two sources of truth."),
         ("note", "ok", "Izolacja jest wymuszona", "Isolation is enforced",
          "Reguła ESLint <code>no-restricted-imports</code> blokuje <code>phaser</code> w <code>core/</code>, <code>components/</code> i <code>systems/</code>, a test <code>PublicApi.test.ts</code> skanuje źródła, wykrywa import Phasera oraz import katalogu <code>adapters/</code> w rdzeniu. To nie konwencja w dokumentacji, tylko bramka w CI.",
          "An ESLint <code>no-restricted-imports</code> rule blocks <code>phaser</code> inside <code>core/</code>, <code>components/</code> and <code>systems/</code>, and the <code>PublicApi.test.ts</code> suite scans the sources, catching both a Phaser import and an <code>adapters/</code> import in the core. This is a CI gate, not documentation convention."),
         ("h2", "Własny backend", "A custom backend"),
         ("steps", [
             ((P("Zaimplementuj porty", "Implement the ports")), P("Pięć interfejsów z <code>core/ports.ts</code>. Wystarczy pusty render, żeby uruchomić logikę.", "The five interfaces from <code>core/ports.ts</code>. An empty renderer is enough to run the logic.")),
             ((P("Podłącz w konstruktorze", "Wire them up")), P("Warstwa aplikacji tworzy <code>SceneContext</code> i przekazuje <code>{ render }</code> do <code>initInternal</code>.", "The application layer builds <code>SceneContext</code> and passes <code>{ render }</code> to <code>initInternal</code>.")),
             ((P("Nie zmieniaj scen", "Do not touch scenes")), P("Sceny, komponenty i testy zostają bez zmian — to jest cały sens portów.", "Scenes, components and tests stay unchanged — that is the whole point of ports.")),
         ]),
     ], "adapter porty ports renderport physicsport izolacja phaser backend"),

page("ecs", "advanced", P("ECS: ocena prototypu", "ECS: prototype evaluation"),
     P("Lekki ECS został zmierzony na prototypie i świadomie nie wdrożony. Poniżej liczby i warunki powrotu do tematu.", "A lightweight ECS was measured on a prototype and deliberately not adopted. The numbers and the revisit conditions are below."),
     [
         ("h2", "Pytanie", "The question"),
         ("p", "Czy warto zamienić kompozycję obiektową na ECS? Argument za jest znany: iteracja po tablicach struktur zamiast po obiektach z mapami. Argument przeciw też: tracimy hierarchię, cykl życia per obiekt i czytelność. Zamiast zgadywać, zmierzyłem oba warianty na tym samym zadaniu.", "Is it worth replacing object composition with an ECS? The argument for is known: iterating structure-of-arrays instead of objects with maps. The argument against too: we lose hierarchy, per-object lifecycle and readability. Instead of guessing, both variants were measured on the same workload."),
         ("h2", "Metoda", "Method"),
         ("table", [P("Parametr", "Parameter"), P("Wartość", "Value")], [
             [P("Encje", "Entities"), "20 000"],
             [P("Klatki", "Frames"), "120"],
             [P("Przebiegi", "Runs"), P("3, brany najlepszy (min)", "3, best (min) kept")],
             [P("Zadanie", "Workload"), P("pozycja += prędkość × dt, licznik życia, odczyt pozycji", "position += velocity × dt, lifetime counter, position read")],
             [P("Wariant A", "Variant A"), P("obiekty + <code>Map&lt;konstruktor, komponent&gt;</code>, jak w silniku", "objects + <code>Map&lt;constructor, component&gt;</code>, as in the engine")],
             [P("Wariant B", "Variant B"), P("SoA: <code>Float64Array</code> + maska bitowa", "SoA: <code>Float64Array</code> + bit mask")],
         ]),
         ("code", "Bash", """
node scripts/bench-ecs.mjs
"""),
         ("h2", "Wyniki", "Results"),
         ("table", [P("Operacja", "Operation"), P("Obiekty", "Objects"), P("ECS", "ECS"), P("Różnica", "Ratio")], [
             [P("aktualizacja 20k × 120 klatek", "update 20k × 120 frames"), "0,72 ms/klatkę", "0,09 ms/klatkę", "≈ 8×"],
             [P("utworzenie 20k encji", "spawn 20k entities"), "22 ms", "0,5 ms", "≈ 45×"],
             [P("usunięcie 5k w trakcie klatek", "destroy 5k during frames"), "0,68 ms/klatkę", "0,05 ms/klatkę", "≈ 13×"],
             [P("zapytanie po dwóch tagach", "query by two tags"), "0,47 ms", "0,02 ms", "≈ 23×"],
         ]),
         ("p", "Liczby są prawdziwe, ale dotyczą skali, której ten silnik nie obsługuje: przy typowej scenie do 2 000 obiektów aktualizacja komponentów zajmuje ok. 0,07 ms na klatkę, czyli poniżej 0,5% budżetu 16,7 ms. Rendering Phasera jest w tym momencie dwie rzędy wielkości droższy niż logika.", "The numbers are real, but they describe a scale this engine does not target: for a typical scene of up to 2 000 objects, component updates cost about 0.07 ms per frame — under 0.5% of the 16.7 ms budget. At that point Phaser rendering is two orders of magnitude more expensive than the logic."),
         ("h2", "Decyzja", "Decision"),
         ("table", [P("Kryterium", "Criterion"), P("Obiekty + komponenty", "Objects + components"), P("ECS", "ECS")], [
             [P("Hierarchia i transformacje dziedziczone", "Hierarchy and inherited transforms"), P("wbudowane", "built in"), P("wymaga dodatkowej warstwy", "needs an extra layer")],
             [P("Cykl życia obiektu i komponentu", "Object and component lifecycle"), P("hooki per obiekt", "per-object hooks"), P("systemy, brak hooków", "systems, no hooks")],
             [P("Czytelność i debug", "Readability and debugging"), P("obiekt = byt", "object = entity"), P("wiele tablic", "many arrays")],
             [P("Wydajność przy 2k obiektów", "Performance at 2k objects"), P("0,07 ms/klatkę", "0.07 ms/frame"), P("0,01 ms/klatkę", "0.01 ms/frame")],
             [P("Koszt migracji publicznego API", "Public API migration cost"), P("zero", "none"), P("zmiana <code>Scene</code>, <code>GameObject</code>, testów i dokumentacji", "changes <code>Scene</code>, <code>GameObject</code>, tests and docs")],
         ]),
         ("note", "info", "Wniosek", "Verdict",
          "ECS nie został wdrożony. Zysk wydajności jest realny, ale nieosiągalny w docelowej skali, a koszt to utrata hierarchii, cyklu życia i stabilnego API. Prototyp pozostał w repozytorium jako <code>scripts/bench-ecs.mjs</code>, żeby decyzję można było powtórzyć na nowym sprzęcie.",
          "ECS was not adopted. The performance gain is real but unreachable at the target scale, and the cost is losing hierarchy, lifecycle and a stable API. The prototype stays in the repository as <code>scripts/bench-ecs.mjs</code> so the decision can be re-run on new hardware."),
         ("h2", "Kiedy wrócić do tematu", "When to revisit"),
         ("ul", [
             (P("Scena przekracza ~20 000 jednorodnych obiektów w klatce.", "A scene exceeds ~20 000 homogeneous objects per frame.")),
             (P("Profiler pokazuje, że dyspozycja komponentów to ponad 20% czasu klatki.", "The profiler shows component dispatch taking over 20% of frame time.")),
             (P("Pojawia się symulacja czysto danych: cząstki, boidy, siatki — wtedy ECS jako <b>dodatkowy</b> system obok obiektów.", "A purely data-driven simulation appears: particles, boids, fields — then ECS as an <b>additional</b> system next to objects.")),
             (P("Znika potrzeba hierarchii i hooków per obiekt.", "The need for hierarchy and per-object hooks disappears.")),
         ]),
         ("note", "tip", "Czego nie zmieniono", "What did not change",
          "<code>GameObject</code>, <code>Component</code>, <code>Scene</code> i format projektu pozostały bez zmian po ocenie. Eksperyment nie zostawił po sobie połowicznej abstrakcji.",
          "<code>GameObject</code>, <code>Component</code>, <code>Scene</code> and the project format stayed unchanged after the evaluation. The experiment left no half-baked abstraction behind."),
     ], "ecs entity component system prototyp benchmark wydajnosc decyzja"),

page("compat", "more", P("Przeglądarki, urządzenia i ograniczenia", "Browsers, devices and limitations"),
     P("Co jest sprawdzane automatycznie, na czym to stoi i czego silnik świadomie nie zrobi. Bez obietnic bez pokrycia: każda pozycja w tabelach odpowiada realnie uruchamianemu testowi.",
       "What is verified automatically, what it depends on and what the engine deliberately will not do. No idle promises: every row in the tables maps to a test that actually runs."),
     [
         ("h2", "Wspierane przeglądarki", "Supported browsers"),
         ("table", [P("Silnik", "Engine"), P("Minimum", "Minimum"), P("Test automatyczny", "Automated test"), P("Uwagi", "Notes")], [
             [P("<b>Chromium</b> — Chrome, Edge, Opera, Brave", "<b>Chromium</b> — Chrome, Edge, Opera, Brave"), "111+",
              P("tak — <code>npm run test:compat</code>", "yes — <code>npm run test:compat</code>"),
              P("renderer WebGL, stan w URL, strict CSP; 12 sprawdzeń", "WebGL renderer, URL state, strict CSP; 12 checks")],
             [P("<b>Firefox</b>", "<b>Firefox</b>"), "128+",
              P("tak — ten sam zestaw", "yes — the same suite"),
              P("headless startuje bez WebGL, więc przy okazji potwierdza fallback canvas 2D", "headless starts without WebGL, so it also proves the canvas 2D fallback")],
             [P("<b>Safari</b> — macOS i iOS", "<b>Safari</b> — macOS and iOS"), "17+",
              P("ręcznie (WebKit nie zawsze dostępny w CI)", "manual (WebKit is not always available in CI)"),
              P("wymaga HTTPS dla audio i <code>AudioContext.resume()</code> po geście", "needs HTTPS for audio and <code>AudioContext.resume()</code> after a gesture")],
             [P("<b>Chromium na Androidzie</b>", "<b>Chromium on Android</b>"), "111+",
              P("pośrednio — profile telefonów w matrycy", "indirectly — phone profiles in the matrix"),
              P("viewport 390×844 @3x i 320×568 @2x, cele dotykowe ≥ 24 px", "390×844 @3x and 320×568 @2x viewports, touch targets ≥ 24 px")],
         ]),
         ("note", "warn", "Czego nie wspieramy", "What is not supported",
          "Internet Explorer i tryb zgodności (brak <code>??</code>, <code>?.</code> i <code>Promise.allSettled</code>), przeglądarki bez canvasu 2D, WebView bez <code>requestAnimationFrame</code>. Silnik nie polyfilluje składni — build ma <code>target: es2020</code>, więc starsze silniki odrzucą plik przy parsowaniu, zamiast działać połowicznie.",
          "Internet Explorer and compatibility mode (no <code>??</code>, <code>?.</code> or <code>Promise.allSettled</code>), browsers without canvas 2D, WebViews without <code>requestAnimationFrame</code>. The engine ships no syntax polyfills — the build targets <code>es2020</code>, so older engines reject the file at parse time instead of half-working."),
         ("h2", "Od czego zależy start", "What startup depends on"),
         ("ul", [
             P("<code>ES2020</code>: opcjonalne łańcuchy, <code>??</code>, <code>Promise.allSettled</code>, <code>globalThis</code>. Build nie schodzi niżej, bo transpilacja całego Phasera do ES5 to koszt bez zysku — i tak nie ma już odbiorców.",
               "<code>ES2020</code>: optional chaining, <code>??</code>, <code>Promise.allSettled</code>, <code>globalThis</code>. The build does not go lower because transpiling all of Phaser to ES5 is cost without benefit — there is no audience left for it."),
             P("<b>WebGL2 jest opcjonalny.</b> Bez niego Phaser wchodzi w tryb canvas 2D: gra działa, ale traci shadery, maski i część efektów kamery. Sprawdzenie trafia do raportu diagnostycznego jako <code>webgl2: true/false</code>.",
               "<b>WebGL2 is optional.</b> Without it Phaser falls back to canvas 2D: the game runs but loses shaders, masks and some camera effects. The check lands in the diagnostics report as <code>webgl2: true/false</code>."),
             P("<b>Audio wymaga gestu użytkownika.</b> Do pierwszego kliknięcia dźwięki czekają w kolejce autoplay, a stan widać w <code>getAudio().getState()</code> — interfejs nigdy nie zakłada, że dźwięk zagra sam.",
               "<b>Audio needs a user gesture.</b> Until the first click, sounds wait in the autoplay queue and the state is visible in <code>getAudio().getState()</code> — the UI never assumes sound will play on its own."),
             P("<b>HTTPS</b> jest wymagane dla <code>SharedArrayBuffer</code> (wątki WASM), <code>crossOriginIsolated</code> i części API audio. Sam render działa po HTTP, ale publikacja bez TLS odcina te funkcje — patrz <a href=\"#deploy\">Build i publikacja</a>.",
               "<b>HTTPS</b> is required for <code>SharedArrayBuffer</code> (WASM threads), <code>crossOriginIsolated</code> and some audio APIs. Rendering works over HTTP, but publishing without TLS cuts those features off — see <a href=\"#deploy\">Build and deployment</a>."),
             P("<code>localStorage</code> jest opcjonalny: gdy jest zablokowany (tryb prywatny, iframe bez zgody), zapisy schodzą do <code>MemoryStore</code> i gra działa dalej. Detekcja to <code>LocalStorageStore.isAvailable()</code>, czyli realny zapis i odczyt próbny, nie sam test obecności obiektu.",
               "<code>localStorage</code> is optional: when blocked (private mode, an iframe without consent), saves fall back to <code>MemoryStore</code> and the game keeps running. Detection is <code>LocalStorageStore.isAvailable()</code> — a real test write and read, not a mere presence check."),
         ]),
         ("h2", "Macierz urządzeń", "Device matrix"),
         ("p", "Siedem profili, po kilkanaście sprawdzeń każdy. Profil to nie „szerokość okna”, a konkretna kombinacja viewportu, gęstości pikseli, preferencji ruchu i akcji użytkownika.",
          "Seven profiles with a dozen checks each. A profile is not merely a window width — it is a combination of viewport, pixel ratio, motion preference and user action."),
         ("table", [P("Profil", "Profile"), P("Viewport", "Viewport"), P("DPR", "DPR"), P("Co jest sprawdzane", "What is checked")], [
             ["desktop", "1440×900", "1", P("proporcja 16:9, brak poziomego przewijania, przyciski w kadrze", "16:9 ratio, no horizontal scroll, buttons inside the viewport")],
             ["laptop", "1280×800", "1", P("to samo co desktop plus panel debugowania", "same as desktop plus the debug panel")],
             ["tablet", "820×1180", "2", P("układ pionowy, modal przykładów, kolejność fokusu", "portrait layout, examples modal, focus order")],
             ["phone", "390×844", "3", P("cele dotykowe ≥ 24 px, nagłówek bez przycięcia", "touch targets ≥ 24 px, header not clipped")],
             ["phone-small", "320×568", "2", P("najwęższy wspierany kadr, tap w płótno", "narrowest supported frame, tap on the canvas")],
             ["reduced-motion", "1280×800", "1", P("<code>prefers-reduced-motion</code> wyłącza animacje interfejsu", "<code>prefers-reduced-motion</code> disables UI animations")],
             ["resize", "1036 → 856 px", "1", P("zmiana rozmiaru w trakcie gry nie gubi stanu", "resizing mid-game keeps the state")],
         ]),
         ("h2", "Uruchamianie", "Running"),
         ("code", "Bash", """
npm run test:matrix
npm run test:compat
node scripts/e2e-compat.mjs --engine=firefox
node scripts/e2e-matrix.mjs --json=1
"""),
         ("p", "Oba skrypty stawiają serwer statyczny na <code>dist</code> z nagłówkami bezpieczeństwa i kończą się kodem wyjścia różnym od zera, gdy którykolwiek warunek nie przejdzie. <code>--json=1</code> wypisuje pełny raport, więc wynik wciąga się do CI bez parsowania tekstu.",
          "Both scripts start a static server over <code>dist</code> with security headers and exit non-zero when any condition fails. <code>--json=1</code> prints the full report, so the result can be fed into CI without parsing text."),
         ("h2", "Znane ograniczenia", "Known limitations"),
         ("table", [P("Ograniczenie", "Limitation"), P("Wpływ", "Impact"), P("Obejście albo plan", "Workaround or plan")], [
             [P("Brak routingu po ścieżkach", "No path-based routing"), P("stan gry siedzi w <code>?example=…&amp;lang=…</code>", "game state lives in <code>?example=…&amp;lang=…</code>"), P("celowo — SPA fallback psuje względne <code>./assets/…</code>", "deliberate — an SPA fallback breaks relative <code>./assets/…</code>")],
             [P("Jeden plik JS (~1,6 MB, 380 kB gzip)", "One JS file (~1.6 MB, 380 kB gzip)"), P("Phaser to większość rozmiaru", "Phaser is most of it"), P("budżet pilnuje <code>bundle:check</code>, dzielenie na chunki po MVP", "the budget is guarded by <code>bundle:check</code>, chunk splitting after MVP")],
             [P("Fizyka: tylko Arcade", "Physics: Arcade only"), P("brak obrotów i realistycznych kontaktów", "no rotation or realistic contacts"), P("fizyka siedzi za <code>PhysicsPort</code>, więc podmiana to jedno miejsce", "physics sits behind <code>PhysicsPort</code>, so replacing it is one seam")],
             [P("Canvas nie jest czytany przez czytniki ekranu", "Canvas is not exposed to screen readers"), P("treść gry niedostępna dla AT", "game content is unavailable to AT"), P("lustrzany HUD w DOM i skróty klawiszowe — patrz niżej", "a mirrored DOM HUD and keyboard shortcuts — see below")],
             [P("Determinizm w obrębie jednego silnika", "Determinism within one engine"), P("inne przeglądarki mogą dać inny wynik symulacji", "other browsers may produce a different simulation result"), P("<a href=\"#determinism\">Determinizm i jego granice</a>", "<a href=\"#determinism\">Determinism and its limits</a>")],
             [P("Tilemapa wczytuje całą mapę", "Tilemaps load the whole map"), P("duże mapy to duży koszt pamięci", "large maps cost memory"), P("dane i render są rozdzielone, chunkowanie po MVP", "data and render are separate, chunking after MVP")],
             [P("WASM jest opcjonalny i eksperymentalny", "WASM is optional and experimental"), P("nie leży na ścieżce krytycznej", "it is not on the critical path"), P("zostaje tylko jeśli wygrywa w benchmarku — <a href=\"#wasm\">C++23 / WASM</a>", "stays only if it wins the benchmark — <a href=\"#wasm\">C++23 / WASM</a>")],
             [P("Brak wbudowanego netcode", "No built-in netcode"), P("multiplayer wymaga własnej warstwy", "multiplayer needs your own layer"), P("poza zakresem MVP", "out of MVP scope")],
             [P("Utrata kontekstu WebGL", "WebGL context loss"), P("czarny ekran do przeładowania", "black screen until reload"), P("zdarzenie jest logowane, ekran błędu podaje przyczynę", "the event is logged, the error screen states the cause")],
         ]),
         ("h2", "Dostępność", "Accessibility"),
         ("ul", [
             P("<code>prefers-reduced-motion</code> wyłącza przejścia i tweeny interfejsu; informacja nie ginie, bo zmiany stanu nadal są widoczne. Sprawdza to profil <code>reduced-motion</code>.",
               "<code>prefers-reduced-motion</code> disables UI transitions and tweens; no information is lost because state changes stay visible. The <code>reduced-motion</code> profile verifies it."),
             P("Kontrast w motywie jasnym: <code>#0f1115</code> na <code>#ffffff</code> (17,8:1) i <code>#4a5160</code> na <code>#f7f8f8</code> (8,4:1) — oba powyżej progu WCAG AA.",
               "Contrast in the light theme: <code>#0f1115</code> on <code>#ffffff</code> (17.8:1) and <code>#4a5160</code> on <code>#f7f8f8</code> (8.4:1) — both above the WCAG AA threshold."),
             P("Wszystkie skróty działają bez myszy: <code>p</code> pauza, <code>m</code> menu, <code>r</code> restart, <code>e</code> przykłady, <code>Esc</code> zamknięcie, <code>]</code> i <code>\\</code> skala czasu. Fokus jest widoczny, a modal przechwytuje <code>Tab</code>.",
               "All shortcuts work without a mouse: <code>p</code> pause, <code>m</code> menu, <code>r</code> restart, <code>e</code> examples, <code>Esc</code> close, <code>]</code> and <code>\\</code> time scale. Focus is visible and the modal traps <code>Tab</code>."),
             P("Treść płótna nie trafia do drzewa dostępności — to ograniczenie platformy, nie silnika. Jeśli gra ma być czytelna, potrzebny jest lustrzany HUD w DOM, jak niżej.",
               "Canvas content never reaches the accessibility tree — a platform limitation, not an engine one. If a game must be readable, it needs a mirrored DOM HUD, as below."),
         ]),
         ("code", "TypeScript", """
const live = document.getElementById("a11y-status")!;

scene.events.on("crystal:collected", ({ total, remaining }) => {
  live.textContent = `Kryształy: ${total - remaining} z ${total}`;
});
"""),
         ("h2", "Gdy urządzenie nie działa", "When a device misbehaves"),
         ("ol", [
             P("Sprawdź <code>meta[name=\"b2d-build\"]</code> i <code>b2d-base</code>: czy to ten build i ta ścieżka bazowa. Obie wartości są w raporcie diagnostycznym ekranu błędu.",
               "Check <code>meta[name=\"b2d-build\"]</code> and <code>b2d-base</code>: right build, right base path. Both values are in the error screen's diagnostics report."),
             P("Uruchom <code>npm run test:compat -- --engine=&lt;silnik&gt;</code>. Jeśli tam przechodzi, problem jest w urządzeniu albo w treści gry, nie w rdzeniu. Pominięty silnik (np. WebKit bez bibliotek systemowych) to brak pokrycia, nie dowód działania.",
               "Run <code>npm run test:compat -- --engine=&lt;engine&gt;</code>. If it passes there, the problem is the device or the game content, not the core. A skipped engine (e.g. WebKit without system libraries) means no coverage, not proof it works."),
             P("Powtórz w profilu z matrycy (<code>phone-small</code>, <code>reduced-motion</code>) — inny wynik zawęża przyczynę do rozmiaru albo preferencji. Potem zgłoś według <a href=\"#policy\">procedury zgłoszeń</a>.",
               "Repeat in a matrix profile (<code>phone-small</code>, <code>reduced-motion</code>) — a different result narrows the cause to size or preference. Then report it following the <a href=\"#policy\">reporting procedure</a>."),
         ]),
     ], "kompatybilnosc przegladarki safari firefox chrome webkit urzadzenia matryca tablet telefon ograniczenia dostepnosc a11y"),

page("policy", "more", P("Wersjonowanie, migracje i zgłaszanie błędów", "Versioning, migrations and bug reporting"),
     P("Zasady, których trzyma się repozytorium: co jest zmianą łamiącą, jak migrują dane projektu i zapisu, jak wygląda zgłoszenie, które da się odtworzyć, i skąd bierze się pewność co do zależności oraz licencji.",
       "The rules this repository follows: what counts as a breaking change, how project and save data migrate, what a reproducible report looks like, and where the certainty about dependencies and licences comes from."),
     [
         ("p", "Ta strona opisuje <b>zasady</b>. Mechanika — komendy, artefakty, kanały i kolejność wydania — jest na stronie <a href='#releases'>Wydania, kanały i artefakty</a>, a otwarte kompromisy na stronie <a href='#debt'>Dług techniczny i decyzje architektoniczne</a>.",
          "This page describes the <b>rules</b>. The mechanics — commands, artifacts, channels and the release order — live on <a href='#releases'>Releases, channels and artifacts</a>, and the open trade-offs on <a href='#debt'>Technical debt and architecture decisions</a>."),
         ("h2", "Semver dla publicznych pakietów", "Semver for the public packages"),
         ("table", [P("Zmiana", "Change"), P("Wersja", "Version"), P("Przykład", "Example")], [
             [P("Usunięcie lub zmiana nazwy eksportu", "Removing or renaming an export"), "<b>major</b>", "<code>Scene.createRect</code> → <code>Scene.rect</code>"],
             [P("Zmiana sygnatury albo wartości domyślnej", "Changed signature or default"), "<b>major</b>", P("nowy wymagany argument w <code>EngineOptions</code>", "a new required argument in <code>EngineOptions</code>")],
             [P("Podniesienie <code>formatVersion</code> projektu lub zapisu", "Bumping project or save <code>formatVersion</code>"), "<b>major</b>", P("v2 → v3 z migracją w <code>Migrate.ts</code>", "v2 → v3 with a migration in <code>Migrate.ts</code>")],
             [P("Nowy opcjonalny element API", "New optional API surface"), "<b>minor</b>", "<code>engine.getDiagnosticsReport()</code>"],
             [P("Nowa reguła walidacji odrzucająca dane, które wcześniej przechodziły", "A new validation rule rejecting previously valid data"), "<b>major</b>", P("nowy limit w <code>DEFAULT_PROJECT_LIMITS</code>", "a new limit in <code>DEFAULT_PROJECT_LIMITS</code>")],
             [P("Poprawka bez zmiany zachowania API", "Fix without API behaviour change"), "<b>patch</b>", P("błąd w <code>clampDelta</code>, literówka w logu", "a bug in <code>clampDelta</code>, a typo in a log")],
         ]),
         ("p", "Wszystkie pakiety w monorepo mają jedną wersję — <code>packages/*/package.json</code> niosą tę samą liczbę co rdzeń. Rozjazd wersji jest traktowany jak defekt, bo użytkownik nie ma jak zgadnąć, który pakiet jest „ten właściwy”.",
          "Every package in the monorepo carries one version — <code>packages/*/package.json</code> hold the same number as the core. A version skew is treated as a defect, because users have no way to guess which package is \"the right one\"."),
         ("h2", "Kanały stabilności", "Stability channels"),
         ("table", [P("Kanał", "Channel"), P("Co obejmuje", "What it covers"), P("Gwarancja", "Guarantee")], [
             [P("<b>stable</b> 0.1.x", "<b>stable</b> 0.1.x"), P("rdzeń: silnik, sceny, obiekty, wejście, fizyka, zasoby, format projektu", "core: engine, scenes, objects, input, physics, assets, project format"), P("zmiany łamiące tylko w major", "breaking changes only in a major")],
             [P("<b>experimental</b>", "<b>experimental</b>"), P("most WASM, prototyp ECS, import Tiled w wersji roboczej", "WASM bridge, ECS prototype, work-in-progress Tiled import"), P("API może się zmienić w minor; kod oznaczony <code>@experimental</code> i opisany na stronie funkcji", "API may change in a minor; marked <code>@experimental</code> and documented on the feature page")],
             [P("<b>internal</b>", "<b>internal</b>"), P("adaptery, porty, narzędzia builda", "adapters, ports, build tooling"), P("poza semverem, mogą się zmienić w każdej wersji", "outside semver, may change in any release")],
         ]),
         ("note", "info", "Dwie stałe, które to kodują", "Two constants that encode this",
          "<code>ENGINE_VERSION</code> i <code>API_LEVEL</code> są eksportowane z pakietu. <code>API_LEVEL</code> rośnie tylko przy zmianie łamiącej, więc biblioteka trzecia wykryje niezgodność bez parsowania semveru. <code>API_STABILITY</code> mówi wprost, że w 0.x nie ma jeszcze obietnicy stabilności.",
          "<code>ENGINE_VERSION</code> and <code>API_LEVEL</code> are exported from the package. <code>API_LEVEL</code> only grows on a breaking change, so a third-party library detects a mismatch without parsing semver. <code>API_STABILITY</code> states plainly that 0.x carries no stability promise yet."),
         ("h2", "Snapshot publicznego API", "Public API snapshot"),
         ("p", "Każdy eksport z <code>packages/engine/src/index.ts</code> trafia do <code>tests/fixtures/public-api.json</code>. Test <code>tests/unit/ApiSnapshot.test.ts</code> porównuje z nim stan aktualny i rozróżnia trzy przypadki: usunięcie symbolu (zmiana łamiąca), dodanie (wymaga świadomej aktualizacji) i zmianę wersji.",
          "Every export from <code>packages/engine/src/index.ts</code> lands in <code>tests/fixtures/public-api.json</code>. <code>tests/unit/ApiSnapshot.test.ts</code> compares the current state against it and distinguishes three cases: a removed symbol (breaking), an added one (needs a deliberate update) and a version change."),
         ("code", "Bash", """
npm test -- tests/unit/ApiSnapshot.test.ts
UPDATE_API_SNAPSHOT=1 npm test -- tests/unit/ApiSnapshot.test.ts
"""),
         ("p", "Snapshot ma 316 symboli i aktualizuje się wyłącznie komendą z <code>UPDATE_API_SNAPSHOT=1</code> — dzięki temu w commitcie widać każdą zmianę powierzchni publicznej, także taką, która nie zmienia zachowania.",
          "The snapshot holds 316 symbols and is updated only through the <code>UPDATE_API_SNAPSHOT=1</code> command — so every change to the public surface shows up in the diff, including ones that do not change behaviour."),
         ("h2", "Deprecacja", "Deprecation"),
         ("ol", [
             P("Oznacz funkcję <code>@deprecated</code> w komentarzu typów i w dokumentacji — z nazwą zamiennika i wersją, w której zniknie. Komentarz jest jedynym miejscem, które pokaże IDE, więc sam wpis w changelogu nie wystarczy.",
               "Mark the function <code>@deprecated</code> in the type comments and in the docs — with the replacement name and the version it disappears in. The comment is the only place the IDE shows, so a changelog entry alone is not enough."),
             P("Dodaj ostrzeżenie w czasie działania przez <code>getLogger().warn()</code> z kontekstem <code>deprecation</code>, raz na sesję, nie raz na klatkę — dzięki temu gracz i deweloper widzą to samo w panelu logów.",
               "Emit a runtime warning through <code>getLogger().warn()</code> with the <code>deprecation</code> context, once per session rather than once per frame — so player and developer see the same thing in the log panel."),
             P("Zostaw stare API na co najmniej dwa wydania minor i usuń je w major, razem z wpisem w changelogu i migracją w dokumentacji. W 0.x obowiązuje wariant skrócony: jedno minor plus wpis w <code>Migrate.ts</code>, jeśli zmiana dotyczy danych.",
               "Keep the old API for at least two minor releases and remove it in a major, together with a changelog entry and a migration note. During 0.x a shortened variant applies: one minor plus a <code>Migrate.ts</code> entry when data is involved."),
         ]),
         ("code", "TypeScript", """
/** @deprecated since 0.1.0 — use scene.spawn("sprite", options). Removed in 0.3.0. */
createSprite(asset: string, options: SpriteOptions): Sprite {
  this.warnOnce("deprecated:createSprite");
  return this.spawn("sprite", { asset, ...options });
}
"""),
         ("h2", "Migracja formatu projektu", "Project format migration"),
         ("table", [P("Sytuacja", "Situation"), P("Zachowanie", "Behaviour")], [
             [P("Ten sam <code>formatVersion</code>", "Same <code>formatVersion</code>"), P("odczyt bez zmian, walidacja schematu", "read as-is, schema validation")],
             [P("Starsza wersja, znana ścieżka migracji", "Older version, known migration path"), P("łańcuch <code>v1 → v2 → v3</code>, krok po kroku, wynik walidowany ponownie", "a <code>v1 → v2 → v3</code> chain, step by step, the result re-validated")],
             [P("Starsza wersja bez ścieżki", "Older version without a path"), P("błąd <code>formatVersion</code>: <i>No migration path from format N</i>, dane nietknięte", "a <code>formatVersion</code> error: <i>No migration path from format N</i>, data untouched")],
             [P("Wersja nowsza niż wspierana", "Newer than supported"), P("błąd <code>formatVersion</code> z numerem wersji — żadnego „odczytu na siłę”", "a <code>formatVersion</code> error carrying the version number — no \"best effort\" read")],
             [P("Nieznane pola", "Unknown fields"), P("zachowane i zgłoszone jako <code>unknown-field</code>, nie wycinane po cichu", "preserved and reported as <code>unknown-field</code>, not silently stripped")],
             [P("Uszkodzona koperta lub suma kontrolna", "Broken envelope or checksum"), P("odrzucenie z kodem <code>checksum-mismatch</code>", "rejected with a <code>checksum-mismatch</code> code")],
         ]),
         ("p", "<code>importProject()</code> nigdy nie rzuca wyjątkiem na dowolnym tekście i nigdy nie zwraca częściowo zbudowanego projektu. Wynik ma zawsze ten sam kształt: <code>ok</code>, lista <code>errors</code> z kodem i ścieżką oraz lista <code>warnings</code>. Test <code>tests/unit/Resilience.test.ts</code> przepuszcza przez tę funkcję losowe śmieci (pusty tekst, urwany JSON, <code>1e999</code>) i sprawdza, że zmienia się wyłącznie wynik.",
          "<code>importProject()</code> never throws on arbitrary text and never returns a half-built project. The result always has the same shape: <code>ok</code>, an <code>errors</code> list with code and path, and a <code>warnings</code> list. <code>tests/unit/Resilience.test.ts</code> pushes random garbage (empty text, truncated JSON, <code>1e999</code>) through it and checks that only the result changes."),
         ("code", "TypeScript", """
const result = importProject(text, { requireLicenses: true });

if (!result.ok) {
  for (const problem of result.errors) {
    console.warn(problem.code, problem.path, problem.message);
  }
  return null;
}

return result.project;
"""),
         ("h3", "Limity importu", "Import limits"),
         ("table", [P("Limit", "Limit"), P("Domyślnie", "Default"), P("Kod błędu", "Error code")], [
             ["<code>maxBytes</code>", "5 MiB", "<code>limit-exceeded</code>"],
             ["<code>maxDepth</code>", "12", "<code>limit-exceeded</code>"],
             ["<code>maxObjects</code> / <code>maxObjectsPerScene</code>", "20 000 / 10 000", "<code>limit-exceeded</code>"],
             ["<code>maxScenes</code> / <code>maxAssets</code>", "200 / 2 000", "<code>limit-exceeded</code>"],
             ["<code>maxStringLength</code> / <code>maxIdLength</code>", "4 096 / 96", "<code>limit-exceeded</code>"],
             ["<code>maxCoordinate</code>", "1 000 000", "<code>limit-exceeded</code>"],
             [P("klucze <code>__proto__</code>, <code>constructor</code>, <code>prototype</code>", "keys <code>__proto__</code>, <code>constructor</code>, <code>prototype</code>"), P("zawsze odrzucane", "always rejected"), "<code>unsafe-key</code>"],
         ]),
         ("p", "Limity są parametrem, nie stałą w kodzie: <code>importProject(text, { limits: { maxObjects: 50_000 } })</code> podnosi je dla zaufanego edytora, a <code>mergeLimits()</code> pilnuje, żeby wartości ujemne i <code>NaN</code> nie przeszły. Odrzucenie jest zawsze jawnym błędem — nigdy cichym obcięciem danych.",
          "Limits are a parameter, not a constant: <code>importProject(text, { limits: { maxObjects: 50_000 } })</code> raises them for a trusted editor, and <code>mergeLimits()</code> ensures negative values and <code>NaN</code> never slip through. A rejection is always an explicit error — never a silent trim of the data."),
         ("h2", "Migracja zapisów gracza", "Player save migration"),
         ("ul", [
             P("<code>CURRENT_SAVE_VERSION</code> opisuje wersję bieżącą, a <code>migrateSave()</code> podnosi starsze zapisy krok po kroku. Migracja jest czystą funkcją na obiekcie — bez DOM i bez zapisu, więc testuje się ją bez przeglądarki.",
               "<code>CURRENT_SAVE_VERSION</code> describes the current version and <code>migrateSave()</code> upgrades older saves step by step. The migration is a pure function on an object — no DOM, no writes, so it is tested without a browser."),
             P("Zapis z nowszego builda jest odrzucany z <code>SaveCorruptionError</code>, a nie odczytywany częściowo: lepiej pokazać komunikat niż nadpisać postęp gracza. Komunikat zawiera numer wersji, więc wsparcie od razu wie, o co chodzi.",
               "A save from a newer build is rejected with <code>SaveCorruptionError</code> instead of being partially read: better to show a message than to overwrite a player's progress. The message includes the version number, so support knows immediately."),
             P("Suma kontrolna FNV-1a wykrywa ręczną edycję i uszkodzenie pliku; to nie jest zabezpieczenie przed oszustwem — od tego jest podpis po stronie serwera. Brak sumy nie blokuje odczytu starszych zapisów.",
               "An FNV-1a checksum detects manual edits and file corruption; it is not anti-cheat — that needs a server-side signature. A missing checksum does not block reading older saves."),
         ]),
         ("h2", "Zgłaszanie błędów", "Bug reporting"),
         ("p", "Dobre zgłoszenie różni się od złego jednym: da się je odtworzyć bez zgadywania. Szablon zbiera dokładnie te dane, których brakuje w większości zgłoszeń.",
          "A good report differs from a bad one in a single way: it can be reproduced without guessing. The template collects exactly the data missing from most reports."),
         ("code", "Markdown", """
## Środowisko / Environment
- build: <meta name="b2d-build">        (np. 0.1.0+20261022-144654)
- przeglądarka: Chrome 129 / Firefox 130 / Safari 17.4
- system: Windows 11 / macOS 14 / Android 14
- viewport i DPR: 390×844 @3

## Kroki / Steps
1. Otwórz playground z ?example=top-down
2. Wciśnij p, potem r
3. ...

## Oczekiwane / faktyczne (expected / actual)
- oczekiwane: HUD pokazuje 0 / 8
- faktyczne: HUD pokazuje 8 / 8

## Załączniki / Attachments
- diagnostyka: przycisk „Pobierz raport” (b2d-diagnostics.txt)
- konsola: pełny tekst, także ostrzeżenia
- jeśli dotyczy: minimalny projekt JSON
"""),
         ("table", [P("Waga", "Severity"), P("Znaczenie", "Meaning"), P("Czas reakcji", "Response time")], [
             [P("<b>S1</b> — blokujący", "<b>S1</b> — blocking"), P("czarny ekran, brak startu, utrata danych gracza", "black screen, no boot, player data loss"), P("natychmiast, hotfix", "immediate, hotfix")],
             [P("<b>S2</b> — poważny", "<b>S2</b> — major"), P("funkcja nie działa, ale da się obejść", "a feature is broken but has a workaround"), P("następne wydanie", "next release")],
             [P("<b>S3</b> — zwykły", "<b>S3</b> — normal"), P("błędne zachowanie w wąskim przypadku", "wrong behaviour in a narrow case"), P("kolejka, według priorytetu", "backlog, by priority")],
             [P("<b>S4</b> — kosmetyczny", "<b>S4</b> — cosmetic"), P("wygląd, literówka, wydajność bez wpływu", "looks, typo, performance without impact"), P("przy okazji", "when convenient")],
         ]),
         ("note", "warn", "Zanim zgłosisz czarny ekran", "Before you report a black screen",
          "Ekran błędu jest pierwszym źródłem prawdy: pokazuje adres, build, brakujące zasoby i trzy przyciski (ponów, kopiuj, pobierz). Zgłoszenie bez tego raportu wydłuża diagnozę o rundę pytań. Jeśli ekran się nie pojawia, problem jest wcześniej — w samym HTML albo w nagłówkach hostingu.",
          "The error screen is the first source of truth: it shows the URL, build, missing resources and three buttons (retry, copy, download). A report without that dump adds a round of questions. If the screen never appears, the failure is earlier — in the HTML itself or in hosting headers."),
         ("h2", "Bezpieczeństwo", "Security"),
         ("ul", [
             P("Zgłoszenia podatności nie idą do publicznego issue: kanał prywatny, potwierdzenie w ciągu 72 h, poprawka przed publikacją szczegółów. Zakres: XSS przez dane projektu, obejście walidacji importu, wyciek danych z zapisów.",
               "Vulnerability reports do not go to a public issue: a private channel, acknowledgement within 72 h, a fix before details are published. Scope: XSS through project data, bypassing import validation, data leaks from saves."),
             P("Silnik nie używa <code>eval</code> ani <code>new Function</code> na ścieżce startu, nie ładuje niczego z sieci po starcie i przechodzi pod <code>script-src 'self' 'sha256-…'</code>. Sprawdzają to <code>npm run test:compat</code> i <code>npm run test:hosting</code>.",
               "The engine uses no <code>eval</code> or <code>new Function</code> on the startup path, loads nothing from the network after boot and runs under <code>script-src 'self' 'sha256-…'</code>. Verified by <code>npm run test:compat</code> and <code>npm run test:hosting</code>."),
             P("Dane projektu i zapisu są traktowane jak wejście niezaufane: limity, zakaz kluczy prototypowych, walidacja referencji. Patrz tabela limitów wyżej oraz strona <a href=\"#json\">Format projektu</a>.",
               "Project and save data are treated as untrusted input: limits, a ban on prototype keys, reference validation. See the limits table above and <a href=\"#json\">Project format</a>."),
         ]),
         ("h2", "Zależności i licencje", "Dependencies and licences"),
         ("p", "<code>npm run audit:licenses</code> czyta <code>package-lock.json</code> i katalog zasobów, klasyfikuje każdą pozycję i generuje <code>docs/LICENSES.md</code>. Wariant <code>--check</code> nic nie zapisuje i kończy się kodem 1, jeśli pojawi się licencja spoza polityki — to brama w CI, nie raport „do przeczytania kiedyś”.",
          "<code>npm run audit:licenses</code> reads <code>package-lock.json</code> and the asset catalogue, classifies every entry and generates <code>docs/LICENSES.md</code>. The <code>--check</code> variant writes nothing and exits 1 when a licence outside the policy appears — it is a CI gate, not a \"read it someday\" report."),
         ("table", [P("Klasa", "Class"), P("Licencje", "Licences"), P("Co robi audyt", "What the audit does")], [
             [P("dozwolone", "allowed"), "MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, CC0-1.0, CC-BY-4.0, Unlicense, MIT-0, MPL-2.0", P("przechodzi", "passes")],
             [P("do przeglądu", "review"), "LGPL-3.0, LGPL-2.1, MPL-2.0", P("przechodzi, ale trafia na listę do świadomej decyzji", "passes but is listed for a conscious decision")],
             [P("niedozwolone", "forbidden"), "GPL-2.0, GPL-3.0, AGPL-3.0, SSPL-1.0, BUSL-1.1, CC-BY-NC-4.0", P("błąd i kod wyjścia 1", "an error and exit code 1")],
             [P("nieznane", "unknown"), P("brak pola <code>license</code>", "a missing <code>license</code> field"), P("błąd — brak odpowiedzi to nie odpowiedź", "an error — a missing answer is not an answer")],
         ]),
         ("p", "Zasoby w grze mają własny katalog z wymaganym polem <code>license</code> i sumą kontrolną pliku. Asset bez licencji nie przechodzi walidacji projektu z <code>requireLicenses: true</code>, a raport zasobów wypisuje go jako <code>unlicensed</code> — problem widać w grze, zanim trafi do wydania.",
          "Game assets live in their own catalogue with a mandatory <code>license</code> field and a file checksum. An asset without a licence fails project validation with <code>requireLicenses: true</code>, and the asset report lists it as <code>unlicensed</code> — the problem shows up in the game before it reaches a release."),
         ("code", "Bash", """
npm run audit:licenses          # raport + regeneracja docs/LICENSES.md
npm run audit:licenses:check    # brama CI: nic nie zapisuje, kod 1 przy naruszeniu
"""),
         ("p", "Stan na dziś: 308 pakietów (2 runtime), 308 dozwolonych, 0 do przeglądu, 0 nieznanych, 0 niedozwolonych. Nowa zależność przechodzi cztery kroki: wpis w <code>package.json</code> z konkretną wersją, <code>npm ci</code>, <code>npm run audit:licenses:check</code> i wpis w changelogu z uzasadnieniem.",
          "Current state: 308 packages (2 runtime), 308 allowed, 0 for review, 0 unknown, 0 forbidden. A new dependency goes through four steps: an entry in <code>package.json</code> with an exact version, <code>npm ci</code>, <code>npm run audit:licenses:check</code>, and a changelog entry with the rationale."),
     ], "semver wersjonowanie migracja deprecacja zgloszenia bledow bug report licencje audyt zaleznosci bezpieczenstwo limity"),

page("releases", "more", P("Wydania, kanały i artefakty", "Releases, channels and artifacts"),
     P("Jak wygląda wydanie od podniesienia wersji do plików, które dostaje użytkownik: kanał stabilny i eksperymentalny, changelog, szablon release notes oraz artefakty z wynikami testów i benchmarków. Wszystko sterowane komendami, które kończą się kodem wyjścia różnym od zera.",
       "What a release looks like from a version bump to the files a user receives: the stable and experimental channels, the changelog, the release-notes template, and artifacts carrying test and benchmark results. Everything is driven by commands that exit non-zero on failure."),
     [
         ("h2", "Kanały stabilności", "Stability channels"),
         ("p", "Kanał nie jest etykietą w dokumentacji, tylko danymi w kodzie. Każda funkcja ma wpis w rejestrze <code>FEATURE_STATUS</code> z kanałem, wersją od której istnieje i jednym zdaniem o zakresie. Dzięki temu odpowiedź na pytanie „czy mogę na tym budować?” brzmi <code>isStable(\"wasm\")</code>, a nie „to zależy”.",
          "A channel is not a label in the docs, it is data in the code. Every feature has an entry in the <code>FEATURE_STATUS</code> registry with its channel, the version it appeared in and a one-sentence scope. That makes the answer to \"can I build on this?\" a call to <code>isStable(\"wasm\")</code> instead of \"it depends\"."),
         ("table", [P("Kanał", "Channel"), P("Obietnica", "Promise"), P("Przykłady", "Examples")], [
             [P("<b>stable</b>", "<b>stable</b>"), P("zmiany łamiące wyłącznie w wersji major; zachowanie pokryte testami i stroną dokumentacji", "breaking changes only in a major; behaviour covered by tests and a docs page"),
              P("silnik, sceny, obiekty, wejście, fizyka, kamera, zasoby, audio, animacje, format projektu, zapisy, pluginy, debug", "engine, scenes, objects, input, physics, camera, assets, audio, animation, project format, saves, plugins, debug")],
             [P("<b>experimental</b>", "<b>experimental</b>"), P("API może się zmienić w wersji minor; kod oznaczony i opisany, nigdy na ścieżce krytycznej", "API may change in a minor; marked and documented, never on the critical path"),
              "most WASM, prototyp ECS, import Tiled", "WASM bridge, ECS prototype, Tiled import"],
             [P("<b>internal</b>", "<b>internal</b>"), P("poza semverem — adaptery, porty i narzędzia builda mogą się zmienić w każdej wersji", "outside semver — adapters, ports and build tooling may change in any release"),
              "<code>RuntimeAdapter</code>, <code>RenderPort</code>, <code>PhysicsPort</code>", "<code>RuntimeAdapter</code>, <code>RenderPort</code>, <code>PhysicsPort</code>"],
         ]),
         ("code", "TypeScript", """
import { getStabilityReport, isExperimental, isStable, listFeatures } from "@browser2d/engine";

isStable("physics");          // true  — możesz na tym budować
isExperimental("wasm");       // true  — sprawdzaj changelog przy każdej aktualizacji
listFeatures("experimental"); // pełna lista z polem `note` i wersją `since`

const report = getStabilityReport();
report.counts;                // { stable: 17, experimental: 3, internal: 1 }
"""),
         ("p", "Raport trafia też do artefaktów wydania jako tabela liczników, więc w release notes widać wprost, ile funkcji zmieniło kanał — bez zaglądania do kodu.",
          "The report also lands in the release artifacts as a table of counts, so the release notes show how many features changed channel — without opening the code."),
         ("h2", "Podniesienie wersji", "Bumping the version"),
         ("p", "Wszystkie pakiety w <code>packages/*</code> mają jedną wersję — wspólną z rdzeniem — a zależności wewnętrzne są przypięte dokładnie. To decyzja architektoniczna (ADR 0006), nie porządkowy nawyk: rozjazd wersji kończy się błędem typowania, którego komunikat nie tłumaczy przyczyny.",
          "Every package in <code>packages/*</code> carries one version — the same as the core — and internal dependencies are pinned exactly. This is an architectural decision (ADR 0006), not housekeeping: a version skew ends in a type error whose message does not explain the cause."),
         ("code", "Bash", """
npm run versions:check              # brama: root, packages/*, zależności wewnętrzne, ENGINE_VERSION
npm run versions:bump -- minor
npm run versions:bump -- major   # podnosi też API_LEVEL
node scripts/versions.mjs --set=0.2.0
"""),
         ("table", [P("Zmiana", "Change"), P("Wersja", "Version"), P("API_LEVEL", "API_LEVEL")], [
             [P("poprawka bez zmiany API", "a fix without API change"), "<b>patch</b>", P("bez zmian", "unchanged")],
             [P("nowe opcjonalne API, nowa funkcja", "new optional API or feature"), "<b>minor</b>", P("bez zmian", "unchanged")],
             [P("usunięcie lub zmiana sygnatury, nowy limit odrzucający dane", "removal, changed signature, a new limit rejecting data"), "<b>major</b>", P("+1", "+1")],
         ]),
         ("note", "info", "Jedna komenda zamiast pięciu plików", "One command instead of five files",
          "<code>applyVersion()</code> aktualizuje <code>package.json</code> w rdzeniu, wszystkie manifesty pakietów, ich zakresy <code>@browser2d/*</code> oraz stałą <code>ENGINE_VERSION</code> w <code>version.ts</code>. Po zapisie natychmiast uruchamia sprawdzenie, więc rozjazd nie przejdzie do commita.",
          "<code>applyVersion()</code> updates the root <code>package.json</code>, every package manifest, their <code>@browser2d/*</code> ranges and the <code>ENGINE_VERSION</code> constant in <code>version.ts</code>. It re-runs the check immediately after writing, so a skew never reaches the commit."),
         ("h2", "Changelog", "Changelog"),
         ("p", "<code>CHANGELOG.md</code> trzyma się formatu Keep a Changelog, a wersje są semverowe. Sekcje <code>Added</code>, <code>Changed</code>, <code>Deprecated</code>, <code>Removed</code>, <code>Fixed</code>, <code>Security</code> istnieją zawsze — puste też — bo pominięta sekcja wygląda jak przeoczenie i wsparcie nie odróżni jej od realnej luki.",
          "<code>CHANGELOG.md</code> follows Keep a Changelog and versions are semver. The <code>Added</code>, <code>Changed</code>, <code>Deprecated</code>, <code>Removed</code>, <code>Fixed</code> and <code>Security</code> sections always exist — empty ones included — because a missing section looks like an oversight and support cannot tell it apart from a real gap."),
         ("ul", [
             P("Wpis mówi o zachowaniu użytkownika, nie o pliku: „<code>npm ci</code> działa na czystym klonie”, a nie „poprawiono <code>package.json</code>”.", "An entry describes user-visible behaviour, not a file: \"<code>npm ci</code> works on a clean checkout\", not \"fixed <code>package.json</code>\"."),
             P("Każda sekcja ma link do strony dokumentacji, która opisuje dany mechanizm — changelog nie powtarza dokumentacji, tylko wskazuje miejsce.", "Every section links to the docs page describing the mechanism — the changelog does not repeat the docs, it points at them."),
             P("Zmiany łamiące mają własną tabelę „przed → po → co zrobić”, także w release notes.", "Breaking changes get their own before → after → action table, in the release notes as well."),
         ]),
         ("h2", "Szablon release notes", "Release notes template"),
         ("p", "<code>docs/RELEASE_NOTES_TEMPLATE.md</code> definiuje osiem sekcji i pięć zasad. Najważniejsza: liczby pochodzą z artefaktów, nie z pamięci. Jeśli wyniku nie da się wskazać plikiem w <code>release/artifacts/{wersja}/</code>, nie trafia do notatek.",
          "<code>docs/RELEASE_NOTES_TEMPLATE.md</code> defines eight sections and five rules. The most important one: numbers come from artifacts, not memory. If a result cannot be traced to a file in <code>release/artifacts/{version}/</code>, it does not go into the notes."),
         ("table", [P("Sekcja", "Section"), P("Skąd dane", "Source")], [
             [P("Highlights", "Highlights"), P("człowiek — trzy zdania o efektach dla użytkownika", "a human — three sentences about user-visible outcomes")],
             [P("Breaking changes", "Breaking changes"), P("sekcja <code>Removed</code>/<code>Changed</code> z changelogu + tabela migracji", "<code>Removed</code>/<code>Changed</code> from the changelog plus a migration table")],
             [P("Deprecations", "Deprecations"), "<code>engine.getDeprecations()</code>"],
             [P("Migrations", "Migrations"), P("kroki <code>scripts/migrate.mjs</code> i wersje formatu", "<code>scripts/migrate.mjs</code> steps and format versions")],
             ["Quality gate", "<code>test-results.json</code>, <code>benchmarks.json</code>, <code>bundle-manifest.json</code>, <code>api-snapshot.json</code>"],
             [P("Stability", "Stability"), "<code>getStabilityReport()</code>"],
             [P("Artifacts", "Artifacts"), "wygenerowana tabela z sumami SHA-256", "a generated table with SHA-256 sums"],
             [P("Known limitations", "Known limitations"), P("strona <a href='#compat'>Przeglądarki i ograniczenia</a>", "the <a href='#compat'>Browsers and limitations</a> page")],
         ]),
         ("h2", "Budowanie artefaktów", "Building the artifacts"),
         ("p", "Jedna komenda uruchamia testy i zbiera wszystko, co potwierdza jakość wydania: wyniki testów jednostkowych i integracyjnych, benchmarki porównane z zapisaną bazą, raport rozmiaru, snapshot publicznego API, wpis z changelogu, sumy kontrolne i wersję roboczą release notes.",
          "One command runs the tests and collects everything that backs the release quality claim: unit and integration test results, benchmarks compared against the recorded baseline, the size report, the public API snapshot, the changelog entry, checksums and a draft of the release notes."),
         ("code", "Bash", """
npm run release:check          # wersje, changelog, szablon, ADR, dług S1, buildId
npm run release:artifacts      # testy + artefakty + CHECKSUMS.txt + release-notes.md
npm run release:notes          # to samo, ale bez ponownego uruchamiania testów
node scripts/release.mjs --artifacts --out=release/artifacts/rc1
"""),
         ("code", "text", """
release/artifacts/0.1.0/
  release.json          # maszynowe podsumowanie: wersja, build, kanały, artefakty
  test-results.json     # pełny raport vitest (JSON)
  benchmarks.json       # 17 przypadków: średnia, mediana, delta do bazy
  benchmarks-raw.json   # surowe próbki z benchmarks/latest.json
  bundle-manifest.json  # rozmiary, gzip, brotli, SHA-256 per plik
  api-snapshot.json     # 316 symboli publicznego API
  changelog-entry.md    # sekcja changelogu dla tej wersji
  release-notes.md      # wersja robocza z wypełnionymi tabelami
  CHECKSUMS.txt         # SHA-256 wszystkich plików powyżej
"""),
         ("note", "tip", "Dlaczego JSON, a nie zrzut konsoli", "Why JSON, not a console dump",
          "Wynik ma być czytelny dla maszyny, bo z niego powstaje release notes i porównanie między wydaniami. <code>release/artifacts/index.json</code> zbiera wszystkie wydania z liczbą testów, liczbą przypadków benchmarku i rozmiarem gzip — czyli historię jakości w jednym pliku.",
          "The result must be machine-readable, because the release notes and the comparison between releases are generated from it. <code>release/artifacts/index.json</code> lists every release with its test count, benchmark case count and gzip size — the quality history in one file."),
         ("h2", "Deprecacja i migracje", "Deprecation and migrations"),
         ("p", "Deprecacja ma dwa nośniki: komentarz <code>@deprecated</code> w typach (widzi go IDE) i wpis w rejestrze, który emituje jedno ostrzeżenie na sesję przez <code>getLogger()</code>. Rejestr jest danymi, więc można go odczytać i pokazać w UI.",
          "Deprecation has two carriers: the <code>@deprecated</code> comment in the types (the IDE sees it) and a registry entry that emits one warning per session through <code>getLogger()</code>. The registry is data, so it can be read and shown in a UI."),
         ("code", "TypeScript", """
engine.warnDeprecated("scene.createSprite");   // jedno ostrzeżenie na sesję, kontekst `deprecation`
engine.getDeprecations();                      // pełna lista: id, zamiennik, since, removeIn

registerDeprecation({
  id: "scene.createSprite",
  replacement: 'scene.spawn("sprite", options)',
  since: "0.1.0",
  removeIn: "0.3.0",
  message: "createSprite(asset, options) keeps the positional asset argument"
});
"""),
         ("p", "Migracja danych to osobne narzędzie, bo pliki użytkownika żyją dłużej niż aplikacja. Działa na projektach i zapisach, obsługuje <code>--check</code> (tylko sprawdzenie), <code>--out</code> (zapis do pliku) i tryb potokowy. Wynik ma zawsze ten sam kształt, a błąd jest błędem — nie cichym obcięciem danych.",
          "Data migration is a separate tool, because user files outlive the app. It handles projects and saves, supports <code>--check</code> (verify only), <code>--out</code> (write to a file) and a pipeline mode. The result always has the same shape, and an error is an error — never a silent trim of data."),
         ("code", "Bash", """
npm run migrate -- --kind=project --in=project.json --out=project.v2.json
npm run migrate -- --kind=project --in=project.json --check
npm run migrate -- --kind=save --in=save.json --check
cat project.json | npm run migrate -- --kind=project --stdio > project.v2.json
"""),
         ("table", [P("Sytuacja", "Situation"), P("Kod wyjścia", "Exit code"), P("Co widzi użytkownik", "What the user sees")], [
             [P("migracja wykonana", "migration applied"), "0", P("<code>project: 1 -&gt; 2 (1-&gt;2)</code> na stderr, dane na stdout", "<code>project: 1 -&gt; 2 (1-&gt;2)</code> on stderr, data on stdout")],
             [P("plik już w bieżącej wersji", "already current"), "0", P("<code>project: version 2, migration not required</code>", "<code>project: version 2, migration not required</code>")],
             [P("brak ścieżki migracji lub wersja z przyszłości", "no migration path or a future version"), "1", P("kod błędu i numer wersji, plik nietknięty", "an error code and the version number, the file untouched")],
             [P("uszkodzony JSON lub zły kształt", "broken JSON or wrong shape"), "1", "<code>invalid-json</code> / <code>invalid-shape</code>"],
             [P("zasób bez licencji przy <code>--require-licenses</code>", "an asset without a licence under <code>--require-licenses</code>"), "1", "<code>missing-license @ assets.player</code>"],
         ]),
         ("note", "warn", "Narzędzie nie zgaduje", "The tool does not guess",
          "Brak ścieżki migracji to błąd, nie próba „odczytu na siłę”. Zapis z nowszego builda jest odrzucany, bo nadpisanie postępu gracza jest gorsze niż komunikat. Suma kontrolna wykrywa uszkodzenie, ale nie jest podpisem — przed celową edycją chroni tylko serwer.",
          "A missing migration path is an error, not a best-effort read. A save from a newer build is rejected, because overwriting a player's progress is worse than a message. The checksum detects corruption but is not a signature — only a server protects against deliberate edits."),
         ("h2", "Kolejność wydania", "Release order"),
         ("ol", [
             P("Uzupełnij <code>CHANGELOG.md</code> w sekcji <code>[Unreleased]</code> — bez tego <code>release:check</code> nie przepuści.", "Fill in <code>CHANGELOG.md</code> under <code>[Unreleased]</code> — <code>release:check</code> blocks without it."),
             P("Podnieś wersję: <code>node scripts/versions.mjs --bump=minor</code>. Komenda sama sprawdza spójność po zapisie.", "Bump the version: <code>node scripts/versions.mjs --bump=minor</code>. The command verifies consistency after writing."),
             P("Uruchom <code>npm run verify</code>: typy, lint, testy, wersje, benchmarki, build, budżet rozmiaru, licencje, kontrola wydania i e2e.", "Run <code>npm run verify</code>: types, lint, tests, versions, benchmarks, build, size budget, licences, release check and e2e."),
             P("Zbuduj artefakty: <code>npm run release:artifacts</code>. Powstaje katalog z wynikami, sumami i wersją roboczą notatek.", "Build the artifacts: <code>npm run release:artifacts</code>. A directory appears with results, checksums and a draft of the notes."),
             P("Uzupełnij w <code>release-notes.md</code> sekcje <code>Highlights</code>, <code>Breaking changes</code> i <code>Known limitations</code> — reszta jest już wygenerowana.", "Complete the <code>Highlights</code>, <code>Breaking changes</code> and <code>Known limitations</code> sections in <code>release-notes.md</code> — the rest is already generated."),
             P("Opublikuj: <code>npm run export:game</code> (gra + konfiguracje hostingów) i dołącz katalog artefaktów do wydania.", "Publish: <code>npm run export:game</code> (game plus hosting configs) and attach the artifacts directory to the release."),
         ]),
     ], "wydanie release semver wersjonowanie kanal stabilny eksperymentalny changelog release notes artefakty migracja deprecacja lockstep"),

page("debt", "more", P("Dług techniczny i decyzje architektoniczne", "Technical debt and architecture decisions"),
     P("Rejestr świadomie odłożonych decyzji z warunkami spłaty oraz rekordy decyzji architektonicznych: co wybrano, jakie to ma koszty i jakie alternatywy odrzucono. Bez tego dokumentacja kłamie — opisuje stan idealny, a nie rzeczywisty.",
       "A register of deliberately deferred work with repayment conditions, plus architecture decision records: what was chosen, what it costs and which alternatives were rejected. Without it the documentation lies — it describes the ideal state instead of the real one."),
     [
         ("h2", "Dług techniczny", "Technical debt"),
         ("p", "Każda pozycja ma identyfikator, wagę, realny wpływ na użytkownika i zdanie „spłata, gdy…”, które da się sprawdzić. Dług bez warunku spłaty nie jest długiem, tylko życzeniem — dlatego takich pozycji w rejestrze nie ma.",
          "Every entry has an identifier, a weight, a real user impact and a \"repay when…\" sentence that can be verified. Debt without a repayment condition is a wish, not debt — which is why the register holds none."),
         ("table", [P("Waga", "Weight"), P("Znaczenie", "Meaning"), P("Efekt w procesie", "Process effect")], [
             [P("<b>S1</b>", "<b>S1</b>"), P("blokuje wydanie lub dotyczy bezpieczeństwa", "blocks a release or affects security"), P("<code>release:check</code> kończy się błędem, dopóki pozycja jest otwarta", "<code>release:check</code> fails while the entry stays open")],
             [P("<b>S2</b>", "<b>S2</b>"), P("kosztuje użytkownika pracę albo pieniądze", "costs the user work or money"), P("priorytet w planowaniu, widoczne w „znanych ograniczeniach”", "planning priority, visible in \"known limitations\"")],
             [P("<b>S3</b>", "<b>S3</b>"), P("spowalnia rozwój", "slows development"), P("spłacane przy okazji większych zmian w obszarze", "repaid alongside larger changes in the area")],
             [P("<b>S4</b>", "<b>S4</b>"), P("porządki i kosmetyka", "housekeeping and cosmetics"), P("kolejka „przy okazji”", "when-convenient queue")],
         ]),
         ("p", "Rejestr ma dwie tabele: <b>Otwarte</b> i <b>Spłacone</b>. Spłata przenosi wiersz z datą, nie kasuje go — historia jest częścią dokumentacji, a „już naprawione” bez daty nie mówi nic o tym, jak długo problem żył.",
          "The register has two tables: <b>Open</b> and <b>Repaid</b>. Repaying moves the row with a date instead of deleting it — history is part of the documentation, and \"already fixed\" without a date says nothing about how long the problem lived."),
         ("table", [P("Obszar", "Area"), P("Przykład otwartej pozycji", "Example open entry"), P("Waga", "Weight")], [
             [P("monorepo", "monorepo"), P("pakiety nie są budowane do <code>dist</code>, więc nie da się ich opublikować w rejestrze", "packages are not built to <code>dist</code>, so they cannot be published to a registry"), "S2"],
             [P("build", "build"), P("jeden chunk ~1,62 MB z całym Phaserem", "one chunk ~1.62 MB including all of Phaser"), "S2"],
             [P("fizyka", "physics"), P("tylko Arcade: brak obrotów i kontaktów realistycznych", "Arcade only: no rotation or realistic contacts"), "S2"],
             [P("dostępność", "accessibility"), P("treść canvasu poza drzewem dostępności", "canvas content outside the accessibility tree"), "S2"],
             [P("CI", "CI"), P("WebKit nie działa w automacie tego środowiska", "WebKit does not run automatically in this environment"), "S3"],
             [P("testy", "tests"), P("brak progów pokrycia kodu", "no code-coverage thresholds"), "S3"],
         ]),
         ("p", "Pełna lista, z warunkami spłaty, jest w <code>docs/TECH_DEBT.md</code>. Rejestr jest sprawdzany maszynowo: <code>release:check</code> czyta tabelę „Otwarte” i blokuje wydanie przy otwartej pozycji S1.",
          "The full list, with repayment conditions, lives in <code>docs/TECH_DEBT.md</code>. The register is machine-checked: <code>release:check</code> reads the Open table and blocks a release while an S1 entry is open."),
         ("h2", "Decyzje architektoniczne", "Architecture decisions"),
         ("p", "Każda decyzja, której cofnięcie kosztowałoby więcej niż tydzień pracy, ma rekord w formacie <b>Kontekst → Decyzja → Konsekwencje → Odrzucone alternatywy</b>. Zmiana decyzji to nowy rekord ze statusem „zastępuje 000N”, nie edycja historii.",
          "Every decision whose reversal would cost more than a week of work gets a record in the format <b>Context → Decision → Consequences → Rejected alternatives</b>. Changing a decision means a new record marked \"supersedes 000N\", not editing history."),
         ("table", [P("Nr", "No."), P("Decyzja", "Decision"), P("Koszt, który przyjęliśmy", "The cost we accepted")], [
             ["0001", P("<a href='#ports'>Izolacja adaptera przez porty</a>", "<a href='#ports'>Adapter isolation through ports</a>"), P("każda funkcja wymaga wpisu w porcie i w adapterze", "every feature needs an entry in the port and in the adapter")],
             ["0002", P("Wersjonowany format JSON z łańcuchem migracji", "Versioned JSON format with a migration chain"), P("każda zmiana schematu to nowy krok migracji i test", "every schema change is a new migration step and a test")],
             ["0003", P("<a href='#ecs'>Brak ECS</a> — prototyp odrzucony", "<a href='#ecs'>No ECS</a> — prototype rejected"), P("brak korzyści cache-locality dla symulacji cząstek", "no cache-locality benefit for particle simulations")],
             ["0004", P("<a href='#wasm'>WASM opcjonalny</a>, tylko przy mierzalnej przewadze", "<a href='#wasm'>WASM optional</a>, only with a measurable win"), P("dwa języki w repozytorium i dodatkowy stan diagnostyczny", "two languages in the repo and extra diagnostic state")],
             ["0005", P("Brak SPA fallback — stan w query stringu", "No SPA fallback — state in the query string"), P("brak „ładnych” adresów per scena", "no \"pretty\" per-scene URLs")],
             ["0006", P("Jedna wersja dla wszystkich pakietów", "One version for all packages"), P("patch w jednym pakiecie podnosi wersję całości", "a patch in one package bumps everything")],
             ["0007", P("Bramy jakości jako blokujące komendy", "Quality gates as blocking commands"), P("pełna brama trwa kilka minut i wymaga przeglądarek", "the full gate takes minutes and needs browsers")],
             ["0008", P("<a href='#troubleshooting'>Playground jako jeden plik</a>", "<a href='#troubleshooting'>Playground as a single file</a>"), P("brak cache między wersjami i brak chunków", "no cross-version cache and no chunks")],
             ["0009", P("Dokumentacja jako generowana jedna strona", "Docs as one generated page"), P("PL i EN pisane równolegle w jednym źródle", "PL and EN written side by side in one source")],
         ]),
         ("code", "Bash", """
ls docs/adr                     # 0001…0009 + README z indeksem
npm run release:check           # zgłasza rekord bez wpisu w indeksie
"""),
         ("note", "info", "Po co rekord, jeśli decyzja jest w kodzie", "Why a record if the decision is in the code",
          "Kod pokazuje <i>co</i> jest zrobione, ale nie <i>dlaczego</i> ani <i>co odrzucono</i>. Bez tego drugiego ktoś po roku „poprawia” porty, bo „warstwa delegacji to narzut” — i odkrywa koszt dopiero po przepisaniu testów. Rekord jest tańszy niż powtórka analizy.",
          "Code shows <i>what</i> was done, not <i>why</i> or <i>what was rejected</i>. Without the latter, someone a year later \"fixes\" the ports because \"the delegation layer is overhead\" — and discovers the cost only after rewriting the tests. A record is cheaper than repeating the analysis."),
         ("h2", "Jak zgłosić nowy dług", "How to record new debt"),
         ("ol", [
             P("Dopisz wiersz w <code>docs/TECH_DEBT.md</code> w tym samym commicie, w którym dług powstaje — nie „przy okazji refaktoru”.", "Add a row to <code>docs/TECH_DEBT.md</code> in the same commit that creates the debt — not \"during some refactor\"."),
             P("Nadaj numer kolejny (D-0NN), wagę i zdanie „spłata, gdy…” z liczbą, pomiarem albo zdarzeniem produktowym.", "Assign the next number (D-0NN), a weight and a \"repay when…\" sentence with a number, a measurement or a product event."),
             P("Jeśli pozycja dotyczy decyzji architektonicznej, dodaj rekord ADR i wpis w indeksie — inaczej <code>release:check</code> zgłosi brak linku.", "If the entry concerns an architectural decision, add an ADR record and an index entry — otherwise <code>release:check</code> reports a missing link."),
         ]),
     ], "dlug techniczny tech debt adr decyzje architektoniczne rejestr splata ograniczenia jakosc"),

def build():
    sections = []
    for page in pages:
        pid = page["id"]
        title_pl, title_en = page["title"]
        lead_pl, lead_en = page["lead"]
        body = render_blocks(page["blocks"])
        raw_text = re.sub(r"<[^>]+>", " ", title_pl + lead_pl + body)
        minutes = max(1, round(word_count(raw_text) / 180))
        crumb_pl = dict((g[0], g[1]) for g in GROUPS)[page["group"]]
        crumb_en = dict((g[0], g[2]) for g in GROUPS)[page["group"]]
        sections.append(f"""
<section data-page="{pid}" class="hide">
  <div class="crumbs"><a href="#{pages[0]['id']}">Docs</a><span>/</span><b class="crumb-group">{crumb_pl}</b><span>/</span><span data-pl>{title_pl}</span><span data-en>{title_en}</span></div>
  <div class="page-head">
    <h1><span data-pl>{title_pl}</span><span data-en>{title_en}</span></h1>
    <p class="lead"><span data-pl>{lead_pl}</span><span data-en>{lead_en}</span></p>
    <div class="page-meta"><span data-pl>{minutes} min czytania</span><span data-en>{minutes} min read</span><span>Node 20+</span><span>Phaser 3.80.1</span><span>MVP 0.1</span></div>
  </div>
  {body}
  <div class="pager"></div>
  <div class="foot"><span>Browser2DEngine 0.1.0 · MIT</span><span><a href="#{pages[0]['id']}">↑ <span data-pl>Na górę</span><span data-en>Back to top</span></a> · <a href="http://localhost:5173" target="_blank">Playground</a></span></div>
</section>""")

    groups_json = json.dumps({g[0]: [g[0], g[1], g[2]] for g in GROUPS}, ensure_ascii=False)
    docs_json = json.dumps([
        {"id": p["id"], "group": p["group"], "title": {"pl": p["title"][0], "en": p["title"][1]},
         "keywords": (p["keywords"] + " " + p["title"][0] + " " + p["title"][1]).strip(),
         "text": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", p["lead"][0] + " " + p["lead"][1] + " " + render_blocks(p["blocks"]))).strip()[:4000]}
        for p in pages
    ], ensure_ascii=False)

    html_out = f"""<!doctype html>
<html lang="pl" data-theme="light">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dokumentacja — Browser2DEngine</title>
<meta name="description" content="Browser2DEngine — silnik 2D nad Phaserem 3.80. Konfiguracja, cykl życia, sceny, obiekty, input, fizyka, kamera, zasoby, JSON, zdarzenia, WASM."/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' rx='7' fill='%230f1115'/%3E%3Cpath d='M8 12.5l8-4 8 4v7l-8 4-8-4z' fill='none' stroke='%23fff' stroke-width='1.5'/%3E%3C/svg%3E"/>
<style>{CSS}</style>
</head>
<body data-lang="pl">
<header class="head">
  <a class="brand" href="#{pages[0]['id']}">
    <svg width="24" height="24" viewBox="0 0 32 32"><rect class="logo-bg" width="32" height="32" rx="7"/><path class="logo-fg" d="M8 12.5l8-4 8 4v7l-8 4-8-4z" fill="none" stroke-width="1.6" stroke-linejoin="round"/><path class="logo-fg" d="M16 16.5v7M8 12.5l8 4 8-4" fill="none" stroke-width="1.1"/></svg>
    <b>Browser2DEngine</b><span>v0.1</span>
  </a>
  <nav class="head-nav">
    <a href="#quickstart" data-pl>Start</a><a href="#quickstart" data-en>Start</a>
    <a href="#config" data-pl>Podstawy</a><a href="#config" data-en>Essentials</a>
    <a href="#api-engine">API</a>
    <a href="#example" data-pl>Przykład</a><a href="#example" data-en>Example</a>
  </nav>
  <div class="tools">
    <div class="search">
      <span class="ico"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></span>
      <input id="q" type="search" autocomplete="off" placeholder="Szukaj w dokumentacji"/>
      <span class="key">/</span>
      <div class="hits" id="hits"></div>
    </div>
    <div class="seg">
      <button type="button" data-set-lang="pl">PL</button>
      <button type="button" data-set-lang="en">EN</button>
    </div>
    <button type="button" class="icon-btn" id="theme" title="Motyw / Theme">◐</button>
    <button type="button" class="icon-btn menu-btn" id="menu" title="Menu">☰</button>
  </div>
</header>
<div class="shell">
  <aside class="side" id="side"></aside>
  <div class="col">
    <main class="main" id="content">
{''.join(sections)}
    </main>
    <nav class="toc" id="toc"></nav>
  </div>
</div>
<script>window.__GROUPS__={groups_json};window.__DOCS__={docs_json};</script>
<script>{JS}</script>
</body>
</html>
"""
    OUT.write_text(html_out, encoding="utf-8")
    total_words = sum(word_count(p["lead"][0] + render_blocks(p["blocks"])) for p in pages)
    print(f"pages={len(pages)} words_pl={total_words} size={len(html_out)//1024}kB -> {OUT}")

if __name__ == "__main__":
    build()
