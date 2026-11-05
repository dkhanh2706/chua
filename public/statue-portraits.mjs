import * as THREE from 'three';

// Fixed site assets, ordered left to right when looking towards the altar.
// Crop centres use image coordinates, with (0, 0) at the top left.
export const STATUE_PORTRAITS=Object.freeze([
  Object.freeze({src:'/picture/hue.jpg',centerX:.425,centerY:.475,height:.57}),
  Object.freeze({src:'/picture/ngan.jpg',centerX:.555,centerY:.485,height:.65})
]);

export function setupStatuePortraits(statues){
  const loader=new THREE.TextureLoader();
  statues.forEach((statue,index)=>{
    const portrait=STATUE_PORTRAITS[index];if(!portrait)return;
    const shape=new THREE.Shape();shape.absellipse(0,0,.51,.66,0,Math.PI*2,false);
    const material=new THREE.MeshBasicMaterial({toneMapped:false});
    const geometry=new THREE.ShapeGeometry(shape,64),positions=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)/1.02+.5,positions.getY(i)/1.32+.5);
    const face=new THREE.Mesh(geometry,material);
    face.name='statue-portrait';face.position.set(0,4.12,.695);face.visible=false;
    face.userData.portraitSource=portrait.src;statue.add(face);
    loader.load(portrait.src,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      const image=texture.image,cropHeight=image.height*portrait.height,cropWidth=cropHeight*(.51/.66);
      texture.repeat.set(cropWidth/image.width,cropHeight/image.height);
      texture.offset.set(portrait.centerX-texture.repeat.x/2,1-portrait.centerY-texture.repeat.y/2);
      material.map=texture;material.needsUpdate=true;face.visible=true;
      statue.getObjectByName('sculpted-face').visible=false;
    },undefined,error=>console.error(`Unable to load fixed statue portrait: ${portrait.src}`,error));
  });
}
