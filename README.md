
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

Fuer grafische Assets koennt ihr die freien Assets von https://kenney.nl/ verwenden.

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
