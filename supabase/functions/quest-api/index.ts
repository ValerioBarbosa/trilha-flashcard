import { createQuestApiHandler } from './handler.ts';

Deno.serve(createQuestApiHandler({
  getEnv: (name) => Deno.env.get(name),
}));
