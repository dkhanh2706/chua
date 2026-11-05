import * as THREE from 'three';

// All twelve sticks share one draw call instead of up to sixty separate meshes.
export class IncenseSmoke{
  constructor(parent){
    const geometry=new THREE.SphereGeometry(1,7,5);
    this.opacity=new THREE.InstancedBufferAttribute(new Float32Array(60),1);geometry.setAttribute('puffOpacity',this.opacity);
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{color:{value:new THREE.Color('#eee7d6')}},
      vertexShader:`attribute float puffOpacity;varying float vOpacity;void main(){vOpacity=puffOpacity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform vec3 color;varying float vOpacity;void main(){gl_FragColor=vec4(color,vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.mesh=new THREE.InstancedMesh(geometry,material,60);this.mesh.name='shared-incense-smoke';this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.opacity.setUsage(THREE.DynamicDrawUsage);this.dummy=new THREE.Object3D();parent.add(this.mesh);
  }
  update(items,time,now){
    const count=5;let index=0;
    for(const item of items){
      const length=.25+Math.max(0,(item.end-now)/300000)*.85;
      for(let i=0;i<count;i++){
        const age=(time*.18+i/count+item.slot*.07)%1;
        this.dummy.position.set(-1.2+(item.slot%6)*.46+Math.sin(time+i)*age*.3,1.46+length+age*2.8,(Math.floor(item.slot/6)-.5)*.6+Math.cos(time*.7+i)*age*.2);
        this.dummy.scale.setScalar(.09+age*.26);this.dummy.updateMatrix();this.mesh.setMatrixAt(index,this.dummy.matrix);this.opacity.setX(index++,(1-age)*.15);
      }
    }
    this.mesh.count=index;this.mesh.visible=index>0;this.mesh.instanceMatrix.needsUpdate=true;this.opacity.needsUpdate=true;
  }
}
