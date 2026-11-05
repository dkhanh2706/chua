(function(root){
  const proximity=(distance,full,range)=>{const t=Math.max(0,Math.min(1,(distance-full)/(range-full)));return 1-t*t*(3-2*t);};
  function mix(x,y,yaw,world){
    const wx=(x-500)/10,wz=(y-350)/10,river=world.riverX(y);
    const riverDistance=Math.max(0,Math.abs(x-river)-36)/10;
    const pondDistance=Math.max(0,(Math.hypot((wx+29.6)/13.4,(wz-10.1)/8.6)-1)*8.6);
    const dx=31.5-wx,dz=-32.8-wz,fallDistance=Math.hypot(dx,dz),muffle=world.insideHall(x,y)?.12:1;
    return{
      stream:Math.max(.4*proximity(riverDistance,1,9),.1*proximity(pondDistance,.4,4.5))*muffle,
      waterfall:.65*proximity(fallDistance,6,18)*muffle,
      fallPan:Math.max(-.85,Math.min(.85,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/Math.max(1,fallDistance))),
      streamPan:Math.max(-.75,Math.min(.75,(river-x)/180*Math.cos(yaw)))
    };
  }
  const api={mix};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TempleWaterAudio=api;
})(typeof window!=='undefined'?window:globalThis);
