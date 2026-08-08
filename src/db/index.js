const path = require('path');
const SQLiteAdapter = require('./sqlite-adapter');
const PGAdapter = require('./pg-adapter');

let dbInstance = null;

async function getDb() {
  if (dbInstance) return dbInstance;

  const dbUrl = process.env.DATABASE_URL || 'sqlite:./data/app.db';

  if (dbUrl.startsWith('sqlite:')) {
    const dbFilePath = dbUrl.replace('sqlite:', '');
    const absolutePath = path.isAbsolute(dbFilePath) ? dbFilePath : path.join(process.cwd(), dbFilePath);
    dbInstance = new SQLiteAdapter(absolutePath);
  } else if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    dbInstance = new PGAdapter(dbUrl);
  } else {
    throw new Error(`Unsupported DATABASE_URL format: ${dbUrl}`);
  }

  await dbInstance.init();
  return dbInstance;
}

module.exports = {
  getDb
};
