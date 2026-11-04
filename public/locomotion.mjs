export function easeVelocity(current,target,dt){
  const blend=1-Math.exp(-Math.max(0,Math.min(dt,.1))/.04);
  const value=current+(target-current)*blend;
  return target===0&&Math.abs(value)<.08?0:value;
}
