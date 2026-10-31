import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { createTestHarness } from 'wrangler';

// Construct real workerd Requests at the adapter seam; all responses are synthetic.
const directory = await mkdtemp(join(tmpdir(), 'luna-runtime-'));
const main = join(directory, 'worker.mjs');
const haiku = process.argv[2] === 'haiku';
let server;
try {
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
        import {${haiku ? 'anthropicProvider' : 'lunaProvider'} as makeProvider} from './server/${haiku ? 'anthropic' : 'luna'}';
        import {haikuReviewProvider} from './server/haiku-review';
        import {providerBody} from './server/anthropic';
        import {haikuDeployedBody} from './server/haiku';
        import {readLimits} from './server/config';
        import {catalog,environment} from './server/test-helpers';
        export default {async fetch(request) {
          let calls=0;
          try {
            const redirect=new URL(request.url).pathname==='/redirect';
            const provider=makeProvider('synthetic-key',async(url,init)=>{
              calls++;
              const outbound=new Request(url,init);
              if(outbound.redirect!=='manual')throw new Error('Redirects must not be followed');
              if(redirect)return new Response(null,{status:302,headers:{location:'https://example.com/'}});
              const keys=JSON.parse(String(init.body)).output_config?.format?.schema?.properties;
              const text=JSON.stringify(${haiku} ? Object.fromEntries(Object.keys(keys??{rank1:0,rank2:0,rank3:0,rank4:0,rank5:0,rank6:0,rank7:0,rank8:0}).map((key,i)=>[key,key.startsWith('candidate')?(i===0?2:0):(i===0?0:null)])) : {positions:[0]});
              const payload = ${haiku ? "{stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:50},content:[{type:'text',text}]}" : "{id:'synthetic',model:'gpt-6-luna',status:'completed',service_tier:'priority',usage:{input_tokens:100,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text}]}]}"};
              if (${haiku}) return Response.json(payload);
              const bytes=new TextEncoder().encode('event: response.completed\\ndata: '+JSON.stringify({type:'response.completed',response:payload})+'\\n\\n');
              return new Response(new ReadableStream({start(controller){controller.enqueue(bytes);},cancel(){return new Promise(()=>{});}}),{headers:{'content-type':'text/event-stream'}});
            });
            if (${haiku} && new URL(request.url).pathname==='/review') {
              const body=haikuDeployedBody(providerBody({functionArea:null,goal:'organize records',tools:[],catalogVersion:catalog.catalogVersion},catalog,{...readLimits(environment),LLM_MAX_OUTPUT_TOKENS:512}));
              const result=await haikuReviewProvider(provider)(body,new AbortController().signal);
              return Response.json({ok:true,calls,inputTokens:result.inputTokens,outputTokens:result.outputTokens});
            }
            const result=await provider({data:{catalog:[],functionArea:null,goal:'',tools:[]},catalogIds:['abcdefghijk'],request:{system:'Synthetic runtime test',messages:[],output_config:{format:{schema:{}}}}},new AbortController().signal);
            return Response.json({ok:true,calls,ids:result.value.youtubeIds});
          }catch(error){return Response.json({ok:false,calls,error:error.message});}
        }};
      `,
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: main,
    logLevel: 'silent',
  });
  server = createTestHarness({
    workers: [
      {
        config: {
          name: 'luna-runtime-test',
          main,
          compatibility_date: '2026-10-01',
        },
      },
    ],
  });
  await server.listen();
  assert.deepEqual(await (await server.fetch('/')).json(), {
    ok: true,
    calls: 1,
    ids: ['abcdefghijk'],
  });
  assert.deepEqual(await (await server.fetch('/redirect')).json(), {
    ok: false,
    calls: 1,
    error: 'Provider failed',
  });
  if (haiku)
    assert.deepEqual(await (await server.fetch('/review')).json(), {
      ok: true,
      calls: 2,
      inputTokens: 200,
      outputTokens: 100,
    });
  console.log(
    `Cloudflare runtime accepts ${haiku ? 'Haiku' : 'Luna'} requests and rejects redirects without retries. External requests: 0.`,
  );
} finally {
  await server?.close();
  await rm(directory, { recursive: true, force: true });
}
