import * as THREE from 'three';

// Portraits stay on this browser; each statue has its own image and material.
export function setupStatuePortraits(statues){
  const dialog=document.getElementById('statue-portraits');
  const status=dialog.querySelector('[role="status"]');
  const shapes=statues.map(statue=>{
    const shape=new THREE.Shape();shape.absellipse(0,0,.51,.66,0,Math.PI*2,false);
    const face=new THREE.Mesh(new THREE.ShapeGeometry(shape,64),new THREE.MeshStandardMaterial({roughness:.78}));
    face.name='statue-portrait';face.position.set(0,4.12,.695);face.visible=false;statue.add(face);
    return face;
  });
  const apply=async(index,url)=>{
    const face=shapes[index];
    const texture=url?await new THREE.TextureLoader().loadAsync(url):null;
    if(texture)texture.colorSpace=THREE.SRGBColorSpace;
    face.material.map?.dispose();face.material.map=texture;face.material.needsUpdate=true;
    face.visible=!!texture;statues[index].getObjectByName('sculpted-face').visible=!texture;
    const preview=dialog.querySelector(`[data-portrait-preview="${index}"]`);
    preview.hidden=!url;if(url)preview.src=url;else preview.removeAttribute('src');
  };
  const key=index=>`temple-statue-portrait-${index}`;
  statues.forEach((_,index)=>{
    try{const saved=localStorage.getItem(key(index));if(saved)apply(index,saved).catch(()=>{status.textContent='Không đọc được ảnh đã lưu. Bạn có thể chọn ảnh khác.';});}catch{}
    const input=dialog.querySelector(`[data-portrait-input="${index}"]`);
    input.addEventListener('change',async()=>{
      const file=input.files[0];if(!file)return;
      status.textContent='Đang chuẩn bị ảnh…';
      let bitmap;
      try{
        if(!file.type.startsWith('image/'))throw new Error('image');
        bitmap=await createImageBitmap(file);
        const canvas=document.createElement('canvas');canvas.width=384;canvas.height=496;
        const context=canvas.getContext('2d');
        const scale=Math.max(canvas.width/bitmap.width,canvas.height/bitmap.height);
        context.drawImage(bitmap,(canvas.width-bitmap.width*scale)/2,(canvas.height-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);
        const url=canvas.toDataURL('image/jpeg',.88);
        await apply(index,url);
        try{localStorage.setItem(key(index),url);status.textContent='Đã lưu ảnh trên trình duyệt này.';}
        catch{status.textContent='Đã thay ảnh. Trình duyệt không cho lưu, ảnh sẽ mất khi tải lại trang.';}
      }catch{status.textContent='Không đọc được ảnh. Hãy chọn ảnh JPG, PNG hoặc WebP.';}
      finally{bitmap?.close();input.value='';}
    });
    dialog.querySelector(`[data-portrait-reset="${index}"]`).addEventListener('click',async()=>{
      input.value='';await apply(index,null);
      try{localStorage.removeItem(key(index));status.textContent='Đã khôi phục khuôn mặt tượng.';}
      catch{status.textContent='Đã khôi phục. Trình duyệt không cho cập nhật ảnh đã lưu.';}
    });
  });
  document.getElementById('statue-portraits-open').addEventListener('click',()=>dialog.showModal());
  dialog.querySelector('[data-portraits-close]').addEventListener('click',()=>dialog.close());
}
