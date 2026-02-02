import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing auth router
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.png',
      }),
    }),
  })),
}));

vi.mock('cross-fetch', () => ({
  default: vi.fn(),
}));

vi.mock('../../db', () => ({
  query: vi.fn(),
}));

// Set required env vars
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.KAKAO_REST_KEY = 'test-kakao-rest-key';

import express from 'express';
import request from 'supertest';
import { authRouter } from '../auth';
import { query } from '../../db';
import fetch from 'cross-fetch';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockFetch = fetch as ReturnType<typeof vi.fn>;

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /auth/oauth', () => {
    it('should create user and return tokens for valid Google login', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        provider: 'google',
        provider_user_id: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUser] }) // upsertUser
        .mockResolvedValueOnce({ rows: [] }); // createSession

      const res = await request(app)
        .post('/auth/oauth')
        .send({ provider: 'google', idToken: 'valid-google-id-token-12345' });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: 'user-uuid-123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'google',
      });
      expect(res.body.tokens).toHaveProperty('accessToken');
      expect(res.body.tokens).toHaveProperty('refreshToken');
    });

    it('should create user and return tokens for valid Kakao login', async () => {
      const mockUser = {
        id: 'user-uuid-456',
        provider: 'kakao',
        provider_user_id: 'kakao-user-789',
        email: 'kakao@example.com',
        name: 'Kakao User',
        avatar_url: 'https://kakao.com/avatar.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'kakao-user-789',
          kakao_account: {
            email: 'kakao@example.com',
            profile: {
              nickname: 'Kakao User',
              profile_image_url: 'https://kakao.com/avatar.png',
            },
          },
        }),
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUser] }) // upsertUser
        .mockResolvedValueOnce({ rows: [] }); // createSession

      const res = await request(app)
        .post('/auth/oauth')
        .send({ provider: 'kakao', accessToken: 'valid-kakao-access-token-12345' });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: 'user-uuid-456',
        email: 'kakao@example.com',
        name: 'Kakao User',
        provider: 'kakao',
      });
      expect(res.body.tokens).toHaveProperty('accessToken');
      expect(res.body.tokens).toHaveProperty('refreshToken');
    });

    it('should return 400 for invalid provider', async () => {
      const res = await request(app)
        .post('/auth/oauth')
        .send({ provider: 'invalid', token: 'some-token' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing token', async () => {
      const res = await request(app)
        .post('/auth/oauth')
        .send({ provider: 'google' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when Kakao API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'invalid_token' }),
      });

      const res = await request(app)
        .post('/auth/oauth')
        .send({ provider: 'kakao', accessToken: 'invalid-kakao-token-12345' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Kakao');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      const mockSession = {
        id: 'session-uuid',
        user_id: 'user-uuid-123',
        refresh_token_hash: 'hashed-token',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        revoked_at: null,
        // user fields
        provider: 'google',
        provider_user_id: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockSession] }) // find session
        .mockResolvedValueOnce({ rows: [] }); // update session

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.tokens).toHaveProperty('accessToken');
      expect(res.body.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for expired session', async () => {
      const mockSession = {
        id: 'session-uuid',
        user_id: 'user-uuid-123',
        refresh_token_hash: 'hashed-token',
        expires_at: new Date(Date.now() - 86400000).toISOString(), // expired
        revoked_at: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockSession] });

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'expired-refresh-token' });

      expect(res.status).toBe(401);
    });

    it('should return 401 for revoked session', async () => {
      const mockSession = {
        id: 'session-uuid',
        user_id: 'user-uuid-123',
        refresh_token_hash: 'hashed-token',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        revoked_at: new Date().toISOString(), // revoked
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockSession] });

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'revoked-refresh-token' });

      expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent session', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'nonexistent-refresh-token' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke session', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/auth/logout')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user for valid access token', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        provider: 'google',
        provider_user_id: 'google-user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
      };

      // Generate a valid token
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign({ sub: 'user-uuid-123' }, 'test-jwt-secret-key-for-testing');

      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: 'user-uuid-123',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should return 401 for missing token', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent user', async () => {
      const jwt = await import('jsonwebtoken');
      const token = jwt.default.sign({ sub: 'nonexistent-user' }, 'test-jwt-secret-key-for-testing');

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

