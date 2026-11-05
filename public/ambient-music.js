(function(root){
  const BEAT=60/66;
  const CHORDS=[[48,52,55,59],[45,48,52,55],[41,45,48,52],[43,50,55,57]];
  const MELODY=[72,null,76,79,null,76,74,null,72,76,null,79,83,null,79,76,
    69,null,72,76,null,74,72,null,67,71,null,74,79,null,74,71];
  const frequency=note=>440*2**((note-69)/12);

  // An original, quiet 66 BPM arrangement: warm pads, soft keys and a sparse bass.
  class TempleAmbientMusic{
    constructor(context,output){
      this.ctx=context;this.output=context.createGain();this.output.gain.value=.64;this.output.connect(output);
      this.voices=new Set();this.timer=null;this.nextBeat=0;this.step=0;this.playing=false;
      const tone=context.createBiquadFilter();tone.type='lowpass';tone.frequency.value=1900;tone.Q.value=.45;tone.connect(this.output);this.tone=tone;
      const echo=context.createDelay(2);echo.delayTime.value=BEAT*.75;
      const feedback=context.createGain();feedback.gain.value=.23;
      const echoTone=context.createBiquadFilter();echoTone.type='lowpass';echoTone.frequency.value=1100;
      const wet=context.createGain();wet.gain.value=.18;
      tone.connect(echo);echo.connect(echoTone);echoTone.connect(wet);wet.connect(this.output);echoTone.connect(feedback);feedback.connect(echo);
      this.feedback=feedback;this.wet=wet;
    }
    note(note,start,duration,gain,pad=false,pan=0){
      const c=this.ctx,osc=c.createOscillator(),envelope=c.createGain(),stereo=c.createStereoPanner();
      osc.type=pad?'triangle':'sine';osc.frequency.value=frequency(note);osc.detune.value=pad?(note%3-1)*3:0;
      const attack=pad?1.8:.018,release=pad?2.4:2.1,end=start+duration+release;
      envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(gain,start+attack);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,gain*(pad?.7:.3)),start+duration);
      envelope.gain.exponentialRampToValueAtTime(.0001,end);envelope.gain.linearRampToValueAtTime(0,end+.03);
      stereo.pan.value=pan;osc.connect(envelope);envelope.connect(stereo);stereo.connect(this.tone);
      const voice={osc,envelope,stereo};this.voices.add(voice);
      osc.onended=()=>{osc.disconnect();envelope.disconnect();stereo.disconnect();this.voices.delete(voice);};
      osc.start(start);osc.stop(end+.04);
    }
    schedule(){
      if(!this.playing)return;
      // Resume gently after timer throttling, without stacking missed notes.
      if(this.nextBeat<this.ctx.currentTime-.2)this.nextBeat=this.ctx.currentTime+.08;
      while(this.nextBeat<this.ctx.currentTime+1.1){
        const step=this.step%32,chord=CHORDS[Math.floor(step/8)],t=this.nextBeat;
        if(step%8===0){chord.forEach((note,i)=>this.note(note,t+i*.045,BEAT*8,.044,true,(i-1.5)*.22));this.note(chord[0]-12,t,BEAT*3,.095);}
        if(MELODY[step]!==null)this.note(MELODY[step],t+.08,BEAT*1.65,step%4===0?.15:.105,false,Math.sin(step*.8)*.32);
        this.step++;this.nextBeat+=BEAT;
      }
    }
    start(){
      if(this.playing)return;this.playing=true;this.step=0;this.nextBeat=this.ctx.currentTime+.08;
      this.feedback.gain.value=.23;this.wet.gain.value=.18;this.schedule();this.timer=setInterval(()=>this.schedule(),250);
    }
    stop(){
      this.playing=false;clearInterval(this.timer);this.timer=null;
      this.feedback.gain.value=0;this.wet.gain.value=0;
      const t=this.ctx.currentTime;
      for(const {osc,envelope} of this.voices){envelope.gain.cancelScheduledValues(t);envelope.gain.setTargetAtTime(0,t,.02);try{osc.stop(t+.08);}catch{}}
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={BEAT,CHORDS,MELODY,frequency};
  else root.TempleAmbientMusic=TempleAmbientMusic;
})(typeof window!=='undefined'?window:globalThis);
