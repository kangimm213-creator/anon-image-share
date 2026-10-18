import { db, parse, clean, newId, json, body, LIMITS } from '../lib/db.js';

const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9]{1,40}$/.test(id);

// 게시물의 댓글 전체 (최근 300개)
export async function GET(request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!validId(id)) return json({ error: '잘못된 요청' }, 400);
    const items = await db().lrange(`comments:${id}`, -300, -1);
    return json({ comments: items.map(parse).filter(Boolean) });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// 댓글 달기 (닉네임은 선택, 없으면 익명)
export async function POST(request) {
  try {
    const b = await body(request);
    if (!validId(b.id)) return json({ error: '잘못된 요청' }, 400);
    const text = clean(b.text, LIMITS.comment);
    if (!text) return json({ error: '댓글 내용을 입력해 주세요.' }, 400);
    const r = db();
    if (!(await r.exists(`post:${b.id}`))) return json({ error: '게시물이 없어요.' }, 404);
    const c = { id: newId(), nick: clean(b.nick, LIMITS.nick), text, at: new Date().toISOString() };
    const count = await r.rpush(`comments:${b.id}`, JSON.stringify(c));
    return json({ comment: c, count });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
