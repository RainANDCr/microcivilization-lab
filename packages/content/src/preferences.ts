export type Theme='dark'|'light'|'dusk';
export type Preferences={version:1;theme:Theme;reduced:boolean;sound:boolean};
export const preferencesKey='mc-preferences';
function theme(value:unknown):Theme{return value==='light'||value==='dusk'?value:'dark';}
export function readPreferences(storage:Pick<Storage,'getItem'>):Preferences{
  try{
    const raw=storage.getItem(preferencesKey);
    if(raw){
      const value=JSON.parse(raw);
      if(value?.version===1)return {version:1,theme:theme(value.theme),reduced:value.reduced===true,sound:value.sound===true};
    }
    return {version:1,theme:theme(storage.getItem('mc-theme')),reduced:storage.getItem('mc-reduced')==='true',sound:false};
  }catch{return {version:1,theme:'dark',reduced:false,sound:false};}
}
