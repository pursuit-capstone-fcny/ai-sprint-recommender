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
        export default {async fetch(request) {
          let calls=0;
          try {
            const redirect=new URL(request.url).pathname==='/redirect';
            const provider=makeProvider('synthetic-key',async(url,init)=>{
              calls++;
              const outbound=new Request(url,init);
              if(outbound.redirect!=='manual')throw new Error('Redirects must not be followed');
              if(redirect)return new Response(null,{status:302,headers:{location:'https://example.com/'}});
              const text=JSON.stringify(Object.fromEntries(Array.from({length:10},(_,i)=>['rank'+(i+1),i===0?0:null])));
              return Response.json(${haiku ? "{stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:50},content:[{type:'text',text}]}" : "{id:'synthetic',model:'gpt-6-luna',status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{type:'message',content:[{type:'output_text',text}]}]}"});
            });
            const result=await provider({catalogIds:['abcdefghijk'],request:{system:'Synthetic runtime test',messages:[],output_config:{format:{schema:{}}}}},new AbortController().signal);
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
  console.log(
    `Cloudflare runtime accepts ${haiku ? 'Haiku' : 'Luna'} requests and rejects redirects without retries. External requests: 0.`,
  );
} finally {
  await server?.close();
  await rm(directory, { recursive: true, force: true });
}
