import * as THREE from 'three';

// Paint directly into the head's UV map so the muzzle, nose and smile follow
// the head surface at every viewing angle, without additional face meshes.
export function createTomFaceTexture(){
  const size=512,pixels=new Uint8Array(size*size*4);
  const smooth=(edge0,edge1,value)=>THREE.MathUtils.smoothstep(value,edge0,edge1);
  const fur=[119,133,139],cream=[243,240,223],ink=[39,53,60];
  for(let row=0;row<size;row++){
    const theta=(1-(row+.5)/size)*Math.PI;
    const y=.015+.43*Math.cos(theta),ring=Math.sin(theta);
    for(let col=0;col<size;col++){
      const phi=(col+.5)/size*Math.PI*2,x=-.43*Math.cos(phi)*ring;
      const color=fur.slice();
      const paint=(rgb,coverage)=>{for(let k=0;k<3;k++)color[k]+= (rgb[k]-color[k])*coverage;};
      if(Math.sin(phi)>0){
        const muzzle=Math.min(((x-.085)/.145)**2+((y+.157)/.102)**2,((x+.085)/.145)**2+((y+.157)/.102)**2);
        paint(cream,1-smooth(.95,1.07,muzzle));
        const nose=(x/.061)**2+((y+.087)/.035)**2;
        paint(ink,1-smooth(.88,1.12,nose));
        const bridge=Math.max(Math.abs(x)-.0035,Math.abs(y+.166)-.055);
        const smileY=-.224+3.6*x*x;
        const smile=Math.max(Math.abs(y-smileY)-.0045,Math.abs(x)-.13);
        paint(ink,1-smooth(0,.0025,Math.min(bridge,smile)));
        // Fine whiskers are painted on the cheeks as well.
        const ax=Math.abs(x);
        for(let line=0;line<3;line++){
          const t=THREE.MathUtils.clamp((ax-.15)/.19,0,1);
          const whiskerY=-.14-line*.031+t*(.025-line*.024);
          const edge=Math.max(Math.abs(y-whiskerY)-.0018,.15-ax,ax-.34);
          paint(ink,(1-smooth(0,.002,edge))*.88);
        }
      }
      const offset=(row*size+col)*4;
      for(let k=0;k<3;k++)pixels[offset+k]=Math.round(color[k]);pixels[offset+3]=255;
    }
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}
