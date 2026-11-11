// One set of swells drives geometry, lighting and the boats floating on it.
const waves=[
  [.32,.9474,.35,.14,0],
  [-.6,.8,.63,.075,1.7],
  [.8944,.4472,1.27,.035,3.1],
  [-.2425,.9701,2.62,.015,.8]
];

export function sampleWaterWaves(x,z,time){
  let height=0,dx=0,dz=0;
  for(const [wx,wz,frequency,amplitude,phase] of waves){
    const bend=(-x*wz+z*wx)*frequency*.32+time*.11+phase;
    const angle=(x*wx+z*wz)*frequency-time*Math.sqrt(9.81*frequency)*.62+phase+Math.sin(bend)*.65;
    const slope=Math.cos(angle)*amplitude*frequency,curve=Math.cos(bend)*.32*.65;
    height+=Math.sin(angle)*amplitude;dx+=(wx-wz*curve)*slope;dz+=(wz+wx*curve)*slope;
  }
  return {height,dx,dz};
}

export const waterWaveGLSL=`
  vec3 waterWave(vec2 p,float t,vec2 direction,float frequency,float amplitude,float phase){
    vec2 transverse=vec2(-direction.y,direction.x);
    float bend=dot(p,transverse)*frequency*.32+t*.11+phase;
    float angle=dot(p,direction)*frequency-t*sqrt(9.81*frequency)*.62+phase+sin(bend)*.65;
    float slope=cos(angle)*amplitude*frequency;
    return vec3(sin(angle)*amplitude,(direction+transverse*cos(bend)*.32*.65)*slope);
  }
  vec3 waterWaves(vec2 p,float t){
    return ${waves.map(([x,z,k,a,phase])=>`waterWave(p,t,vec2(${x.toFixed(4)},${z.toFixed(4)}),${k.toFixed(4)},${a.toFixed(4)},${phase.toFixed(4)})`).join('\n      +')};
  }
`;
