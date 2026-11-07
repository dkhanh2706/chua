import * as THREE from 'three';

export function createGardenMoon(){
  const opacity={value:0};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{uOpacity:opacity},
    vertexShader:`varying vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uOpacity;varying vec3 vLocal;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float value=0.,weight=.55;for(int i=0;i<4;i++){value+=noise(p)*weight;p=p*2.1+vec3(2.7,1.3,4.1);weight*=.48;}return value;}
      void main(){vec3 n=normalize(vLocal);
        float terrain=fbm(n*4.2+vec3(4.1,8.7,1.3));
        float seas=smoothstep(.39,.68,terrain);
        vec3 color=mix(vec3(.82,.75,.57),vec3(.31,.36,.37),seas*.75);
        color*=.89+noise(n*110.)*.17;
        for(int i=0;i<28;i++){
          float seed=float(i);vec2 center=vec2(hash(vec3(seed,2,5)),hash(vec3(seed,9,1)))*1.7-.85;
          float radius=.024+hash(vec3(seed,3,8))*.115;
          float distanceToRim=length(n.xy-center)/radius;
          float bowl=1.-smoothstep(.22,.88,distanceToRim);
          float rim=(1.-smoothstep(.05,.19,abs(distanceToRim-1.)))*.15;
          color*=1.-bowl*.24;color+=rim*vec3(.7,.66,.5);
        }
        float sunlight=max(0.,dot(n,normalize(vec3(-.45,.34,-1.))));
        color*=.52+.48*sunlight;
        gl_FragColor=vec4(color,uOpacity);
        #include <colorspace_fragment>
      }`
  });
  const moon=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),material);moon.name='distant-garden-moon';moon.visible=false;
  const size=128,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const radius=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),i=(y*size+x)*4;
    pixels[i]=235;pixels[i+1]=218;pixels[i+2]=174;pixels[i+3]=Math.round(Math.max(0,1-radius)**3*90);
  }
  const map=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map,color:'#fff3cd',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false}));
  halo.name='soft-moon-halo';halo.renderOrder=-1;halo.visible=false;
  return{moon,halo,opacity};
}
