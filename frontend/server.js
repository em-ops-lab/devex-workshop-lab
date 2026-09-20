const http = require('http');

const PORT = 3000;
const HOST = '0.0.0.0';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Workshop Fullstack Experiment</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f4f4f9; }
    .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 500px; }
    button { padding: 8px 16px; cursor: pointer; background: #0070f3; color: white; border: none; border-radius: 4px; }
    pre { background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Fullstack Workshop Sandbox</h2>
    <p>Testing communication across container network.</p>
    <button onclick="fetchData()">Fetch from Backend</button>
    <pre id="output">Click button to query backend...</pre>
  </div>
  <script>
    async function fetchData() {
      const out = document.getElementById('output');
      out.textContent = 'Fetching...';
      try {
        // Points to backend port via the current host domain/IP
        const res = await fetch('http://' + window.location.hostname + ':5000/api/data');
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(PORT, HOST, () => {
  console.log(`Frontend UI server running on http://${HOST}:${PORT}`);
});
