window.TempleSound = class {
  constructor(){this.ctx=null;this.enabled=false;this.nextBird=0;this.lastWater=0;this.sources=[];this.listener={x:0,y:2,z:0,yaw:0};this.voices=new Set();this.onBird=null;}
  async start(enabled=true){
    if(!this.ctx){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      this.ctx=new Audio();const c=this.ctx;
      this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
      const buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);
      let brown=0;for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown*6;}
      const source=c.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=850;filter.Q.value=.35;
      this.water=c.createGain();this.water.gain.value=.18;source.connect(filter);filter.connect(this.water);this.water.connect(this.master);source.start();
      const lfo=c.createOscillator(),lfoGain=c.createGain();lfo.frequency.value=.28;lfoGain.gain.value=.04;lfo.connect(lfoGain);lfoGain.connect(this.water.gain);lfo.start();
    }
    try{await this.ctx.resume();}catch{}
    this.setEnabled(enabled);
  }
  setEnabled(enabled){this.enabled=enabled;if(this.ctx){this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setTargetAtTime(enabled?.32:0,this.ctx.currentTime,enabled?.12:.02);if(!enabled)for(const voice of [...this.voices])voice.cancel();}}
  setGardenSources(sources){this.sources=Array.isArray(sources)?sources.filter(s=>Number.isFinite(s.position?.x)&&Number.isFinite(s.position?.z)):[];}
  update(time,x,y,yaw=0){
    if(!this.ctx||!this.enabled)return;
    Object.assign(this.listener,{x:(x-500)/10,y:(typeof groundHeight==='function'?groundHeight(x,y):0)+2,z:(y-350)/10,yaw});
    if(time-this.lastWater>.15){this.lastWater=time;const distance=Math.abs(x-riverX(y));this.water.gain.setTargetAtTime(.08+.45*Math.exp(-distance/180),this.ctx.currentTime,.4);}
    if(time>this.nextBird){this.nextBird=time+5+Math.random()*7;const index=Math.floor(Math.random()*this.sources.length);this.bird(this.sources[index]);if(this.sources.length>1&&Math.random()<.3)this.bird(this.sources[(index+1)%this.sources.length],.7+Math.random()*.6);}
  }
  bird(source,delay=0){
    if(!this.ctx||!this.enabled||this.voices.size>=3)return;
    const c=this.ctx,s=source||{id:'ambient',position:{x:this.listener.x+12,y:6,z:this.listener.z-18},voice:'whistle'};
    const notes=TempleBirdsong.phrase(s.voice),spatial=TempleBirdsong.spatial(s.position,this.listener),start=c.currentTime+delay;
    const output=c.createGain();output.gain.value=spatial.gain;const panner=c.createStereoPanner?.();if(panner){panner.pan.value=spatial.pan;output.connect(panner);panner.connect(this.master);}else output.connect(this.master);
    const nodes=[],voice={remaining:notes.length,cancel:()=>{for(const node of nodes)try{node.stop();}catch{}output.disconnect();panner?.disconnect();this.voices.delete(voice);}};this.voices.add(voice);
    for(const note of notes){
      const t=start+note.at,end=t+note.duration,carrier=c.createOscillator(),gain=c.createGain(),vibrato=c.createOscillator(),depth=c.createGain(),harmonic=c.createOscillator(),harmonicGain=c.createGain();
      carrier.type='sine';carrier.frequency.setValueAtTime(note.from,t);carrier.frequency.exponentialRampToValueAtTime(note.to,t+note.duration*.4);carrier.frequency.exponentialRampToValueAtTime(note.end,end);
      vibrato.frequency.value=note.trill;depth.gain.value=s.voice==='warble'?65:15;vibrato.connect(depth);depth.connect(carrier.frequency);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.115,t+.014);gain.gain.exponentialRampToValueAtTime(.001,end);carrier.connect(gain);gain.connect(output);
      harmonic.frequency.setValueAtTime(note.from*2.02,t);harmonic.frequency.exponentialRampToValueAtTime(note.end*2.02,end);harmonicGain.gain.setValueAtTime(.004,t);harmonicGain.gain.exponentialRampToValueAtTime(.0001,end);harmonic.connect(harmonicGain);harmonicGain.connect(output);
      nodes.push(carrier,vibrato,harmonic);carrier.onended=()=>{carrier.disconnect();gain.disconnect();vibrato.disconnect();depth.disconnect();harmonic.disconnect();harmonicGain.disconnect();if(--voice.remaining===0){output.disconnect();panner?.disconnect();this.voices.delete(voice);}};
      for(const o of [carrier,vibrato,harmonic]){o.start(t);o.stop(end+.025);}
    }
    const duration=Math.max(...notes.map(n=>n.at+n.duration));this.onBird?.({id:s.id,delay,duration,gain:spatial.gain,pan:spatial.pan});
  }
  bell(distance=0){
    if(!this.ctx||!this.enabled)return;const c=this.ctx;
    for(const frequency of [880,1762,2639]){const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.frequency.value=frequency;g.gain.setValueAtTime(.09*Math.exp(-distance/700),t);g.gain.exponentialRampToValueAtTime(.001,t+2);o.connect(g);g.connect(this.master);o.start();o.stop(t+2);}
  }
  footstep(surface='stone'){
    if(!this.ctx||!this.enabled)return;const c=this.ctx,t=c.currentTime;
    const buffer=c.createBuffer(1,Math.floor(c.sampleRate*.065),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(data.length*.22));
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=surface==='wood'?500:surface==='grass'?1400:950;
    gain.gain.setValueAtTime(surface==='grass'?.035:.055,t);gain.gain.exponentialRampToValueAtTime(.001,t+.065);source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(t);source.stop(t+.07);
  }
};
