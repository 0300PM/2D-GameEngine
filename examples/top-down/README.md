# Top-Down Example — gra referencyjna

Mała gra weryfikująca wszystkie funkcje MVP: sceny, input z mapowaniem, sprite'y, kamera, kolizje blokujące, triggery, UI, event bus, format JSON.

Uruchomienie:

```bash
npm run dev
# http://localhost:5173
```

Sceny:

- `menu` — tytuł + przycisk start (Space / klik)
- `game` — świat 2000×1400, ściany, 8 kryształów, kamera follow, fizyka Arcade

Sterowanie: WASD / strzałki, R restart, M menu, pauza na ukrycie karty.

Kod źródłowy w `apps/playground/src/scenes/`. Skopiuj do własnego projektu jako punkt startu.
