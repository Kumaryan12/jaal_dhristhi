export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    status: 'ok',
    service: 'jaaldrishti-hosted-demo',
    version: '1.0.0',
    dataset_ready: true,
  });
}
