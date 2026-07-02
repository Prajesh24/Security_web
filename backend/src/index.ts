import app from './app';
import { connectDatabase } from './database/mongodb';
import { PORT } from './config';

async function start() {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`🛒 GadgetHub API listening on http://localhost:${PORT}`);
  });
}

start();
