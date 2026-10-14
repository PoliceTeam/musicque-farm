import { createApp } from '@/app';
import { readConfig } from '@/config';
import { openDatabase } from '@/db/database';

const config = readConfig();
const database = await openDatabase(config.databaseUrl);
const { app } = await createApp({ db: database.db, config, logger: true });
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close().then(database.close);
  });
await app.listen({ host: config.host, port: config.port });
