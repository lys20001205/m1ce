"use strict";
const cv=document.getElementById("game"),ctx=cv.getContext("2d",{alpha:false});
const E=document.getElementById("event");
const BUILD="v9-route-20260913";
const SESSION=(Date.now().toString(36)+Math.random().toString(36).slice(2,7)).toUpperCase();
const LOGS=[];let drawCount=0,canvasSyncCount=0;
const REMOTE_TOPIC="roundhouse-log-f333c88ded8549f084c70bd5cceb0a7f",REMOTE_URL="https://ntfy.sh/"+REMOTE_TOPIC,REMOTE_ALLOWED=location.hostname==="lys20001205.github.io";
let remoteCursor=0,remoteTimer=0,remoteLast="idle",remoteFailures=0;
const carDefs={engine:{name:"ENGINE",hp:180,desc:"Throttle / brake / core"},cargo:{name:"CARGO",hp:110,desc:"Physical cargo attracts thieves"},battery:{name:"BATTERY",hp:100,desc:"Keeps tunnel lighting stable"},workshop:{name:"WORKSHOP",hp:120,desc:"Faster repairs"},gun:{name:"GUN CAR",hp:110,desc:"Player-operated exterior gun"}};
const S={round:1,money:1000,playerHp:100,engineHp:180,routeT:0,running:false,phase:"roundhouse",roof:false,px:70,facing:1,move:0,attackCd:0,cars:[{type:"engine",hp:180,max:180},{type:"cargo",hp:110,max:110,cargo:3}],enemies:[],effects:[],selected:"battery",hazardHit:false,tunnelHit:false,cameraX:0};
let VIEW={w:1,h:1,dpr:1,scale:1,camX:0,base:300,playerScreenX:0};
function standaloneMode(){return !!((matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true)}
function tw(){return S.cars.length*178}
function carIndexAt(x){return Math.max(0,Math.min(S.cars.length-1,Math.floor((x+12)/178)))}
function phaseAt(t){if(t<.12)return"roundhouse";if(t<.58)return"industrial";if(t<.82)return"tunnel";return"return"}
function phaseLabel(p){return p==="roundhouse"?"ROUNDHOUSE":p==="industrial"?"INDUSTRIAL":p==="tunnel"?"TUNNEL":"RETURN"}
function snap(){return{build:BUILD,session:SESSION,round:S.round,phase:S.phase,routeT:+S.routeT.toFixed(3),px:+S.px.toFixed(1),roof:S.roof,carIndex:carIndexAt(S.px)+1,cars:S.cars.map(c=>c.type),enemyCount:S.enemies.length,money:Math.round(S.money),playerHp:Math.round(S.playerHp),engineHp:Math.round(S.engineHp),standalone:standaloneMode(),canvasCss:[Math.round(VIEW.w),Math.round(VIEW.h)],canvasBacking:[cv.width,cv.height],dpr:VIEW.dpr,drawCount,canvasSyncCount,cameraX:+VIEW.camX.toFixed(1),playerScreenX:+VIEW.playerScreenX.toFixed(1)}}
function logEvent(type,data){const r={at:new Date().toISOString(),ms:Math.round(performance.now()),type,...(data||{})};LOGS.push(r);if(LOGS.length>320)LOGS.splice(0,LOGS.length-320);try{localStorage.setItem("roundhouse_last_log",JSON.stringify({build:BUILD,session:SESSION,latest:snap(),logs:LOGS}))}catch{}scheduleRemote(type);return r}
function compactRemote(reason){return{v:BUILD,s:SESSION,reason,at:Date.now(),state:snap(),events:LOGS.slice(remoteCursor).slice(-12)}}
function scheduleRemote(reason){if(!REMOTE_ALLOWED)return;clearTimeout(remoteTimer);remoteTimer=setTimeout(()=>flushRemote(reason),1400)}
function flushRemote(reason="heartbeat",beacon=false){if(!REMOTE_ALLOWED)return;const sent=LOGS.length,body=JSON.stringify(compactRemote(reason));if(beacon&&navigator.sendBeacon){try{if(navigator.sendBeacon(REMOTE_URL,body)){remoteCursor=sent;remoteLast="beacon";return}}catch{}}fetch(REMOTE_URL,{method:"POST",body,keepalive:true}).then(r=>{if(!r.ok)throw 0;remoteCursor=Math.max(remoteCursor,sent);remoteLast="ok"}).catch(()=>{remoteFailures++;remoteLast="offline"})}
function syncCanvas(reason="sync"){const d=Math.min(devicePixelRatio||1,2),rect=cv.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width*d)),h=Math.max(1,Math.round(rect.height*d));const changed=cv.width!==w||cv.height!==h;if(changed){cv.width=w;cv.height=h;canvasSyncCount++;logEvent("canvas_sync",{reason,css:[Math.round(rect.width),Math.round(rect.height)],backing:[w,h],dpr:d})}VIEW={...VIEW,w:rect.width,h:rect.height,dpr:d};ctx.setTransform(d,0,0,d,0,0)}
addEventListener("resize",()=>syncCanvas("resize"),{passive:true});addEventListener("orientationchange",()=>setTimeout(()=>syncCanvas("orientation"),80),{passive:true});document.addEventListener("visibilitychange",()=>{if(document.hidden)flushRemote("hidden",true);else setTimeout(()=>syncCanvas("visible"),50)});syncCanvas("boot");
function setEvent(t){E.textContent=t}
function hud(){document.getElementById("r").textContent=S.round;document.getElementById("phase").textContent=phaseLabel(S.phase);document.getElementById("m").textContent="$"+Math.round(S.money).toLocaleString();document.getElementById("e").textContent=Math.max(0,Math.round(S.engineHp/180*100))+"%";document.getElementById("hp").textContent=Math.max(0,Math.round(S.playerHp))+"%";document.getElementById("routeFill").style.width=(S.routeT*100).toFixed(1)+"%"}
function rr(x,y,w,h,r,fill=true,stroke=false){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill)ctx.fill();if(stroke)ctx.stroke()}
window.addEventListener("error",e=>logEvent("window_error",{message:e.message,line:e.lineno,col:e.colno}));window.addEventListener("unhandledrejection",e=>logEvent("promise_error",{reason:String(e.reason)}));
function renderDebug(){document.getElementById("debugMeta").textContent=BUILD+" · "+SESSION+" · "+(standaloneMode()?"PWA":"BROWSER");document.getElementById("remoteStatus").textContent="REMOTE: "+(REMOTE_ALLOWED?remoteLast:"disabled")+" · failures "+remoteFailures;document.getElementById("debugText").textContent=JSON.stringify({snapshot:snap(),logs:LOGS.slice(-100)},null,2)}
