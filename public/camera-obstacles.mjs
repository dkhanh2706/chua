import {Raycaster,Vector3} from 'three';

// Probe the centre and edges of the camera boom so walls cannot clip the lens.
export class CameraObstacles {
  constructor(objects){
    this.objects=objects;this.ray=new Raycaster();this.direction=new Vector3();this.origin=new Vector3();
    this.probes=[[0,0],[.25,0],[-.25,0],[0,.25],[0,-.25]];
  }
  constrain(target,camera){
    this.direction.subVectors(camera,target);
    const distance=this.direction.length();if(distance<.001)return camera;
    this.direction.divideScalar(distance);
    let limit=distance;
    for(const [x,y] of this.probes){
      this.origin.copy(target);this.origin.x+=x;this.origin.y+=y;
      this.ray.set(this.origin,this.direction);this.ray.far=distance+.45;
      const hit=this.ray.intersectObjects(this.objects,true)[0];
      if(hit)limit=Math.min(limit,Math.max(.05,hit.distance-.45));
    }
    return camera.copy(target).addScaledVector(this.direction,limit);
  }
}
