import { put } from '@vercel/blob';

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX = 4.4 * 1024 * 1024;

export async function POST(request) {
  const type = request.headers.get('content-type') || '';
  if (!ALLOWED.includes(type)) {
    return Response.json({ error: '지원하지 않는 형식이에요.' }, { status: 400 });
  }

  const size = Number(request.headers.get('content-length') || 0);
  if (size > MAX) {
    return Response.json({ error: '파일이 너무 커요.' }, { status: 413 });
  }

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[type];

  // 파일명에 원본 이름을 쓰지 않고, 추측 불가능한 랜덤 이름으로 저장
  const blob = await put(`i/${crypto.randomUUID()}.${ext}`, request.body, {
    access: 'public',
    contentType: type,
    addRandomSuffix: true,
  });

  return Response.json({ url: blob.url });
}
