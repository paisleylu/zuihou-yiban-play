'use strict';
const DIFFICULTIES=Object.freeze({
  standard:Object.freeze({name:'标准',battery:100,drain:.48,charge:22,recharge:2.5,rechargeCap:38,staminaDrain:32,staminaRegen:17,recoverAt:25,awake:false,grace:6,lampRange:7.2,walkRange:3.5,quietRange:2,stillRange:1.4,hearing:10,memory:5,pickupMemory:8,chase:1.28,chaseBonus:.05,investigate:.68,patrol:.68,chaseRepath:.3,repath:.9}),
  hell:Object.freeze({name:'地狱',battery:65,drain:1.6,charge:6,recharge:0,rechargeCap:0,staminaDrain:45,staminaRegen:9,recoverAt:35,awake:true,grace:4,lampRange:10.5,walkRange:4.5,quietRange:1.2,stillRange:1,hearing:14,memory:8,pickupMemory:12,chase:1.8,chaseBonus:.12,investigate:1.25,patrol:1.05,chaseRepath:.18,repath:.55})
});
class NightShiftGame {
  constructor(difficulty='standard') { this.reset(difficulty); }
  reset(difficulty=this.difficulty) {
    this.difficulty=Object.prototype.hasOwnProperty.call(DIFFICULTIES,difficulty)?difficulty:'standard';
    this.rules=DIFFICULTIES[this.difficulty];
    this.hardObjectives=this.difficulty==='hell';
    this.width=22; this.height=20;
    this.map=Array.from({length:this.height},()=>Array(this.width).fill(1));
    const room=(x1,y1,x2,y2)=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)this.map[y][x]=0;};
    room(1,13,7,18); room(1,1,6,6); room(14,1,20,7); room(13,12,20,18); room(8,7,12,12);
    room(3,5,3,15); room(3,8,18,8); room(17,5,17,15); room(10,8,10,16); room(6,16,17,16);
    this.player={x:3.5,y:16.5,angle:-Math.PI/2};
    this.fuses=[{x:3.5,y:2.5,name:'库房',taken:false},{x:18.5,y:3.5,name:'配电间',taken:false},{x:18.5,y:16.5,name:'档案室',taken:false}];
    this.exit={x:1.7,y:17.5};
    this.breakers=this.hardObjectives?[{x:5.5,y:4.5,name:'库房',done:false},{x:19.5,y:6.5,name:'配电间',done:false}]:[];
    this.action=null;this.escapeRemaining=null;this.lossReason=null;this.explored=new Set();
    this.enemy={x:10.5,y:9.5,active:false,state:'patrol',alert:0,grace:0,path:[],repath:0,target:null,patrolIndex:0};
    this.patrol=[{x:10.5,y:9.5},{x:17.5,y:8.5},{x:17.5,y:14.5},{x:10.5,y:16.5},{x:3.5,y:8.5}];
    this.lamp=true; this.battery=this.rules.battery; this.stamina=100; this.collected=0; this.elapsed=0;
    this.mode='ready'; this.events=[]; this.moving=false; this.running=false; this.crouching=false; this.exhausted=false; this.distanceWalked=0;
    this.revealMap();
  }
  start(){this.mode='playing';if(this.rules.awake){this.enemy.active=true;this.enemy.grace=this.rules.grace;}this.events.push({type:'message',text:this.difficulty==='hell'?'地狱模式：他已经醒了。关灯潜行，留体力逃跑。':'找到三枚保险丝，再回到大厅的出口。'});}
  wall(x,y){return !this.map[Math.floor(y)] || this.map[Math.floor(y)][Math.floor(x)]!==0;}
  clear(x,y,r=.19){return ![[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].some(p=>this.wall(...p));}
  move(actor,dx,dy,r=.19){if(this.clear(actor.x+dx,actor.y,r))actor.x+=dx;if(this.clear(actor.x,actor.y+dy,r))actor.y+=dy;}
  dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  visible(a,b){const d=this.dist(a,b),n=Math.ceil(d*12);for(let i=1;i<n;i++){const t=i/n;if(this.wall(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}return true;}
  pathTo(a,b){
    const sx=Math.floor(a.x),sy=Math.floor(a.y),tx=Math.floor(b.x),ty=Math.floor(b.y),key=(x,y)=>y*this.width+x;
    if(this.wall(tx+.5,ty+.5))return [];
    const queue=[[sx,sy]], parents=new Map([[key(sx,sy),null]]);let end=null;
    for(let i=0;i<queue.length;i++){const [x,y]=queue[i];if(x===tx&&y===ty){end=[x,y];break;}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(!this.wall(nx+.5,ny+.5)&&!parents.has(k)){parents.set(k,[x,y]);queue.push([nx,ny]);}}
    }
    if(!end)return [];const path=[];let cur=end;
    while(cur){path.push({x:cur[0]+.5,y:cur[1]+.5});cur=parents.get(key(...cur));}
    path.reverse();path.shift();return path;
  }
  toggleLamp(){if(this.mode!=='playing')return;this.lamp=!this.lamp&&this.battery>0;this.events.push({type:'switch'});}
  revealMap(){
    const radius=this.lamp?3.8:1.6,p=this.player;
    for(let y=Math.max(0,Math.floor(p.y-radius));y<Math.min(this.height,p.y+radius);y++)for(let x=Math.max(0,Math.floor(p.x-radius));x<Math.min(this.width,p.x+radius);x++){
      const tile={x:x+.5,y:y+.5};if(this.dist(p,tile)<=radius&&this.visible(p,tile))this.explored.add(y*this.width+x);
    }
  }
  discovered(obj){return !this.hardObjectives||this.explored.has(Math.floor(obj.y)*this.width+Math.floor(obj.x));}
  exitReady(){return this.collected===3&&this.breakers.every(b=>b.done);}
  get objective(){
    if(this.collected<3)return '找齐保险丝　'+this.collected+' / 3';
    if(!this.exitReady())return '复位断路器　'+this.breakers.filter(b=>b.done).length+' / 2';
    return this.hardObjectives?'限时逃离　'+Math.ceil(this.escapeRemaining)+' 秒':'回到大厅，打开出口';
  }
  interactionLabel(near=this.nearby()){
    if(this.action)return '取消'+(this.action.kind==='breaker'?'复位':'开门');
    if(!near)return '交互';
    if(near.kind==='fuse')return '拿起保险丝 · '+near.item.name;
    if(near.kind==='breaker')return this.collected<3?'断路器缺少保险丝':'复位断路器 · '+near.item.name+'（4秒）';
    return this.exitReady()?(this.hardObjectives?'打开出口（2秒）':'打开出口，离开这里'):'出口尚未供电';
  }
  nearby(){const p=this.player;const f=this.fuses.find(f=>!f.taken&&this.dist(p,f)<1.2&&this.visible(p,f));if(f)return {kind:'fuse',item:f};const b=this.breakers.find(b=>!b.done&&this.dist(p,b)<1.2&&this.visible(p,b));if(b)return {kind:'breaker',item:b};if(this.dist(p,this.exit)<1.3&&this.visible(p,this.exit))return {kind:'exit',item:this.exit};return null;}
  alertEnemy(){const e=this.enemy;if(!e.active)return;e.target={x:this.player.x,y:this.player.y};if(e.state!=='chase')e.state='investigate';e.alert=Math.max(e.alert,this.rules.pickupMemory);e.repath=0;}
  cancelAction(){if(!this.action)return;this.action=null;this.events.push({type:'message',text:'操作中断。需要站稳后重新开始。'});}
  beginAction(near,duration){this.action={kind:near.kind,item:near.item,progress:0,duration};this.alertEnemy();this.events.push({type:'message',text:near.kind==='breaker'?'复位中：站稳4秒。机械声会引来他。':'开门中：站稳2秒，别松懈。'});}
  advanceAction(dt){
    const a=this.action;if(!a)return;
    if(this.moving||this.dist(this.player,a.item)>1.3||!this.visible(this.player,a.item)){this.cancelAction();return;}
    a.progress+=dt;if(a.progress+1e-9<a.duration)return;
    this.action=null;
    if(a.kind==='exit'){this.mode='won';this.events.push({type:'won'});return;}
    a.item.done=true;this.alertEnemy();
    if(this.exitReady()){this.escapeRemaining=60;this.events.push({type:'alarm',text:'应急电源只能维持60秒！回大厅，站稳2秒打开出口！'});}
    else this.events.push({type:'message',text:a.item.name+'已复位。还需复位另一处断路器。'});
  }
  interact(){
    if(this.mode!=='playing')return;if(this.action){this.cancelAction();return;}const n=this.nearby();if(!n)return;
    if(n.kind==='fuse'){
      n.item.taken=true;this.collected++;this.battery=Math.min(100,this.battery+this.rules.charge);
      this.events.push({type:'pickup',text:this.collected===3?(this.hardObjectives?'保险丝齐了。去库房与配电间，各复位一处断路器。':'电源恢复了。回大厅，从出口离开！'):`找到 ${this.collected}/3 枚保险丝。那阵脚步声……更近了。`});
      if(!this.enemy.active){this.enemy.active=true;this.enemy.grace=this.rules.grace;}
      this.enemy.target={x:this.player.x,y:this.player.y};this.enemy.state='investigate';this.enemy.alert=this.rules.pickupMemory;this.enemy.repath=0;
    }else if(n.kind==='breaker'){
      if(this.collected<3)this.events.push({type:'message',text:'先找齐三枚保险丝，才能复位断路器。'});
      else this.beginAction(n,4);
    }else if(this.exitReady()){
      if(this.hardObjectives)this.beginAction(n,2);
      else{this.mode='won';this.events.push({type:'won'});}
    }else this.events.push({type:'message',text:this.collected<3?`出口还没有电。还差 ${3-this.collected} 枚保险丝。`:'出口还没有电。先复位库房与配电间的两处断路器。'});
  }
  step(dt,input={}){
    if(this.mode!=='playing')return;dt=Math.min(.05,Math.max(0,dt));this.elapsed+=dt;
    if(this.escapeRemaining!==null){this.escapeRemaining=Math.max(0,this.escapeRemaining-dt);if(this.escapeRemaining<=1e-9){this.mode='lost';this.lossReason='power';this.action=null;this.events.push({type:'lost'});return;}}
    const p=this.player,turn=(input.right?1:0)-(input.left?1:0);p.angle+=turn*dt*1.9;
    let forward=Number.isFinite(input.forwardAxis)?input.forwardAxis:(input.forward?1:0)-(input.backward?1:0),side=Number.isFinite(input.sideAxis)?input.sideAxis:(input.strafeRight?1:0)-(input.strafeLeft?1:0);
    const len=Math.hypot(forward,side);if(len>1){forward/=len;side/=len;}
    this.moving=len>0;this.crouching=!!input.crouch;
    const rules=this.rules;
    if(this.exhausted&&this.stamina>rules.recoverAt)this.exhausted=false;
    this.running=!!input.sprint&&this.moving&&!this.crouching&&!this.exhausted&&this.stamina>0;
    const speed=this.running?3.05:(this.crouching ? .86 : 1.65),ox=p.x,oy=p.y;
    this.move(p,(Math.cos(p.angle)*forward-Math.sin(p.angle)*side)*speed*dt,(Math.sin(p.angle)*forward+Math.cos(p.angle)*side)*speed*dt);
    this.distanceWalked+=Math.hypot(p.x-ox,p.y-oy);
    this.stamina=Math.max(0,Math.min(100,this.stamina+(this.running?-rules.staminaDrain:rules.staminaRegen)*dt));
    if(this.stamina===0)this.exhausted=true;
    if(this.lamp){this.battery=Math.max(0,this.battery-rules.drain*dt);if(this.battery===0){this.lamp=false;this.events.push({type:'message',text:this.difficulty==='hell'?'手电没电了。只有保险丝能补充电量。':'手电没电了。关灯片刻，会恢复一些电量。'});}}
    else if(this.battery<rules.rechargeCap)this.battery=Math.min(rules.rechargeCap,this.battery+rules.recharge*dt);
    this.revealMap();this.advanceAction(dt);if(this.mode!=='playing')return;
    const e=this.enemy;if(!e.active)return;
    if(e.grace>0){e.grace-=dt;return;}
    const distance=this.dist(e,p),sight=this.visible(e,p),detectRange=this.lamp?rules.lampRange:(this.moving?(this.crouching?rules.quietRange:rules.walkRange):rules.stillRange);
    if((sight&&distance<detectRange)||(this.running&&distance<rules.hearing)){
      if(e.state!=='chase')this.events.push({type:'chase'});
      e.state='chase';e.alert=rules.memory;e.target={x:p.x,y:p.y};
    }else if(e.alert>0){e.alert-=dt;if(e.state==='chase')e.state='investigate';}
    else{e.state='patrol';if(!e.target||this.dist(e,e.target)<.45){e.patrolIndex=(e.patrolIndex+1)%this.patrol.length;e.target=this.patrol[e.patrolIndex];}}
    e.repath-=dt;
    if(e.repath<=0){e.path=this.pathTo(e,e.target||p);e.repath=e.state==='chase'?rules.chaseRepath:rules.repath;}
    while(e.path.length&&this.dist(e,e.path[0])<.14)e.path.shift();
    const next=e.path[0]||(e.target&&sight?e.target:null);
    if(next){const d=this.dist(e,next);if(d>.01){const speed=e.state==='chase'?rules.chase+rules.chaseBonus*this.collected:e.state==='investigate'?rules.investigate:rules.patrol;const step=Math.min(d,speed*dt);this.move(e,(next.x-e.x)/d*step,(next.y-e.y)/d*step,.16);}}
    if(this.dist(e,p)<.53){this.mode='lost';this.lossReason='caught';this.action=null;this.events.push({type:'lost'});}
  }
}
if(typeof module!=='undefined')module.exports=NightShiftGame;
