export const streamCenter=z=>(784+Math.sin((z*10+350)/130)*36-500)/10;
export const RIVER_START_Z=-22.8;
export const riverHalfWidth=z=>3.6+Math.exp(-(((z+22)/3.6)**2));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Three short cascades separated by calm rock pools, ending in the existing river.
export const FALL_STATIONS=[[-60,21.8],[-55,21.4],[-52.5,15.2],[-47,14.7],[-44.5,9],[-37,8.5],[-33.5,.055],[-22.8,.055]];
export function cascadeHeight(z){
  for(let i=1;i<FALL_STATIONS.length;i++){
    const [a,ha]=FALL_STATIONS[i-1],[b,hb]=FALL_STATIONS[i];
    if(z<=b)return ha+(hb-ha)*smooth((z-a)/(b-a));
  }
  return .055;
}
export function cascadeCenter(z){
  const t=smooth((z+60)/31),x=38-6.5*t;
  const join=smooth((z+31)/7);return x*(1-join)+streamCenter(z)*join;
}
export function cascadeHalfWidth(z){
  if(z>-34){const join=smooth((z+28)/5.2);return (1.65+2.85*smooth((z+34)/6))*(1-join)+riverHalfWidth(z)*join;}
  return 1.25+.65*Math.sin(smooth((z+60)/26)*Math.PI)**2;
}
export function mountainFootprint(x,z,padding=0){
  if(z< -64-padding||z> -26+padding)return false;
  const t=(z+45)/19;
  const half=10.4*Math.sqrt(Math.max(0,1-t*t));
  return Math.abs(x-(cascadeCenter(z)+1.1))<half+padding;
}
export function rockyHeight(x,z){
  if(!mountainFootprint(x,z))return -.12;
  const t=(z+45)/19,half=10.4*Math.sqrt(Math.max(0,1-t*t));
  const edge=smooth((half-Math.abs(x-cascadeCenter(z)-1.1))/2.2);
  const bank=smooth((Math.abs(x-cascadeCenter(z))-cascadeHalfWidth(z)-.2)/1.4);
  const ridge=2.2+1.2*Math.sin(z*.46+x*.25)**2;
  return Math.max(-.12,(cascadeHeight(z)-.18+bank*ridge)*edge);
}
