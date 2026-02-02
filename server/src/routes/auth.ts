import { Router, type RequestHandler } from 'express';
import { OAuth2Client } from 'google-auth-library';
import fetch from 'cross-fetch';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { query } from '../db';

type UserRow = {
  id: string;
  provider: 'google' | 'kakao';
  provider_user_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
};

const authRouter = Router();

// 환경 변수를 런타임에 읽는 getter 함수들
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[auth] JWT_SECRET is not configured');
  }
  return secret;
}

function getGoogleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID;
}

function getKakaoRestKey(): string | undefined {
  return process.env.KAKAO_REST_KEY;
}

function getAccessTokenTtl(): string {
  return process.env.ACCESS_TOKEN_TTL || '15m';
}

function getSessionTtlDays(): number {
  return Number(process.env.SESSION_TTL_DAYS || '30');
}

// Google OAuth 클라이언트 (lazy initialization)
let _googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client | null {
  const clientId = getGoogleClientId();
  if (!clientId) return null;
  if (!_googleClient) {
    _googleClient = new OAuth2Client(clientId);
  }
  return _googleClient;
}

const oauthBodySchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('google'),
    idToken: z.string().min(20, '유효하지 않은 Google 토큰입니다.'),
    clientName: z.string().max(120).optional(),
  }),
  z.object({
    provider: z.literal('kakao'),
    accessToken: z.string().min(20, '유효하지 않은 Kakao 토큰입니다.'),
    clientName: z.string().max(120).optional(),
  }),
]);

const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'refreshToken이 필요합니다.'),
});

const logoutSchema = refreshSchema;

type StandardProfile = {
  provider: 'google' | 'kakao';
  providerUserId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
};

function toUserPayload(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    provider: row.provider,
  };
}

function signAccessToken(userId: string) {
  const ttl = getAccessTokenTtl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: ttl } as any);
}

function generateRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function upsertUser(profile: StandardProfile): Promise<UserRow> {
  const id = randomUUID();
  const result = await query<UserRow>(
    `
      INSERT INTO users (id, provider, provider_user_id, email, name, avatar_url, last_login_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = NOW()
      RETURNING *;
    `,
    [id, profile.provider, profile.providerUserId, profile.email ?? null, profile.name ?? null, profile.avatarUrl ?? null]
  );
  return result.rows[0];
}

async function createSession(userId: string, refreshToken: string, clientName?: string) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + getSessionTtlDays() * 24 * 60 * 60 * 1000).toISOString();
  await query(
    `
      INSERT INTO sessions (id, user_id, refresh_token_hash, client_name, expires_at)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [sessionId, userId, hashToken(refreshToken), clientName ?? 'app', expiresAt]
  );
}

async function verifyGoogleToken(idToken: string): Promise<StandardProfile> {
  const googleClient = getGoogleClient();
  const googleClientId = getGoogleClientId();
  if (!googleClient || !googleClientId) {
    throw new Error('Google 로그인 설정이 되어있지 않습니다.');
  }
  const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new Error('유효하지 않은 Google 토큰입니다.');
  }
  return {
    provider: 'google',
    providerUserId: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? payload.given_name ?? null,
    avatarUrl: payload.picture ?? null,
  };
}

async function verifyKakaoToken(accessToken: string): Promise<StandardProfile> {
  const kakaoRestKey = getKakaoRestKey();
  if (!kakaoRestKey) {
    throw new Error('Kakao 로그인 설정이 되어있지 않습니다.');
  }
  const resp = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!resp.ok) {
    throw new Error('Kakao 토큰 확인에 실패했습니다.');
  }
  const data: any = await resp.json();
  if (!data?.id) {
    throw new Error('유효하지 않은 Kakao 응답입니다.');
  }
  const account = data.kakao_account ?? {};
  const profile = account.profile ?? {};
  return {
    provider: 'kakao',
    providerUserId: String(data.id),
    email: account.email ?? null,
    name: profile.nickname ?? null,
    avatarUrl: profile.profile_image_url ?? profile.thumbnail_image_url ?? null,
  };
}

const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '토큰이 필요합니다.' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (!decoded?.sub) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    (req as any).userId = decoded.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: '토큰 검증에 실패했습니다.' });
  }
};

authRouter.post('/oauth', async (req, res) => {
  try {
    const body = oauthBodySchema.parse(req.body);
    const profile =
      body.provider === 'google'
        ? await verifyGoogleToken(body.idToken)
        : await verifyKakaoToken(body.accessToken);

    const user = await upsertUser(profile);
    const refreshToken = generateRefreshToken();
    await createSession(user.id, refreshToken, body.clientName);
    const accessToken = signAccessToken(user.id);

    res.json({
      user: toUserPayload(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: getAccessTokenTtl(),
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? '로그인에 실패했습니다.' });
  }
});

type SessionWithUser = UserRow & {
  session_id: string;
  expires_at: string;
  revoked_at: string | null;
};

authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const hashed = hashToken(refreshToken);
    const result = await query<SessionWithUser>(
      `
        SELECT
          s.id AS session_id,
          s.refresh_token_hash,
          s.expires_at,
          s.revoked_at,
          u.id,
          u.provider,
          u.provider_user_id,
          u.email,
          u.name,
          u.avatar_url
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.refresh_token_hash = $1
      `,
      [hashed]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: '세션이 만료되었거나 존재하지 않습니다.' });
    }
    if (row.revoked_at) {
      return res.status(401).json({ error: '세션이 해지되었습니다.' });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: '세션이 만료되었습니다.' });
    }

    const nextRefreshToken = generateRefreshToken();
    await query(
      `
        UPDATE sessions
        SET refresh_token_hash = $1,
            last_used_at = NOW(),
            expires_at = $2
        WHERE id = $3
      `,
      [hashToken(nextRefreshToken), new Date(Date.now() + getSessionTtlDays() * 24 * 60 * 60 * 1000).toISOString(), row.session_id]
    );
    const accessToken = signAccessToken(row.id);
    res.json({
      user: toUserPayload(row),
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        expiresIn: getAccessTokenTtl(),
      },
    });
  } catch (err: any) {
    const status = err instanceof z.ZodError ? 400 : 400;
    res.status(status).json({ error: err.message ?? '토큰 갱신에 실패했습니다.' });
  }
});

authRouter.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = logoutSchema.parse(req.body);
    const hashed = hashToken(refreshToken);
    await query(
      `
        UPDATE sessions
        SET revoked_at = NOW()
        WHERE refresh_token_hash = $1
      `,
      [hashed]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? '로그아웃에 실패했습니다.' });
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const result = await query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ user: toUserPayload(user) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? '사용자 정보를 불러올 수 없습니다.' });
  }
});

export { authRouter };


