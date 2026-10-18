import { list } from '@vercel/blob';
import { db, parse, clean, newId, json, body, LIMITS } from '../lib/db.js';

const PAGE = 12;
// 우리 Blob 스토어에 올라간 이미지 주소만 허용
const IMG_URL = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/i\/[A-Za-z0-9._-]+$/;

// 게시물 목록 (최신순, 페이지 단위)
export async function GET(request) {
  try {
    const r = db();
    await migrateOldImages(r);

    const offset = Math.max(0, parseInt(new URL(request.url).searchParams.get('offset') || '0', 10) || 0);
    const ids = await r.zrange('posts', offset, offset + PAGE - 1, { rev: true });
    if (!ids.length) return json({ posts: [], next: null });

    const p = r.pipeline();
    p.mget(...ids.map((id) => `post:${id}`));
    p.hmget('likes', ...ids);
    for (const id of ids) {
      p.llen(`comments:${id}`);
      p.lrange(`comments:${id}`, -2, -1);
    }
    const [raw, likes, ...rest] = await p.exec();
    const likeArr = Array.isArray(likes) ? likes : ids.map((id) => likes?.[id]);

    const posts = ids
      .map((id, i) => {
        const post = parse(raw[i]);
        if (!post) return null;
        return {
          ...post,
          likes: Math.max(0, Number(likeArr[i] || 0)),
          commentCount: Number(rest[i * 2] || 0),
          comments: (rest[i * 2 + 1] || []).map(parse).filter(Boolean),
        };
      })
      .filter(Boolean);

    return json({ posts, next: ids.length === PAGE ? offset + PAGE : null });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// 새 게시물 (이미지는 /api/upload 로 먼저 올린 뒤 주소만 전달)
export async function POST(request) {
  try {
    const b = await body(request);
    const images = Array.isArray(b.images) ? b.images : [];
    if (images.length < 1 || images.length > LIMITS.images || !images.every((u) => typeof u === 'string' && IMG_URL.test(u))) {
      return json({ error: '이미지는 1~3장까지 올릴 수 있어요.' }, 400);
    }
    const post = {
      id: newId(),
      nick: clean(b.nick, LIMITS.nick),
      caption: clean(b.caption, LIMITS.caption),
      images,
      at: new Date().toISOString(),
    };
    const r = db();
    const p = r.pipeline();
    p.set(`post:${post.id}`, JSON.stringify(post));
    p.zadd('posts', { score: Date.now(), member: post.id });
    await p.exec();
    return json({ post: { ...post, likes: 0, commentCount: 0, comments: [] } });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// 예전 버전에서 올라온 이미지(Blob에만 있음)를 1장짜리 익명 게시물로 한 번만 옮김
async function migrateOldImages(r) {
  if (await r.get('migrated:v1')) return;
  const ok = await r.set('migrated:v1', 'running', { nx: true, ex: 120 });
  if (!ok) return; // 다른 요청이 처리 중
  let cursor;
  do {
    const res = await list({ prefix: 'i/', limit: 1000, cursor });
    if (res.blobs.length) {
      const p = r.pipeline();
      for (const b of res.blobs) {
        const id = 'old' + b.pathname.replace(/^i\//, '').replace(/\.[a-z]+$/i, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
        const at = new Date(b.uploadedAt);
        p.set(`post:${id}`, JSON.stringify({ id, nick: '', caption: '', images: [b.url], at: at.toISOString() }), { nx: true });
        p.zadd('posts', { nx: true }, { score: at.getTime(), member: id });
      }
      await p.exec();
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  await r.set('migrated:v1', 'done');
}
