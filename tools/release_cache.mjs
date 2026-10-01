import path from 'node:path';
// Canonicalize every game-module URL, including older ?v=12 / ?v=12-art2
// spellings. The pinned Three.js vendor graph keeps its existing single URL.
export function releaseModule(source,file,build){
  return source.replace(/(['"])(\.[^'"?]*\.js)(?:\?[^'"]*)?\1/g,(match,quote,specifier)=>{
    const resolved=path.posix.normalize(path.posix.join('src',path.posix.dirname(file),specifier));
    return resolved.startsWith('src/')?quote+specifier+'?build='+encodeURIComponent(build)+quote:match;
  });
}
export function releaseHTML(source,build){
  return source.replace(/((?:src|href)=)(['"])(\.\/(?:src\/[^'"?]+|style\.css|manifest\.webmanifest))(?:\?[^'"]*)?\2/g,
    (_,attribute,quote,url)=>attribute+quote+url+'?build='+encodeURIComponent(build)+quote);
}
