const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../public/avatar-config');
const modelModule=import('../public/avatar-model.mjs');

test('Tom and Doraemon use the shared animated rig for walking, meditation, bowing and sofa sitting',async()=>{
  const {createAvatar,poseAvatar,disposeAvatar}=await modelModule;
  for(const code of [' TOM ','chồn']){
  const appearance=config.withCharacterCode(config.defaults(),code),m=createAvatar(appearance);
  assert.equal(m.signature,JSON.stringify(appearance));assert.ok(m.tail);assert.equal(m.eyes.length,2);
  if(appearance.special==='doraemon'){
    for(const name of ['doraemon-blue-head','doraemon-white-face','doraemon-red-nose','doraemon-pocket','doraemon-bell','doraemon-red-tail'])assert.ok(m.root.getObjectByName(name),name);
    m.root.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
  }
  for(const p of [{action:'stand',moving:true},{action:'sit'},{action:'bow',ritual:{kind:'incense',start:0}},{action:'sit',sofaSeatId:'sofa'}]){
    for(let i=0;i<40;i++)poseAvatar(m,p,i*.04,.04);
    assert.ok(Number.isFinite(m.postureOffset));m.root.updateMatrixWorld(true);m.root.traverse(o=>{for(const n of o.matrixWorld.elements)assert.ok(Number.isFinite(n));});
  }
  assert.equal(config.withCharacterCode(appearance,'').special,undefined);disposeAvatar(m);
  }
});

test('Doraemon code supports Vietnamese Unicode forms, validates exactly and clears when changing codes',()=>{
  const a=config.defaults();
  for(const code of ['chồn',' CHỒN ','chồn'.normalize('NFD')]){
    assert.equal(config.specialCharacter(code),'doraemon');assert.equal(config.withCharacterCode(a,code).special,'doraemon');
  }
  for(const code of ['chon','doraemon','__proto__','tom chồn'])assert.equal(config.specialCharacter(code),undefined);
  const d=config.withCharacterCode(a,'chồn');assert.equal(config.normalize(d).special,'doraemon');
  assert.equal(config.withCharacterCode(d,'tom').special,'tom');assert.equal(config.withCharacterCode(d,'').special,undefined);
  assert.equal(config.withCharacterCode(d,'unknown').special,undefined);
});

test('bowing and incense keep both folded hands on their own side of the chest for every character',async()=>{
  const {createAvatar,poseAvatar,disposeAvatar}=await modelModule;
  const {Vector3}=await import('three');
  for(const appearance of [config.defaults('male'),config.defaults('female'),config.withCharacterCode(config.defaults(),'tom'),config.withCharacterCode(config.defaults(),'chồn')])for(const kind of ['bow','incense']){
    const m=createAvatar(appearance);
    for(let frame=0;frame<=90;frame++){
      poseAvatar(m,{action:frame<90?'bow':'stand',ritual:{kind,start:0}},frame/60,1/60);m.root.updateMatrixWorld(true);
      const hands=m.wrists.map(w=>m.body.worldToLocal(w.getWorldPosition(new Vector3())));
      assert.ok(hands[0].x<-.07&&hands[1].x>.07,`${appearance.special||appearance.gender} ${kind}: hands crossed at ${frame}`);
      if(m.motionOutput.prayer>.99){
        assert.ok(hands.every(p=>p.z>.32&&p.y>.45),'folded hands stay in front of the chest');
        assert.ok(hands[0].distanceTo(hands[1])<.23,'hands remain together during the ritual');
      }
    }
    disposeAvatar(m);
  }
});

test('appearance accepts free hex colors, validates every style, and removes untrusted fields',()=>{
  const a=config.normalize({gender:'female',shirt:'short',pants:'wide',shoes:'sandals',hair:'bald',necklace:true,hairAccessory:'bow',colors:{shirt:'#123AbC',hairAccessory:'#09f001',skin:'url(evil)'},injected:'ignore'});
  assert.equal(a.gender,'female');assert.equal(a.hair,'bald');assert.equal(a.necklace,true);assert.equal(a.colors.shirt,'#123abc');assert.equal(a.colors.hairAccessory,'#09f001');assert.equal(a.colors.skin,config.defaults().colors.skin);assert.equal(a.injected,undefined);
  const b=config.normalize({gender:'male',hair:'<script>',hairAccessory:'bow',necklace:'true',colors:{pants:'#fff'}});assert.equal(b.hairAccessory,'none');assert.equal(b.necklace,false);assert.equal(b.hair,'short');assert.equal(b.colors.pants,config.defaults().colors.pants);
});
test('both genders support every clothing and hair option, with finite geometry and connected animated joints',async()=>{
  const {createAvatar,poseAvatar,disposeAvatar}=await modelModule;
  const {Vector3}=await import('three');
  for(const gender of ['male','female'])for(const hair of config.styles.hair){
    const a=config.defaults(gender);a.hair=hair;a.necklace=true;a.hairAccessory=gender==='female'?'bow':'none';
    const model=createAvatar(a);
    for(const action of ['stand','sit','bow','stand'])for(let i=0;i<30;i++){
      poseAvatar(model,{action,moving:action==='stand'},i/20,.05);model.root.updateMatrixWorld(true);
      for(let side=0;side<2;side++){
        const shoulder=model.arms[side].getWorldPosition(new Vector3()),elbow=model.elbows[side].getWorldPosition(new Vector3()),wrist=model.wrists[side].getWorldPosition(new Vector3());
        assert.ok(Math.abs(shoulder.distanceTo(elbow)-.34)<1e-6);assert.ok(Math.abs(elbow.distanceTo(wrist)-.29)<1e-6);
        const hip=model.legs[side].getWorldPosition(new Vector3()),knee=model.knees[side].getWorldPosition(new Vector3());assert.ok(Math.abs(hip.distanceTo(knee)-.34)<1e-6);
      }
    }
    let skinned=0;model.root.traverse(o=>{if(o.geometry){for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}if(o.isSkinnedMesh){skinned++;const weight=o.geometry.attributes.skinWeight;for(let i=0;i<weight.count;i++)assert.ok(Math.abs(weight.getX(i)+weight.getY(i)+weight.getZ(i)+weight.getW(i)-1)<1e-6);}});assert.equal(skinned,4);disposeAvatar(model);
  }
});
test('feet stay on the floor through walking, sitting and bowing for every shoe type',async()=>{
  const{createAvatar,poseAvatar,disposeAvatar}=await modelModule;
  for(const shoes of config.styles.shoes){const a=config.defaults();a.shoes=shoes;const m=createAvatar(a);
    for(let i=0;i<160;i++){
      const action=i<40?'stand':i<85?'sit':i<120?'bow':'stand',time=i*.04;
      poseAvatar(m,{action,x:i<40?i*2:80,y:0,ritual:action==='bow'?{kind:'bow',start:3400}:null},time,.04);m.root.position.y=m.postureOffset;m.root.updateMatrixWorld(true);
      let floor=Infinity;for(const foot of m.footMeshes){const e=foot.matrixWorld.elements;floor=Math.min(floor,e[13]-Math.hypot(e[1],e[5],e[9]));}assert.ok(Math.abs(floor)<1e-7,`${shoes}: foot height ${floor}`);
    }disposeAvatar(m);
  }
});

test('meditation lowers the hips to the seat and folds both shins inward with flat feet',async()=>{
  const {createAvatar,poseAvatar,disposeAvatar}=await modelModule;
  const {Vector3}=await import('three');
  for(const gender of ['male','female']){
    const m=createAvatar(config.defaults(gender));
    for(let i=0;i<40;i++)poseAvatar(m,{action:'sit'},i*.05,.05);
    m.root.position.y=m.postureOffset;m.root.updateMatrixWorld(true);
    assert.ok(m.postureOffset<-.5);
    for(let i=0;i<2;i++){
      const hip=m.legs[i].getWorldPosition(new Vector3()),knee=m.knees[i].getWorldPosition(new Vector3()),ankle=m.ankles[i].getWorldPosition(new Vector3());
      assert.ok(hip.y<.23);assert.ok(Math.abs(knee.x)>Math.abs(hip.x)+.2);
      assert.ok(Math.abs(ankle.x)<Math.abs(knee.x)-.25);
      const up=new Vector3(0,1,0).transformDirection(m.ankles[i].matrixWorld);assert.ok(up.y>.99);
    }
    const wrists=m.wrists.map(w=>w.getWorldPosition(new Vector3()));
    assert.ok(wrists[0].distanceTo(wrists[1])<.26,'forearms fold together across the chest');
    assert.ok(wrists.every(w=>w.y>.6&&w.z>.27),'hands stay in front of the torso');
    disposeAvatar(m);
  }
});

test('sofa sitting rests on the cushion with knees forward and lower legs hanging down',async()=>{
  const {createAvatar,poseAvatar,disposeAvatar}=await modelModule,{Vector3}=await import('three');
  const m=createAvatar(config.defaults());for(let i=0;i<40;i++)poseAvatar(m,{action:'sit',sofaSeatId:'sofa'},i*.05,.05);
  m.root.position.y=1.6+m.postureOffset;m.root.updateMatrixWorld(true);
  assert.ok(Math.abs(m.root.position.y+.595-1.6)<1e-6);
  for(let i=0;i<2;i++){const hip=m.legs[i].getWorldPosition(new Vector3()),knee=m.knees[i].getWorldPosition(new Vector3()),ankle=m.ankles[i].getWorldPosition(new Vector3());assert.ok(knee.z>hip.z+.3);assert.ok(ankle.y<knee.y-.28);}
  disposeAvatar(m);
});
