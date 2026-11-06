import {populationSummary,ageYears,allPeople} from '/packages/sim-core/src/demographics.ts';
const element=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
export function renderFamilies(world){
  const list=document.getElementById('families'),count=document.getElementById('family-count');
  list.replaceChildren();const summary=populationSummary(world);
  if(!summary){count.textContent='—';list.append(element('p','这个世界保留旧引擎规则，未启用年龄与家庭模型。','muted'));return;}
  count.textContent=summary.families;
  const ages=element('div',undefined,'age-summary');
  for(const [name,value]of [['儿童 0–11 岁',summary.children],['青少年 12–17 岁',summary.youth],['成人 18–59 岁',summary.adults],['长者 60 岁起',summary.elders]]){const row=element('div');row.append(element('span',name),element('strong',String(value)));ages.append(row);}
  list.append(ages,element('p',`累计新增 ${summary.births} 人 · 离世 ${summary.deaths} 人`,'muted'));
  const agents=new Map(allPeople(world).map(a=>[a.id,a]));
  for(const family of world.families.filter(f=>f.members.some(id=>agents.get(id)?.alive))){
    const card=element('article',undefined,'family-card');card.append(element('strong',family.name));
    card.append(element('small',`家庭伙伴：${family.parents.map(id=>agents.get(id)?.name).join('、')}`));
    if((world.engine==='0.4.5'||world.engine==='0.4.6'))card.append(element('small',`家庭口粮 ${family.food??0}/24`));
    for(const id of family.members){const a=agents.get(id);if(!a)continue;const member=element('p',`${a.name} · ${ageYears(world,a)} 岁${a.alive?'':' · 已离世'}`);if(a.parents.length)member.append(element('small',`父母：${a.parents.map(id=>agents.get(id)?.name).join('、')}`));card.append(member);}
    list.append(card);
  }
  if(!summary.families)list.append(element('p','成年居民在完工住房内建立家庭后，关系与代际变化会出现在这里。','muted'));
}
