const app = require('./app');
const config = require('./config/env');
const { connectDatabase } = require('./config/database');

const bootstrap = async () => {
  await connectDatabase();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`${config.serviceName} escuchando en puerto ${config.port}`);
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('No se pudo iniciar el microservicio de chatbot:', error);
  process.exit(1);
});
