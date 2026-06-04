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
| **Start / Pause / Reset** | Spielsteuerung |
| 🎤 **Enable mic** | Mikrofon aktivieren (optional) |

Ziel: Sammle die Nüsse, klettere immer höher, steige in Level auf. Fällst du unten
aus dem Bild, kostet das ein Leben. Bei 0 Leben ist das Spiel vorbei.

> Das Mikrofon ist optional. Ohne Mikrofon (oder im Test) funktioniert alles über
> den **Lautstärke-Schieberegler** und die Buttons — das Spiel ist ohne Mikrofon
> voll spielbar und vollständig testbar.

## Lokal starten

```bash
npm install
PORT=3000 node server.js     # danach http://localhost:3000 oeffnen
```

## Tests

End-to-End-Tests laufen mit Playwright, deterministisch über die DOM-Schnittstelle
und die `window.__*`-Test-Hooks (kein echtes Mikrofon noetig):

```bash
npx playwright install chromium   # nur beim ersten Mal
npm test
```

## Technik (Kurzueberblick)

Vanilla JavaScript, keine Runtime-Dependencies — `server.js` ist ein kleiner
statischer HTTP-Server. Der Spielzustand steht **als lesbarer Text im DOM**
(stabile `data-testid`s), Zufall ist seedbar (`window.__setSeed`) und Timing ist
konfigurierbar (`window.__config`). Details und Konventionen für die Weiterarbeit
stehen in `CLAUDE.md`.

## Doku & Entwickler-Tools

| Datei | Inhalt |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Projekt-Guide + Engine-Invarianten (für Menschen **und** Agenten). |
| [`../CLAUDE.md`](../CLAUDE.md) | Bindender DOM-Test-Contract (`data-testid`s, Status-Werte, seedbarer Zufall). |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Engine-Interna: Koordinaten, Kamera, Audio, Asset-Pipeline. |
| [`PLAN.md`](PLAN.md) | Ursprünglicher Entwurf (historisch, teilweise überholt). |

```bash
npm run check   # schneller, abhängigkeitsfreier Check des DOM-Contracts (data-testids)
npm test        # vollständige Playwright-Suite
```

Für KI-Agenten liegt unter [`.claude/`](.claude/) zusätzlich: eine
Permission-Allowlist, ein `PostToolUse`-Hook, der nach jeder Bearbeitung den
DOM-Contract prüft (`scripts/check-contract.js`), und ein `game-tester`-Subagent,
der die `window.__*`-Test-Hooks kennt.

---

### Wettbewerbs-Loesung

Meldet euch zuerst in der Workshop-App an und oeffnet euer Profil. Dort findet ihr euren persoenlichen Gitea-Benutzernamen und das Initialpasswort.

Gitea-Login: https://gitea.heyclever.net

#### Technische Umgebung

- **Node.js:** v24.16.0
- **npm:** 11.13.0
- **Server-Port:** Die App MUSS auf `process.env.PORT` lauschen (Standard: 3000)
- **Einstiegspunkt:** `server.js`

#### Deployment

Jeder Push auf den `main`-Branch loest ein automatisches Deployment aus.

Eure App ist anschliessend erreichbar unter:
**https://die-klangn-sse.workshop.heyclever.net**

#### Einstieg fuer den Kreativ-Track

1. Mit den Zugangsdaten aus dem Profil bei https://gitea.heyclever.net anmelden.
2. Im Team-Workspace das Repo `solution` oeffnen.
3. Diese README komplett lesen und danach in `server.js` und den restlichen Dateien arbeiten.
4. Nach jedem Push auf `main` die Team-Subdomain pruefen.

#### Projektstruktur

```
solution/
|-- server.js          <- Einstiegspunkt (PFLICHT)
|-- package.json       <- Dependencies (PFLICHT)
|-- package-lock.json  <- Lock-Datei (PFLICHT, npm install generiert sie)
|-- .gitignore         <- node_modules/ ausschliessen
|-- index.html         <- Spiel-UI (DOM-Contract)
|-- style.css          <- Pixel-Styling
|-- rng.js             <- seedbarer Zufall
|-- input.js           <- Mikrofon- und manuelle Eingabe
|-- game.js            <- Spiel-Engine
|-- tests/             <- Playwright-Tests
```

#### Regeln

1. `server.js` ist der Einstiegspunkt. Dort startet euer HTTP-Server.
2. Der Server MUSS auf dem Port lauschen, der in `process.env.PORT` steht.
3. Alle Dependencies in `package.json` deklarieren.
4. `node_modules/` NICHT committen.
5. `package-lock.json` MUSS committet werden.
6. Kein `Dockerfile` noetig - wird automatisch erzeugt.

#### Quickstart

```bash
git clone https://gitea.heyclever.net/die-klangn-sse/solution.git
cd solution
npm install
PORT=3000 node server.js
```

#### Assets

Fuer grafische Assets koennt ihr die freien Assets von https://kenney.nl/
verwenden. Diese Loesung nutzt stattdessen prozedural gezeichnete Pixel-Grafik
(keine externen Asset-Dateien noetig).

#### Beispiel server.js

```javascript
const http = require('http');
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Hallo Welt!</h1>');
});

server.listen(PORT, HOST, () => {
  console.log(`Server laeuft auf http://${HOST}:${PORT}`);
});
```
