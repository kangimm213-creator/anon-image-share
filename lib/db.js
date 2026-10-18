import { Redis } from '@upstash/redis';

let client;

// Vercel 마켓플레이스의 Upstash Redis를 연결하면 아래 환경변수가 자동으로 들어옵니다.
export function db() {
  if (globalThis.__testRedis) return globalThis.__testRedis; // 로컬 테스트용
  if (!client) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('DB가 연결되지 않았어요 (Redis 환경변수 없음).');
    client = new Redis({ url, token, automaticDeserialization: false });
  }
  return client;
}

export const parse = (v) => {
  if (v == null) return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
};

// 앞뒤 공백 제거 + 길이 제한 + 제어문자 제거
export const clean = (s, max) =>
  String(s ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);

export const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export const json = (data, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } });

export async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

export const LIMITS = { nick: 20, caption: 500, comment: 300, images: 3 };
