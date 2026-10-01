import {BUILD} from './balance.js';
export function assetURL(relative,base=import.meta.url){
  if(/^(?:data|blob):/.test(relative))return relative;
  const url=new URL(relative,base);url.search='';url.searchParams.set('build',BUILD);return url.href;
}
