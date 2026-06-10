require('module-alias/register');
require('module-alias').addAliases({
  '@config': `${__dirname}/../src/config`,
  '@domain': `${__dirname}/../src/domain`,
  '@infra': `${__dirname}/../src/infrastructure`,
  '@modules': `${__dirname}/../src/modules`,
  '@middleware': `${__dirname}/../src/middleware`,
  '@utils': `${__dirname}/../src/utils`,
});

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('@infra/database/connection');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'infrastructure', 'database', 'migrations');
const MIGRATIONS_COLLECTION = 'migrations';

const getMigrationFiles = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();
};

const getMigrationsCollection = () => mongoose.connection.collection(MIGRATIONS_COLLECTION);

const getAppliedMigrations = async () => {
  const collection = getMigrationsCollection();
  const rows = await collection.find({}).sort({ appliedAt: 1 }).toArray();
  return rows.map((row) => row.name);
};

const applyMigration = async (name, direction) => {
  const migrationPath = path.join(MIGRATIONS_DIR, name);
  const migration = require(migrationPath);
  if (!migration || typeof migration[direction] !== 'function') {
    throw new Error(`Migration ${name} does not export ${direction}()`);
  }
  await migration[direction]({ mongoose });
  return migration;
};

const markApplied = async (name) => {
  const collection = getMigrationsCollection();
  await collection.insertOne({ name, appliedAt: new Date() });
};

const markReverted = async (name) => {
  const collection = getMigrationsCollection();
  await collection.deleteOne({ name });
};

const runUp = async () => {
  const files = getMigrationFiles();
  const applied = await getAppliedMigrations();
  const pending = files.filter((file) => !applied.includes(file));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const file of pending) {
    console.log(`Applying ${file}...`);
    const migration = await applyMigration(file, 'up');
    const shouldSkipMarkApplied = typeof migration.shouldSkipMarkApplied === 'function'
      ? migration.shouldSkipMarkApplied()
      : false;

    if (shouldSkipMarkApplied) {
      console.log(`Skipped applied marker for ${file}`);
      continue;
    }

    await markApplied(file);
    console.log(`Applied ${file}`);
  }
};

const runDown = async () => {
  const files = getMigrationFiles();
  const applied = await getAppliedMigrations();
  const appliedSet = new Set(applied);
  const appliedFiles = files.filter((file) => appliedSet.has(file));

  if (appliedFiles.length === 0) {
    console.log('No applied migrations to revert.');
    return;
  }

  const last = appliedFiles[appliedFiles.length - 1];
  console.log(`Reverting ${last}...`);
  await applyMigration(last, 'down');
  await markReverted(last);
  console.log(`Reverted ${last}`);
};

const runStatus = async () => {
  const files = getMigrationFiles();
  const applied = await getAppliedMigrations();
  const appliedSet = new Set(applied);

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  files.forEach((file) => {
    const status = appliedSet.has(file) ? 'APPLIED' : 'PENDING';
    console.log(`${status} - ${file}`);
  });
};

const run = async () => {
  const command = process.argv[2] || 'up';

  await connectDB();

  try {
    if (command === 'up') {
      await runUp();
    } else if (command === 'down') {
      await runDown();
    } else if (command === 'status') {
      await runStatus();
    } else {
      throw new Error('Unknown command. Use: up | down | status');
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

run();
