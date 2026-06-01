/**
 * Test Chat Script
 * Tests the Claude streaming API call and Prisma AISource context size.
 * Run: node scripts/test-chat.js
 */

const fs = require("fs")
const path = require("path")

// -- Load environment (same pattern as overnight-crawl.js) --
function loadEnv(fp) {
  try {
    const lines = fs.readFileSync(fp, 'utf-8').split('\n')
    for (const line of lines) {
      if (line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx === -1) continue
      const key = line.substring(0, idx).trim()
      let val = line.substring(idx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1)
      if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1)
      if (key) process.env[key] = val
    }
  } catch {}
}

const rootDir = path.resolve(__dirname, "..")
loadEnv(path.join(rootDir, ".env"))
loadEnv(path.join(rootDir, ".env.local"))

const { PrismaClient } = require("@prisma/client")
const Anthropic = require("@anthropic-ai/sdk")
const prisma = new PrismaClient()
const SYSTEM_PROMPT=["Je bent de AI-assistent van Workx Advocaten.","","## Kernregels","- Antwoord in het Nederlands","- Vermeld dat antwoord geen juridisch advies is","- Verwijs naar wetgeving (Boek 7 BW, Rv, WW, WAZO)","- Structureer met kopjes","","## Bronnen","- rechtspraak.nl","- wetten.overheid.nl","- uwv.nl","- rijksoverheid.nl"].join("\n")
function separator(t){console.log("\n"+"=".repeat(70));console.log("  "+t);console.log("=".repeat(70)+"\n")}
function formatBytes(b){if(b<1024)return b+" B";if(b<1048576)return(b/1024).toFixed(1)+" KB";return(b/1048576).toFixed(2)+" MB"}
async function analyzeAISources(){
  separator("PART 1: Prisma AISource Analysis")
  try{
    var tc=await prisma.aISource.count()
    console.log("Total AISource records: "+tc)
    var bu=await prisma.aISource.groupBy({by:["userId"],_count:{id:true}})
    console.log("\nPer user:");bu.forEach(function(r){console.log("  "+r.userId+" -> "+r._count.id)})
    var src=await prisma.aISource.findMany({where:{isActive:true},select:{id:true,userId:true,name:true,type:true,category:true,isProcessed:true,content:true,summary:true}})
    console.log("\nActive: "+src.length+"\n")
    console.log("  "+"Name".padEnd(40)+" Type       Processed  Content      Summary      Context")
    console.log("  "+"-".repeat(96))
    var tC=0,tS=0,tX=0,sL=0
    src.forEach(function(s){
      var cL=s.content?s.content.length:0,sn=s.summary?s.summary.length:0;tC+=cL;tS+=sn
      var k=s.isProcessed&&s.summary?s.summary:s.content,m=s.isProcessed?10000:5000
      var tL=k?Math.min(k.length,m):0,u=0
      if(tL>0&&sL+tL<=30000){sL+=tL;u=tL};tX+=u
      console.log("  "+(s.name||"?").padEnd(40).substring(0,40)+" "+(s.type||"-").padEnd(10)+" "+(s.isProcessed?"YES":"no").padEnd(10)+" "+String(cL).padEnd(12)+" "+String(sn).padEnd(12)+" "+u)
    })
    var aC=src.map(function(x){return x.content||""}).join(""),aS=src.map(function(x){return x.summary||""}).join("")
    console.log("\n--- Size Totals ---")
    console.log("  Raw content:    "+tC.toLocaleString()+" chars ("+formatBytes(Buffer.byteLength(aC,"utf-8"))+")")
    console.log("  Summaries:      "+tS.toLocaleString()+" chars ("+formatBytes(Buffer.byteLength(aS,"utf-8"))+")")
    console.log("  Context to API: "+tX.toLocaleString()+" chars (cap: 30,000)")
    console.log("  System prompt:  "+SYSTEM_PROMPT.length+" chars")
    console.log("  Total system:   "+(SYSTEM_PROMPT.length+tX)+" chars")
    console.log("  Est. tokens:    ~"+Math.ceil((SYSTEM_PROMPT.length+tX)/4))
    return{success:true}
  }catch(e){
    console.error("[ERROR] Prisma: "+e.message);if(e.code)console.error("  Code: "+e.code)
    return{success:false,error:e.message}
  }
}
async function testClaudeStreaming(){
  separator("PART 2: Claude Streaming API Call")
  var ak=process.env.ANTHROPIC_API_KEY
  if(!ak){console.error("[ERROR] ANTHROPIC_API_KEY not set");return{success:false,error:"Missing API key"}}
  console.log("API key: "+ak.substring(0,10)+"..."+ak.substring(ak.length-4))
  var client=new Anthropic.default({apiKey:ak})
  var msg="Wat is de transitievergoeding in 2025?"
  console.log("\nModel:    claude-sonnet-4-5-20250929")
  console.log("Tokens:   8096")
  console.log("Tools:    web_search (5)")
  console.log("Message:  "+msg)
  console.log("System:   "+SYSTEM_PROMPT.length+" chars\n")
  console.log("Streaming...\n")
  var t0=Date.now(),full="",n=0,ws=false,cits=[],types={}
  try{
    var res=await client.messages.create({model:"claude-sonnet-4-5-20250929",max_tokens:8096,system:SYSTEM_PROMPT,messages:[{role:"user",content:msg}],tools:[{type:"web_search_20250305",name:"web_search",max_uses:5}],stream:true})
    for await(var ev of res){
      n++;types[ev.type]=(types[ev.type]||0)+1
      if(ev.type==="message_start"){var m=ev.message;console.log("  ["+n+"] message_start model="+(m?m.model:"?")+" input_tokens="+(m&&m.usage?m.usage.input_tokens:"?"))}
      else if(ev.type==="content_block_start"){var bt=ev.content_block?ev.content_block.type:"?";console.log("  ["+n+"] block_start idx="+(ev.index!=null?ev.index:"?")+" type="+bt);if(bt==="web_search_tool_use"||bt==="server_tool_use"){ws=true;console.log("         -> Web search")}}
      else if(ev.type==="content_block_delta"){var dt=ev.delta?ev.delta.type:"?"
        if(dt==="text_delta"){var tx=ev.delta.text||"";full+=tx;if(n<=50||n%20===0)console.log("  ["+n+"] text: "+JSON.stringify(tx.substring(0,60)))}
        else if(dt==="citations_delta"){var ci=ev.delta.citation;if(ci&&ci.url){cits.push({url:ci.url,title:ci.title||""});console.log("  ["+n+"] cite: "+ci.url)}}
        else console.log("  ["+n+"] "+dt)}
      else if(ev.type==="content_block_stop")console.log("  ["+n+"] block_stop idx="+(ev.index!=null?ev.index:"?"))
      else if(ev.type==="message_delta")console.log("  ["+n+"] msg_delta stop="+(ev.delta?ev.delta.stop_reason:"?")+" out_tokens="+(ev.usage?ev.usage.output_tokens:"?"))
      else if(ev.type==="message_stop")console.log("  ["+n+"] message_stop")
      else console.log("  ["+n+"] "+ev.type)
    }    var sec=((Date.now()-t0)/1000).toFixed(1)
    console.log("\n--- Results ---")
    console.log("  Events: "+n)
    console.log("  Types: "+JSON.stringify(types))
    console.log("  Web search: "+(ws?"YES":"no"))
    console.log("  Citations: "+cits.length)
    cits.forEach(function(ci){console.log("    - "+(ci.title||"?")+": "+ci.url)})
    console.log("  Response: "+full.length+" chars")
    console.log("  Time: "+sec+"s\n")
    console.log("--- Preview (500 chars) ---")
    console.log(full.substring(0,500))
    if(full.length>500)console.log("  ... ("+(full.length-500)+" more)")
    return{success:true}
  }catch(e){
    console.error("\n[ERROR] Claude failed after "+((Date.now()-t0)/1000).toFixed(1)+"s: "+e.message)
    if(e.status)console.error("  HTTP: "+e.status)
    if(e.error)console.error("  Body: "+JSON.stringify(e.error))
    return{success:false,error:e.message}
  }
}
async function main(){
  console.log("============================================================")
  console.log("  WORKX DASHBOARD -- Chat API Test Script")
  console.log("  "+new Date().toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam"}))
  console.log("============================================================")
  var r={}
  r.prisma=await analyzeAISources()
  r.claude=await testClaudeStreaming()
  separator("FINAL SUMMARY")
  console.log("  Prisma: "+(r.prisma.success?"PASS":"FAIL -- "+r.prisma.error))
  console.log("  Claude: "+(r.claude.success?"PASS":"FAIL -- "+r.claude.error))
  var ok=r.prisma.success&&r.claude.success
  console.log("\n  Overall: "+(ok?"ALL TESTS PASSED":"SOME TESTS FAILED"))
  if(!ok)process.exitCode=1
}

main()
  .catch(function(e){console.error("\nFATAL:",e);process.exitCode=1})
  .finally(function(){prisma["$disconnect"]()})