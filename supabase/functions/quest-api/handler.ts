export type EnvReader = (name: string) => string | undefined;

export type QuestApiHandlerOptions = {
  getEnv: EnvReader;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type ProxyRequest = {
  resource?: 'questions';
  params?: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_PER_PAGE = 50;
const MAX_TEXT_FILTER_LENGTH = 160;

const textParams = new Set(['after_id', 'banca', 'orgao', 'cargo', 'materia', 'codigo', 'tipo']);
const numericParams = new Set(['page', 'per_page', 'ano']);
const allowedQuestionParams = new Set([...textParams, ...numericParams]);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function parsePositiveInteger(value: unknown, field: string, maximum: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${field} deve ser um inteiro entre 1 e ${maximum}.`);
  }
  return parsed;
}

function normalizeParams(params: Record<string, unknown> | undefined): URLSearchParams {
  const normalized = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (!allowedQuestionParams.has(key) || value === null || value === undefined || value === '') continue;

    if (key === 'page') {
      normalized.set(key, String(parsePositiveInteger(value, key, 100_000)));
      continue;
    }

    if (key === 'per_page') {
      normalized.set(key, String(parsePositiveInteger(value, key, MAX_PER_PAGE)));
      continue;
    }

    if (key === 'ano') {
      normalized.set(key, String(parsePositiveInteger(value, key, 2100)));
      continue;
    }

    if (typeof value !== 'string' || value.trim().length > MAX_TEXT_FILTER_LENGTH) {
      throw new Error(`${key} deve ser um texto de até ${MAX_TEXT_FILTER_LENGTH} caracteres.`);
    }
    normalized.set(key, value.trim());
  }

  return normalized;
}

function readConfiguration(getEnv: EnvReader) {
  const rawBaseUrl = getEnv('QUEST_API_BASE_URL')?.trim().replace(/\/$/, '');
  const apiKey = getEnv('QUEST_API_KEY')?.trim();
  const apiKeyHeader = getEnv('QUEST_API_KEY_HEADER')?.trim() || 'x-api-key';

  if (!rawBaseUrl || !apiKey) return null;
  if (!/^[A-Za-z0-9-]+$/.test(apiKeyHeader)) throw new Error('QUEST_API_KEY_HEADER inválido.');

  const baseUrl = new URL(rawBaseUrl);
  if (baseUrl.protocol !== 'https:') throw new Error('QUEST_API_BASE_URL deve usar HTTPS.');

  return { baseUrl, apiKey, apiKeyHeader };
}

export function createQuestApiHandler({
  getEnv,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: QuestApiHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

    // A plataforma valida o JWT antes de executar a função. Esta checagem mantém
    // uma falha segura caso a configuração de implantação seja alterada por engano.
    if (!request.headers.get('authorization')?.startsWith('Bearer ')) {
      return json({ error: 'Autenticação necessária.' }, 401);
    }

    let configuration: ReturnType<typeof readConfiguration>;
    try {
      configuration = readConfiguration(getEnv);
    } catch (cause) {
      console.error('Configuração inválida da Quest.API:', cause instanceof Error ? cause.message : String(cause));
      return json({ error: 'Integração Quest.API indisponível.' }, 503);
    }

    if (!configuration) {
      return json({ error: 'Integração Quest.API ainda não configurada no servidor.' }, 503);
    }

    let payload: ProxyRequest;
    try {
      payload = await request.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid-payload');
    } catch {
      return json({ error: 'Corpo JSON inválido.' }, 400);
    }

    if (payload.resource !== 'questions') {
      return json({ error: 'Recurso não suportado.' }, 400);
    }

    let params: URLSearchParams;
    try {
      params = normalizeParams(payload.params);
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : 'Filtros inválidos.' }, 400);
    }

    const url = new URL('questoes', `${configuration.baseUrl.toString().replace(/\/$/, '')}/`);
    url.search = params.toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstream = await fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          [configuration.apiKeyHeader]: configuration.apiKey,
        },
        signal: controller.signal,
      });

      const contentType = upstream.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.error(`Quest.API respondeu conteúdo inesperado (status ${upstream.status}).`);
        return json({ error: 'Resposta inválida do provedor de questões.' }, 502);
      }

      return json(await upstream.json(), upstream.status);
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === 'AbortError';
      console.error('Falha ao consultar Quest.API:', timedOut ? 'timeout' : cause instanceof Error ? cause.message : String(cause));
      return json({ error: timedOut ? 'Tempo limite ao consultar Quest.API.' : 'Falha ao consultar Quest.API.' }, 502);
    } finally {
      clearTimeout(timeout);
    }
  };
}
