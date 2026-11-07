const {test}=require('node:test');
const assert=require('node:assert/strict');

test('camera stops before exterior walls, eaves and obstacles grazing the lens',async()=>{
  const {Mesh,BoxGeometry,MeshBasicMaterial,Vector3}=await import('three');
  const {CameraObstacles}=await import('../public/camera-obstacles.mjs');
  for(const [x,y,w,h] of [[0,2,8,8],[.35,2,.3,8],[0,4,8,.3]]){
    const wall=new Mesh(new BoxGeometry(w,h,.5),new MeshBasicMaterial());
    wall.position.set(x,y,3);wall.updateMatrixWorld(true);
    const target=new Vector3(0,2,0),camera=new Vector3(0,y===4?6:2,7),direction=camera.clone().sub(target).normalize();
    const collision=new CameraObstacles([wall]);collision.constrain(target,camera);
    assert.ok(camera.z<2.75,'camera stays on the player side of the obstacle');
    assert.ok(camera.clone().sub(target).normalize().dot(direction)>.99999,'orbit direction is preserved');
    wall.geometry.dispose();wall.material.dispose();
  }
});

test('an unobstructed camera retains its full distance',async()=>{
  const {Vector3}=await import('three'),{CameraObstacles}=await import('../public/camera-obstacles.mjs');
  const camera=new Vector3(3,4,8),expected=camera.clone();
  new CameraObstacles([]).constrain(new Vector3(0,1,0),camera);
  assert.ok(camera.distanceTo(expected)<1e-12);
});
