export type OfficialLawSource = { name: string; url: string };
const root = 'https://www.planalto.gov.br/ccivil_03/';
const sources: Array<[RegExp, OfficialLawSource]> = [
  [/\b(?:CF(?:\/88)?|ADCT|constitui[cç][aã]o federal)\b/i, {name:'Constituição Federal',url:root+'constituicao/constituicao.htm'}],
  [/\b(?:CLT|consolida[cç][aã]o das leis do trabalho|5\.?452\/1943)\b/i,{name:'CLT',url:root+'decreto-lei/del5452compilado.htm'}],
  [/\b(?:CPC|c[oó]digo de processo civil|13\.?105\/2015)\b/i,{name:'CPC',url:root+'_ato2015-2018/2015/lei/l13105compilada.htm'}],
  [/\b8\.?112(?:\/(?:1990|90))?\b/i,{name:'Lei 8.112/1990',url:root+'leis/l8112compilado.htm'}],
  [/\b14\.?133(?:\/(?:2021|21))?\b/i,{name:'Lei 14.133/2021',url:root+'_ato2019-2022/2021/lei/l14133.htm'}],
  [/\b(?:LGPD|13\.?709(?:\/(?:2018|18))?)\b/i,{name:'LGPD',url:root+'_ato2015-2018/2018/lei/l13709compilado.htm'}],
  [/\b(?:STF|supremo tribunal federal)\b/i,{name:'Portal STF',url:'https://portal.stf.jus.br/'}],
  [/\b(?:TST|tribunal superior do trabalho)\b/i,{name:'Portal TST',url:'https://www.tst.jus.br/'}],
  [/\b(?:TRT[\s-]*4|TRT[\s-]*RS)\b/i,{name:'Portal TRT-4',url:'https://www.trt4.jus.br/'}],
  [/\bCNJ\b/i,{name:'Atos do CNJ',url:'https://atos.cnj.jus.br/'}],
];
export function officialLawSources(reference: string): OfficialLawSource[] {
  return sources.filter(([pattern]) => pattern.test(reference)).map(([,source]) => source);
}
