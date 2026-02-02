import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 프로젝트 루트의 .env 파일 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { exhibitionsRouter } from './routes/exhibitions';
import { authRouter } from './routes/auth';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRouter);
app.use('/exhibitions', exhibitionsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on :${port}`);
});


