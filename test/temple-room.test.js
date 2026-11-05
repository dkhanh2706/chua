const {test}=require('node:test');
const assert=require('node:assert/strict');
const {HALL,HALL_ENTRY,SOFA_LAYOUT,SOFA_SEATS}=require('../public/world');

test('camera keeps its viewing direction through the doorway and when shortened at the wall',async()=>{
  const {Vector3}=await import('three'),{constrainHallCamera}=await import('../public/hall-camera.mjs');
  const entryZ=(HALL_ENTRY.y-350)/10;
  for(const x of [-5,0,5])for(let depth=-.3;depth<18;depth+=.2)for(const yaw of [0,.6,Math.PI/2,Math.PI]){
    const target=new Vector3(x,2.1,entryZ-depth),offset=new Vector3(Math.sin(yaw)*8,4.5,Math.cos(yaw)*8),camera=target.clone().add(offset);
    constrainHallCamera(target,camera,HALL,HALL_ENTRY);
    const actual=camera.clone().sub(target);
    assert.ok(actual.length()>.01);assert.ok(actual.clone().normalize().dot(offset.clone().normalize())>.999999,'camera never reverses azimuth');
    assert.ok(camera.y<=HALL.ceiling-.65+1e-8);
    if(yaw===0&&depth<.5)assert.ok(camera.z>target.z,'camera stays behind the player while crossing the entrance');
  }
});

test('uniform floor tiles cover the curved perimeter and stop at the doorway',async()=>{
  const {Mesh,MeshBasicMaterial,Raycaster,Vector3}=await import('three'),{createTempleFloorGeometry}=await import('../public/temple-floor.mjs');
  const centerZ=(HALL.y-350)/10,frontZ=(HALL_ENTRY.y-350)/10,radius=HALL.radius/10,geometry=createTempleFloorGeometry(radius,frontZ,centerZ),floor=new Mesh(geometry,new MeshBasicMaterial());
  floor.updateMatrixWorld();assert.ok(geometry.userData.tileCount>250);
  for(let i=0;i<720;i++){
    const a=i*Math.PI*2/720,x=Math.cos(a)*(radius-.1),z=Math.sin(a)*(radius-.1);
    if(z+centerZ>frontZ-.03)continue;
    // Thin, regular grout lines are the only intentional gaps.
    if(Math.abs(Math.abs(x-Math.round(x/2)*2)-1)<.02||Math.abs(Math.abs(z-Math.round(z/2)*2)-1)<.02)continue;
    const ray=new Raycaster(new Vector3(x,3,z+centerZ),new Vector3(0,-1,0));
    assert.ok(ray.intersectObject(floor).length>0,`perimeter tile at ${a}`);
  }
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(Math.hypot(p.getX(i),p.getZ(i)-centerZ)<radius+1e-5);assert.ok(p.getZ(i)<=frontZ+1e-5);}
  assert.equal(SOFA_LAYOUT.length,6);assert.equal(SOFA_SEATS.length,18);
  geometry.dispose();floor.material.dispose();
});
