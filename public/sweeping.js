(function(root){
  const BROOM_RACKS=[{id:'gate',x:380,y:605},{id:'east',x:695,y:355},{id:'west',x:125,y:300}];
  // Patches sit on accessible paving beneath the crowns, outside the planting beds.
  const LEAF_PATCHES=[
    {id:'leaves-0',tree:11,x:301,y:615},{id:'leaves-1',tree:7,x:301,y:335},
    {id:'leaves-2',tree:8,x:99,y:359},{id:'leaves-3',tree:10,x:70,y:584},
    {id:'leaves-4',tree:12,x:911,y:607},{id:'leaves-5',tree:9,x:911,y:391},
    {id:'leaves-6',tree:6,x:91,y:231},{id:'leaves-7',tree:5,x:919,y:225},
    {id:'leaves-8',tree:13,x:131,y:643},{id:'leaves-9',tree:14,x:890,y:659}
  ];
  const PICKUP_RANGE=48,SWEEP_RANGE=52,SWEEP_DURATION=900,LEAF_RESPAWN=3000,LEAF_FALL_DURATION=2200;
  const HIT_RANGE=40,HIT_DURATION=650,HIT_CONTACT=300,HIT_COOLDOWN=1400;
  function nearestRack(player){return BROOM_RACKS.find(r=>Math.hypot(player.x-r.x,player.y-r.y)<=PICKUP_RANGE)||null;}
  function nearestLeaves(player,patches,time){
    let nearest=null,distance=SWEEP_RANGE;
    for(const patch of patches){const d=Math.hypot(player.x-patch.x,player.y-patch.y);if(patch.readyAt<=time&&d<=distance){nearest=patch;distance=d;}}
    return nearest;
  }
  const api={BROOM_RACKS,LEAF_PATCHES,PICKUP_RANGE,SWEEP_RANGE,SWEEP_DURATION,LEAF_RESPAWN,LEAF_FALL_DURATION,HIT_RANGE,HIT_DURATION,HIT_CONTACT,HIT_COOLDOWN,nearestRack,nearestLeaves};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TempleSweeping=api;
})(typeof window!=='undefined'?window:globalThis);
