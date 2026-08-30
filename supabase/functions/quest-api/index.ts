const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProxyRequest = {
  resource?: 'questions';
  params?: Record<string, string | number | boolean | null | undefined>;
};

const allowedQuestionParams = new Set([
  'page',
  'per_page',
  'after_id',
  'banca',
  'orgao',
  'cargo',
  'materia',
  'ano',
  'codigo',
  'tipo',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const baseUrl = Deno.env.get('QUEST_API_BASE_URL')?.replace(/\/$/, '');
  const apiKey = Deno.env.get('QUEST_API_KEY');
  const apiKeyHeader = Deno.env.get('QUEST_API_KEY_HEADER') || 'x-api-key';

  if (!baseUrl || !apiKey) {
    return json({ error: 'Integração Quest.API ainda não configurada no servidor.' }, 503);
  }

  let payload: ProxyRequest;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Corpo JSON inválido.' }, 400);
  }

  if (payload.resource !== 'questions') {
    return json({ error: 'Recurso não suportado.' }, 400);
  }

  const url = new URL(`${baseUrl}/questoes`);
  for (const [key, value] of Object.entries(payload.params ?? {})) {
    if (!allowedQuestionParams.has(key) || value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        [apiKeyHeader]: apiKey,
      },
    });

    const contentType = upstream.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await upstream.json()
      : { error: await upstream.text() };

    return json(body, upstream.status);
  } catch (cause) {
    return json({
      error: 'Falha ao consultar Quest.API.',
      detail: cause instanceof Error ? cause.message : String(cause),
    }, 502);
  }
});
