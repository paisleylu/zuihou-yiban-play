'use strict';
let installPrompt=null;
const offlineLabel=document.getElementById('offlineStatus'),installButton=document.getElementById('installButton'),help=document.getElementById('installHelp');
function installed(){return matchMedia('(display-mode:standalone)').matches||matchMedia('(display-mode:fullscreen)').matches||navigator.standalone===true;}
function updateInstallUI(){installButton.hidden=installed();}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;installButton.textContent='安装到手机';updateInstallUI();});
window.addEventListener('appinstalled',()=>{installPrompt=null;updateInstallUI();});
installButton.onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else{help.hidden=!help.hidden;help.textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'在 Safari 中点分享，再选择“添加到主屏幕”，开启“作为网页 App 打开”。安装后横屏游玩。':'打开浏览器菜单，选择“安装应用”或“添加到桌面”。首次打开等待显示“已可离线游玩”，之后从桌面图标进入。';}};
updateInstallUI();
if(document.querySelector('meta[name=nightshift-native]')){offlineLabel.textContent='本机离线版 · 无需联网';installButton.hidden=true;}else if('serviceWorker' in navigator&&window.isSecureContext){
 navigator.serviceWorker.register('./sw.js').then(async registration=>{
  await navigator.serviceWorker.ready;
  async function verifyOffline(){const cache=await caches.open('nightshift-v5');const paths=['./index.html','./engine.js','./game.js','./settlement.js','./settlement.css','./touch.js','./pwa.js','./mobile.css','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];const checks=await Promise.all(paths.map(p=>cache.match(new URL(p,location.href).href)));offlineLabel.textContent=checks.every(Boolean)?'已可离线游玩':'正在准备离线内容…';}
  await verifyOffline();navigator.serviceWorker.addEventListener('controllerchange',verifyOffline);
 }).catch(()=>{offlineLabel.textContent='离线准备失败，请联网后重开';});
}else{offlineLabel.textContent='当前浏览器不能缓存离线游戏';}
