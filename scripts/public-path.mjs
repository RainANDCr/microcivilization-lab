export function resolvePublicPath(path){
  if(path==='/')return 'apps/offline/index.html';
  if(/^\/apps\/offline\/(index\.html|style\.css|app\.js|storage\.js|settlement-ui\.js|family-ui\.js)$/.test(path))return path.slice(1);
  if(/^\/packages\/(sim-core|sim-worker|protocol|content|storage)\/src\/[a-z-]+\.ts$/.test(path)&&!path.includes('/storage/src/index.ts'))return path.slice(1);
  if(path==='/packages/mod-sdk/src/index.ts')return path.slice(1);
  return null;
}
