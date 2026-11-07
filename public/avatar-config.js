(function(root){
  const styles={
    shirt:['tunic','long','short'],pants:['straight','wide','shorts'],shoes:['slipon','sneakers','sandals'],
    hair:['bald','short','side','bob','ponytail','braids','long'],hairAccessory:['none','bow','clip']
  };
  const labels={shirt:{tunic:'Áo lam',long:'Áo dài tay',short:'Áo ngắn tay'},pants:{straight:'Quần suông',wide:'Quần rộng',shorts:'Quần lửng'},shoes:{slipon:'Giày vải',sneakers:'Giày thể thao',sandals:'Dép quai'},hair:{bald:'Đầu trọc',short:'Tóc ngắn',side:'Tóc rẽ ngôi',bob:'Tóc bob',ponytail:'Đuôi ngựa',braids:'Hai bím',long:'Tóc dài'},hairAccessory:{none:'Không đeo',bow:'Nơ',clip:'Kẹp tóc'}};
  function defaults(gender='male'){
    const female=gender==='female';
    return {gender:female?'female':'male',shirt:'tunic',pants:'straight',shoes:'slipon',hair:female?'ponytail':'short',necklace:false,hairAccessory:'none',colors:{shirt:female?'#b68183':'#87966f',pants:'#656d60',shoes:'#68594d',shoeTrim:'#e6dfca',hair:'#443a32',hairTie:'#667959',skin:'#e6bd99',necklace:'#b89a58',hairAccessory:'#d59b9c'}};
  }
  const validColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  const characterCode=value=>typeof value==='string'?value.trim().toLowerCase():'';
  function withCharacterCode(avatar,code){
    const result=normalize(avatar);
    delete result.special;
    if(characterCode(code)==='tom')result.special='tom';
    return result;
  }
  function normalize(input,legacyCharacter=0,legacyColor){
    const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
    const result=defaults(raw.gender==='female'||raw.gender===undefined&&legacyCharacter===1?'female':'male');
    if(raw.special==='tom')result.special='tom';
    for(const key of Object.keys(styles))if(styles[key].includes(raw[key]))result[key]=raw[key];
    result.necklace=raw.necklace===true;
    for(const key of Object.keys(result.colors))if(validColor(raw.colors?.[key]))result.colors[key]=raw.colors[key].toLowerCase();
    if(!raw.colors?.shirt&&validColor(legacyColor))result.colors.shirt=legacyColor.toLowerCase();
    if(result.gender==='male')result.hairAccessory='none';
    return result;
  }
  const api={styles,labels,defaults,normalize,validColor,characterCode,withCharacterCode};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AvatarConfig=api;
})(typeof window!=='undefined'?window:globalThis);
