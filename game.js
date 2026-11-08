'use strict';
const game=new NightShiftGame(), canvas=document.getElementById('scene'),ctx=canvas.getContext('2d',{alpha:false});
const PI=Math.PI,FOV=.78,keys=new Set();
let W=canvas.width,H=canvas.height,zbuffer=new Float32Array(W);
function resizeScene(){const mobile=matchMedia('(pointer:coarse)').matches;W=mobile?480:800;H=Math.max(mobile?180:240,Math.min(640,Math.round(W*innerHeight/innerWidth)));canvas.width=W;canvas.height=H;zbuffer=new Float32Array(W);}
resizeScene();
const $=id=>document.getElementById(id);
let paused=false,mapOpen=false,last=0,noticeUntil=0,lastFoot=0,lastEnemyFoot=0,drag=false,endShown=false,volume=.38;
let audio=null,master=null,hum=null;
function initAudio(){
  try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=volume;master.connect(audio.destination);
    for(const [frequency,gain] of [[43,.024],[67,.011],[112,.006]]){const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=frequency;g.gain.value=gain;o.connect(g).connect(master);o.start();}
  }audio.resume();}catch(e){}
}
function tone(freq,duration,gain=.12,type='sine',pan=0){if(!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain(),p=audio.createStereoPanner();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*.53),audio.currentTime+duration);g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);p.pan.value=pan;o.connect(g).connect(p).connect(master);o.start();o.stop(audio.currentTime+duration);}
function noise(duration,gain,lowpass=400,pan=0){if(!audio||audio.state!=='running')return;const b=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*6);const s=audio.createBufferSource(),f=audio.createBiquadFilter(),g=audio.createGain(),p=audio.createStereoPanner();s.buffer=b;f.type='lowpass';f.frequency.value=lowpass;g.gain.value=gain;p.pan.value=pan;s.connect(f).connect(g).connect(p).connect(master);s.start();}
function foot(enemy=false){const d=game.dist(game.player,game.enemy),a=Math.atan2(game.enemy.y-game.player.y,game.enemy.x-game.player.x)-game.player.angle,pan=enemy?Math.sin(a):0,gain=enemy?Math.max(0,.19*(1-d/12)):(game.crouching?.035:.10);if(enemy&&gain<=0)return;noise(.17,gain,enemy?280:550,pan);tone(enemy?62:86,.15,gain*.5,'sine',pan);}
function showMessage(text){$('message').textContent=text;$('message').style.opacity=1;noticeUntil=performance.now()+5500;}
function start(){clearSettlement();$('actionProgress').classList.add('hidden');initAudio();game.reset($('difficulty').value);game.start();$('difficultyHud').textContent='B-07 / '+game.rules.name+'难度';$('nightmareRules').hidden=!game.hardObjectives;resetInput();paused=false;endShown=false;mapOpen=false;lastFoot=0;$('title').classList.add('hidden');$('end').classList.add('hidden');$('pause').classList.add('hidden');$('hud').classList.remove('hidden');$('mapPanel').classList.add('hidden');canvas.focus();syncMobileUI();enterMobileFullscreen();}
function title(){clearSettlement();$('actionProgress').classList.add('hidden');game.reset();paused=false;resetInput();endShown=false;$('title').classList.remove('hidden');for(const id of ['hud','pause','end','mapPanel'])$(id).classList.add('hidden');$('danger').style.opacity=0;syncMobileUI();}
function pauseToggle(){if(game.mode!=='playing')return;paused=!paused;if(paused){game.cancelAction();$('actionProgress').classList.add('hidden');}resetInput();$('pause').classList.toggle('hidden',!paused);syncMobileUI();if(!paused){initAudio();canvas.focus();}else if(audio)audio.suspend().catch(()=>{});}
$('difficulty').onchange=()=>{$('difficultyNote').textContent=$('difficulty').value==='hell'?'黑暗迷雾 · 复位两处断路器 · 60秒限时逃离':'收集首枚保险丝后出现敌人 · 关灯可恢复电量';$('introStory').innerHTML=$('difficulty').value==='hell'?'电梯停了，出口也断了电。<br>找到三枚保险丝，复位库房与配电间的断路器，<br>然后在60秒内回到大厅。脚步声……不是你的。':'电梯停了，出口也断了电。<br>找到散落在库房、配电间和档案室的三枚保险丝，<br>然后回到大厅。走廊里的脚步声……不是你的。';};
$('start').onclick=start;$('retry').onclick=start;$('back').onclick=title;$('returnTitle').onclick=title;$('resume').onclick=pauseToggle;
function adjustVolume(e){volume=+e.target.value/100;$('volume').value=$('pauseVolume').value=e.target.value;if(master)master.gain.setTargetAtTime(volume,audio.currentTime,.05);}
$('volume').oninput=adjustVolume;$('pauseVolume').oninput=adjustVolume;
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)&&game.mode==='playing')e.preventDefault();if(e.code==='Escape'){if(game.mode==='won'||game.mode==='lost')title();else pauseToggle();return;}if(game.mode!=='playing'||paused)return;keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE')game.interact();if(e.code==='KeyF')game.toggleLamp();if(e.code==='KeyM')toggleMap();});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(game.mode==='playing'&&!paused)pauseToggle();});
canvas.addEventListener('mousedown',()=>{if(game.mode==='playing'&&!paused){drag=true;canvas.focus();}});window.addEventListener('mouseup',()=>drag=false);window.addEventListener('mousemove',e=>{if(drag&&game.mode==='playing'&&!paused)game.player.angle+=e.movementX*.005;});
function sprite(type){const c=document.createElement('canvas');c.width=160;c.height=260;const g=c.getContext('2d');
  if(type==='enemy'){
    const glow=g.createRadialGradient(80,94,2,80,120,100);glow.addColorStop(0,'#89979718');glow.addColorStop(1,'#0000');g.fillStyle=glow;g.fillRect(0,0,160,260);
    g.fillStyle='#070a09';g.beginPath();g.moveTo(58,79);g.lineTo(42,103);g.lineTo(22,214);g.lineTo(31,218);g.lineTo(53,138);g.lineTo(48,219);g.lineTo(61,244);g.lineTo(65,259);g.lineTo(74,259);g.lineTo(79,223);g.lineTo(88,259);g.lineTo(100,259);g.lineTo(99,233);g.lineTo(111,216);g.lineTo(107,142);g.lineTo(128,215);g.lineTo(138,211);g.lineTo(121,110);g.lineTo(102,78);g.closePath();g.fill();
    g.fillStyle='#0e1511';g.beginPath();g.ellipse(80,62,23,33,0,0,PI*2);g.fill();g.fillStyle='#8da691';g.shadowColor='#e6f6d5';g.shadowBlur=8;g.fillRect(68,61,6,2);g.fillRect(86,61,6,2);g.shadowBlur=0;
    g.strokeStyle='#28362b';g.lineWidth=2;g.beginPath();g.moveTo(80,101);g.lineTo(80,188);g.stroke();
  }else if(type==='fuse'){
    const glow=g.createRadialGradient(80,125,5,80,125,74);glow.addColorStop(0,'#bddfa53a');glow.addColorStop(1,'#abc68800');g.fillStyle=glow;g.fillRect(0,0,160,260);
    g.fillStyle='#1c2721';g.fillRect(43,168,74,85);g.fillStyle='#39493c';g.fillRect(36,162,88,9);g.strokeStyle='#56664d';g.strokeRect(43,170,74,83);
    g.fillStyle='#c4d8ac';g.shadowColor='#cae0a1';g.shadowBlur=16;g.fillRect(71,106,18,37);g.shadowBlur=0;g.fillStyle='#8b9b87';g.fillRect(67,100,26,8);g.fillRect(67,140,26,8);g.fillStyle='#ebf5d5';g.fillRect(76,110,5,25);
  }else if(type==='breaker'){
    g.fillStyle='#16231c';g.fillRect(34,82,92,128);g.strokeStyle='#687b59';g.lineWidth=3;g.strokeRect(34,82,92,128);
    g.fillStyle='#bd8657';g.fillRect(47,97,66,20);g.fillStyle='#171b12';g.font='bold 12px sans-serif';g.textAlign='center';g.fillText('POWER',80,111);
    g.fillStyle='#9eac82';g.fillRect(73,130,14,52);g.fillStyle='#cfb17c';g.fillRect(60,143,40,13);
    g.fillStyle='#6d8a56';g.fillRect(48,191,12,7);g.fillRect(72,191,12,7);g.fillRect(96,191,12,7);
  }else{
    g.fillStyle='#0d1713';g.fillRect(15,22,130,238);g.strokeStyle='#53674a';g.lineWidth=5;g.strokeRect(15,22,130,238);g.fillStyle='#192820';g.fillRect(23,29,114,231);g.fillStyle='#536552';g.fillRect(36,45,88,25);g.fillStyle='#c9e8aa';g.textAlign='center';g.font='bold 17px sans-serif';g.fillText('EXIT',80,64);g.fillStyle='#687960';g.fillRect(114,147,10,4);g.strokeStyle='#2b3e2b';g.lineWidth=2;g.strokeRect(32,81,96,154);
  }return c;
}
const sprites={enemy:sprite('enemy'),fuse:sprite('fuse'),breaker:sprite('breaker'),exit:sprite('exit')};
function normalize(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function drawBillboard(obj,type,width,height,time){
  const p=game.player,dx=obj.x-p.x,dy=obj.y-p.y,dist=Math.hypot(dx,dy),relative=normalize(Math.atan2(dy,dx)-p.angle),depth=dist*Math.cos(relative);if(depth<=.15||Math.abs(relative)>1.18)return;
  const center=W/2+Math.tan(relative)*W/(2*FOV),scale=H*.68/depth,sh=scale*height,sw=scale*width;
  const bob=type==='enemy'?Math.sin(time*3)*scale*.015:0,top=H/2+scale*.5-sh+bob,left=Math.floor(center-sw/2),img=sprites[type];
  const dark=game.hardObjectives&&game.mode!=='ready';
  if(dark&&dist>(game.lamp?7:3.2))return;
  const brightness=dark?(game.lamp?Math.max(.16,.85-dist*.12):Math.max(.10,.28-dist*.035)):(game.lamp?Math.max(.26,1-dist*.075):Math.max(.12,.44-dist*.025));
  ctx.globalAlpha=type==='fuse'?Math.max(dark?.30:.60,brightness):brightness;
  for(let x=Math.max(0,left);x<Math.min(W,left+sw);x+=2){if(depth<zbuffer[x]+.03){const source=(x-left)/sw*img.width;ctx.drawImage(img,source,0,Math.max(1,img.width/sw*2),img.height,x,top,2,sh);}}
  ctx.globalAlpha=1;
}
function drawScene(time){
  const p=game.player,a=p.angle,dirx=Math.cos(a),diry=Math.sin(a),px=-diry*FOV,py=dirx*FOV,horizon=H/2;
  const dark=game.hardObjectives&&game.mode!=='ready';
  const ceiling=ctx.createLinearGradient(0,0,0,horizon);ceiling.addColorStop(0,dark?'#010302':'#040706');ceiling.addColorStop(1,dark?'#070c09':'#131b15');ctx.fillStyle=ceiling;ctx.fillRect(0,0,W,horizon);
  const floor=ctx.createLinearGradient(0,horizon,0,H);floor.addColorStop(0,dark?'#050906':'#121a15');floor.addColorStop(1,dark?(game.lamp?'#172019':'#050907'):(game.lamp?'#28332b':'#0d1410'));ctx.fillStyle=floor;ctx.fillRect(0,horizon,W,H-horizon);
  for(let y=horizon+2;y<H;y+=4){const d=H*.34/(y-horizon),lx=p.x+d*(dirx-px),ly=p.y+d*(diry-py),stepx=d*px*2/W,stepy=d*py*2/W;
    for(let x=0;x<W;x+=6){const fx=lx+stepx*x,fy=ly+stepy*x,checker=(Math.floor(fx*2)+Math.floor(fy*2))&1,cone=Math.max(0,1-Math.abs(x-W/2)/(W*.57)),brightness=(dark?(game.lamp?7+28*Math.pow(cone,2)/(1+d*.38):4):(game.lamp?22+31*cone/(1+d*.19):12))/(1+d*(dark?.18:.075))+(checker?0:dark?1:3);ctx.fillStyle=`rgb(${brightness*.77|0},${brightness|0},${brightness*.82|0})`;ctx.fillRect(x,y,6,4);}
  }
  for(let x=0;x<W;x+=2){
    const camera=2*x/W-1,rx=dirx+px*camera,ry=diry+py*camera;let mx=Math.floor(p.x),my=Math.floor(p.y),ddx=Math.abs(1/rx),ddy=Math.abs(1/ry),sx=rx<0?-1:1,sy=ry<0?-1:1,sdx=(rx<0?p.x-mx:mx+1-p.x)*ddx,sdy=(ry<0?p.y-my:my+1-p.y)*ddy,side=0;
    for(let step=0;step<70;step++){if(sdx<sdy){sdx+=ddx;mx+=sx;side=0;}else{sdy+=ddy;my+=sy;side=1;}if(!game.map[my]||game.map[my][mx]!==0)break;}
    const distance=Math.max(.05,side?sdy-ddy:sdx-ddx);zbuffer[x]=zbuffer[x+1]=distance;
    let wallX=side?p.x+distance*rx:p.y+distance*ry;wallX-=Math.floor(wallX);
    const hh=H*.68/distance,top=horizon-hh*.5,bottom=top+hh;
    const cone=Math.pow(Math.max(0,1-Math.abs(camera)*.8),.4),light=dark?(game.lamp?(.035+.70*Math.pow(cone,3)/(1+distance*.48)):.055):(game.lamp?(.20+.77*cone/(1+distance*.22)):.15);
    const stripe=(wallX<.015||wallX>.985)?-.22:0,panel=(Math.floor(wallX*9)%3===0)?.025:0;
    const bright=Math.max(dark?.018:.055,light*(side?.79:1)+stripe+panel),variation=((mx*17+my*11)%6)/6;
    ctx.fillStyle=`rgb(${(92+variation*12)*bright|0},${(110+variation*9)*bright|0},${(92+variation*6)*bright|0})`;ctx.fillRect(x,top,2,hh);
    ctx.fillStyle=`rgba(0,0,0,${.18})`;ctx.fillRect(x,top+hh*.30,2,Math.max(1,hh*.011));ctx.fillRect(x,top+hh*.83,2,hh*.17);
    ctx.fillStyle=`rgba(156,180,145,${bright*.18})`;ctx.fillRect(x,top+hh*.82,2,Math.max(1,hh*.007));
    if(((mx+my)%7===0)&&wallX>.27&&wallX<.70){ctx.fillStyle=`rgba(13,25,18,${.8})`;ctx.fillRect(x,top+hh*.40,2,hh*.11);ctx.fillStyle=`rgba(183,193,156,${bright*.40})`;ctx.fillRect(x,top+hh*.435,2,hh*.017);}
  }
  const objects=game.fuses.filter(f=>!f.taken).map(f=>({obj:f,type:'fuse',w:.26,h:.52}));for(const b of game.breakers)if(!b.done)objects.push({obj:b,type:'breaker',w:.42,h:.80});objects.push({obj:game.exit,type:'exit',w:.58,h:1.0});if(game.enemy.active)objects.push({obj:game.enemy,type:'enemy',w:.40,h:.98});objects.sort((a,b)=>game.dist(p,b.obj)-game.dist(p,a.obj));for(const o of objects)drawBillboard(o.obj,o.type,o.w,o.h,time);
  const glow=ctx.createRadialGradient(W/2,H*.56,15,W/2,H*.56,W*.57);glow.addColorStop(0,dark?'#00000000':'#bed0b00b');glow.addColorStop(1,dark?(game.lamp?'#00000099':'#000000ba'):(game.lamp?'#00000051':'#00000086'));ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  if(game.mode==='playing'){
    const sway=game.moving?Math.sin(game.distanceWalked*7)*3:Math.sin(time)*1.2;ctx.save();ctx.translate(W*.77+sway,H*.90+(game.moving?Math.abs(Math.sin(game.distanceWalked*7))*2:0));ctx.rotate(-.17);ctx.fillStyle='#0a100f';ctx.beginPath();ctx.moveTo(-20,55);ctx.lineTo(-27,-34);ctx.lineTo(20,-42);ctx.lineTo(57,55);ctx.closePath();ctx.fill();ctx.fillStyle='#26352c';ctx.fillRect(-28,-46,53,17);ctx.fillStyle=game.lamp?'#a4b18a':'#333f32';ctx.fillRect(-22,-48,42,4);ctx.fillStyle='#17241d';ctx.fillRect(-14,-27,28,70);ctx.restore();
  }
}
function drawMap(){
 const c=$('mapCanvas'),g=c.getContext('2d'),s=10,ox=6,oy=5,dark=game.hardObjectives;
 g.fillStyle=dark?'#050806':'#0c130f';g.fillRect(0,0,c.width,c.height);
 for(let y=0;y<game.height;y++)for(let x=0;x<game.width;x++){
  const seen=!dark||game.explored.has(y*game.width+x);
  g.fillStyle=!seen?'#080c0a':game.map[y][x]?(dark?'#18241d':'#253128'):(dark?'#465348':'#788571');g.fillRect(ox+x*s,oy+y*s,s-1,s-1);
 }
 g.fillStyle='#d1dfa7';for(const f of game.fuses){if(f.taken||!game.discovered(f))continue;g.save();g.translate(ox+f.x*s,oy+f.y*s);g.rotate(PI/4);g.fillRect(-3,-3,6,6);g.restore();}
 for(const b of game.breakers){if(!game.discovered(b))continue;g.strokeStyle=b.done?'#81a881':'#e1ab72';g.strokeRect(ox+b.x*s-3,oy+b.y*s-3,6,6);}
 if(game.discovered(game.exit)){g.fillStyle='#5fa994';g.fillRect(ox+game.exit.x*s-4,oy+game.exit.y*s-3,8,6);}
 g.fillStyle='#f2eed9';g.beginPath();g.arc(ox+game.player.x*s,oy+game.player.y*s,3,0,PI*2);g.fill();g.strokeStyle='#f2eed9';g.beginPath();g.moveTo(ox+game.player.x*s,oy+game.player.y*s);g.lineTo(ox+(game.player.x+Math.cos(game.player.angle)*.8)*s,oy+(game.player.y+Math.sin(game.player.angle)*.8)*s);g.stroke();
 $('mapHint').textContent=dark?'迷雾只记录探索区域；□ 断路器。看图时敌人仍会移动。':'● 你的位置　◇ 保险丝　▱ 出口。看图时敌人仍会移动。';
}
function updateHUD(now){$('objective').textContent=game.objective;$('stageHint').textContent=game.hardObjectives?(game.collected<3?'三枚保险丝 → 两处断路器 → 限时出口':game.exitReady()?'开门需站稳2秒；移动会中断':'库房 / 配电间 · 站稳4秒，声音引敌'):'';$('actionProgress').classList.toggle('hidden',!game.action);if(game.action){$('actionLabel').textContent=(game.action.kind==='breaker'?'复位':'开门')+'中 · 移动会中断';$('actionFill').style.width=Math.min(100,game.action.progress/game.action.duration*100)+'%';}document.querySelectorAll('.slot').forEach((s,i)=>s.classList.toggle('filled',i<game.collected));$('batteryLabel').textContent=(game.lamp?'手电　':'关灯　')+Math.ceil(game.battery)+'%';$('batteryFill').style.width=game.battery+'%';$('staminaFill').style.width=game.stamina+'%';const minutes=134+Math.floor(game.elapsed/60);$('clock').textContent=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');const near=game.nearby();$('prompt').classList.toggle('hidden',!near);if(near)$('prompt').textContent=(isTouch?'交互 · ':'E · ')+game.interactionLabel(near);if(game.action||now>noticeUntil)$('message').style.opacity=0;const d=game.dist(game.player,game.enemy);$('danger').style.opacity=game.enemy.active&&game.enemy.grace<=0?Math.max(0,(5-d)/5)*.8:0;if(mapOpen)drawMap();syncMobileUI();}
function handleEvents(){for(const event of game.events.splice(0)){if(event.text)showMessage(event.text);if(event.type==='pickup'){tone(720,.2,.08);setTimeout(()=>tone(1080,.28,.05),100);}if(event.type==='switch'){noise(.05,.06,1800);}if(event.type==='alarm'){tone(180,.6,.12);noise(.3,.08,800);}if(event.type==='chase'){tone(49,1,.18);noise(.5,.12,320);}if(event.type==='won'||event.type==='lost')ending(event.type==='won');}}
function ending(won){
 if(endShown)return;
 endShown=true;paused=false;mapOpen=false;resetInput();syncMobileUI();
 for(const id of ['title','hud','mapPanel','pause'])$(id).classList.add('hidden');
 $('actionProgress').classList.add('hidden');$('danger').style.opacity=0;$('message').style.opacity=0;$('prompt').classList.add('hidden');
 renderSettlement(won,game);
 if(won){tone(320,.8,.065);setTimeout(()=>tone(480,1,.04),240);}else{noise(.65,.30,490);tone(39,.8,.22);}
}
let lastDraw=0;const frameStats={count:0,total:0,max:0};
function frame(now){if(document.hidden){last=now;requestAnimationFrame(frame);return;}if(isTouch&&now-lastDraw<32){requestAnimationFrame(frame);return;}lastDraw=now;const drawStart=performance.now();const dt=Math.min(.05,(now-last)/1000||.016);last=now;if(!paused&&game.mode==='playing'){game.step(dt,gameInput());if(game.moving&&game.distanceWalked-lastFoot>(game.running?.88:.73)){lastFoot=game.distanceWalked;foot();}if(game.enemy.active&&game.enemy.grace<=0&&game.dist(game.player,game.enemy)<12&&now-lastEnemyFoot>(game.enemy.state==='chase'?490:860)){lastEnemyFoot=now;foot(true);}}handleEvents();if(!paused&&game.mode==='playing')updateHUD(now);drawScene(now/1000);const cost=performance.now()-drawStart;frameStats.count++;frameStats.total+=cost;frameStats.max=Math.max(frameStats.max,cost);requestAnimationFrame(frame);}
function onSystemBack(){
 if(game.mode==='won'||game.mode==='lost'||paused){title();return true;}
 if(game.mode==='playing'){pauseToggle();return true;}
 return false;
}
window.__nightShift={game,start,pauseToggle,drawScene,frameStats,back:title,onSystemBack};
