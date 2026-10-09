import { describe, expect, it } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { savePracticeAttempt, loadQuestionAccuracy } from '../modern/src/learning/practice-repository';
import { PRACTICE_BANK } from '../modern/src/learning/practice-bank';

class MemoryClient {
  rows: Record<string, any[]> = { questions:[], question_attempts:[] };
  writeError: {message:string;code:string} | null = null;
  from(table:string) {
    const predicates: Array<(row:any) => boolean> = [];
    let payload:any; let conflict:string | undefined; let start=0; let end=Infinity;
    const query = {
      select: () => query,
      eq: (field:string,value:any) => { predicates.push((row) => row[field] === value); return query; },
      is: (field:string,value:any) => { predicates.push((row) => (row[field] ?? null) === value); return query; },
      not: (field:string,_op:string,value:any) => { predicates.push((row) => row[field] !== value); return query; },
      order: () => query,
      range: (a:number,b:number) => { start=a; end=b; return query; },
      insert: (row:any) => { payload=row; return query; },
      upsert: (row:any,options:any) => { payload=row; conflict=options.onConflict; return query; },
      maybeSingle: async () => ({ data:this.rows[table].find((row) => predicates.every((predicate) => predicate(row))) || null, error:null }),
      then: (resolve:any) => {
        if (payload && this.writeError) return Promise.resolve({ data:null,error:this.writeError }).then(resolve);
        if (payload) {
          if (!conflict || !this.rows[table].some((row) => row[conflict!] === payload[conflict!])) this.rows[table].push(payload);
          return Promise.resolve({ data:null,error:null }).then(resolve);
        }
        return Promise.resolve({ data:this.rows[table].filter((row) => predicates.every((predicate) => predicate(row))).slice(start,end+1),error:null }).then(resolve);
      },
    };
    return query;
  }
}
const user = { id:'u1' } as User;
const question = PRACTICE_BANK[0];
describe('registro das questões autorais', () => {
  it('salva gabarito, contexto do perfil e mantém idempotência na repetição de envio', async () => {
    const db = new MemoryClient();
    const input = { answer:question.answer, responseMs:2300, attemptId:'attempt-1',subjectId:'subject-1' };
    await savePracticeAttempt(db as unknown as SupabaseClient,user,'profile-1',question,input);
    await savePracticeAttempt(db as unknown as SupabaseClient,user,'profile-1',question,input);
    expect(db.rows.questions).toHaveLength(1);
    expect(db.rows.question_attempts).toHaveLength(1);
    expect(db.rows.questions[0]).toMatchObject({ user_id:'u1',profile_id:'profile-1',subject_id:'subject-1',source_provider:'trilha-autoral-20261009',correct_answer:'B' });
    expect(db.rows.questions[0].id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(db.rows.question_attempts[0]).toMatchObject({ answer:'B',is_correct:true,response_ms:2300 });
  });
  it('não mistura tentativas entre usuários ou perfis e admite repetições reais', async () => {
    const db = new MemoryClient();
    await savePracticeAttempt(db as unknown as SupabaseClient,user,'profile-1',question,{ answer:0,responseMs:100,attemptId:'a' });
    await savePracticeAttempt(db as unknown as SupabaseClient,user,'profile-1',question,{ answer:question.answer,responseMs:100,attemptId:'b' });
    await savePracticeAttempt(db as unknown as SupabaseClient,user,'profile-2',question,{ answer:question.answer,responseMs:100,attemptId:'c' });
    expect(db.rows.questions).toHaveLength(2);
    expect(await loadQuestionAccuracy(db as unknown as SupabaseClient,user,'profile-1')).toEqual({total:2,correct:1,accuracy:50});
    expect(await loadQuestionAccuracy(db as unknown as SupabaseClient,{id:'u2'} as User,'profile-1')).toEqual({total:0,correct:0,accuracy:null});
  });
  it('não oculta falhas de gravação nem aceita alternativa fora do intervalo', async () => {
    const db = new MemoryClient();
    await expect(savePracticeAttempt(db as unknown as SupabaseClient,user,'p',question,{answer:9,responseMs:1,attemptId:'a'})).rejects.toThrow('Alternativa inválida');
    db.writeError = {code:'42501',message:'RLS denied'};
    await expect(savePracticeAttempt(db as unknown as SupabaseClient,user,'p',question,{answer:0,responseMs:1,attemptId:'a'})).rejects.toMatchObject({code:'42501'});
    expect(db.rows.question_attempts).toHaveLength(0);
  });
});
