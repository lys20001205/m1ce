import fs from 'node:fs';import crypto from 'node:crypto';
const packs={
 train:{folder:'train-kit',page:'https://kenney.nl/assets/train-kit',zip:'https://kenney.nl/media/pages/assets/train-kit/cf8521d625-1727040883/kenney_train-kit.zip',models:['train-diesel-a','train-carriage-flatbed','train-carriage-container-red','train-connector','railroad-straight']},
 factory:{folder:'factory',page:'https://kenney.nl/assets/factory-kit',zip:'https://kenney.nl/media/pages/assets/factory-kit/edaac9d4f6-1777639602/kenney_factory-kit_3.0.zip',models:['catwalk-straight','catwalk-corner','catwalk-stairs','structure-tall','structure-wall','structure-doorway-wide','door-wide-open','box-large','box-small','crane']},
 industrial:{folder:'industrial',page:'https://kenney.nl/assets/city-kit-industrial',zip:'https://kenney.nl/media/pages/assets/city-kit-industrial/0ec35b139d-1788171848/kenney_city-kit-industrial_2.0.zip',models:['building-h','building-i','shipping-container-a','water-tower']},
 characters:{folder:'characters',page:'https://kenney.nl/assets/blocky-characters',zip:'https://kenney.nl/media/pages/assets/blocky-characters/8369c0cf30-1749547469/kenney_blocky-characters_20.zip',models:['character-g','character-h']}
};
const manifest={author:'Kenney',license:'CC0-1.0',licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',packs:{}};
for(const [name,p] of Object.entries(packs)){
 const base='assets/vendor-downloads/'+p.folder,src=base+'/Models/GLB format',dest='assets/kenney/'+name;fs.mkdirSync(dest+'/Textures',{recursive:true});
 const license=fs.readFileSync(base+'/License.txt','utf8');if(!license.includes('Creative Commons Zero'))throw Error('Unverified license '+name);fs.copyFileSync(base+'/License.txt',dest+'/License.txt');
 const files=[];for(const model of p.models){const input=src+'/'+model+'.glb',data=fs.readFileSync(input),json=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));fs.copyFileSync(input,dest+'/'+model+'.glb');files.push({file:model+'.glb',bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});for(const img of json.images||[]){if(!img.uri||!img.uri.startsWith('Textures/')||img.uri.includes('..'))throw Error('Unexpected texture path');fs.copyFileSync(src+'/'+img.uri,dest+'/'+img.uri);}}
 manifest.packs[name]={source:p.page,download:p.zip,licenseFile:name+'/License.txt',models:files};
}
fs.writeFileSync('assets/kenney/manifest.json',JSON.stringify(manifest,null,2));console.log('Imported selected official CC0 assets; independent palettes retained.');
