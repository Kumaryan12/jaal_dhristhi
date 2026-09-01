import { handleHostedApi } from '../../../../lib/hosted-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleHostedApi(request);
}

export async function POST(request: Request) {
  return handleHostedApi(request);
}
