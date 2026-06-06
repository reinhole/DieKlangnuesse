# 🐿️🌰 Die Klangnüsse

Ein Pixel-Platformer im Stil von *Shovel Knight*: Ein Eichhörnchen klettert einen
Baum **nach oben** und hüpft von Ast zu Ast, um Nüsse zu sammeln.

Das Besondere: Gesteuert wird über die **Stimme**. Je lauter du bist, desto
schneller läuft das Eichhörnchen — und wenn du **laut schreist, springt es**. Bist
du leise, schleicht es langsam. Die **Richtung** bestimmst du mit den **Pfeiltasten
Links/Rechts** (oder den Buttons auf dem Bildschirm).

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| 📢 Lautstärke (Mikrofon oder Schieberegler) | Tempo — leise = langsam, laut = schnell |
| 📢 Sehr laut / Schrei (oder **Jump**-Button) | Sprung (nur am Boden) |
| ⬅️ ➡️ Pfeiltasten **oder** ◄/► Buttons | Richtung |
| **↓** / **S** | Ducken (verlangsamt, fällt durch Äste) |
| **Start / Pause / Reset** | Spielsteuerung |
| 🎤 **Enable mic** | Mikrofon aktivieren (optional) |

### Admin Commands
Für schnelles Testen gibt es einen Admin-Modus:
- **Shift+A**: Admin Panel ein-/ausblenden
- **Shift+N**: Nächstes Level (gibt Nüsse für ein Level-Up)
- **Shift+H**: +1 Leben
- **Shift+M**: Super Jump (maximiert die Sprunghöhe)

Ziel: Sammle die Nüsse, klettere immer höher, steige in Level auf. Fällst du unten
aus dem Bild, kostet das ein Leben. Bei 0 Leben ist das Spiel vorbei.

> Das Mikrofon ist optional. Ohne Mikrofon (oder im Test) funktioniert alles über
> den **Lautstärke-Schieberegler** und die Buttons — das Spiel ist ohne Mikrofon
> voll spielbar und vollständig testbar.

## Lokal starten

Das Projekt nutzt **Vite** als leichtgewichtiges Build-Tool für Hot Module Replacement (HMR) im Development und zur Asset-Optimierung im Production-Build.

```bash
npm install

# Startet den Vite Development-Server mit HMR
npm run dev

# Baut die optimierte Version für Production (im Ordner dist/)
npm run build

# Startet den Produktions-Server (liefert dist/ aus, falls vorhanden)
PORT=3000 npm start
```

## Tests

End-to-End-Tests laufen mit Playwright, deterministisch über die DOM-Schnittstelle
und die `window.__*`-Test-Hooks (kein echtes Mikrofon nötig):

```bash
npx playwright install chromium   # nur beim ersten Mal
npm test
```

## Technik (Kurzüberblick)

- Vanilla JavaScript mit modernen ES-Modulen im `js/` Ordner.
- **Vite** bündelt den Code und optimiert Assets.
- `server.js` ist ein minimaler Node.js HTTP-Server, der für das produktive Deployment gedacht ist und automatisch den Build aus `dist/` ausliefert.
- Der Spielzustand steht **als lesbarer Text im DOM** (stabile `data-testid`s), Zufall ist seedbar (`window.__setSeed`) und Timing ist konfigurierbar (`window.__config`).

## Doku & Entwickler-Tools

| Datei | Inhalt |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Projekt-Guide + Engine-Invarianten (für Menschen **und** Agenten). |
| [`../CLAUDE.md`](../CLAUDE.md) | Bindender DOM-Test-Contract (`data-testid`s, Status-Werte, seedbarer Zufall). |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Engine-Interna: Koordinaten, Kamera, Audio, Asset-Pipeline. |

```bash
npm run check   # schneller, abhängigkeitsfreier Check des DOM-Contracts (data-testids)
npm test        # vollständige Playwright-Suite
```

Für KI-Agenten liegt unter [`.claude/`](.claude/) zusätzlich: eine
Permission-Allowlist, ein `PostToolUse`-Hook, der nach jeder Bearbeitung den
DOM-Contract prüft (`scripts/check-contract.js`), und ein `game-tester`-Subagent,
der die `window.__*`-Test-Hooks kennt.

---

### Wettbewerbs-Lösung

Meldet euch zuerst in der Workshop-App an und öffnet euer Profil. Dort findet ihr euren persönlichen Gitea-Benutzernamen und das Initialpasswort.

Gitea-Login: https://gitea.heyclever.net

#### Technische Umgebung

- **Node.js:** v24.16.0
- **npm:** 11.13.0
- **Server-Port:** Die App MUSS auf `process.env.PORT` lauschen (Standard: 3000)
- **Einstiegspunkt:** `server.js`

#### Deployment

Jeder Push auf den `main`-Branch löst ein automatisches Deployment aus.

Eure App ist anschließend erreichbar unter:
**https://die-klangn-sse.workshop.heyclever.net**

#### Einstieg für den Kreativ-Track

1. Mit den Zugangsdaten aus dem Profil bei https://gitea.heyclever.net anmelden.
2. Im Team-Workspace das Repo `solution` öffnen.
3. Diese README komplett lesen und danach mit `npm run dev` lokal entwickeln.
4. Nach jedem Push auf `main` die Team-Subdomain prüfen.

#### Projektstruktur

```
solution/
|-- server.js          <- Einstiegspunkt für Production (PFLICHT)
|-- package.json       <- Dependencies inkl. Vite und Playwright (PFLICHT)
|-- package-lock.json  <- Lock-Datei (PFLICHT, npm install generiert sie)
|-- index.html         <- Spiel-UI (DOM-Contract)
|-- style.css          <- Pixel-Styling
|-- js/                <- ES-Module (main.js, rng.js, input.js, GameState.js, Renderer.js, etc.)
|-- svgs/              <- SVG-Grafiken für UI (Hearts, Icons)
|-- tests/             <- Playwright-Tests
|-- .gitignore         <- node_modules/ ausschließen
```

#### Regeln

1. `server.js` ist der Einstiegspunkt für das Deployment. Dort startet euer HTTP-Server.
2. Der Server MUSS auf dem Port lauschen, der in `process.env.PORT` steht.
3. Alle Dependencies in `package.json` deklarieren.
4. `node_modules/` NICHT committen.
5. `package-lock.json` MUSS committet werden.
6. Kein `Dockerfile` nötig - wird automatisch erzeugt.

#### Quickstart

```bash
git clone https://gitea.heyclever.net/die-klangn-sse/solution.git
cd solution
npm install
npm run dev
```

#### Assets

Für grafische Assets könnt ihr die freien Assets von https://kenney.nl/ verwenden. Diese Lösung nutzt stattdessen prozedural gezeichnete Pixel-Grafik im Canvas, ergänzt durch SVG-Icons für das UI.
