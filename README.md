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
| [`CLAUDE.md`](CLAUDE.md) | Projekt-Guide + Engine-Invarianten (für Menschen **und** Agenten). Enthält auch den bindenden DOM-Test-Contract. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Engine-Interna: Koordinaten, Kamera, Audio, Asset-Pipeline. |
| [`docs/decisions.md`](docs/decisions.md) | Entscheidungen und ihre Begründungen. |
| [`ISSUES.md`](ISSUES.md) | Roadmap, gegen den Code auditiert (Stand 2026-08-12). |

```bash
npm run check   # schneller, abhängigkeitsfreier Check des DOM-Contracts (data-testids)
npm test        # vollständige Playwright-Suite
```

Für KI-Agenten liegt unter [`.claude/`](.claude/) zusätzlich: eine
Permission-Allowlist, ein `PostToolUse`-Hook, der nach jeder Bearbeitung den
DOM-Contract prüft (`scripts/check-contract.js`), und ein `game-tester`-Subagent,
der die `window.__*`-Test-Hooks kennt.

---

## Deployment

Das Spiel läuft live unter **https://symphony.olereinhold.com**.

Jeder Push auf `main` löst `.github/workflows/deploy.yml` aus. Der Ablauf:

1. Playwright-Suite (19 Specs) — **schlägt sie fehl, wird nichts deployed**
2. `vite build`
3. zwei Guards (siehe unten)
4. `rsync` des `dist/`-Ordners auf den Server

Caddy liefert die Dateien statisch von der Platte aus; es wird bewusst **kein**
Neustart eines Dienstes ausgelöst, weil derselbe Caddy auch andere Seiten
ausliefert.

### Zwei Guards, die den Build brechen dürfen

Die Domain, unter der das Spiel läuft, hat eine Datenschutzerklärung, die
zusagt, dass **keine Besucherdaten an Dritte gehen** und dass deshalb kein
Consent-Banner nötig ist. Zwei CI-Schritte halten das aufrecht, damit es nicht
von Erinnerungsvermögen abhängt:

- **Keine Third-Party-Fonts.** `index.html` lud Press Start 2P ursprünglich von
  `fonts.googleapis.com` — das hätte die IP jedes Besuchers an Google gegeben
  und die Zusage gebrochen. Die Schrift liegt jetzt unter `public/fonts/`
  (OFL, siehe `THIRD-PARTY-NOTICES.md`). Der Guard bricht ab, wenn im Build
  wieder ein Fremd-Font-Host als Ressource auftaucht.
- **Die Schrift muss auch wirklich mitgeliefert werden.** Der Gegen-Check: zu
  beweisen, dass wir nicht bei Google laden, ist wertlos, wenn wir gleichzeitig
  vergessen haben, die eigene Kopie auszuliefern — das fiele still auf Courier
  zurück und käme trotzdem durch.

### Deploy-Key

Der SSH-Key in den Repo-Secrets ist **kein** allgemeiner Server-Key. Er ist auf
dem Server festgenagelt auf:

```
command="/usr/bin/rrsync /opt/klartext/site/symphony",restrict
```

Damit kann er ausschließlich in dieses eine Verzeichnis schreiben: keine Shell,
kein Port-Forwarding, kein Pfad mit `..`. Das ist bewusst so, weil hier mehrere
Leute pushen können und ein Workflow-Secret jedem zur Verfügung steht, der einen
Workflow ändern darf.

> **Wer das von Hand testen will:** auf macOS ist `/usr/bin/rsync` in Wahrheit
> `openrsync`. Es schickt `--dirs` als Long-Option, die `rrsync` ablehnt — ein
> lokaler Test schlägt dadurch irreführend fehl. Mit rsync 3.x
> (`brew install rsync`) funktioniert es; das ist auch, was Runner und Server
> verwenden.

---

### Wettbewerbs-Lösung (historisch)

> Dieser Abschnitt beschreibt den Workshop, in dem das Projekt entstanden ist
> (Hackathon x GameJam, Juni 2026, veranstaltet von Claudius Proißl). Die dort
> genannte Gitea-Instanz und die Subdomain
> `die-klangn-sse.workshop.heyclever.net` waren die Workshop-Umgebung — sie sind
> **nicht** der aktuelle Deployment-Weg. Der steht oben. Der Abschnitt bleibt
> stehen, weil er erklärt, warum das Repo aufgebaut ist, wie es aufgebaut ist:
> `server.js` als Pflicht-Einstiegspunkt und `process.env.PORT` sind
> Workshop-Vorgaben, keine freien Entscheidungen.

Meldet euch zuerst in der Workshop-App an und öffnet euer Profil. Dort findet ihr euren persönlichen Gitea-Benutzernamen und das Initialpasswort.

Gitea-Login: https://gitea.heyclever.net

#### Technische Umgebung

- **Node.js:** v24.16.0
- **npm:** 11.13.0
- **Server-Port:** Die App MUSS auf `process.env.PORT` lauschen (Standard: 3000)
- **Einstiegspunkt:** `server.js`

#### Deployment

*(Damals:)* Jeder Push auf den `main`-Branch löste ein automatisches Deployment
aus, und die App war erreichbar unter
`https://die-klangn-sse.workshop.heyclever.net`. Heute deployt derselbe Push
nach `symphony.olereinhold.com` — siehe **Deployment** oben.

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

Die Grafik stammt aus den freien Pixel-Art-Paketen **SunnyLand** und **SunnyLand
Fort of Illusion** von [ansimuz](https://ansimuz.itch.io/sunny-land-pixel-game-art),
ergänzt durch eigene SVG-Icons für das UI. Die Sounds kommen aus demselben Paket.

(Eine frühere Fassung dieses Abschnitts behauptete, die Grafik sei prozedural im
Canvas gezeichnet. Das stimmt nicht — gezeichnet wird prozedural nur das Layout
der Welt, nicht die Sprites.)

## Lizenz

Der Code steht unter der MIT-Lizenz, siehe [`LICENSE`](LICENSE).

Die Assets unter `public/assets/` gehören nicht dazu: Sie stehen unter den
Bedingungen der jeweiligen Pakete. Herkunft und Lizenzlage sind in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) aufgeschlüsselt — inklusive
des Hinweises, dass die Hintergrundmusik gesondert zu prüfen ist.
