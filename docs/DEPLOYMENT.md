# Wdrożenie — notatki operacyjne

Skrót decyzyjny dla buildów i hostingu. Pełny opis z przykładami: `docs/index.html#deploy`.

## Dwie konfiguracje

| Plik | Komenda | Przeznaczenie |
|------|---------|---------------|
| `vite.config.ts` | `npm run dev` | serwer deweloperski, HMR, `/docs` |
| `vite.prod.config.ts` | `npm run build` | build produkcyjny, `base` z `B2D_BASE`, jeden chunk (1623 kB / 373 kB gzip), `dist/release.json` |
| `config/build-meta.ts` | oba | meta `b2d-build`, `b2d-built-at`, `b2d-base`, `b2d-mode` |

`B2D_BASE` steruje ścieżką bazową: `./` (domyślnie, dowolny podkatalog), `/` (korzeń domeny), `/game/` (stały podkatalog).

## Czego pilnujemy

1. **Względne ścieżki** — build nie może zawierać absolutnych `/assets/…`; sprawdza to scenariusz `http-subpath`.
2. **Brak SPA fallback** — nieznane ścieżki zwracają `404.html`, bo gra nie ma routingu po ścieżkach, a przepisanie na `index.html` psuje względne `assets/`.
3. **Stan w query stringu** — `?example=<id>&lang=<pl|en>` przeżywa odświeżenie; sprawdza to `refresh-state`.
4. **Cache** — `index.html` zawsze `no-cache`, pliki `assets/*` z hashem `immutable`.
5. **HTTPS** — wymagane przez audio i część API; scenariusz `https-csp` testuje TLS i kontekst bezpieczny.
6. **CSP** — `script-src 'self' 'sha256-…'` bez `'unsafe-inline'`; `style-src 'unsafe-inline'` jest konieczne (Phaser ustawia style elementów).
7. **MIME** — `.wasm` jako `application/wasm`, `.js` jako `text/javascript`.
8. **Widoczny błąd** — brak modułu kończy się ekranem startowym z diagnostyką, nigdy czarną planszą.

## Komendy

```bash
npm run build            # produkcja do dist/ + release.json
npm run build:site       # B2D_BASE=/ npm run build
npm run build:single     # playground.html (bez sieci)
npm run bundle:report    # tabela rozmiarów + porównanie z bazą
npm run bundle:check     # progi: suma gzip 10%, plik 35%, single 5%
npm run bundle:baseline  # zapis nowej bazy
npm run export:game      # release/game + hosting/ + CHECKSUMS.txt
npm run test:hosting     # 8 scenariuszy w Chromium (HTTP, HTTPS, CSP, cache, 404, błąd startu)
```

## Progi rozmiaru

- suma katalogu dystrybucji: +10% gzip względem `benchmarks/bundle-baseline.json`
- pojedynczy plik > 16 kB: +35%
- `playground.html`: +5%

`bundle:check` kończy się kodem 1 przy przekroczeniu, więc nadaje się do CI bez dodatkowego parsowania.

## Eksport

`npm run export:game` tworzy `release/game` (katalog do wgrania w całości) oraz `release/game/hosting` z gotowymi konfiguracjami:

| Plik | Hosting |
|------|---------|
| `nginx.conf` | nginx (TLS, CSP, cache, `error_page 404`) |
| `htaccess` | Apache 2.4 → zmień nazwę na `.htaccess` |
| `netlify.toml` | Netlify |
| `_headers` | Cloudflare Pages i Netlify |
| `vercel.json` | Vercel (bez `rewrites`) |
| `firebase.json` | Firebase Hosting |
| `README.md` | checklist wdrożenia |

`CHECKSUMS.txt` zawiera SHA-256 każdego pliku — po wgraniu warto porównać kilka pozycji, żeby wykluczyć niekompletny upload.

## Ograniczenia

- Eksport desktopowy (Electron/Tauri) odłożony do stabilizacji wersji webowej.
- Brak routingu po ścieżkach: aplikacja żyje pod jednym adresem katalogu.
- Testy hostingu wymagają przeglądarki Playwright; w CI trzeba doinstalować Chromium.
