/**
 * Creates or promotes the first administrator.
 *
 * No password is ever hardcoded and none is committed. The script reads the
 * credentials from the environment, or prompts for them interactively with the
 * input hidden, hashes the password with bcrypt, and writes only the hash.
 *
 * Promote an existing account:
 *   npm run create:admin -- --email pessoa@exemplo.com
 *
 * Create a new administrator interactively:
 *   npm run create:admin
 *
 * Non-interactive (CI / first deploy):
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run create:admin
 */
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { DEFAULT_TIMEZONE, emailSchema, passwordSchema } from '@kenai/shared';
import { closePool } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/authService.js';
import * as userRepository from '../repositories/userRepository.js';

function parseFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

/** Reads a line from stdin, optionally suppressing the echo for secrets. */
function prompt(question: string, { mask = false } = {}): Promise<string> {
  let muted = false;

  const mutableOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableOutput,
    terminal: true,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (mask) process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
    muted = mask;
  });
}

async function main(): Promise<void> {
  const email =
    parseFlag('email') ?? process.env.ADMIN_EMAIL ?? (await prompt('E-mail do administrador: '));

  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    throw new Error(emailResult.error.issues[0]?.message ?? 'E-mail inválido.');
  }
  const normalisedEmail = emailResult.data;

  const existing = await userRepository.findUserByEmail(normalisedEmail);

  if (existing) {
    if (existing.role === 'ADMIN') {
      logger.info({ email: normalisedEmail }, 'Este usuário já é administrador.');
      return;
    }
    await userRepository.updateUserRole(existing.id, 'ADMIN');
    logger.info({ email: normalisedEmail }, 'Usuário promovido a administrador.');
    return;
  }

  const name = process.env.ADMIN_NAME ?? (await prompt('Nome do administrador: '));
  if (name.trim().length < 2) throw new Error('Informe um nome com pelo menos 2 caracteres.');

  const password =
    process.env.ADMIN_PASSWORD ?? (await prompt('Senha (não será exibida): ', { mask: true }));

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    throw new Error(passwordResult.error.issues[0]?.message ?? 'Senha inválida.');
  }

  await userRepository.createUser({
    name: name.trim(),
    email: normalisedEmail,
    passwordHash: await hashPassword(passwordResult.data),
    timezone: process.env.ADMIN_TIMEZONE ?? DEFAULT_TIMEZONE,
    role: 'ADMIN',
  });

  logger.info({ email: normalisedEmail }, 'Administrador criado com sucesso.');
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    logger.error(
      { err: error instanceof Error ? error.message : error },
      'Falha ao criar administrador',
    );
    await closePool().catch(() => undefined);
    process.exit(1);
  });
