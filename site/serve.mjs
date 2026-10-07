import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import handler from './.quartz/node_modules/serve-handler/src/index.js';
const directory = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 8000);
createServer((request, response) => {
  if (request.url === '/') { response.writeHead(302, { Location: '/duckposting/' }); response.end(); return; }
  if (!request.url?.startsWith('/duckposting/')) { response.writeHead(404); response.end(); return; }
  request.url = request.url.slice('/duckposting'.length);
  return handler(request, response, { public: directory, cleanUrls: true });
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://localhost:${port}/duckposting/`));
