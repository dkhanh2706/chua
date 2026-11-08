// One grid covers both the original courtyard and the beach's negative map coordinates.
export function findWalkingRoute(sx,sy,ex,ey,valid,bounds){
  const size=20,left=Math.floor(bounds.left/size)*size,rear=Math.floor(bounds.rear/size)*size;
  const cols=Math.ceil((bounds.right-left)/size),rows=Math.ceil((bounds.front-rear)/size),idx=(x,y)=>y*cols+x;
  const canCross=(ax,ay,bx,by)=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/4));
    for(let i=0;i<=steps;i++){const t=i/steps;if(!valid(ax+(bx-ax)*t,ay+(by-ay)*t))return false;}
    return true;
  };
  if(!valid(sx,sy)||!valid(ex,ey))return null;
  if(canCross(sx,sy,ex,ey))return[{x:ex,y:ey}];
  const cell=(x,y)=>({x:Math.floor((x-left)/size),y:Math.floor((y-rear)/size)});
  const center=p=>({x:left+p.x*size+size/2,y:rear+p.y*size+size/2});
  const start=cell(sx,sy),end=cell(ex,ey),queue=[start],came=new Map([[idx(start.x,start.y),null]]);
  let head=0,found=false;
  while(head<queue.length){
    const p=queue[head++],from=p===start?{x:sx,y:sy}:center(p);
    if(p.x===end.x&&p.y===end.y&&canCross(from.x,from.y,ex,ey)){found=true;break;}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:p.x+dx,y:p.y+dy},key=idx(next.x,next.y),to=center(next);
      if(next.x<0||next.y<0||next.x>=cols||next.y>=rows||came.has(key)||!canCross(from.x,from.y,to.x,to.y))continue;
      came.set(key,p);queue.push(next);
    }
  }
  if(!found)return null;
  const route=[{x:ex,y:ey}];let p=end;
  while(p&&!(p.x===start.x&&p.y===start.y)){route.push(center(p));p=came.get(idx(p.x,p.y));}
  return route.reverse();
}
