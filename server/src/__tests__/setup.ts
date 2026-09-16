/**
 * Test bootstrap. Runs before any application module is imported, so the env
 * validation in config/env.ts sees the test database rather than the dev one.
 */
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(repoRoot, '.env') });

process.env.NODE_ENV = 'test';

// Integration tests run against TEST_DATABASE_URL and never touch the dev database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.JWT_SECRET ??= 'test-secret-with-at-least-32-characters-long-value';
process.env.LOG_LEVEL = 'silent';

// Uploads go to a throwaway directory so tests never pollute the repository.
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kenai-test-uploads-'));
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = uploadsDir;
