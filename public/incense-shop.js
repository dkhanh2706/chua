(function(root){
  // The counter looks across the courtyard at the centre of the lotus pond.
  const POND={x:204,y:451};
  const INCENSE_SHOP={x:650,y:610,halfWidth:24,halfDepth:14,reach:52};
  INCENSE_SHOP.heading=Math.atan2(POND.x-INCENSE_SHOP.x,POND.y-INCENSE_SHOP.y);
  INCENSE_SHOP.approachX=INCENSE_SHOP.x+Math.sin(INCENSE_SHOP.heading)*36;
  INCENSE_SHOP.approachY=INCENSE_SHOP.y+Math.cos(INCENSE_SHOP.heading)*36;
  function insideIncenseShop(x,y){
    const dx=x-INCENSE_SHOP.x,dy=y-INCENSE_SHOP.y,sin=Math.sin(INCENSE_SHOP.heading),cos=Math.cos(INCENSE_SHOP.heading);
    return Math.abs(dx*cos-dy*sin)<INCENSE_SHOP.halfWidth&&Math.abs(dx*sin+dy*cos)<INCENSE_SHOP.halfDepth;
  }
  const INCENSE_PACKS=[
    {id:'single',name:'1 cây nhang',sticks:1,cost:1},
    {id:'triple',name:'3 cây nhang',sticks:3,cost:3},
    {id:'bundle',name:'1 bó nhang',sticks:6,cost:5}
  ];
  function nearIncenseShop(player){return !!player&&Math.hypot(player.x-INCENSE_SHOP.approachX,player.y-INCENSE_SHOP.approachY)<=INCENSE_SHOP.reach;}
  const api={INCENSE_SHOP,INCENSE_PACKS,nearIncenseShop,insideIncenseShop};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TempleIncense=api;
})(typeof window!=='undefined'?window:globalThis);
