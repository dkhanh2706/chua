const TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

export function createAvatarMotion(seed=1){return{lastX:null,lastY:null,lastTime:null,totalDistance:0,walkDistance:0,phase:0,stride:48,moveBlend:0,sit:0,lastAction:'stand',direction:'down',heading:Math.PI,ritual:null,ritualKey:null,wasMoving:false,stepIndex:0,stepCount:0,seed:Math.abs(seed)||1,nextBlink:null,blinkAt:-Infinity};}

export function advanceAvatarMotion(state,player,time,dt){
  dt=Math.max(0,Math.min(.1,dt));
  let dx=0,dy=0;
  if(Number.isFinite(player.x)&&Number.isFinite(player.y)){
    if(state.lastX!==null){dx=player.x-state.lastX;dy=player.y-state.lastY;}
    state.lastX=player.x;state.lastY=player.y;
  }
  let distance=Math.hypot(dx,dy);if(distance>60){distance=0;dx=0;dy=0;}
  const action=player.action||'stand';
  const accepted=player.ritual&&time*1000-player.ritual.start>=0&&time*1000-player.ritual.start<1500;
  const ritualKey=accepted?`${player.ritual.kind}:${player.ritual.start}`:null;
  if(ritualKey&&ritualKey!==state.ritualKey){state.ritual={kind:player.ritual.kind,start:player.ritual.start/1000};state.ritualKey=ritualKey;}
  else if(action==='bow'&&state.lastAction!=='bow'&&!accepted)state.ritual={kind:'bow',start:time};
  const elapsed=state.ritual?time-state.ritual.start:Infinity;
  const ritualActive=elapsed>=0&&elapsed<1.5;
  const progress=ritualActive?clamp(elapsed/1.5):1;
  const sitTarget=action==='sit'&&!ritualActive?1:0;
  state.sit+=Math.max(-dt/.5,Math.min(dt/.5,sitTarget-state.sit));
  state.sit=clamp(state.sit);
  const sit=smooth(0,1,state.sit);
  const moving=distance>.003&&action==='stand'&&!ritualActive&&state.sit<.02;
  if(moving){
    if(!state.wasMoving){state.walkDistance=0;state.stepIndex=0;}
    state.walkDistance+=distance;state.totalDistance+=distance;state.phase=state.walkDistance/state.stride*TAU;
    const nextStep=Math.floor(state.walkDistance/(state.stride/2));state.stepCount+=Math.max(0,nextStep-state.stepIndex);state.stepIndex=nextStep;
    const ax=Math.abs(dx),ay=Math.abs(dy);
    if(state.direction==='side'?ay>ax*1.2:ax>ay*1.2)state.direction=state.direction==='side'?(dy>0?'down':'up'):'side';
    else if(state.direction!=='side'&&ay>=ax)state.direction=dy>0?'down':'up';
    state.heading=Math.atan2(dx,dy);
  }
  state.moveBlend+=(Number(moving)-state.moveBlend)*(1-Math.exp(-dt*20));
  state.wasMoving=moving;state.lastAction=action;state.lastTime=time;
  if(state.nextBlink===null)state.nextBlink=time+3+(state.seed%3000)/1000;
  if(time>=state.nextBlink){state.blinkAt=time;state.seed=(state.seed*16807)%2147483647;state.nextBlink=time+3+(state.seed%3000)/1000;}
  const blinkProgress=(time-state.blinkAt)/.17;
  const blink=blinkProgress>=0&&blinkProgress<1?1-.97*Math.sin(blinkProgress*Math.PI)**2:1;
  let bow=0,prayer=0,incense=0,reach=0;
  if(ritualActive){
    prayer=smooth(0,.23,progress)*(1-smooth(.77,1,progress));
    if(state.ritual.kind==='incense'){incense=prayer;bow=.22*smooth(.28,.5,progress)*(1-smooth(.66,.94,progress));reach=smooth(.55,.7,progress)*(1-smooth(.8,.97,progress));}
    else bow=smooth(.16,.46,progress)*(1-smooth(.64,.98,progress));
  }
  const name=ritualActive?state.ritual.kind:state.sit>0&&state.sit<1?(sitTarget?'sit_down':'sit_up'):sitTarget?'sit_idle':state.moveBlend>.03?'walk':'idle';
  return{name,sit,bow,prayer,incense,reach,progress,locked:ritualActive||name==='sit_up',phase:state.phase,moveBlend:state.moveBlend,heading:state.heading,direction:state.direction,blink:blink*(1-sit*.87),breath:Math.sin(time*TAU/(sit>.5?6:4.5)+(state.seed%100)/100),stepCount:state.stepCount,totalDistance:state.totalDistance};
}
