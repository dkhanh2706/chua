// One local timeline drives the eyes and hands for an accepted ritual.
export function eyePose(player, now, gentle = true) {
  const seated = player.action === 'sit';
  const ritual = player.ritual;
  const progress = ritual ? (now - ritual.start) / 1500 : -1;
  const active = progress >= 0 && progress < 1;
  const curve = active ? Math.sin(Math.PI * progress) ** 2 : 0;
  const visual = player.visualMotion;
  const bow = active && ritual.kind === 'bow' ? (visual?.bow ?? curve) : 0;
  const incense = active && ritual.kind === 'incense';
  const rise = active ? progress * progress * (3 - 2 * progress) : 1;
  const height = visual ? 2.02-.54*visual.sit : active && ritual.fromSit ? 1.48 + .54 * rise : seated ? 1.48 : 2.02;
  const offering = incense ? (visual?.incense ?? curve) : 0;
  return {
    height: height - bow * (gentle ? .85 : 1.37) - offering * .15,
    pitch: bow * (gentle ? .78 : 1.15) + offering * .16,
    prayer: active&&ritual.kind==='bow'?(visual?.prayer ?? bow):0,
    incense,
    stickVisible:incense&&progress<.84,
    lift: Math.pow(offering,.65),
    seated:visual?visual.sit>.5:seated,
  };
}
