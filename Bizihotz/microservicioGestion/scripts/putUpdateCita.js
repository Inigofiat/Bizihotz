const http = require('http');

const id = process.argv[2];
if (!id) {
  console.error('Uso: node putUpdateCita.js <id>');
  process.exit(1);
}

const data = JSON.stringify({ estado: 'Atendida', notas: 'Prueba actualizacion automática desde script' });

const options = {
  hostname: 'localhost',
  port: 4002,
  path: `/api/citas/${id}`,
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try { console.log(JSON.parse(body)); } catch (e) { console.log(body); }
  });
});

req.on('error', (e) => {
  console.error('problem with request:', e.message);
});

req.write(data);
req.end();
