// Shorten the camera boom along its existing direction; never push it past its target.
export function constrainHallCamera(target,camera,hall,entry){
  const centerZ=(hall.y-350)/10,entryZ=(entry.y-350)/10,half=(entry.right-entry.left)/20;
  const dx=camera.x-target.x,dy=camera.y-target.y,dz=camera.z-target.z;
  let fraction=1;
  if(dy>0)fraction=Math.min(fraction,(hall.ceiling-.65-target.y)/dy);
  const cross=dz>0?(entryZ-target.z)/dz:-1;
  const throughDoor=dz>0&&(
    cross>=0&&cross<=1&&Math.abs(target.x+dx*cross)<half-.35&&target.y+dy*cross<8.6||
    target.z>=entryZ-.05&&Math.abs(target.x)<half-.35&&target.y<8.6
  );
  if(!throughDoor){
    const x=target.x,z=target.z-centerZ,limit=Math.max(hall.radius/10-.6,Math.hypot(x,z)+.04);
    const a=dx*dx+dz*dz,b=2*(x*dx+z*dz),c=x*x+z*z-limit*limit;
    if(a>1e-8&&Math.hypot(camera.x,camera.z-centerZ)>limit){
      const discriminant=b*b-4*a*c;
      if(discriminant>=0)fraction=Math.min(fraction,(-b+Math.sqrt(discriminant))/(2*a));
    }
  }
  fraction=Math.max(.015,Math.min(1,fraction));
  camera.set(target.x+dx*fraction,target.y+dy*fraction,target.z+dz*fraction);
  return camera;
}
