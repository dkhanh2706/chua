(function(root){
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function phrase(voice='whistle',random=Math.random){
    const notes=[],pitch=.93+random()*.14;
    if(voice==='warble')for(let i=0;i<7;i++){const base=(3100+random()*1200)*pitch;notes.push({at:i*.115,duration:.08+random()*.05,from:base,to:base*(1.12+random()*.12),end:base*.91,trill:32+random()*10});}
    else if(voice==='chirp')for(let i=0;i<4;i++)notes.push({at:i*.23,duration:.14,from:(4200+i*110)*pitch,to:3300*pitch,end:3850*pitch,trill:14});
    else for(const [at,duration,from,to,end]of [[0,.22,2500,3300,2900],[.34,.27,3400,4200,3000],[.79,.32,2750,3550,2850]])notes.push({at,duration,from:from*pitch,to:to*pitch,end:end*pitch,trill:7});
    return notes;
  }
  function spatial(source,listener={x:0,y:2,z:0,yaw:0}){
    const dx=source.x-listener.x,dz=source.z-listener.z,dy=(source.y??6)-(listener.y??2),distance=Math.hypot(dx,dy,dz);
    return{distance,gain:.11+.84/(1+(distance/16)**2),pan:clamp((dx*Math.cos(listener.yaw||0)-dz*Math.sin(listener.yaw||0))/Math.max(8,Math.hypot(dx,dz)),-1,1)*.85};
  }
  const api={phrase,spatial};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TempleBirdsong=api;
})(typeof window!=='undefined'?window:globalThis);
