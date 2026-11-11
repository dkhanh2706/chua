(function (root) {
  const {insideIncenseShop}=typeof module!=='undefined'&&module.exports?require('./incense-shop'):root.TempleIncense;
  const WORLD = { width: 1000, height: 700 };
  const WALK_BOUNDS={left:-400,right:1400,rear:-650,front:1100};
  const COAST={left:-56.6,right:56.6,sandStart:-43,front:44.6,waterY:-2.6,cliffX:24};
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  function coastShoreZ(x){
    x=Math.max(COAST.left,Math.min(COAST.right,x));
    const bay=-72+4*Math.sin((x+39)*.055)+1.5*Math.sin(x*.15)+25*(1-smooth(-55,-40,x));
    return bay*(1-smooth(16,30,x))-88*smooth(16,30,x);
  }
  function coastProgress(x,z){
    const start=COAST.sandStart-27*smooth(18,28,x),shore=coastShoreZ(x);
    const sideWidth=20+2*Math.sin(z*.05)+1.5*Math.sin(z*.13);
    const side=Math.max(0,(Math.abs(x)-COAST.right)/sideWidth);
    const rear=Math.max(0,(start-z)/(start-shore));
    const frontShore=66+2.8*Math.sin(x*.055)+1.2*Math.sin(x*.13);
    const front=Math.max(0,(z-COAST.front)/(frontShore-COAST.front));
    return Math.hypot(side,Math.max(rear,front));
  }
  function coastHeight(x,z){
    const t=coastProgress(x,z);
    return COAST.waterY*smooth(0,1,t)-Math.max(0,t-1)*3;
  }
  function onCoast(x,y){const wx=(x-500)/10,wz=(y-350)/10;return wz<COAST.sandStart||wz>COAST.front||wx<COAST.left||wx>COAST.right;}
  function gardenWallSegments(){
    const river=(riverX(790)-500)/10,radius=4.8;
    const rear=[[56,-70],[28,-70],...[25,21,18].map(x=>[x,COAST.sandStart-27*smooth(18,28,x)]),[-56,-43]];
    return [[[-56,-43],[-56,44]],[[-56,44],[-14,44]],[[-14,44],[-11,39]],[[11,39],[14,44]],[[14,44],[river-radius,44]],[[river+radius,44],[56,44]],[[56,44],[56,-70]],...rear.slice(1).map((p,i)=>[rear[i],p])];
  }
  const GARDEN_WALLS=gardenWallSegments();
  function nearGardenWall(x,z){
    return GARDEN_WALLS.some(([a,b])=>{
      const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<.9;
    });
  }
  const ROOM_CAPACITY=6;
  const URN = { x: 500, y: 180 };
  const COLORS = ['#a46e46', '#7d8b65', '#b17a7c', '#778c9e', '#b69a56'];
  const SOFA_SEAT_HEIGHT=1.6,SOFA_SCALE_Y=1,SOFA_REACH=32;
  const SOFA_LAYOUT=[-9,9].flatMap(x=>[-11,-16,-6].map(z=>({id:`sofa-${x}-${z}`,x:x*10+500,y:z*10+350,halfWidth:33,halfDepth:15})));
  const SOFA_SEATS=SOFA_LAYOUT.flatMap(sofa=>[-1,0,1].map(slot=>({id:`${sofa.id}-${slot}`,sofaId:sofa.id,x:sofa.x+slot*16.9,y:sofa.y-6.5,approachX:sofa.x+slot*16.9,approachY:sofa.y-28,heading:Math.PI})));
  const WATCH_BENCHES=[275,325].map((y,row)=>({id:`watch-bench-${row}`,x:204,y,halfWidth:37,halfDepth:10}));
  const WATCH_SEATS=WATCH_BENCHES.flatMap(bench=>[-1,0,1].map(slot=>({id:`${bench.id}-${slot}`,sofaId:bench.id,x:bench.x+slot*24,y:bench.y,approachX:bench.x+slot*24,approachY:bench.y+25,heading:0,height:.95,watching:true})));
  SOFA_SEATS.push(...WATCH_SEATS);
  const HALL={x:500,y:220,radius:185,floor:1.2,ceiling:14.1,entryAngle:Math.PI/8};
  const HALL_COLUMNS=Array.from({length:24},(_,i)=>(i+.5)*Math.PI/12).filter(a=>Math.min(a,Math.PI*2-a)>=HALL.entryAngle-.001).map(a=>({x:HALL.x+Math.sin(a)*182.5,y:HALL.y+Math.cos(a)*182.5,radius:7}));
  const entryHalf=Math.sin(HALL.entryAngle)*HALL.radius*.8;
  const HALL_ENTRY={y:HALL.y+Math.cos(HALL.entryAngle)*HALL.radius,left:HALL.x-entryHalf,right:HALL.x+entryHalf,clearance:6,halfDepth:7};
  function insideHall(x,y){return Math.hypot(x-HALL.x,y-HALL.y)<HALL.radius-4&&y<HALL_ENTRY.y;}
  function sofaAt(x,y){return [...SOFA_LAYOUT,...WATCH_BENCHES].find(s=>Math.abs(x-s.x)<s.halfWidth&&Math.abs(y-s.y)<s.halfDepth)||null;}
  function sofaSeatAt(x,y){const sofa=sofaAt(x,y);if(!sofa)return null;return SOFA_SEATS.filter(s=>s.sofaId===sofa.id).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];}
  // An equilateral triangle centred in the pond; the complete leaf stays over water.
  const LOTUS_SEATS = [{x:262,y:451},{x:175,y:401},{x:175,y:501}].map((p,id)=>({...p,id,radius:23}));
  const POND_STEPS = [{x:292,y:451},{x:312,y:451},{x:332,y:451},{x:352,y:451},{x:175,y:374},{x:175,y:354},{x:175,y:528},{x:175,y:548}].map(p=>({...p,radius:12}));
  function lotusAt(x,y){return LOTUS_SEATS.find(p=>Math.hypot(x-p.x,y-p.y)<=p.radius)||null;}
  function pondStepAt(x,y){return POND_STEPS.find(p=>Math.hypot(x-p.x,y-p.y)<=p.radius)||null;}
  function lotusHeight(id,time=0){return .34+Math.sin(time*.85+id*.9)*.025;}
  function riverX(y) { return 784 + Math.sin(y / 130) * 36; }
  function bridgeHeight(x,y){
    const t=(x-riverX(505))/66;
    if(Math.abs(t)>1||y<=475||y>=535)return 0;
    return .02+1.08*(1-t*t)**2;
  }
  function validPosition(x, y) {
    if (!Number.isFinite(x)||!Number.isFinite(y)||x<WALK_BOUNDS.left||x>WALK_BOUNDS.right||y<WALK_BOUNDS.rear||y>WALK_BOUNDS.front) return false;
    if(insideIncenseShop(x,y))return false;
    const wx=(x-500)/10,wz=(y-350)/10;
    if(coastProgress(wx,wz)>.99||nearGardenWall(wx,wz))return false;
    if(wz< -22.5&&wz> -79&&wx>COAST.cliffX&&wx<57)return false;
    // Circular walls and a flat, open doorway share the same architectural plan.
    const entry=HALL_ENTRY;
    const dx=x-HALL.x,dy=y-HALL.y,distance=Math.hypot(dx,dy),angle=Math.abs(Math.atan2(dx,dy));
    if(Math.abs(distance-HALL.radius)<8&&angle>HALL.entryAngle-.025)return false;
    if(Math.abs(y-entry.y)<entry.halfDepth&&Math.abs(dx)<Math.sin(HALL.entryAngle)*HALL.radius+8&&(x<entry.left+entry.clearance||x>entry.right-entry.clearance))return false;
    if (y > 95 && y < 160 && x > 438 && x < 562) return false;
    if(Math.abs(y-86)<8&&Math.abs(x-500)<86)return false;
    if(sofaAt(x,y)||HALL_COLUMNS.some(c=>Math.hypot(x-c.x,y-c.y)<c.radius))return false;
    if (((x - 204) / 134) ** 2 + ((y - 451) / 86) ** 2 < 1 && !lotusAt(x,y) && !pondStepAt(x,y)) return false;
    if (wz>=-24&&wz<=44.4&&Math.abs(x - riverX(y)) < 36 && !(y > 480 && y < 530)) return false;
    if(Math.abs(x-riverX(505))<66&&Math.abs(y-505)>25&&Math.abs(y-505)<32)return false;
    if (Math.hypot(x - URN.x, y - URN.y) < 30) return false;
    return true;
  }
  function canWalkBetween(ax,ay,bx,by){const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/4));for(let i=0;i<=steps;i++){const t=i/steps;if(!validPosition(ax+(bx-ax)*t,ay+(by-ay)*t))return false;}return true;}
  function groundHeight(x, y, time=0) {
    if(onCoast(x,y))return coastHeight((x-500)/10,(y-350)/10);
    const lotus=lotusAt(x,y);if(lotus)return lotusHeight(lotus.id,time);
    if(pondStepAt(x,y))return .29;
    if(Math.hypot(x-HALL.x,y-HALL.y)<HALL.radius+2&&y<=HALL_ENTRY.y)return HALL.floor;
    if(Math.abs(x-HALL.x)<entryHalf+10&&y>=HALL_ENTRY.y&&y<HALL_ENTRY.y+45)return HALL.floor*Math.min(1,Math.max(0,(HALL_ENTRY.y+45-y)/34));
    if (Math.abs(x - riverX(505)) <= 66 && y > 475 && y < 535) return bridgeHeight(x,y);
    return 0;
  }
  const api = { WORLD,WALK_BOUNDS,COAST,coastShoreZ,coastProgress,coastHeight,onCoast,gardenWallSegments,ROOM_CAPACITY,WATCH_BENCHES,WATCH_SEATS, URN, COLORS, HALL,insideHall,SOFA_LAYOUT,SOFA_SEATS,SOFA_SEAT_HEIGHT,SOFA_SCALE_Y,SOFA_REACH,HALL_COLUMNS,HALL_ENTRY,sofaAt,sofaSeatAt,canWalkBetween,LOTUS_SEATS,POND_STEPS,lotusAt,pondStepAt,lotusHeight,riverX, bridgeHeight,validPosition, groundHeight };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
