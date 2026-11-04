export const TREE_SPOTS=[[-43,-28],[-28,-29],[-19,-30],[23,-29],[39,-27],[45,-13],[-44,-12],[-23,-2],[-43,1],[44,4],[-46,22],[-23,27],[44,26],[-39,32],[39,35],[-49,-37],[0,-36],[18,-37],[48,-35],[-38,-34],[-48,35]];
export function seededRandom(seed=917){let value=Math.max(1,seed%2147483647);return()=>{value=value*16807%2147483647;return(value-1)/2147483646;};}
export function makeTreeLayout(){const random=seededRandom(1849);return TREE_SPOTS.map(([x,z],i)=>({id:`tree-${i}`,x,z,species:i%3,height:7.4+random()*2.8,radius:2.8+random()*1.2,seed:Math.floor(random()*100000)+1}));}

// Leaves emerge from their own crown, settle on the surface, then fade before reuse.
export function fallingLeafPose(leaf,time,ground=0){
  const age=((time+leaf.offset)%leaf.cycle+leaf.cycle)%leaf.cycle;
  const fraction=Math.min(1,age/leaf.fallTime),air=fraction<1;
  const drift=fraction*leaf.drift;
  const sway=Math.sin(fraction*Math.PI*4+leaf.seed)*Math.sin(fraction*Math.PI)*.65;
  const x=leaf.x+drift+sway,z=leaf.z+Math.sin(fraction*Math.PI*2+leaf.seed)*Math.sin(fraction*Math.PI)*.48+fraction*leaf.crossDrift;
  const y=ground+.045+Math.max(0,leaf.y-ground-.045)*(1-fraction);
  const fadeIn=Math.min(1,age/.3),fadeOut=Math.min(1,(leaf.cycle-age)/.65);
  return{x,y,z,air,scale:leaf.size*fadeIn*fadeOut,rx:air?Math.PI*.48+Math.sin(age*2+leaf.seed)*.8:Math.PI/2,ry:leaf.seed+age*(air?.65:.015),rz:air?Math.sin(age*1.7+leaf.seed)*.65:leaf.seed*.3};
}
