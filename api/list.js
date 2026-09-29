import { list } from '@vercel/blob';

export async function GET() {
  const { blobs } = await list({ prefix: 'i/', limit: 1000 });
  const images = blobs
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .map((b) => ({ url: b.url, at: b.uploadedAt }));
  return Response.json(images, { headers: { 'cache-control': 'no-store' } });
}
