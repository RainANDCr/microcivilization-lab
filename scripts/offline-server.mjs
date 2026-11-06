import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {resolvePublicPath} from './public-path.mjs';
const root=new URL('../',import.meta.url);
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const path=resolvePublicPath((req.url??'/').split('?')[0]);
    if(!path){res.writeHead(404);res.end('Not found');return;}
    let body=await readFile(new URL(path,root),'utf8');
    if(path.endsWith('.ts'))body=stripTypeScriptTypes(body);
    const type=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript';
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?'':body);
  }catch(error){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Preview asset unavailable');console.error(error.message);}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(5180,'127.0.0.1',()=>console.log(`MicroCivilization core preview: http://127.0.0.1:5180\nSource: ${fileURLToPath(root)}\nNo dependencies or external network required. Ctrl+C to stop.`));
