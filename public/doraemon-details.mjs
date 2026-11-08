import * as THREE from 'three';

export function addDoraemonDetails({head,body,shirt,eyes,ball,add,stroke,profile}){
  const blue='#008dcc',white='#f7faf6',red='#e9383b',ink='#263d49',gold='#f6cc45';
  head.name='doraemon-head';
  ball(head,0,0,0,.59,.57,.52,blue).name='doraemon-blue-head';
  ball(head,0,-.075,.265,.50,.45,.31,white).name='doraemon-white-face';
  const faceZ=(x,y)=>.265+.31*Math.sqrt(Math.max(0,1-(x/.5)**2-((y+.075)/.45)**2))+.008;
  for(const side of [-1,1]){
    const eye=new THREE.Group();eye.position.set(side*.123,.24,.492);head.add(eye);
    ball(eye,0,0,0,.128,.214,.071,ink);
    ball(eye,0,0,.009,.119,.205,.074,white);
    ball(eye,-side*.028,-.04,.078,.028,.06,.018,ink);
    ball(eye,-side*.028-.009,-.018,.096,.009,.012,.005,'#ffffff');
    eyes.push(eye);
    for(let i=0;i<3;i++){
      const points=[];
      for(let j=0;j<=8;j++){
        const t=j/8,x=side*(.18+t*.255),y=-.04-i*.085+t*(.075-i*.065);
        points.push([x,y,faceZ(x,y)]);
      }
      stroke(head,points,ink,.007);
    }
  }
  ball(head,0,.025,.592,.087,.082,.08,red).name='doraemon-red-nose';
  ball(head,-.026,.054,.658,.019,.024,.009,'#ffffff');
  stroke(head,Array.from({length:9},(_,i)=>{const y=-.055-i*.029;return[0,y,faceZ(0,y)];}),ink,.007);
  const smile=Array.from({length:25},(_,i)=>{
    const t=i/24,x=-.34+t*.68,y=-.13-.24*Math.sin(t*Math.PI);
    return[x,y,faceZ(x,y)];
  });
  stroke(head,smile,ink,.008);

  const collar=add(body,new THREE.TorusGeometry(.34,.036,10,48),red,0,.73,0);collar.rotation.x=Math.PI/2;collar.scale.z=.84;collar.name='doraemon-red-collar';
  const bell=new THREE.Group();bell.name='doraemon-bell';bell.position.set(0,.64,.32);body.add(bell);
  ball(bell,0,0,0,.106,.106,.097,gold);
  const bellRidge=Array.from({length:13},(_,i)=>{const x=-.086+i*.172/12;return[x,.025,.097*Math.sqrt(Math.max(0,1-(x/.106)**2-(.025/.106)**2))+.004];});
  stroke(bell,bellRidge,'#a77921',.005);
  ball(bell,0,-.025,.097,.018,.018,.006,ink);
  stroke(bell,[[0,-.027,.099],[0,-.073,.075]],ink,.006);

  const surface=profile.getPoints(160);
  function torsoZ(x,y){
    let r=.44;
    for(let i=1;i<surface.length;i++){
      const a=surface[i-1],b=surface[i];
      if(a.y<=y&&b.y>=y){r=THREE.MathUtils.lerp(a.x,b.x,(y-a.y)/(b.y-a.y));break;}
    }
    return Math.sqrt(Math.max(0,r*r-x*x))*.84+.009;
  }
  const pocket=new THREE.Group();pocket.name='doraemon-pocket';shirt.add(pocket);
  stroke(pocket,Array.from({length:25},(_,i)=>{const t=i/24*Math.PI,x=.22*Math.cos(t),y=.30-.22*Math.sin(t);return[x,y,torsoZ(x,y)];}),'#597078',.007);
  stroke(pocket,Array.from({length:17},(_,i)=>{const x=-.22+i*.44/16;return[x,.30,torsoZ(x,.30)];}),'#597078',.007);
}

export function drawDoraemonPortrait(c){
  const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  ellipse(30,63,19,22,'#008dcc');ellipse(30,66,14,16,'#f7faf6');
  ellipse(30,29,25,25,'#008dcc');ellipse(30,34,21,19,'#f7faf6');
  c.strokeStyle='#263d49';c.lineWidth=.8;
  for(const side of [-1,1]){
    ellipse(30+side*6.4,22,6.3,9,'#ffffff');c.stroke();ellipse(30+side*4.5,24,1.5,3,'#263d49');
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(30+side*9,34+i*4);c.lineTo(30+side*20,31+i*6);c.stroke();}
  }
  ellipse(30,31,4.2,4,'#e9383b');ellipse(28.7,29.7,1,1,'#ffffff');
  c.beginPath();c.moveTo(30,35);c.lineTo(30,43);c.moveTo(14,37);c.quadraticCurveTo(30,56,46,37);c.stroke();
  c.strokeStyle='#e9383b';c.lineWidth=3.3;c.beginPath();c.moveTo(15,52);c.quadraticCurveTo(30,56,45,52);c.stroke();
  ellipse(30,56,4,4,'#f6cc45');c.strokeStyle='#597078';c.lineWidth=.8;c.beginPath();c.moveTo(22,64);c.lineTo(38,64);c.arc(30,64,8,0,Math.PI);c.stroke();
}
