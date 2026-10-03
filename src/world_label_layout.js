// Car labels are optional world annotations; controls and the permanent vitals win.
export function showCarHealthLabel(car,inspect,point,controls){
 if(!inspect&&car.hp>=car.max*.9)return false;
 const label={left:point.x-55,right:point.x+55,top:point.y-13,bottom:point.y+13};
 return !controls.some(r=>label.left<r.right&&label.right>r.left&&label.top<r.bottom&&label.bottom>r.top);
}

// A navigation label yields to the top HUD, controls and the carrier's silhouette.
// Return the bottom-centre anchor used by cargoGoal's CSS transform.
export function cargoGoalPosition(point,player,width,height){
 const half=60,labelHeight=24,left=half+8,right=width-half-8;
 const top=height<=350?135:155,bottom=height-88;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const y=clamp(point.y,top,bottom);
 let x=clamp(point.x,left,right);
 if(player&&Math.abs(x-player.x)<half+28&&y>player.head-12&&y-labelHeight<player.feet+10){
  const candidates=[player.x-half-36,player.x+half+36].filter(n=>n>=left&&n<=right);
  if(candidates.length)x=candidates.sort((a,b)=>Math.abs(a-point.x)-Math.abs(b-point.x))[0];
 }
 return {x,y};
}
