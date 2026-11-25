// node rec.cjs scenario.js outname [w h]  -> /tmp/reel/clips/outname.mp4 (30fps, DPR3)
const { chromium } = require('playwright'); const fs=require('fs'); const {execSync}=require('child_process');
const [scen,name,W='390',H='690']=process.argv.slice(2);
(async()=>{ const b=await chromium.launch({args:['--force-device-scale-factor='+(process.env.DPR||3)]}); const ctx=await b.newContext({baseURL:'http://localhost:5055',storageState:process.env.STATE||'/tmp/reel/rig/state.json',viewport:{width:+W,height:+H},deviceScaleFactor:+(process.env.DPR||3),isMobile:!process.env.DESK,hasTouch:!process.env.DESK});
 const page=await ctx.newPage(); page.setDefaultTimeout(6000); page.on('pageerror',e=>console.log('ERR',e.message));
 const css=`[data-testid=ai-setup-banner]{display:none!important} div:has(> [data-testid=button-view-owner]){visibility:hidden!important} html{scrollbar-width:none} ::-webkit-scrollbar{display:none} .rec-tap{position:fixed;z-index:2147483647;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(22,22,22,.22);border:2px solid rgba(255,255,255,.9);pointer-events:none;animation:rt .55s ease-out forwards} @keyframes rt{0%{transform:scale(.4);opacity:1}100%{transform:scale(1.3);opacity:0}}`;
 await page.addInitScript(c=>{ const add=()=>{const s=document.createElement('style');s.textContent=c;document.head.appendChild(s);
   const hide=()=>{ for(const el of document.querySelectorAll('div,aside,section')){ if(el.childElementCount<6 && /^AI\s*needs\s*setup/.test(el.innerText||'') ) el.style.display='none'; } }; setInterval(hide,200); };
   if(document.head) add(); else document.addEventListener('DOMContentLoaded',add); }, css);
 const tapAt=async(x,y)=>{ await page.evaluate(([x,y])=>{const d=document.createElement('div');d.className='rec-tap';d.style.left=x+'px';d.style.top=y+'px';document.body.appendChild(d);setTimeout(()=>d.remove(),700)},[x,y]); };
 const tap=async(loc)=>{ const l=typeof loc==='string'?page.getByTestId(loc).first():loc; await l.scrollIntoViewIfNeeded(); const bb=await l.boundingBox(); await tapAt(bb.x+bb.width/2,bb.y+bb.height/2); await page.waitForTimeout(250); await l.click(); };
 const wait=ms=>page.waitForTimeout(ms);
 const scroll=async(dy,ms=900,sel)=>{ await page.evaluate(([dy,ms,sel])=>new Promise(r=>{const el=sel?document.querySelector(sel):([...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+50&&/(auto|scroll)/.test(getComputedStyle(e).overflowY)).sort((a,b)=>b.clientHeight-a.clientHeight)[0]||document.scrollingElement); const s=el.scrollTop,t0=performance.now(); const f=t=>{const p=Math.min(1,(t-t0)/ms); const e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2; el.scrollTop=s+dy*e; p<1?requestAnimationFrame(f):r()}; requestAnimationFrame(f)}),[dy,ms,sel]); };
 const go=async p=>{ await page.goto(p); await page.waitForLoadState('networkidle').catch(()=>{}); await wait(1500); };

 const encode=(name)=>{ const dir='/tmp/reel/frames/'+name; fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true}); fs.mkdirSync('/tmp/reel/clips',{recursive:true});
 let list=''; frames.forEach((f,i)=>{ const fn=`${dir}/${String(i).padStart(5,'0')}.jpg`; fs.writeFileSync(fn,Buffer.from(f.d,'base64')); const dur=i<frames.length-1?frames[i+1].t-f.t:0.5; list+=`file '${fn}'\nduration ${dur.toFixed(4)}\n`; });
 if(!frames.length){console.log('no frames');return}
 list+=`file '${dir}/${String(frames.length-1).padStart(5,'0')}.jpg'\n`; fs.writeFileSync(dir+'/list.txt',list);
 execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${dir}/list.txt -vf "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -crf 14 -preset medium /tmp/reel/clips/${name}.mp4`);
 console.log(name, frames.length,'frames', (frames.at(-1).t-frames[0].t).toFixed(2)+'s');
};
 let rec=false; const frames=[]; let cdp;
 const start=async()=>{ frames.length=0; cdp=await ctx.newCDPSession(page); cdp.on('Page.screencastFrame',async f=>{ if(rec) frames.push({t:f.metadata.timestamp,d:f.data}); cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{}); });
   await cdp.send('Page.startScreencast',{format:'jpeg',quality:92,maxWidth:+W*(process.env.DPR||3),maxHeight:+H*(process.env.DPR||3),everyNthFrame:1}); rec=true; await wait(300); };
 const stop=async(n)=>{ await wait(300); rec=false; await cdp.send('Page.stopScreencast'); encode(n||name); };
 try{ await eval('(async()=>{'+fs.readFileSync(scen,'utf8')+'})')(); }catch(e){console.log('FAIL',e.message); await page.screenshot({path:'/tmp/reel/rig/fail.png'}); rec=false;}
 await ctx.storageState({path:process.env.STATE||'/tmp/reel/rig/state.json'}); await b.close();
})();
