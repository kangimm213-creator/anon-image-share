import { db, json, body } from '../lib/db.js';

// 좋아요 / 좋아요 취소. 누가 눌렀는지는 저장하지 않고 개수만 셉니다.
// (중복 방지는 브라우저 단위로 화면에서 처리)
export async function POST(request) {
  try {
    const { id, on } = await body(request);
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(id)) return json({ error: '잘못된 요청' }, 400);
    const r = db();
    if (!(await r.exists(`post:${id}`))) return json({ error: '게시물이 없어요.' }, 404);
    let likes = await r.hincrby('likes', id, on === false ? -1 : 1);
    if (likes < 0) { await r.hset('likes', { [id]: 0 }); likes = 0; }
    return json({ likes });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
