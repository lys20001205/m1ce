function drawRoundhouse(w,h){
  const cx=w*.66,cy=h*.47,R=Math.min(w,h)*.34;
  ctx.fillStyle="#0a1118";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#31485e";ctx.lineWidth=18;ctx.beginPath();ctx.arc(cx,cy,R,Math.PI*.05,Math.PI*.95);ctx.stroke();
  ctx.strokeStyle="#17283a";ctx.lineWidth=3;for(let i=-4;i<=4;i++){const a=Math.PI*.5+i*.15,ex=cx+Math.cos(a)*R*1.55,ey=cy+Math.sin(a)*R*.92;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke()}
  ctx.fillStyle="#172432";ctx.beginPath();ctx.ellipse(cx,cy,R*.62,R*.22,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#50677d";ctx.stroke();
  for(let i=0;i<9;i++){const a=Math.PI*.15+i*Math.PI*.7/8,x=cx+Math.cos(a)*R*.95,y=cy-Math.sin(a)*R*.55;ctx.fillStyle=i%2?"#273849":"#213140";rr(x-34,y-24,68,48,4);ctx.fillStyle=i===4?"#f1bd58":"#7ea2be";ctx.fillRect(x-18,y+13,36,3)}
  ctx.fillStyle="rgba(242,188,84,.65)";ctx.font="bold 13px system-ui";ctx.fillText("ROUNDHOUSE TURNTABLE",cx-78,cy+5);
}
function drawIndustrial(w,h,t){
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,"#183044");sky.addColorStop(1,"#0a151f");ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const scroll=t*2400;ctx.globalAlpha=.25;for(let i=0;i<14;i++){const x=((i*150-scroll*.18)%(w+180)+w+180)%(w+180)-100;const bh=90+(i%4)*28;ctx.fillStyle=i%2?"#243b4c":"#1b3243";ctx.fillRect(x,h*.22,110,bh);ctx.fillStyle="#35536b";ctx.fillRect(x+12,h*.22+14,86,8)}ctx.globalAlpha=1;
  for(let i=0;i<7;i++){const x=((i*260-scroll*.48)%(w+300)+w+300)%(w+300)-160;ctx.strokeStyle="#31495e";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x,h*.26);ctx.lineTo(x+70,h*.1);ctx.lineTo(x+120,h*.1);ctx.stroke();ctx.fillStyle="#364f62";ctx.fillRect(x+105,h*.1,20,h*.38)}
  if(S.routeT>.34&&S.routeT<.44){const p=(S.routeT-.34)/.10,armX=w*(1.15-p*1.35);ctx.strokeStyle="#d0a34c";ctx.lineWidth=22;ctx.beginPath();ctx.moveTo(armX,h*.16);ctx.lineTo(armX-90,h*.52);ctx.stroke();ctx.fillStyle="#f0c35c";ctx.beginPath();ctx.arc(armX-90,h*.52,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f0c35c";ctx.font="bold 12px system-ui";ctx.fillText("ROOF SWEEP",Math.max(10,armX-142),h*.12)}
}
function drawTunnel(w,h,t){
  ctx.fillStyle="#06090d";ctx.fillRect(0,0,w,h);const scroll=t*1800;
  ctx.fillStyle="#161d24";ctx.fillRect(0,0,w,h*.2);ctx.fillRect(0,h*.75,w,h*.25);
  for(let i=0;i<12;i++){const x=((i*120-scroll*.5)%(w+130)+w+130)%(w+130)-60;ctx.strokeStyle="#2b333b";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,h*.2);ctx.lineTo(x,h*.76);ctx.stroke();ctx.fillStyle="rgba(242,205,124,.8)";ctx.fillRect(x-12,h*.23,24,5)}
  ctx.fillStyle="rgba(255,111,76,.13)";ctx.fillRect(0,h*.18,w,38);ctx.strokeStyle="rgba(255,133,91,.58)";ctx.setLineDash([9,7]);ctx.beginPath();ctx.moveTo(0,h*.2+38);ctx.lineTo(w,h*.2+38);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#ff996c";ctx.font="bold 12px system-ui";ctx.fillText("LOW CLEARANCE — GET INSIDE",14,h*.18+24)
}
function drawReturn(w,h,t){drawRoundhouse(w,h);ctx.fillStyle="rgba(7,16,24,"+(1-Math.min(1,(S.routeT-.82)/.18))*.45+")";ctx.fillRect(0,0,w,h)}
function drawEnvironment(w,h){if(S.phase==="roundhouse")drawRoundhouse(w,h);else if(S.phase==="industrial")drawIndustrial(w,h,S.routeT);else if(S.phase==="tunnel")drawTunnel(w,h,S.routeT);else drawReturn(w,h,S.routeT)}
function drawCar(car,i,base){
  const x=i*178+8,z=18,y=base-118,w=162,h=98;
  ctx.fillStyle="#1b2a36";ctx.beginPath();ctx.moveTo(x+z,y-z);ctx.lineTo(x+w+z,y-z);ctx.lineTo(x+w,y);ctx.lineTo(x,y);ctx.closePath();ctx.fill();
  ctx.fillStyle=car.type==="cargo"?"#4d3d20":car.type==="battery"?"#1f3b30":car.type==="workshop"?"#33263a":car.type==="gun"?"#263642":"#233644";rr(x,y,w,h,7);
  ctx.strokeStyle="#70869a";ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,w-2,h-2);
  ctx.fillStyle="#0f1922";ctx.fillRect(x+10,y+28,w-20,h-47);ctx.strokeStyle="#405265";ctx.strokeRect(x+10,y+28,w-20,h-47);
  ctx.fillStyle="#dde6ee";ctx.font="bold 10px system-ui";ctx.fillText(String(i+1).padStart(2,"0")+" "+carDefs[car.type].name,x+11,y+17);
  if(car.type==="engine"){ctx.fillStyle="#36516c";ctx.fillRect(x+19,y+39,36,42);ctx.fillStyle="#7aa7d1";ctx.fillRect(x+65,y+45,50,9);ctx.fillStyle="#4c6478";ctx.fillRect(x+69,y+60,26,14)}
  if(car.type==="cargo"){for(let k=0;k<(car.cargo||0);k++){ctx.fillStyle="#b28d3d";rr(x+22+k*35,y+51,27,21,3)}}
  if(car.type==="battery"){for(let k=0;k<3;k++){ctx.fillStyle="#376b52";ctx.fillRect(x+27+k*35,y+41,24,38);ctx.fillStyle="#8dd1a7";ctx.fillRect(x+32+k*35,y+46,14,3)}}
  if(car.type==="workshop"){ctx.fillStyle="#68507a";ctx.fillRect(x+24,y+58,92,10);ctx.fillStyle="#a18db1";ctx.fillRect(x+32,y+39,18,16);ctx.fillRect(x+74,y+38,24,17)}
  if(car.type==="gun"){ctx.fillStyle="#9fb3c3";ctx.fillRect(x+78,y+32,7,29);ctx.fillRect(x+70,y+32,30,7)}
  ctx.fillStyle="#526273";ctx.fillRect(x+9,y-8,w-18,9);ctx.fillStyle="#1f2d39";ctx.fillRect(x+67,y-10,28,11);
  for(const wx of [x+38,x+124]){ctx.fillStyle="#111820";ctx.beginPath();ctx.arc(wx,base+2,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#5e7183";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#7890a5";ctx.beginPath();ctx.arc(wx,base+2,4,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle="#73c98b";ctx.fillRect(x+11,y+h-10,(w-22)*Math.max(0,car.hp/car.max),5)
}
function playerY(base){return S.roof?base-167:base-63}
function drawPlayer(base){const y=playerY(base);ctx.fillStyle="#76a8ff";rr(S.px,y,23,36,6);ctx.fillStyle="#d8e8ff";ctx.fillRect(S.px+5,y+8,13,4);ctx.strokeStyle="#c4d3e0";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(S.px+12,y+18);ctx.lineTo(S.px+(S.facing>0?25:-3),y+19);ctx.stroke();ctx.fillStyle="#fff";ctx.font="9px system-ui";ctx.fillText(S.roof?"ROOF":"INSIDE",S.px-8,y-7)}
function drawEnemy(en,base){const y=en.roof?base-164:base-61;ctx.fillStyle=en.type==="thief"?"#a57cff":"#dc6d6d";rr(en.x,y,21,33,6);ctx.fillStyle="#fff";ctx.font="8px system-ui";ctx.fillText(en.type==="thief"?"THIEF":"BOARDER",en.x-7,y-5)}
function draw(){syncCanvas("draw");const w=VIEW.w,h=VIEW.h,d=VIEW.dpr;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);drawEnvironment(w,h);const base=Math.min(h-84,Math.max(232,h*.77));VIEW.base=base;const scale=Math.max(.92,Math.min(1.16,h/390));const visibleWorld=w/scale,maxCam=Math.max(0,tw()-visibleWorld+70),target=Math.max(0,Math.min(maxCam,S.px-visibleWorld*.42));S.cameraX+=(target-S.cameraX)*.14;VIEW.camX=S.cameraX;VIEW.scale=scale;ctx.save();ctx.scale(scale,scale);ctx.translate(20-S.cameraX,0);
  ctx.fillStyle="#7d8c9a";ctx.fillRect(S.cameraX-40,base+14,visibleWorld+100,7);ctx.fillStyle="#2f3a45";ctx.fillRect(S.cameraX-40,base+31,visibleWorld+100,9);
  S.cars.forEach(drawCar);S.enemies.forEach(en=>drawEnemy(en,base));drawPlayer(base);
  if(S.phase==="industrial"&&S.routeT>.31&&S.routeT<.45){ctx.fillStyle="rgba(240,188,76,.14)";ctx.fillRect(S.cameraX,base-196,visibleWorld,54)}
  if(S.phase==="tunnel"){ctx.fillStyle="rgba(255,112,80,.14)";ctx.fillRect(S.cameraX,base-198,visibleWorld,36)}
ctx.restore();VIEW.playerScreenX=(S.px+20-S.cameraX)*scale;drawCount++;hud()}
function spawnEnemy(){const edge=S.px<tw()/2?Math.min(tw()-32,S.px+250):Math.max(0,S.px-250),type=Math.random()<.25?"thief":"boarder";S.enemies.push({type,x:edge,roof:false,hp:type==="thief"?3:2,atk:0});logEvent("spawn",{enemy:type,x:edge})}
function updateEnemies(dt){for(const en of S.enemies){let tx=S.px;if(en.type==="thief"){const ci=S.cars.findIndex(c=>c.type==="cargo"&&(c.cargo||0)>0);if(ci>=0)tx=ci*178+90}if(Math.abs(en.x-tx)>14)en.x+=Math.sign(tx-en.x)*34*dt;else{en.atk+=dt;if(en.atk>1.1){en.atk=0;if(en.type==="thief"){const ci=carIndexAt(en.x),c=S.cars[ci];if(c&&c.type==="cargo"&&(c.cargo||0)>0){c.cargo--;S.money=Math.max(0,S.money-220);setEvent("THIEF 抱走了货物！")}}else{S.playerHp=Math.max(0,S.playerHp-7);setEvent("BOARDER 击中了你")}}}}S.enemies=S.enemies.filter(e=>e.hp>0&&e.x>-80&&e.x<tw()+80)}
let spawnClock=0;
function updateHazards(dt){
  if(S.phase==="industrial"&&S.routeT>.35&&S.routeT<.405&&S.roof&&!S.hazardHit){S.hazardHit=true;S.playerHp=Math.max(0,S.playerHp-35);setEvent("机械臂横扫车顶！你被击中，应该提前下车内");logEvent("hazard_hit",{hazard:"crane",roof:true})}
  if(S.phase==="tunnel"&&S.roof&&!S.tunnelHit){S.tunnelHit=true;S.playerHp=Math.max(0,S.playerHp-40);S.roof=false;setEvent("隧道净空过低！被迫跌回车内");logEvent("hazard_hit",{hazard:"tunnel_clearance"})}
}
function update(dt){if(!S.running)return;S.routeT=Math.min(1,S.routeT+dt/62);const p=phaseAt(S.routeT);if(p!==S.phase){S.phase=p;S.hazardHit=false;if(p!=="tunnel")S.tunnelHit=false;logEvent("phase",{phase:p,routeT:S.routeT});if(p==="industrial")setEvent("进入 INDUSTRIAL YARD：注意顶部机械臂");if(p==="tunnel")setEvent("进入 SERVICE TUNNEL：立即离开车顶");if(p==="return")setEvent("Roundhouse 已在前方")}
  if(S.move){S.px=Math.max(0,Math.min(tw()-30,S.px+S.move*118*dt));S.facing=S.move}
  S.attackCd=Math.max(0,S.attackCd-dt);spawnClock+=dt;if((S.phase==="industrial"||S.phase==="tunnel")&&spawnClock>Math.max(3.2,6-S.round*.25)){spawnClock=0;spawnEnemy()}
  updateEnemies(dt);updateHazards(dt);if(S.routeT>=1)finishRound();if(S.playerHp<=0||S.engineHp<=0)failRun()}
let last=0;function loop(ts){const dt=Math.min(.05,(ts-(last||ts))/1000);last=ts;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
function attack(){if(!S.running||S.attackCd>0)return;S.attackCd=.42;const range=65,center=S.px+11;let hit=null,best=1e9;for(const en of S.enemies){const d=(en.x+10-center)*S.facing;if(d>=-8&&d<range&&Math.abs(en.x-S.px)<best){best=Math.abs(en.x-S.px);hit=en}}if(hit){hit.hp-=1;S.money+=35;setEvent("扳手命中 +$35");logEvent("melee_hit",{enemy:hit.type,x:hit.x})}else setEvent("挥空了");logEvent("attack",{px:S.px,roof:S.roof})}
function repair(){if(!S.running)return;const i=carIndexAt(S.px),c=S.cars[i];c.hp=Math.min(c.max,c.hp+(S.cars.some(x=>x.type==="workshop")?20:12));if(i===0)S.engineHp=Math.min(180,S.engineHp+12);setEvent("维修 CAR "+(i+1));logEvent("repair",{car:i+1})}
function toggleLayer(){if(!S.running)return;if(S.phase==="tunnel"){setEvent("隧道内禁止上车顶");return}S.roof=!S.roof;setEvent(S.roof?"爬上车顶":"回到车内");logEvent("layer",{roof:S.roof})}
function startRun(){document.getElementById("modal").style.display="none";S.running=true;S.routeT=.12;S.phase="industrial";S.playerHp=100;S.hazardHit=false;S.tunnelHit=false;spawnClock=0;setEvent("发车：INDUSTRIAL LOOP");logEvent("depart",{round:S.round,cars:S.cars.map(c=>c.type)})}
function finishRound(){if(!S.running)return;S.running=false;S.phase="roundhouse";S.money+=Math.round(800+S.round*520);document.getElementById("modal").style.display="flex";document.getElementById("briefCards").style.display="none";document.getElementById("roundUi").style.display="block";document.getElementById("cash").style.display="block";document.getElementById("more").style.display="block";document.getElementById("start").style.display="none";document.getElementById("rm").textContent="$"+Math.round(S.money).toLocaleString();document.getElementById("rc").textContent=S.cars.length+" CARS";document.getElementById("risk").textContent="+"+(S.round+1);buildChoices();logEvent("round_complete",{round:S.round,money:S.money})}
function buildChoices(){const root=document.getElementById("choices"),pool=["battery","workshop","cargo","gun"],a=pool[(S.round-1)%pool.length],b=pool[S.round%pool.length];if(![a,b].includes(S.selected))S.selected=a;root.innerHTML="";for(const type of [a,b]){const d=document.createElement("div");d.className="choice"+(S.selected===type?" sel":"");d.innerHTML="<b>"+carDefs[type].name+"</b><span>"+carDefs[type].desc+"</span>";d.onclick=()=>{S.selected=type;buildChoices()};root.appendChild(d)}}
function oneMore(){const type=S.selected,d=carDefs[type],car={type,hp:d.hp,max:d.hp};if(type==="cargo")car.cargo=3;S.cars.push(car);S.round++;S.money=Math.round(S.money*1.15);S.px=Math.min(S.px,tw()-35);document.getElementById("modal").style.display="none";document.getElementById("cash").style.display="none";document.getElementById("more").style.display="none";S.routeT=.12;S.phase="industrial";S.running=true;S.playerHp=100;spawnClock=0;setEvent("ONE MORE ROUND：新车厢 "+d.name+" 已接入");logEvent("one_more_round",{round:S.round,car:type})}
function cashOut(){S.running=false;const bank=Number(localStorage.getItem("roundhouse_bank")||0)+Math.round(S.money);localStorage.setItem("roundhouse_bank",String(bank));document.getElementById("ms").innerHTML="CASH OUT 成功。<br>BANKED $"+bank.toLocaleString()+"<br><small>V9 暂停扩展 Garage，先验证路线本身是否成立。</small>";document.getElementById("roundUi").style.display="none";document.getElementById("cash").style.display="none";document.getElementById("more").style.display="none";logEvent("cash_out",{money:S.money,bank})}
function failRun(){if(!S.running)return;S.running=false;document.getElementById("modal").style.display="flex";document.getElementById("ms").innerHTML="RUN LOST · 未兑现收益损失。<br><small>失败原因："+(S.playerHp<=0?"PLAYER DOWN":"ENGINE LOST")+"</small>";document.getElementById("briefCards").style.display="none";document.getElementById("roundUi").style.display="none";document.getElementById("cash").style.display="none";document.getElementById("more").style.display="none";document.getElementById("start").style.display="none";logEvent("run_fail",{playerHp:S.playerHp,engineHp:S.engineHp})}
