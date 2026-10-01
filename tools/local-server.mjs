import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'dist'),port=Number(process.argv[3]||8779);
http.createServer((req,res)=>{const target=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const data=fs.readFileSync(target);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(target)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/`));
