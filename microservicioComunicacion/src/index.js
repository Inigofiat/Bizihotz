const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { connectMongo } = require('./config/database');
const registerChatGateway = require('./sockets/chatGateway');
const { setSocketServer } = require('./utils/socketEmitter');

const server = http.createServer(app);
const io = registerChatGateway(server);
setSocketServer(io);

const start = async () => {
  await connectMongo();

  return new Promise((resolve) => {
    server.listen(config.port, () => {
      console.log(`[Comunicacion] Servidor escuchando en el puerto ${config.port}`);
      resolve();
    });
  });
};

if (require.main === module) {
  start().catch((error) => {
    console.error('[Comunicacion] Error al iniciar el servicio', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  start,
  io,
  server,
};
