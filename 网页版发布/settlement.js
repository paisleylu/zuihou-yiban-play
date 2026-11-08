'use strict';
function formatRunTime(seconds){
 const total=Math.max(0,Math.floor(Number(seconds)||0));
 return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
}
function renderSettlement(won,run){
 const byId=id=>document.getElementById(id);
 const panel=byId('end');
 panel.dataset.result=won?'won':'lost';
 byId('resultDifficulty').textContent=run.rules.name+'难度';
 document.body.classList.add('result-open');
 byId('endLabel').textContent=won?'ESCAPED / 第一章完成':'CAUGHT / 本次探索结束';
 byId('endHeading').textContent=won?'你赶上了最后一班。':'他找到你了。';
 byId('resultStatus').textContent=won?'成功逃离':'未能逃离';
 byId('endStory').textContent=won?'出口亮了。你走出办公楼，远处传来公交车的声音。这一次，你没有回头。':'脚步声停在身后。下次关掉手电、放慢脚步，换一条路再试一次。';
 byId('resultPowerRow').hidden=!run.hardObjectives;byId('resultPower').textContent=run.breakers.filter(b=>b.done).length+' / 2';
 if(!won&&run.lossReason==='power'){byId('endLabel').textContent='BLACKOUT / 应急电源耗尽';byId('endHeading').textContent='出口又暗了。';byId('endStory').textContent='应急电源耗尽，出口重新锁住。下次先记好回大厅的路线，再复位最后一处断路器。';}
 byId('resultTime').textContent=formatRunTime(run.elapsed);
 byId('resultFuses').textContent=run.collected+' / 3';
 byId('resultBattery').textContent=Math.ceil(Math.max(0,Math.min(100,run.battery)))+'%';
 byId('resultChapter').textContent=won?'第一章已完成，本版本到此结束。':'本次探索结束，你可以重新挑战。';
 byId('retry').textContent=won?'再挑战一次':'重新开始';
 byId('back').textContent='返回主菜单';
 const record=byId('resultRecord');
 record.textContent=won?'通关记录已结算':run.lossReason==='power'?'提示：60秒倒计时包含最后2秒的开门操作。':'提示：冲刺会暴露位置，慢走更安静。';
 if(won){
  try{
   const key=run.difficulty==='hell'?'nightshift-best-time-hell-v2':'nightshift-best-time';
   const previous=localStorage.getItem(key),value=previous===null?null:Number(previous);
   const valid=value!==null&&Number.isFinite(value)&&value>=0;
   const best=valid?Math.min(value,run.elapsed):run.elapsed;
   localStorage.setItem(key,String(best));
   record.textContent=(!valid?'首次通关':run.elapsed<value?'刷新个人最佳':'个人最佳')+' · '+formatRunTime(best);
  }catch(e){record.textContent='本次通关用时 · '+formatRunTime(run.elapsed);}
 }
 panel.classList.remove('hidden');
 byId('retry').focus({preventScroll:true});
}
function clearSettlement(){document.body.classList.remove('result-open');}
