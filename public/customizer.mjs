const {defaults,normalize,styles,labels,validColor}=window.AvatarConfig;
const parts=[['shirt','Áo'],['pants','Quần'],['shoes','Giày'],['hair','Tóc'],['accessories','Phụ kiện'],['skin','Da']];
const colorLabels={shirt:'Màu áo',pants:'Màu quần',shoes:'Màu giày',shoeTrim:'Màu đế / dây giày',hair:'Màu tóc',hairTie:'Màu dây buộc tóc',skin:'Màu da',necklace:'Màu dây chuyền',hairAccessory:'Màu nơ / kẹp tóc'};
const palette=['#87966f','#b68183','#8cabc0','#d4b76b','#704d3a','#e6d9c2','#343a38','#c3a5c7'];
const $=id=>document.getElementById(id);
export class Customizer{
  constructor(view){
    this.view=view;this.gender='male';this.drafts={male:defaults('male'),female:defaults('female')};this.part='shirt';this.degrees=0;
    try{const saved=JSON.parse(localStorage.getItem('temple-avatars'));if(saved){for(const gender of ['male','female'])this.drafts[gender]=normalize({...saved[gender],gender});this.gender=saved.selected==='female'?'female':'male';}}catch{}
    for(const[part,label]of parts){const b=document.createElement('button');b.type='button';b.id='tab-'+part;b.setAttribute('role','tab');b.setAttribute('aria-controls','custom-panel');b.textContent=label;b.onclick=()=>{this.part=part;this.renderPanel();};b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let i=parts.findIndex(p=>p[0]===this.part);i=e.key==='Home'?0:e.key==='End'?parts.length-1:(i+(e.key==='ArrowRight'?1:-1)+parts.length)%parts.length;this.part=parts[i][0];this.renderPanel();$('tab-'+this.part).focus();};$('part-tabs').append(b);}
    document.querySelectorAll('[data-gender]').forEach(b=>b.onclick=()=>{this.gender=b.dataset.gender;this.refreshGender();this.renderPanel();this.commit();});
    $('avatar-rotation').oninput=e=>this.rotate(Number(e.target.value));$('rotate-left').onclick=()=>this.rotate((this.degrees+315)%360);$('rotate-right').onclick=()=>this.rotate((this.degrees+45)%360);
    if(this.view)this.view.studio.onActionChange=action=>document.querySelectorAll('[data-preview-action]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewAction===action)));
    document.querySelectorAll('[data-preview-action]').forEach(button=>button.onclick=()=>this.view?.studio.setAction(button.dataset.previewAction));
    const canvas=$('canvas');let pointer=null,lastX=0;
    canvas.addEventListener('pointerdown',e=>{if(document.body.classList.contains('playing'))return;pointer=e.pointerId;lastX=e.clientX;canvas.setPointerCapture(pointer);});
    canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId||document.body.classList.contains('playing'))return;this.rotate((this.degrees+(e.clientX-lastX)*.7+360)%360);lastX=e.clientX;});
    const stop=e=>{if(pointer===e.pointerId)pointer=null;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);
    $('character-code').addEventListener('input',()=>this.commit());
    this.refreshGender();this.renderPanel();this.commit();
  }
  get value(){return this.drafts[this.gender];}
  rotate(degrees){this.degrees=degrees;this.view?.studio.rotate(degrees*Math.PI/180);$('avatar-rotation').value=Math.round(degrees);$('rotation-value').textContent=Math.round(degrees)+'°';}
  refreshGender(){document.querySelectorAll('[data-gender]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gender===this.gender)));}
  commit(){this.drafts[this.gender]=normalize(this.value);const code=window.AvatarConfig.characterCode($('character-code').value),special=window.AvatarConfig.specialCharacter(code);this.view?.studio.setAppearance(window.AvatarConfig.withCharacterCode(this.value,code));$('character-code-hint').textContent=special==='doraemon'?'Đã chọn Doraemon.':special?'Đã chọn nhân vật đặc biệt.':code?'Chưa có nhân vật với mã này.':'Để trống để dùng nhân vật đã chọn.';try{localStorage.setItem('temple-avatars',JSON.stringify({...this.drafts,selected:this.gender}));}catch{}}
  styleField(part,label){
    const field=document.createElement('label');field.className='style-field';const text=document.createElement('span');text.textContent=label;const select=document.createElement('select');select.id='style-'+part;select.setAttribute('aria-label',label);
    for(const value of styles[part]){const option=document.createElement('option');option.value=value;option.textContent=labels[part][value];select.append(option);}select.value=this.value[part];select.onchange=()=>{this.value[part]=select.value;this.commit();if(part==='hair'||part==='shoes')this.renderPanel();};field.append(text,select);$('custom-panel').append(field);
  }
  colorField(part){
    const field=document.createElement('div');field.className='color-field';const row=document.createElement('div');row.className='color-field-row';const label=document.createElement('label');label.htmlFor='color-'+part;label.textContent=colorLabels[part];
    const input=document.createElement('input');input.type='color';input.id='color-'+part;input.value=this.value.colors[part];input.setAttribute('aria-label',colorLabels[part]);
    const hex=document.createElement('input');hex.type='text';hex.className='hex-color';hex.maxLength=7;hex.value=input.value;hex.setAttribute('aria-label','Mã '+colorLabels[part].toLowerCase());hex.spellcheck=false;hex.autocomplete='off';
    const swatches=document.createElement('div');swatches.className='color-presets';swatches.setAttribute('role','group');swatches.setAttribute('aria-label','Màu nhanh cho '+colorLabels[part].toLowerCase());
    const update=value=>{if(!validColor(value))return;this.value.colors[part]=value.toLowerCase();input.value=value;hex.value=value.toUpperCase();hex.removeAttribute('aria-invalid');this.commit();for(const b of swatches.children)b.setAttribute('aria-pressed',String(b.dataset.color===value.toLowerCase()));};
    input.oninput=()=>update(input.value);hex.oninput=()=>{if(validColor(hex.value))update(hex.value);else hex.setAttribute('aria-invalid','true');};hex.onblur=()=>{if(!validColor(hex.value)){hex.value=input.value;hex.removeAttribute('aria-invalid');}};
    palette.forEach(color=>{const b=document.createElement('button');b.type='button';b.style.setProperty('--swatch',color);b.dataset.color=color;b.setAttribute('aria-label',color);b.setAttribute('aria-pressed',String(color===input.value));b.onclick=()=>update(color);swatches.append(b);});
    row.append(label,input,hex);field.append(row,swatches);$('custom-panel').append(field);
  }
  renderPanel(){
    for(const[part]of parts){const tab=$('tab-'+part),selected=part===this.part;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    $('custom-panel').replaceChildren();$('custom-panel').setAttribute('aria-labelledby','tab-'+this.part);
    if(this.part==='accessories'){
      const row=document.createElement('label');row.className='necklace-toggle';const title=document.createElement('span');title.textContent='Đeo dây chuyền';const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='necklace';toggle.checked=this.value.necklace;toggle.onchange=()=>{this.value.necklace=toggle.checked;this.commit();};row.append(title,toggle);$('custom-panel').append(row);this.colorField('necklace');
      if(this.gender==='female'){this.styleField('hairAccessory','Phụ kiện tóc');this.colorField('hairAccessory');}
    }else{if(this.part!=='skin')this.styleField(this.part,'Kiểu '+({shirt:'áo',pants:'quần',shoes:'giày',hair:'tóc'}[this.part]));this.colorField(this.part);if(this.part==='hair'&&['ponytail','braids'].includes(this.value.hair))this.colorField('hairTie');if(this.part==='shoes'&&this.value.shoes==='sneakers')this.colorField('shoeTrim');}
  }
}
