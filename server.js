const http = require('http');
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Euer Server laeuft!</h1><p>Jetzt koennt ihr loslegen.</p>');
});

server.listen(PORT, HOST, () => {
  console.log(`Server laeuft auf http://${HOST}:${PORT}`);
});
