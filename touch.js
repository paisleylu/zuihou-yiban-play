'use strict';
const mobileInput={forward:0,side:0,sprint:false,crouch:false};
const isTouch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
document.body.classList.toggle('touchscreen',isTouch);
let joystickPointer=null,lookPointer=null,lookX=0,sprintPointer=null;
function resetInput(){
 keys.clear();drag=false;mobileInput.forward=mobileInput.side=0;mobileInput.sprint=mobileInput.crouch=false;
 joystickPointer=lookPointer=sprintPointer=null;$('stick').style.transform='';
 $('sprintButton').classList.remove('active');$('crouchButton').classList.remove('active');$('crouchButton').setAttribute('aria-pressed','false');
}
function gameInput(){return {
 forwardAxis:Math.max(-1,Math.min(1,mobileInput.forward+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0))),
 sideAxis:Math.max(-1,Math.min(1,mobileInput.side+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0))),
 left:keys.has('ArrowLeft'),right:keys.has('ArrowRight'),sprint:mobileInput.sprint||keys.has('ShiftLeft')||keys.has('ShiftRight'),crouch:mobileInput.crouch||keys.has('KeyC')
};}
function activePlay(){return game.mode==='playing'&&!paused&&!document.hidden;}
function updateJoystick(e){const r=$('joystick').getBoundingClientRect();let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;const distance=Math.hypot(dx,dy),limit=r.width*.32;if(distance>limit){dx=dx/distance*limit;dy=dy/distance*limit;}
 $('stick').style.transform=`translate(${dx}px,${dy}px)`;mobileInput.side=Math.abs(dx)<5?0:dx/limit;mobileInput.forward=Math.abs(dy)<5?0:-dy/limit;
}
$('joystick').addEventListener('pointerdown',e=>{if(!activePlay()||joystickPointer!==null)return;e.preventDefault();joystickPointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);updateJoystick(e);});
$('joystick').addEventListener('pointermove',e=>{if(e.pointerId!==joystickPointer)return;e.preventDefault();if(activePlay())updateJoystick(e);});
function releaseStick(e){if(e.pointerId!==joystickPointer)return;joystickPointer=null;mobileInput.forward=mobileInput.side=0;$('stick').style.transform='';}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,releaseStick);
$('lookPad').addEventListener('pointerdown',e=>{if(!activePlay()||lookPointer!==null)return;e.preventDefault();lookPointer=e.pointerId;lookX=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);});
$('lookPad').addEventListener('pointermove',e=>{if(e.pointerId!==lookPointer)return;e.preventDefault();if(activePlay())game.player.angle+=(e.clientX-lookX)*.006;lookX=e.clientX;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('lookPad').addEventListener(event,e=>{if(e.pointerId===lookPointer)lookPointer=null;});
$('sprintButton').addEventListener('pointerdown',e=>{if(!activePlay())return;e.preventDefault();sprintPointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);mobileInput.sprint=true;e.currentTarget.classList.add('active');});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('sprintButton').addEventListener(event,e=>{if(e.pointerId!==sprintPointer)return;sprintPointer=null;mobileInput.sprint=false;e.currentTarget.classList.remove('active');});
$('crouchButton').onclick=()=>{if(!activePlay())return;mobileInput.crouch=!mobileInput.crouch;$('crouchButton').classList.toggle('active',mobileInput.crouch);$('crouchButton').setAttribute('aria-pressed',String(mobileInput.crouch));};
$('lampButton').onclick=()=>{if(activePlay())game.toggleLamp();};
$('interactButton').onclick=()=>{if(activePlay())game.interact();};
function toggleMap(){if(!activePlay())return;mapOpen=!mapOpen;$('mapPanel').classList.toggle('hidden',!mapOpen);$('mapButton').setAttribute('aria-pressed',String(mapOpen));}
$('mapButton').onclick=toggleMap;$('pauseButton').onclick=pauseToggle;
function syncMobileUI(){
 document.body.classList.toggle('playing',game.mode==='playing');document.body.classList.toggle('paused',paused);
 const near=game.nearby();$('interactButton').disabled=(!near&&!game.action)||paused;$('interactButton').textContent=game.action?'取消操作':!near?'交互':near.kind==='fuse'?'拾取保险丝':near.kind==='breaker'?(game.collected===3?'复位断路器':'查看断路器'):(game.exitReady()?'打开出口':'查看出口');
 $('lampButton').classList.toggle('active',game.lamp);$('lampButton').setAttribute('aria-pressed',String(game.lamp));
}
window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(game.mode==='playing'&&!paused)pauseToggle();resetInput();if(audio)audio.suspend().catch(()=>{});}});
window.addEventListener('pagehide',()=>{if(game.mode==='playing'&&!paused)pauseToggle();resetInput();if(audio)audio.suspend().catch(()=>{});});
window.addEventListener('resize',()=>{resetInput();resizeScene();if(isTouch&&innerHeight>innerWidth&&activePlay())pauseToggle();});
async function enterMobileFullscreen(){if(!isTouch||document.querySelector('meta[name=nightshift-native]'))return;try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape');}catch(e){/* iPhone uses the installed web-app window and physical rotation. */}}
window.__nightShift.input=mobileInput;

syncMobileUI();requestAnimationFrame(frame);
