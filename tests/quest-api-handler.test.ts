import { describe, expect, it, vi } from 'vitest';
import { createQuestApiHandler } from '../supabase/functions/quest-api/handler';

const secrets: Record<string, string> = {
  QUEST_API_BASE_URL: 'https://gateway.quest.test/api',
  QUEST_API_KEY: 'server-only-key',
  QUEST_API_KEY_HEADER: 'x-api-key',
};

function jwt(claims: Record<string, unknown>) {
  const encode = (value: unknown) => btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.test-signature`;
}

const authenticatedJwt = jwt({ role: 'authenticated', sub: 'user-1' });
const anonymousJwt = jwt({ role: 'anon' });

function request(body: unknown, authorization = `Bearer ${authenticatedJwt}`) {
  return new Request('https://project.supabase.co/functions/v1/quest-api', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Quest.API Edge Function', () => {
  it('não executa sem autenticação', async () => {
    const handler = createQuestApiHandler({ getEnv: (name) => secrets[name] });
    const response = await handler(request({ resource: 'questions' }, ''));
    expect(response.status).toBe(401);
  });

  it('rejeita o JWT público legado com role anon', async () => {
    const fetchImpl = vi.fn();
    const handler = createQuestApiHandler({ getEnv: (name) => secrets[name], fetchImpl });
    const response = await handler(request({ resource: 'questions' }, `Bearer ${anonymousJwt}`));

    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('mantém a chave no servidor, aplica allowlist e limita per_page', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const handler = createQuestApiHandler({ getEnv: (name) => secrets[name], fetchImpl });

    const response = await handler(request({
      resource: 'questions',
      params: { banca: ' FCC ', per_page: 50, desconhecido: 'ignorar' },
    }));

    expect(response.status).toBe(200);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://gateway.quest.test/api/questoes?banca=FCC&per_page=50');
    expect(init.headers['x-api-key']).toBe('server-only-key');
    expect(JSON.stringify(await response.json())).not.toContain('server-only-key');
  });

  it('rejeita paginação acima do limite antes de chamar o provedor', async () => {
    const fetchImpl = vi.fn();
    const handler = createQuestApiHandler({ getEnv: (name) => secrets[name], fetchImpl });
    const response = await handler(request({ resource: 'questions', params: { per_page: 51 } }));

    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('encaminha somente filtros booleanos válidos para solicitar gabarito', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { items: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const handler = createQuestApiHandler({ getEnv: (name) => secrets[name], fetchImpl });
    const response = await handler(request({
      resource: 'questions',
      params: { tem_gabarito: true, include_gabarito: true, alternative_type: 'CERTO_ERRADO' },
    }));

    expect(response.status).toBe(200);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('tem_gabarito=true');
    expect(String(fetchImpl.mock.calls[0][0])).toContain('include_gabarito=true');
    expect(String(fetchImpl.mock.calls[0][0])).toContain('alternative_type=CERTO_ERRADO');
  });

  it('não devolve texto inesperado do provedor ao navegador', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('internal upstream detail', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    }));
    const handler = createQuestApiHandler({ getEnv: (name) => secrets[name], fetchImpl });
    const response = await handler(request({ resource: 'questions' }));

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('internal upstream detail');
  });
});
