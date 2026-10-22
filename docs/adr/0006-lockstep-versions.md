# 0006 — Jedna wersja dla wszystkich pakietów

- **Status:** przyjęta
- **Data:** 2026-10-22
- **Kontekst:** monorepo z czterema pakietami i jednym zestawem testów integracyjnych.

## Kontekst

Wersjonowanie niezależne brzmi elegancko, dopóki użytkownik nie musi zgadnąć, czy `@browser2d/engine@0.4.2` pasuje
do `@browser2d/phaser-adapter@0.2.9`. Pakiety dzielą adaptery i typy, więc niezgodność wersji kończy się błędem
typowania, którego komunikat nie tłumaczy przyczyny.

## Decyzja

Wszystkie pakiety w `packages/*` mają dokładnie tę samą wersję co root, a zależności wewnętrzne są **przypięte do
konkretnej wersji** (`"@browser2d/engine": "0.1.0"`, bez `^`). `ENGINE_VERSION` w `packages/engine/src/version.ts`
musi być równy tej wersji. Pilnuje tego `scripts/versions.mjs --check` (brama CI) i
`tests/unit/WorkspaceVersions.test.ts`.

Podniesienie wersji to jedna komenda: `node scripts/release.mjs --bump=minor` → aktualizuje root, wszystkie
manifesty, zakresy wewnętrzne i stałą `ENGINE_VERSION`.

## Konsekwencje

- Zmiana w jednym pakiecie podnosi wersję wszystkich — to celowe: wydanie jest zestawem, nie zbiorem niezależnych
  kawałków.
- `API_LEVEL` rośnie tylko przy zmianie łamiącej, więc biblioteka trzecia może wykryć niezgodność bez parsowania
  semveru.
- Koszt: brak możliwości „szybkiego patcha tylko w adapterze”; przy 0.x jest to akceptowalne.
- `examples/*` są poza lockstepem — przykład pluginu ma własny cykl życia i własną wersję.

## Odrzucone alternatywy

- **Wersje niezależne + zakresy `^`** — wymaga narzędzia w stylu changesets i dyscypliny, której zespół tej
  wielkości nie utrzyma.
- **Wersja 0.0.0 z `workspace:*`** — nie działa przy publikacji i nie mówi nic o stanie projektu.
