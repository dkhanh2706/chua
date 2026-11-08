import * as THREE from 'three';
import {RIVER_START_Z} from './waterfall-layout.mjs';

// The falls, river surface and submerged bed share one palette and flow pattern.
// Matching the bed to the surface keeps clear water from picking up a dark stripe.
export function flowingWaterMaterial(time,night,{opacity=1,waves=false}={}){
  return new THREE.ShaderMaterial({
    uniforms:{uTime:time,uNight:night,uOpacity:{value:opacity},uWaves:{value:waves?1:0},uRiverStart:{value:RIVER_START_Z}},
    transparent:opacity<1,depthWrite:opacity===1,side:THREE.DoubleSide,
    vertexShader:`attribute float aCascade;uniform float uTime;uniform float uWaves;uniform float uRiverStart;
      varying vec2 vUv;varying vec3 vWorld;varying float vCascade;
      void main(){
        vUv=uv;vCascade=aCascade;vec3 p=position;
        p.y+=sin(p.z*2.1+p.x*1.4-uTime*1.7)*.009*sin(uv.x*3.14159)*uWaves*smoothstep(uRiverStart,uRiverStart+1.0,p.z);
        vWorld=(modelMatrix*vec4(p,1.0)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
      }`,
    fragmentShader:`uniform float uTime;uniform float uNight;uniform float uOpacity;uniform float uRiverStart;
      varying vec2 vUv;varying vec3 vWorld;varying float vCascade;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float depth=pow(max(0.0,sin(vUv.x*3.14159)),.65);
        vec2 flow=vec2(vUv.x*9.0,vWorld.z*.75-uTime*(.65+vCascade*1.7));
        float n=noise(flow+noise(flow*.55));
        float threads=pow(noise(vec2(vUv.x*23.0,(-vWorld.y+vWorld.z*.35)*2.5-uTime*3.8)),2.0);
        float ripples=sin(vWorld.z*5.6-uTime*3.0+sin(vWorld.x*2.4+uTime*.3)*1.3);
        float impact=exp(-pow((vWorld.z+32.6)/1.0,2.0))+exp(-pow((vWorld.z+44.2)/.8,2.0))+exp(-pow((vWorld.z+52.2)/.8,2.0));
        float shore=(1.0-smoothstep(0.0,.08,min(vUv.x,1.0-vUv.x)))*(.10+.13*n);
        float foam=clamp(vCascade*(.36+threads*.65)+impact*(.22+.5*n)+shore,0.0,.94);
        vec3 water=mix(vec3(.15,.59,.69),vec3(.025,.29,.46),depth);
        water+=vec3(.035,.055,.045)*(n-.5);
        float glimmer=pow(max(0.0,ripples),18.0)*smoothstep(.52,.85,n)*.16;
        water+=vec3(.68,.81,.72)*glimmer;
        // Ease into clear river water without exposing a straight material seam.
        float opacity=mix(1.0,uOpacity,smoothstep(uRiverStart,uRiverStart+3.0,vWorld.z));
        gl_FragColor=vec4(mix(water,vec3(.83,.96,1.),foam)*mix(vec3(1.),vec3(.32,.46,.66),uNight),opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}
