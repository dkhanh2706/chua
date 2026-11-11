(function(root){
  const styles={
    shirt:['tunic','long','short'],pants:['straight','wide','shorts'],shoes:['slipon','sneakers','sandals'],
    hair:['bald','short','side','bob','ponytail','braids','long'],hairAccessory:['none','bow','clip']
  };
  const labels={shirt:{tunic:'Áo lam',long:'Áo dài tay',short:'Áo ngắn tay'},pants:{straight:'Quần suông',wide:'Quần rộng',shorts:'Quần lửng'},shoes:{slipon:'Giày vải',sneakers:'Giày thể thao',sandals:'Dép quai'},hair:{bald:'Đầu trọc',short:'Tóc ngắn',side:'Tóc rẽ ngôi',bob:'Tóc bob',ponytail:'Đuôi ngựa',braids:'Hai bím',long:'Tóc dài'},hairAccessory:{none:'Không đeo',bow:'Nơ',clip:'Kẹp tóc'}};
  function defaults(gender='male'){
    const female=gender==='female';
    return {gender:female?'female':'male',shirt:'tunic',pants:'straight',shoes:'slipon',hair:female?'ponytail':'short',necklace:false,hairAccessory:'none',colors:{shirt:female?'#b98288':'#7c927e',pants:'#47524c',shoes:'#54483e',shoeTrim:'#e9e5d9',hair:'#332c29',hairTie:'#667959',skin:'#e4b795',necklace:'#b89a58',hairAccessory:'#d59b9c'}};
  }
  const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  const characterCode=value=>typeof value==='string'?value.normalize('NFC').trim().toLowerCase():'';
  const characterCodes=Object.freeze({tom:'tom','chồn':'doraemon'});
  const specialCharacter=value=>{const code=characterCode(value);return Object.hasOwn(characterCodes,code)?characterCodes[code]:undefined;};
  function withCharacterCode(avatar,code){
    const result=normalize(avatar);
    delete result.special;
    const special=specialCharacter(code);if(special)result.special=special;
    return result;
  }
  function normalize(input,legacyCharacter=0,legacyColor){
    const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
    const result=defaults(raw.gender==='female'||raw.gender===undefined&&legacyCharacter===1?'female':'male');
    if(Object.values(characterCodes).includes(raw.special))result.special=raw.special;
    for(const key of Object.keys(styles))if(styles[key].includes(raw[key]))result[key]=raw[key];
    result.necklace=raw.necklace===true;
    for(const key of Object.keys(result.colors))if(validColor(raw.colors?.[key]))result.colors[key]=raw.colors[key].toLowerCase();
    if(!raw.colors?.shirt&&validColor(legacyColor))result.colors.shirt=legacyColor.toLowerCase();
    if(result.gender==='male')result.hairAccessory='none';
    return result;
  }
  const api={styles,labels,defaults,normalize,validColor,characterCode,specialCharacter,withCharacterCode};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AvatarConfig=api;
})(typeof window!=='undefined'?window:globalThis);
