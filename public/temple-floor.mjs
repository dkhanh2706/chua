import * as THREE from 'three';

// Clip the uniform square grid against the round room, retaining partial edge tiles.
export function createTempleFloorGeometry(radius,frontZ,centerZ){
  const positions=[],colors=[],indices=[],outline=[];
  for(let i=0;i<128;i++){const a=i*Math.PI*2/128;outline.push([Math.cos(a)*radius,Math.sin(a)*radius]);}
  const clip=(polygon,nx,nz,limit)=>{
    const output=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[0]*nx+a[1]*nz-limit,db=b[0]*nx+b[1]*nz-limit;
      if(da<=1e-9)output.push(a);
      if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);output.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
    return output;
  };
  let tileCount=0;
  for(let row=-10;row<=10;row++)for(let column=-10;column<=10;column++){
    const x=column*2,z=row*2,half=.985;
    let polygon=[[x-half,z-half],[x+half,z-half],[x+half,z+half],[x-half,z+half]];
    polygon=clip(polygon,0,1,frontZ-centerZ);
    for(let edge=0;edge<128&&polygon.length;edge++){
      const a=outline[edge],b=outline[(edge+1)%128],nx=b[1]-a[1],nz=a[0]-b[0];
      polygon=clip(polygon,nx,nz,nx*a[0]+nz*a[1]);
    }
    if(polygon.length<3)continue;
    const start=positions.length/3,shade=.97+((row*7+column*11+1000)%5)*.012;
    for(const [px,pz] of polygon){positions.push(px,1.2,pz+centerZ);colors.push(shade,shade,shade);}
    for(let i=1;i<polygon.length-1;i++)indices.push(start,start+i+1,start+i);
    tileCount++;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.tileCount=tileCount;
  return geometry;
}
