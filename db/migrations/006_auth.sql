-- 사용자 및 세션 테이블

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'kakao')),
  provider_user_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_provider_uid_idx ON users(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  client_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();





