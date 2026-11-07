import * as THREE from 'three';

const TAU=Math.PI*2;

// Cut stone follows the waterline. Small joints and a bevel catch the light
// without piling independent rocks over one another.
export function pondCopingGeometry(){
  const positions=[],colors=[];
  const profile=[[0,.07],[.04,.03],[.71,.03],[.75,.07],[.75,.28],[.71,.32],[.04,.32],[0,.28]];
  const point=(angle,offset,height)=>[(13.37+offset)*Math.cos(angle),height,(8.57+offset)*Math.sin(angle)];
  const triangle=(a,b,c,color)=>{positions.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);};
  const segments=80;
  for(let i=0;i<segments;i++){
    const angle=(i+.5)/segments*TAU,x=13.75*Math.cos(angle),z=8.95*Math.sin(angle);
    // Leave three clean openings where the meditation paths meet the shore.
    if((x>12&&Math.abs(z)<1.15)||(Math.abs(x+2.9)<1.25&&Math.abs(z)>7))continue;
    const joint=.018/Math.hypot(13.75*Math.sin(angle),8.95*Math.cos(angle));
    const start=i/segments*TAU+joint,end=(i+1)/segments*TAU-joint;
    const color=new THREE.Color('#b9b6a5').multiplyScalar(.96+.06*((i*17)%11)/10);
    for(let slice=0;slice<4;slice++){
      const a=start+(end-start)*slice/4,b=start+(end-start)*(slice+1)/4;
      for(let edge=0;edge<profile.length;edge++){
        const [r1,h1]=profile[edge],[r2,h2]=profile[(edge+1)%profile.length];
        const p=point(a,r1,h1),q=point(b,r1,h1),r=point(b,r2,h2),s=point(a,r2,h2);
        triangle(p,r,q,color);triangle(p,s,r,color);
      }
    }
    for(const [a,reverse] of [[start,true],[end,false]]){
      const center=point(a,.375,.175);
      for(let edge=0;edge<profile.length;edge++){
        const p=point(a,...profile[edge]),q=point(a,...profile[(edge+1)%profile.length]);
        triangle(center,reverse?q:p,reverse?p:q,color);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

export function pondSlabGeometry(){
  const shape=new THREE.Shape(),length=.83,width=.88,corner=.16;
  const outline=[[-length+corner,-width],[length-corner,-width],[length,-width+corner],[length,width-corner],[length-corner,width],[-length+corner,width],[-length,width-corner],[-length,-width+corner]];
  outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.computeBoundingBox();
  return geometry;
}

export function buildPondStonework(parent,steps){
  const coping=new THREE.Mesh(pondCopingGeometry(),new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.88}));
  coping.name='pond-shore-stones';coping.castShadow=true;coping.receiveShadow=true;parent.add(coping);
  const geometry=pondSlabGeometry(),palette=['#b8b7a8','#c2bfb0','#bcb9ac'];
  const materials=palette.map(color=>new THREE.MeshStandardMaterial({color,roughness:.87}));
  steps.forEach((step,i)=>{
    const slab=new THREE.Mesh(geometry,materials[i%materials.length]);
    slab.position.set((step.x-204)/10,.095,(step.y-451)/10);
    // The longer axis follows each approach; every slab has a visible water gap.
    slab.rotation.y=step.y===451?0:Math.PI/2;
    slab.name='pond-stepping-stone';slab.castShadow=true;slab.receiveShadow=true;parent.add(slab);
  });
}
