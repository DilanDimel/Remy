// Stand-in OpenAI-compatible endpoint for the demo recording only. Logs prompts; answers Remy chat with a scripted reply.
const http=require('http'); const fs=require('fs');
const reply=(all)=>{
  if(/friendly fox career coach/.test(all)){
    const m=all.match(/\[id:(j\w+)\][^;\[]*Michaels/); const id=m?m[1]:''; console.log('job id',id);
    const fri=(()=>{const d=new Date(Date.now()-6*3600e3); const add=(5-d.getUTCDay()+7)%7||7; d.setUTCDate(d.getUTCDate()+add); return d.toISOString().slice(0,10)})();
    return JSON.stringify({reply:"Done! I saved the **Michaels** internship and added a to-do to apply by Friday.\n• Your **3.6 GPA** clears their 3.0 ask\n• You already show **Excel**, which they want\nWant me to start your resume for it?",actions:[...(id?[{kind:'save',jobId:id}]:[]),{kind:'task',title:'Apply to Michaels Store Communications internship',why:'You meet the GPA and show Excel.',due:fri}],remember:[]});
  }
  return '{}';
};
http.createServer((req,res)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
  let j={}; try{j=JSON.parse(b)}catch{}
  const all=(j.messages||[]).map(m=>typeof m.content==='string'?m.content:JSON.stringify(m.content)).join('\n\n');
  fs.appendFileSync('/tmp/reel/fake/log.txt',`\n==== ${req.url} stream=${!!j.stream}\n${all.slice(0,400)}\n...\n${all.slice(-1500)}\n`);
  if(/friendly fox/.test(all)) fs.writeFileSync('/tmp/reel/fake/chat-prompt.txt',all); const out=reply(all);
  if(j.stream){ res.writeHead(200,{'content-type':'text/event-stream'}); const parts=out.match(/.{1,12}/gs)||['']; let i=0;
    const send=()=>{ if(i<parts.length){ res.write('data: '+JSON.stringify({id:'x',object:'chat.completion.chunk',model:'demo',choices:[{index:0,delta:{content:parts[i++]},finish_reason:null}]})+'\n\n'); setTimeout(send,35);} else { res.write('data: '+JSON.stringify({id:'x',object:'chat.completion.chunk',model:'demo',choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}})+'\n\n'); res.end('data: [DONE]\n\n'); } };
    setTimeout(send,400); return; }
  res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify({id:'x',object:'chat.completion',model:'demo',choices:[{index:0,message:{role:'assistant',content:out},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}}));
});}).listen(5099,()=>console.log('fake on 5099'));
