(function (root) {
  const WORLD = { width: 1000, height: 700 };
  const URN = { x: 500, y: 180 };
  const COLORS = ['#a46e46', '#7d8b65', '#b17a7c', '#778c9e', '#b69a56'];
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
    if (x < 25 || x > 975 || y < 125 || y > 665) return false;
    // The hall has solid side/back walls and an altar; its front is open.
    if (y < 265 && (x > 300 && x < 316 || x > 684 && x < 700)) return false;
    if (y < 145 && x > 300 && x < 700) return false;
    if (y < 160 && x > 438 && x < 562) return false;
    if (((x - 204) / 134) ** 2 + ((y - 451) / 86) ** 2 < 1 && !lotusAt(x,y) && !pondStepAt(x,y)) return false;
    if (Math.abs(x - riverX(y)) < 36 && !(y > 480 && y < 530)) return false;
    if(Math.abs(x-riverX(505))<66&&Math.abs(y-505)>25&&Math.abs(y-505)<32)return false;
    if (Math.hypot(x - URN.x, y - URN.y) < 30) return false;
    return true;
  }
  function groundHeight(x, y, time=0) {
    const lotus=lotusAt(x,y);if(lotus)return lotusHeight(lotus.id,time);
    if(pondStepAt(x,y))return .29;
    if (x > 310 && x < 690 && y < 293) return Math.min(1.2, Math.max(0, (293 - y) / 28 * 1.2));
    if (Math.abs(x - riverX(505)) <= 66 && y > 475 && y < 535) return bridgeHeight(x,y);
    return 0;
  }
  const api = { WORLD, URN, COLORS, LOTUS_SEATS,POND_STEPS,lotusAt,pondStepAt,lotusHeight,riverX, bridgeHeight,validPosition, groundHeight };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
