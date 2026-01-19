const mongoose = require('mongoose');
const config = require('./env');

const connectDatabase = async () => {
  if (!config.mongoUri) {
    throw new Error('MONGO_URI no esta definido');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  return mongoose.connection;
};

module.exports = { connectDatabase };
