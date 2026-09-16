import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  authedUser,
  closeTestPool,
  createTestUser,
  getApp,
  hasTestDatabase,
  migrateTestDatabase,
  resetDatabase,
} from '../helpers.js';
import { pool } from '../../database/pool.js';

const suite = hasTestDatabase ? describe : describe.skip;

suite('Autenticação', () => {
  beforeAll(async () => {
    await migrateTestDatabase();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('cria conta, retorna token e nunca expõe a senha', async () => {
    const response = await request(getApp())
      .post('/api/auth/register')
      .send({ name: 'Ana Souza', email: 'ana@exemplo.com', password: 'senhaSegura123' })
      .expect(201);

    expect(response.body.user.email).toBe('ana@exemplo.com');
    expect(response.body.user.role).toBe('USER');
    expect(response.body.accessToken).toBeTruthy();

    const payload = JSON.stringify(response.body);
    expect(payload).not.toContain('senhaSegura123');
    expect(payload).not.toContain('passwordHash');
    expect(payload).not.toContain('password_hash');
  });

  it('armazena a senha apenas como hash bcrypt', async () => {
    await request(getApp())
      .post('/api/auth/register')
      .send({ name: 'Bruno Lima', email: 'bruno@exemplo.com', password: 'senhaSegura123' })
      .expect(201);

    const row = await pool.query('SELECT password_hash FROM users WHERE email = $1', [
      'bruno@exemplo.com',
    ]);
    const hash = row.rows[0].password_hash as string;
    expect(hash).not.toBe('senhaSegura123');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('define o cookie de refresh como httpOnly', async () => {
    const response = await request(getApp())
      .post('/api/auth/register')
      .send({ name: 'Carla Dias', email: 'carla@exemplo.com', password: 'senhaSegura123' })
      .expect(201);

    const cookies = response.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('kq_refresh='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/api/auth');
  });

  it('recusa e-mail duplicado', async () => {
    await createTestUser({ email: 'duplicado@exemplo.com' });

    const response = await request(getApp())
      .post('/api/auth/register')
      .send({ name: 'Outra Pessoa', email: 'duplicado@exemplo.com', password: 'senhaSegura123' })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('recusa senha fraca', async () => {
    for (const password of ['1234567', 'somenteletras', '12345678']) {
      await request(getApp())
        .post('/api/auth/register')
        .send({ name: 'Teste', email: `teste-${password}@exemplo.com`, password })
        .expect(400);
    }
  });

  it('faz login com credenciais válidas e recusa as inválidas', async () => {
    const { user, password } = await createTestUser({ email: 'login@exemplo.com' });

    await request(getApp())
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200);

    const wrong = await request(getApp())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senhaErrada123' })
      .expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    // An unknown account returns the same code, so the response never reveals
    // whether an e-mail is registered.
    const unknown = await request(getApp())
      .post('/api/auth/login')
      .send({ email: 'naoexiste@exemplo.com', password: 'senhaSegura123' })
      .expect(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('exige autenticação nas rotas protegidas', async () => {
    await request(getApp()).get('/api/goals').expect(401);
    await request(getApp()).get('/api/collectibles').expect(401);
    await request(getApp()).get('/api/trades/available').expect(401);
    await request(getApp()).get('/api/auth/me').expect(401);

    await request(getApp())
      .get('/api/goals')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('renova a sessão e invalida o token de refresh usado', async () => {
    const agent = request.agent(getApp());
    await agent
      .post('/api/auth/register')
      .send({ name: 'Diego Reis', email: 'diego@exemplo.com', password: 'senhaSegura123' })
      .expect(201);

    const first = await agent.post('/api/auth/refresh').expect(200);
    expect(first.body.accessToken).toBeTruthy();

    // The rotated token is consumed; a second rotation issues a different one.
    const second = await agent.post('/api/auth/refresh').expect(200);
    expect(second.body.accessToken).toBeTruthy();

    const revoked = await pool.query(
      'SELECT count(*)::int AS total FROM refresh_tokens WHERE revoked_at IS NOT NULL',
    );
    expect(revoked.rows[0].total).toBeGreaterThanOrEqual(2);
  });

  it('não desconecta o usuário quando duas abas renovam a sessão ao mesmo tempo', async () => {
    const { user, password } = await createTestUser({ email: 'abas@exemplo.com' });

    const login = await request(getApp())
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200);

    const cookies = login.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((cookie) => cookie.startsWith('kq_refresh='));
    const cookieValue = refreshCookie?.split(';')[0] ?? '';

    // Two tabs restoring the same session present the same token. Rotation
    // alone would make the slower one look like a replay and burn the family.
    const [first, second] = await Promise.all([
      request(getApp()).post('/api/auth/refresh').set('Cookie', cookieValue),
      request(getApp()).post('/api/auth/refresh').set('Cookie', cookieValue),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const burned = await pool.query(
      `SELECT count(*)::int AS total FROM refresh_tokens WHERE revoked_reason = 'REUSE_DETECTED'`,
    );
    expect(burned.rows[0].total).toBe(0);
  });

  it('ainda detecta reuso de um token antigo e revoga a família inteira', async () => {
    const { user, password } = await createTestUser({ email: 'roubo@exemplo.com' });

    const login = await request(getApp())
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200);

    const cookies = login.headers['set-cookie'] as unknown as string[];
    const cookieValue =
      cookies.find((cookie) => cookie.startsWith('kq_refresh='))?.split(';')[0] ?? '';

    await request(getApp()).post('/api/auth/refresh').set('Cookie', cookieValue).expect(200);

    // Push the rotation outside the grace window: this is no longer a race,
    // it is a replayed token.
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() - INTERVAL '10 minutes'
       WHERE revoked_reason = 'ROTATED'`,
    );

    await request(getApp()).post('/api/auth/refresh').set('Cookie', cookieValue).expect(401);

    const burned = await pool.query(
      `SELECT count(*)::int AS total FROM refresh_tokens WHERE revoked_reason = 'REUSE_DETECTED'`,
    );
    expect(burned.rows[0].total).toBeGreaterThan(0);
  });

  it('encerra a sessão no logout', async () => {
    const agent = request.agent(getApp());
    await agent
      .post('/api/auth/register')
      .send({ name: 'Elisa Prado', email: 'elisa@exemplo.com', password: 'senhaSegura123' })
      .expect(201);

    await agent.post('/api/auth/logout').expect(204);
    await agent.post('/api/auth/refresh').expect(401);
  });

  it('permite atualizar perfil e fuso horário', async () => {
    const { token } = await authedUser();

    const response = await request(getApp())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado', timezone: 'America/Manaus', themePreference: 'dark' })
      .expect(200);

    expect(response.body.user.name).toBe('Nome Atualizado');
    expect(response.body.user.timezone).toBe('America/Manaus');
    expect(response.body.user.themePreference).toBe('dark');
  });

  it('recusa fuso horário inválido', async () => {
    const { token } = await authedUser();

    await request(getApp())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Marte/Olympus_Mons' })
      .expect(400);
  });
});
