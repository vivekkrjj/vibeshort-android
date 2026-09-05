(() => {
"use strict";

const sources=[
"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
"https://www.w3schools.com/html/mov_bbb.mp4",
"https://media.w3.org/2010/05/sintel/trailer.mp4"
];
const captions=[
"Welcome to VibeShort 🎬","Short videos. Simple vibes. ❤️","Discover something new every day ✨",
"Keep scrolling for more 🔥","Your daily dose of Shorts","Create. Share. Vibe.",
"New creators, new vibes","Watch • Like • Follow","Entertainment in short form",
"Make every second count","Trending vibes today","Just one more Short 😄",
"Find your next favorite creator","VibeShort community","Endless short-video vibes"
];
const users=["@vibeshort","@creator","@travelvibes","@musicvibes","@dailyshorts"];
const demo=Array.from({length:15},(_,i)=>({
 id:"demo"+(i+1),user:users[i%users.length],caption:captions[i],
 music:i%2?"VibeShort sound":"Original sound",src:sources[i%3]
}));

const SUPABASE_URL="https://dmwutlgstwfftoxithiu.supabase.co";
const SUPABASE_KEY="sb_publishable_tRJpnplwlf-TZ_HhqWEuQQ_pHoTrbBt";
const state={
 videos:demo.slice(), liked:new Set(JSON.parse(localStorage.getItem("vs_liked")||"[]")),
 followed:new Set(JSON.parse(localStorage.getItem("vs_followed")||"[]")),
 saved:new Set(JSON.parse(localStorage.getItem("vs_saved")||"[]")), comments:{},
 supabase:null,user:null,blocked:new Set(),realtimeStarted:false, youtubeKey:localStorage.getItem("vs_youtube_key")||"", ytSeen:new Set(JSON.parse(localStorage.getItem("vs_yt_seen")||"[]")),
ytServed:new Set(),
ytLoading:false, ytBatch:0, ytApiReady:false, ytPlayerMap:new Map(), ytWatchTimers:new Map(),
 soundEnabled:false, soundUnlocked:false
};
const $=id=>document.getElementById(id);
const feed=$("feed"),modal=$("modal"),content=$("modalContent");
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function save(){localStorage.setItem("vs_liked",JSON.stringify([...state.liked]));localStorage.setItem("vs_followed",JSON.stringify([...state.followed]));localStorage.setItem("vs_saved",JSON.stringify([...state.saved]));}
function toast(t){const x=$("toast");x.textContent=t;x.style.display="block";clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.style.display="none",1800)}
function openModal(h){content.innerHTML=h;modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden");content.innerHTML=""}
$("modalClose").onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()}


function saveYTSeen(){
 localStorage.setItem("vs_yt_seen",JSON.stringify([...state.ytSeen].slice(-10000)))
}
function youtubeEmbed(id){
 const origin=encodeURIComponent(location.origin);
 return `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1&autoplay=1&mute=1&playsinline=1&controls=1&rel=0&modestbranding=1${location.protocol.startsWith("http")?`&origin=${origin}`:""}`
}
function ensureYouTubeApi(){
 if(window.YT?.Player){state.ytApiReady=true;return Promise.resolve()}
 return new Promise(resolve=>{
   if(!document.getElementById("yt-iframe-api")){
     const s=document.createElement("script");s.id="yt-iframe-api";s.src="https://www.youtube.com/iframe_api";document.head.appendChild(s)
   }
   const old=window.onYouTubeIframeAPIReady;
   window.onYouTubeIframeAPIReady=()=>{old?.();state.ytApiReady=true;resolve()}
   setTimeout(()=>{if(window.YT?.Player){state.ytApiReady=true;resolve()}},5000)
 })
}
async function loadYouTubeRandom(count=12){
 if(!state.youtubeKey){toast("Setup → YouTube Shorts me API key add karein");return false}
 if(state.ytLoading)return false;
 state.ytLoading=true;
 const queries=[
  "funny shorts","music shorts","travel shorts","food shorts","sports shorts",
  "gaming shorts","animals shorts","science shorts","comedy shorts","motivation shorts",
  "dance shorts","technology shorts","nature shorts","life hacks shorts","entertainment shorts"
 ];
 const shuffled=queries.slice().sort(()=>Math.random()-.5);
 const picked=shuffled.slice(0,2); // quota-friendly: 2 searches = up to 100 candidates
 const found=[];
 try{
   for(const q of picked){
     const u=`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&videoEmbeddable=true&videoSyndicated=true&maxResults=50&q=${encodeURIComponent(q)}&key=${encodeURIComponent(state.youtubeKey)}`;
     const r=await fetch(u);
     const j=await r.json();
     if(j.error)throw new Error(j.error.message||"YouTube API error");
     (j.items||[]).sort(()=>Math.random()-.5).forEach(x=>{
       const id=x.id?.videoId;
       if(id && !state.ytSeen.has(id) && !state.ytServed.has(id) && !found.some(v=>v.youtubeId===id)){
         found.push({
           id:"yt_"+id,youtubeId:id,type:"youtube",src:youtubeEmbed(id),
           user:"@"+(x.snippet?.channelTitle||"YouTube"),
           display_name:x.snippet?.channelTitle||"YouTube",caption:x.snippet?.title||"",
           music:"YouTube • Short video",avatar_url:"",likes:0,commentsCount:0,views:0
         });
       }
     });
   }
   const out=found.slice(0,count);
   out.forEach(v=>state.ytServed.add(v.youtubeId));
   if(out.length){
     // First batch is mixed with creator videos; later batches are appended so the
     // user can keep scrolling without replacing the current feed.
     const hasYT=state.videos.some(v=>v.type==="youtube");
     state.videos=hasYT ? state.videos.concat(out) : interleaveRandom(state.videos.filter(v=>v.type!=="youtube"),out);
     render();
     toast(`${out.length} new YouTube videos added`);
     return true;
   }
   toast("New YouTube videos nahi mile. Refresh karke dobara try karein.");
   return false;
 }catch(e){
   console.warn("YouTube",e);
   toast("YouTube: "+e.message);
   return false;
 }finally{state.ytLoading=false}
}
function interleaveRandom(base,yt){
 const a=base.slice().sort(()=>Math.random()-.5);
 const b=yt.slice().sort(()=>Math.random()-.5);
 const out=[], max=Math.max(a.length,b.length);
 for(let i=0;i<max;i++){
   if(b[i])out.push(b[i]);
   if(a[i])out.push(a[i]);
 }
 return out;
}
function markYouTubeWatched(id){
 if(!id || state.ytSeen.has(id))return;
 state.ytSeen.add(id);
 state.ytServed.add(id);
 saveYTSeen();
}
function openYouTubeSetup(){
 openModal(`<h2>YouTube Shorts</h2>
 <p class="muted">Official YouTube Data API v3 se fresh random short-form videos load honge. Feed me VibeShort creators + YouTube dono mix honge.
 <p class="muted">⚠️ YouTube player ke liye VibeShort ko <b>START_VIBESHORT.bat</b> se localhost par chalayein; index.html ko direct double-click karke na kholen.</p></p>
 <input id="ytKey" type="password" placeholder="YouTube Data API v3 key" value="${esc(state.youtubeKey)}">
 <button class="primary" id="saveYT">Save & Load YouTube</button>
 <button id="clearYT">Clear watched YouTube history</button>
 <p class="muted">API key ko Google Cloud me YouTube Data API v3 tak restrict karna recommended hai. videoDuration=short 4 minutes se kam videos deta hai; official Shorts-only filter available nahi hai.</p>`);
 $("saveYT").onclick=async()=>{
   state.youtubeKey=$("ytKey").value.trim();
   localStorage.setItem("vs_youtube_key",state.youtubeKey);
   state.ytServed.clear();
   closeModal();
   if(state.youtubeKey) await loadYouTubeRandom(12); else toast("YouTube key cleared");
 };
 $("clearYT").onclick=()=>{
   state.ytSeen.clear();state.ytServed.clear();saveYTSeen();
   toast("YouTube watched history cleared");
 };
}
async function initYouTubePlayers(){
 if(!state.videos.some(v=>v.type==="youtube"))return;
 await ensureYouTubeApi();
 if(!window.YT?.Player)return;
 document.querySelectorAll("iframe.ytframe").forEach(frame=>{
   if(frame.dataset.ytReady==="1")return;
   const id=frame.id;
   const videoId=frame.dataset.videoId;
   if(!id||!videoId)return;
   frame.dataset.ytReady="1";
   const player=new YT.Player(id,{
     events:{
       onError:e=>{
         console.warn("YouTube player error",videoId,e.data);
         if(e.data===153) toast("YouTube player ko website se open karein. START_VIBESHORT.bat se VibeShort chalayen.");
         else if(e.data===101||e.data===150) toast("Ye YouTube video embedding allow nahi karta.");
       },
       onAutoplayBlocked:()=>{
         // User can still press the native YouTube play button.
         console.info("YouTube autoplay blocked", videoId);
       },
       onStateChange:e=>{
         const item=state.videos.find(v=>v.youtubeId===videoId);
         if(!item)return;
         if(e.data===YT.PlayerState.PLAYING){
           if(state.soundEnabled){try{player.unMute();player.setVolume(100)}catch{}};
           clearTimeout(state.ytWatchTimers.get(videoId));
           const timer=setTimeout(()=>{
             markYouTubeWatched(videoId);
             recordView(item,5);
           },5000);
           state.ytWatchTimers.set(videoId,timer);
         }else if(e.data===YT.PlayerState.PAUSED || e.data===YT.PlayerState.ENDED){
           clearTimeout(state.ytWatchTimers.get(videoId));
           state.ytWatchTimers.delete(videoId);
           if(e.data===YT.PlayerState.ENDED)markYouTubeWatched(videoId);
         }
       }
     }
   });
   state.ytPlayerMap.set(videoId,player);
 });
}
function rankForYou(v){
  const base=(Number(v.likes)||0)*2+(Number(v.views)||0)*0.08;
  const social=state.followed.has(v.user)?40:0;
  const personal=state.liked.has(v.id)?8:0;
  return base+social+personal;
}
async function loadCloudVideos(){
  if(!state.supabase)return;
  try{
    const {data,error}=await state.supabase
      .from("vibe_videos")
      .select("id,user_id,video_url,caption,music,likes_count,comments_count,views_count,created_at,vibe_profiles(username,display_name,avatar_url)")
      .eq("status","published").order("created_at",{ascending:false}).limit(80);
    if(error){console.warn("cloud feed",error);return}
    if(data?.length){
      const cloud=data.filter(v=>!state.blocked.has(v.user_id)).map(v=>({
        id:v.id,user_id:v.user_id,src:v.video_url,
        user:"@"+(v.vibe_profiles?.username||"creator"),
        display_name:v.vibe_profiles?.display_name||"",
        avatar_url:v.vibe_profiles?.avatar_url||"",
        caption:v.caption||"",music:v.music||"Original sound",
        likes:v.likes_count||0,commentsCount:v.comments_count||0,views:v.views_count||0,
        created_at:v.created_at
      }));
      state.videos=cloud.length?cloud.sort((a,b)=>rankForYou(b)-rankForYou(a)):demo.slice();
      render();
      if(state.user) await loadMyRelations(false);
    }
  }catch(e){console.warn(e)}
}
async function loadMyRelations(rerender=true){
  if(!state.supabase||!state.user)return;
  try{
    const uid=state.user.id;
    const [likes,follows,saved,blocks]=await Promise.all([
      state.supabase.from("vibe_likes").select("video_id").eq("user_id",uid),
      state.supabase.from("vibe_follows").select("following_id").eq("follower_id",uid),
      state.supabase.from("vibe_saved_videos").select("video_id").eq("user_id",uid),
      state.supabase.from("vibe_blocks").select("blocked_id").eq("blocker_id",uid)
    ]);
    state.liked=new Set((likes.data||[]).map(x=>x.video_id));
    state.saved=new Set((saved.data||[]).map(x=>x.video_id));
    state.blocked=new Set((blocks.data||[]).map(x=>x.blocked_id));
    state.followed=new Set();
    if(follows.data?.length){
      const ids=new Set(follows.data.map(x=>x.following_id));
      state.videos.filter(v=>ids.has(v.user_id)).forEach(v=>state.followed.add(v.user));
    }
    save();
    if(rerender)render();
  }catch(e){console.warn(e)}
}
function isCloudId(id){return !!id && !String(id).startsWith("demo") && !String(id).startsWith("local_")}
async function cloudLike(id){
  if(!state.supabase||!state.user||!isCloudId(id))return false;
  const has=state.liked.has(id);
  const q=has
    ? state.supabase.from("vibe_likes").delete().eq("user_id",state.user.id).eq("video_id",id)
    : state.supabase.from("vibe_likes").insert({user_id:state.user.id,video_id:id});
  const {error}=await q;
  if(error){toast(error.message);return false}
  has?state.liked.delete(id):state.liked.add(id);save();render();return true;
}
async function cloudFollow(userName){
  if(!state.supabase||!state.user)return false;
  const v=state.videos.find(x=>x.user===userName);
  if(!v?.user_id||v.user_id===state.user.id){toast("Cannot follow this account");return false}
  const has=state.followed.has(userName);
  const q=has
    ? state.supabase.from("vibe_follows").delete().eq("follower_id",state.user.id).eq("following_id",v.user_id)
    : state.supabase.from("vibe_follows").insert({follower_id:state.user.id,following_id:v.user_id});
  const {error}=await q;if(error){toast(error.message);return false}
  has?state.followed.delete(userName):state.followed.add(userName);save();render();return true;
}
async function cloudSave(id){
  if(!state.supabase||!state.user||!isCloudId(id))return false;
  const has=state.saved.has(id);
  const q=has
    ? state.supabase.from("vibe_saved_videos").delete().eq("user_id",state.user.id).eq("video_id",id)
    : state.supabase.from("vibe_saved_videos").insert({user_id:state.user.id,video_id:id});
  const {error}=await q;if(error){toast(error.message);return false}
  has?state.saved.delete(id):state.saved.add(id);save();render();return true;
}
async function publishCloud(file,caption){
  if(!state.supabase||!state.user)return false;
  const path=state.user.id+"/"+Date.now()+"_"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const up=await state.supabase.storage.from("vibe-videos").upload(path,file,{contentType:file.type||"video/mp4",upsert:false});
  if(up.error){toast(up.error.message);return false}
  const pub=state.supabase.storage.from("vibe-videos").getPublicUrl(path).data.publicUrl;
  const ins=await state.supabase.from("vibe_videos").insert({user_id:state.user.id,video_url:pub,storage_path:path,caption:caption||"My new Short 🎬",music:"Original sound"}).select().single();
  if(ins.error){await state.supabase.storage.from("vibe-videos").remove([path]);toast(ins.error.message);return false}
  return true;
}
async function reportVideo(id){
  if(!state.supabase||!state.user){toast("Login required to report");return}
  openModal(`<h2>Report Video</h2><select id="reportReason" style="width:100%;background:#282828;color:#fff;padding:11px;border-radius:10px"><option value="restricted_illegal">Restricted / illegal content</option><option value="privacy">Privacy misuse</option><option value="harassment">Harassment</option><option value="copyright">Copyright</option><option value="violence_danger">Violence / dangerous content</option><option value="spam_scam">Spam / scam</option><option value="other">Other</option></select><textarea id="reportDetails" placeholder="Details (optional)"></textarea><button class="primary" id="sendReport">Submit Report</button>`);
  $("sendReport").onclick=async()=>{const {error}=await state.supabase.from("vibe_reports").insert({video_id:id,reporter_id:state.user.id,reason:$("reportReason").value,details:$("reportDetails").value.trim()});if(error)toast(error.message);else{closeModal();toast("Report submitted")}};
}

const viewedOnce=new Set();
function recordView(v, seconds=0){
 if(!state.supabase||!state.user||!v?.id||String(v.id).startsWith("demo")) return;
 const key=v.id;
 if(viewedOnce.has(key) && seconds<2) return;
 viewedOnce.add(key);
 state.supabase.rpc("vibe_record_view",{p_video_id:v.id,p_seconds:Math.max(0,Math.floor(seconds||0))}).then(()=>{}).catch(()=>{});
}


function currentCard(){
  const cards=[...document.querySelectorAll(".card")];
  return cards.find(c=>{
    const r=c.getBoundingClientRect();
    return r.top < innerHeight*.55 && r.bottom > innerHeight*.45;
  }) || cards[0];
}
function setVideoSound(on){
  state.soundEnabled=!!on;
  document.querySelectorAll("video").forEach(v=>{v.muted=!state.soundEnabled; if(state.soundEnabled){v.volume=1}});
  state.ytPlayerMap.forEach(p=>{try{state.soundEnabled?p.unMute():p.mute();p.setVolume(100)}catch{}});
  $("soundToggle").textContent=state.soundEnabled?"🔊":"🔇";
  $("soundUnlock")?.classList.toggle("hidden",state.soundEnabled);
}
function unlockSound(){
  state.soundUnlocked=true;
  setVideoSound(true);
  const c=currentCard();
  const v=c?.querySelector("video");
  if(v){v.muted=false;v.volume=1;v.play().catch(()=>{})}
  const yt=c?.querySelector("iframe.ytframe");
  if(yt){const p=state.ytPlayerMap.get(yt.dataset.videoId);try{p?.unMute();p?.setVolume(100);p?.playVideo()}catch{}}
}
function wireSoundControls(){
  $("soundUnlock")?.addEventListener("click",unlockSound);
  $("soundToggle")?.addEventListener("click",()=>setVideoSound(!state.soundEnabled));
  const firstGesture=()=>{if(!state.soundUnlocked)unlockSound();};
  ["pointerdown","touchstart","keydown"].forEach(ev=>document.addEventListener(ev,firstGesture,{once:true,passive:true}));
}
function render(list=state.videos){
 feed.innerHTML="";
 list.forEach(v=>{
  const c=document.createElement("section");c.className="card";c.dataset.id=v.id;
  c.innerHTML=`${v.type==="youtube"?`<iframe id="yt_${esc(v.youtubeId)}" class="ytframe" data-video-id="${esc(v.youtubeId)}" src="${esc(v.src)}" title="YouTube Short" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`:`<video src="${esc(v.src)}" playsinline autoplay muted loop preload="metadata"></video>`}<div class="shade"></div>
  <div class="info"><button class="creator-link" data-creator="${esc(v.user_id||"")}" data-user="${esc(v.user)}">${esc(v.user)}</button><div class="caption">${esc(v.caption)}</div><div class="music">♫ ${esc(v.music)}</div></div>
  <div class="actions">
  <button class="action like ${state.liked.has(v.id)?"liked":""}" data-id="${v.id}">♥<small>${state.liked.has(v.id)?"Liked":"Like"}</small></button>
  <button class="action comment" data-id="${v.id}">💬<small>Comment</small></button>
  <button class="action follow" data-user="${esc(v.user)}">${state.followed.has(v.user)?"✓":"＋"}<small>${state.followed.has(v.user)?"Following":"Follow"}</small></button>
  <button class="action save" data-id="${v.id}">${state.saved.has(v.id)?"★":"☆"}<small>Save</small></button>
  <button class="action share" data-id="${v.id}">↗<small>Share</small></button><button class="action report" data-id="${v.id}">⚑<small>Report</small></button></div>`;
  feed.appendChild(c);
 });
 observe();
}
function observe(){
 const cards=[...document.querySelectorAll(".card")];
 if(!("IntersectionObserver" in window)){cards[0]?.querySelector("video")?.play().catch(()=>{});initYouTubePlayers();return}
 const io=new IntersectionObserver(es=>es.forEach(e=>{
   const v=e.target.querySelector("video");
   const yt=e.target.querySelector("iframe.ytframe");
   const item=state.videos.find(x=>x.id===e.target.dataset.id);
   if(e.isIntersecting&&e.intersectionRatio>.6){
     cards.forEach(c=>{
       if(c!==e.target){
         const vv=c.querySelector("video");if(vv)vv.pause();
         const ff=c.querySelector("iframe.ytframe");
         if(ff){
           const p=state.ytPlayerMap.get(ff.dataset.videoId);
           try{p?.pauseVideo()}catch{}
         }
       }
     });
     if(v){v.muted=!state.soundEnabled;v.volume=1;v.play().catch(()=>{});}
     if(item?.type==="youtube"){
       const p=state.ytPlayerMap.get(item.youtubeId);
       try{p?.playVideo()}catch{}
     }
     recordView(item,0);
     // Load the next YouTube batch before the user reaches the end.
     const idx=state.videos.findIndex(x=>x.id===item?.id);
     if(item?.type==="youtube" && idx>=state.videos.length-4) loadYouTubeRandom(10);
   }else{
     if(v){if(!v.paused)recordView(item,v.currentTime||0);v.pause();}
     if(yt){
       const p=state.ytPlayerMap.get(yt.dataset.videoId);
       try{p?.pauseVideo()}catch{}
     }
   }
 }),{root:feed,threshold:[.6]});
 cards.forEach(c=>io.observe(c));
 initYouTubePlayers();
}
feed.addEventListener("click",async e=>{
 const creator=e.target.closest(".creator-link");
 if(creator){await openCreatorProfile(creator.dataset.creator||null,creator.dataset.user);return}
 const b=e.target.closest("button");if(!b)return;const id=b.dataset.id;
 const cloud=isCloudId(id);
 if(b.classList.contains("like")){
   if(cloud){if(state.supabase&&state.user)await cloudLike(id);else toast("Login required")}
   else{state.liked.has(id)?state.liked.delete(id):state.liked.add(id);save();render()}
 }
 else if(b.classList.contains("follow")){if(state.supabase&&state.user)await cloudFollow(b.dataset.user);else toast("Login required")}
 else if(b.classList.contains("save")){
   if(cloud){if(state.supabase&&state.user)await cloudSave(id);else toast("Login required")}
   else{state.saved.has(id)?state.saved.delete(id):state.saved.add(id);save();render()}
 }
 else if(b.classList.contains("share")){navigator.clipboard?.writeText(location.href+"#"+id);toast("Video link copied")}
 else if(b.classList.contains("comment")){
   if(cloud && !state.user){toast("Login required");return}
   openComments(id);
 }
 else if(b.classList.contains("report")){
   if(!cloud){toast("Demo video cannot be reported");return}
   reportVideo(id);
 }
});
async function openComments(id){
 let arr=[];
 if(state.supabase&&isCloudId(id)){
   const r=await state.supabase.from("vibe_comments").select("id,body,created_at,vibe_profiles(username,display_name)").eq("video_id",id).order("created_at",{ascending:true}).limit(100);
   if(!r.error) arr=r.data||[];
 }
 if(!arr.length) arr=(state.comments[id]||[]).map((body,i)=>({id:"local"+i,body,created_at:null,vibe_profiles:{username:"you"}}));
 openModal(`<h2>Comments</h2><div class="results" id="commentList">${arr.length?arr.map(x=>`<p>💬 <b>${esc(x.vibe_profiles?.display_name||x.vibe_profiles?.username||"User")}</b> ${esc(x.body)}</p>`).join(""):"<p style='color:#aaa'>No comments yet.</p>"}</div><textarea id="commentText" placeholder="Write a comment..."></textarea><button class="primary" id="postComment">Post Comment</button>`);
 $("postComment").onclick=async()=>{
   let t=$("commentText").value.trim(); if(!t)return;
   if(state.supabase&&state.user&&isCloudId(id)){
     const r=await state.supabase.from("vibe_comments").insert({video_id:id,user_id:state.user.id,body:t});
     if(r.error){toast(r.error.message);return}
   }else{
     (state.comments[id]??=[]).push(t);
   }
   await openComments(id);
 };
}


async function countRows(table,column,value){
 const r=await state.supabase.from(table).select("*",{count:"exact",head:true}).eq(column,value);
 return r.count||0;
}
function shortListHtml(videos){
 if(!videos?.length)return "<p class='muted'>No Shorts yet.</p>";
 return videos.map(v=>`<div class="result list-video openShort" data-id="${esc(v.id)}"><div class="thumb"><video src="${esc(v.src||v.video_url)}" muted preload="metadata"></video></div><div><b>${esc(v.caption||"Untitled Short")}</b><br><span class="muted">♫ ${esc(v.music||"Original sound")}</span></div></div>`).join("");
}
function attachShortOpen(){
 document.querySelectorAll(".openShort").forEach(x=>x.onclick=()=>{
   const id=x.dataset.id;closeModal();render();
   setTimeout(()=>document.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:"smooth"}),80);
 });
}
async function openCreatorProfile(uid,userName){
 if(!uid||!isCloudId(uid)){
   const vids=state.videos.filter(v=>v.user===userName);
   openModal(`<div class="profile-head"><div class="avatar">🎬</div><h2>${esc(userName||"Creator")}</h2><p class="muted">Demo creator profile</p></div><div class="stats"><div class="stat"><b>—</b><small>Followers</small></div><div class="stat"><b>—</b><small>Following</small></div><div class="stat"><b>${vids.length}</b><small>Shorts</small></div></div><h3>Shorts</h3><div class="results">${shortListHtml(vids)}</div>`);
   attachShortOpen();return;
 }
 const [pr,followers,following,vr]=await Promise.all([
   state.supabase.from("vibe_profiles").select("id,username,display_name,avatar_url,banned").eq("id",uid).maybeSingle(),
   countRows("vibe_follows","following_id",uid),
   countRows("vibe_follows","follower_id",uid),
   state.supabase.from("vibe_videos").select("id,user_id,video_url,caption,music,created_at").eq("user_id",uid).eq("status","published").order("created_at",{ascending:false}).limit(30)
 ]);
 const p=pr.data||{username:(userName||"creator").replace(/^@/,"")};
 const vids=(vr.data||[]).map(v=>({...v,src:v.video_url,user:"@"+p.username}));
 const mine=state.user?.id===uid, followed=state.followed.has("@"+p.username), blocked=state.blocked.has(uid);
 const avatar=p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:"👤";
 openModal(`<div class="profile-head"><div class="avatar">${avatar}</div><h2>${esc(p.display_name||("@"+p.username))}</h2><div class="muted">@${esc(p.username||"creator")}</div>${p.banned?'<p><span class="badge">Banned</span></p>':""}</div><div class="stats"><div class="stat"><b>${followers}</b><small>Followers</small></div><div class="stat"><b>${following}</b><small>Following</small></div><div class="stat"><b>${vids.length}</b><small>Shorts</small></div></div>${!mine?`<div class="row-actions"><button class="primary" id="profileFollow">${followed?"Unfollow":"Follow"}</button><button class="primary danger" id="blockUser">${blocked?"Unblock":"Block"}</button></div>`:""}<h3>Shorts</h3><div class="results">${shortListHtml(vids)}</div>`);
 $("profileFollow")?.addEventListener("click",async()=>{await cloudFollow("@"+p.username);await openCreatorProfile(uid,"@"+p.username)});
 $("blockUser")?.addEventListener("click",async()=>{await toggleBlock(uid,blocked);});
 attachShortOpen();
}
async function toggleBlock(uid,currentlyBlocked){
 if(!state.supabase||!state.user){toast("Login required");return}
 if(uid===state.user.id){toast("You cannot block yourself");return}
 const q=currentlyBlocked
   ? state.supabase.from("vibe_blocks").delete().eq("blocker_id",state.user.id).eq("blocked_id",uid)
   : state.supabase.from("vibe_blocks").insert({blocker_id:state.user.id,blocked_id:uid});
 const {error}=await q;if(error){toast(error.message);return}
 currentlyBlocked?state.blocked.delete(uid):state.blocked.add(uid);
 closeModal();await loadCloudVideos();toast(currentlyBlocked?"User unblocked":"User blocked");
}
async function editProfileUI(){
 const r=await state.supabase.from("vibe_profiles").select("username,display_name").eq("id",state.user.id).maybeSingle();
 const p=r.data||{};
 openModal(`<h2>Edit Profile</h2><input id="editName" placeholder="Display name" value="${esc(p.display_name||"")}"><input id="editUser" placeholder="Username" value="${esc(p.username||"")}"><button class="primary" id="saveProfile">Save Profile</button><p id="editMsg" class="muted"></p>`);
 $("saveProfile").onclick=async()=>{
   const username=$("editUser").value.trim().replace(/^@/,"").toLowerCase();
   const display_name=$("editName").value.trim();
   if(!/^[a-z0-9_]{3,30}$/.test(username)){$("editMsg").textContent="Username: 3-30 letters, numbers or underscore";return}
   const u=await state.supabase.from("vibe_profiles").update({username,display_name}).eq("id",state.user.id);
   if(u.error){$("editMsg").textContent=u.error.message;return}
   closeModal();await loadCloudVideos();toast("Profile updated");
 };
}
async function showSavedVideos(){
 if(!state.user){toast("Login required");return}
 const r=await state.supabase.from("vibe_saved_videos").select("video_id,created_at,vibe_videos(id,user_id,video_url,caption,music,status)").eq("user_id",state.user.id).order("created_at",{ascending:false});
 const vids=(r.data||[]).map(x=>x.vibe_videos).filter(v=>v&&v.status==="published").map(v=>({...v,src:v.video_url}));
 openModal(`<h2>Saved Videos</h2><div class="results">${shortListHtml(vids)}</div>`);attachShortOpen();
}
async function showWatchHistory(){
 if(!state.user){toast("Login required");return}
 const r=await state.supabase.from("vibe_watch_history").select("video_id,watched_seconds,last_watched_at,vibe_videos(id,user_id,video_url,caption,music,status)").eq("user_id",state.user.id).order("last_watched_at",{ascending:false}).limit(50);
 const rows=(r.data||[]).filter(x=>x.vibe_videos&&x.vibe_videos.status==="published");
 openModal(`<h2>Watch History</h2><div class="results">${rows.length?rows.map(x=>`<div class="result list-video openShort" data-id="${esc(x.vibe_videos.id)}"><div class="thumb"><video src="${esc(x.vibe_videos.video_url)}" muted preload="metadata"></video></div><div><b>${esc(x.vibe_videos.caption||"Short")}</b><br><span class="muted">Watched ${Number(x.watched_seconds)||0}s • ${new Date(x.last_watched_at).toLocaleString()}</span></div></div>`).join(""):"<p class='muted'>No watch history yet.</p>"}</div>`);attachShortOpen();
}
async function openMyProfile(){
 if(state.supabase)await refreshUser();
 if(!state.user){
   openModal(`<h2>Profile</h2><p class="muted">Login or create an account to use your profile, Saved Videos and Watch History.</p><button class="primary" id="profileLogin">Login / Create Account</button>`);
   $("profileLogin").onclick=()=>{closeModal();authUI()};return;
 }
 const [pr,followers,following,shorts]=await Promise.all([
   state.supabase.from("vibe_profiles").select("id,username,display_name,avatar_url,role,banned").eq("id",state.user.id).maybeSingle(),
   countRows("vibe_follows","following_id",state.user.id),
   countRows("vibe_follows","follower_id",state.user.id),
   countRows("vibe_videos","user_id",state.user.id)
 ]);
 const p=pr.data||{};
 openModal(`<div class="profile-head"><div class="avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:"👤"}</div><h2>${esc(p.display_name||state.user.email)}</h2><div class="muted">${p.username?"@"+esc(p.username):esc(state.user.email)}</div>${p.banned?'<p><span class="badge">Account banned</span></p>':""}</div><div class="stats"><div class="stat"><b>${followers}</b><small>Followers</small></div><div class="stat"><b>${following}</b><small>Following</small></div><div class="stat"><b>${shorts}</b><small>Shorts</small></div></div><div class="profile-menu"><button class="primary" id="editProfile">Edit Profile</button><button class="primary" id="myShorts">My Shorts</button><button class="primary" id="savedVideos">★ Saved</button><button class="primary" id="historyVideos">◷ History</button></div>${p.role==="admin"?'<button class="primary" id="adminBtn">Admin Dashboard</button>':""}<button class="primary danger" id="logout">Logout</button>`);
 $("editProfile").onclick=editProfileUI;
 $("myShorts").onclick=()=>openCreatorProfile(state.user.id,p.username?"@"+p.username:"@me");
 $("savedVideos").onclick=showSavedVideos;
 $("historyVideos").onclick=showWatchHistory;
 $("adminBtn")?.addEventListener("click",adminUI);
 $("logout").onclick=async()=>{await state.supabase.auth.signOut();state.user=null;state.followed.clear();state.blocked.clear();closeModal();render();toast("Logged out")};
}
function startRealtime(){
 if(!state.supabase||state.realtimeStarted)return;
 state.realtimeStarted=true;
 state.supabase.channel("vibeshort-v11-feed")
   .on("postgres_changes",{event:"*",schema:"public",table:"vibe_videos"},()=>loadCloudVideos())
   .subscribe();
 if(state.user){
   state.supabase.channel("vibeshort-v11-notifications")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"vibe_notifications",filter:`user_id=eq.${state.user.id}`},()=>toast("🔔 New notification"))
    .subscribe();
 }
}
function supabaseReady(){
 return !!(window.supabase && SUPABASE_URL && SUPABASE_KEY);
}
function connectSB(){
 if(!supabaseReady())return false;
 try{
  state.supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  localStorage.setItem("vs_sb_url",SUPABASE_URL);
  localStorage.setItem("vs_sb_key",SUPABASE_KEY);
  return true;
 }catch(e){console.error(e);return false}
}
async function refreshUser(){
 if(!state.supabase)return;
 const {data}=await state.supabase.auth.getUser();state.user=data?.user||null;
 $("loginBtn").textContent=state.user?"✓ Logged in":"⌕ Login";
 startRealtime();
}
async function authUI(mode="login"){
 const isSignup=mode==="signup";
 openModal(`<h2>${isSignup?"Create your creator account":"Welcome back"}</h2>
 <div class="auth-tabs"><button class="${!isSignup?"primary":""}" id="tabLogin">Login</button><button class="${isSignup?"primary":""}" id="tabSignup">Create Account</button></div>
 <div id="signupExtra" style="${isSignup?"":"display:none"}">
   <label>Profile Photo</label><input id="avatarFile" type="file" accept="image/jpeg,image/png,image/webp">
   <input id="displayName" placeholder="Creator display name">
   <input id="username" placeholder="Unique username (e.g. vicky_creator)">
   <textarea id="bio" placeholder="Short creator bio"></textarea>
 </div>
 <input id="email" type="email" placeholder="Email address">
 <input id="password" type="password" placeholder="Password (minimum 6 characters)">
 <button class="primary" id="authGo">${isSignup?"Create Account":"Login"}</button>${!isSignup?`<div class="auth-links"><button class="linkbtn" id="forgotPassword">Forgot password?</button></div>`:""}
 <p id="authMsg" class="muted"></p>`);
 $("tabLogin").onclick=()=>authUI("login");
 $("tabSignup").onclick=()=>authUI("signup");
 $("forgotPassword")?.addEventListener("click",async()=>{
   const email=$("email").value.trim().toLowerCase();
   const msg=$("authMsg");
   if(!email){msg.textContent="Enter your email first.";return}
   if(!state.supabase){msg.textContent="Supabase is not configured.";return}
   msg.textContent="Sending password reset email…";
   const r=await state.supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname+"?reset=1"});
   msg.textContent=r.error?r.error.message:"Password reset link sent. Inbox/Spam check karein.";
 });
 $("authGo").onclick=async()=>{
   const email=$("email").value.trim().toLowerCase(), pass=$("password").value;
   const msg=$("authMsg"); msg.textContent="Please wait…";
   if(!email||!pass){msg.textContent="Email and password are required.";return}
   if(pass.length<6){msg.textContent="Password must be at least 6 characters.";return}
   if(!state.supabase){msg.textContent="Supabase is not configured.";return}
   if(isSignup){
     const username=$("username").value.trim().replace(/^@/,"").toLowerCase();
     const displayName=$("displayName").value.trim();
     const bio=$("bio").value.trim();
     if(!/^[a-z0-9_]{3,30}$/.test(username)){msg.textContent="Username must be 3–30 characters: a-z, 0-9, _";return}
     if(!displayName){msg.textContent="Please enter your display name.";return}
     const photo=$("avatarFile").files[0];
     if(photo && photo.size>3*1024*1024){msg.textContent="Profile photo must be under 3 MB.";return}
     const check=await state.supabase.from("vibe_profiles").select("id").eq("username",username).maybeSingle();
     if(check.data){msg.textContent="This username is already taken. Choose another.";return}
     const s=await state.supabase.auth.signUp({email,password:pass,options:{data:{display_name:displayName,username},emailRedirectTo:window.location.origin+window.location.pathname}});
     if(s.error){msg.textContent=s.error.message;return}
     if(s.data.user){
       const profile={username,display_name:displayName,bio};
       if(photo){
         const ext=(photo.name.split(".").pop()||"jpg").toLowerCase();
         const path=`avatars/${s.data.user.id}.${ext}`;
         const up=await state.supabase.storage.from("vibe-avatars").upload(path,photo,{upsert:true,contentType:photo.type});
         if(!up.error){
           const pub=state.supabase.storage.from("vibe-avatars").getPublicUrl(path).data.publicUrl;
           profile.avatar_url=pub;
         }
       }
       const upd=await state.supabase.from("vibe_profiles").update(profile).eq("id",s.data.user.id);
       if(upd.error){msg.textContent=upd.error.message;return}
     }
     if(!s.data.session){msg.innerHTML="Account created. <b>Verification email bhej diya gaya hai.</b> Inbox/Spam check karein."; const rb=document.createElement("button"); rb.className="primary"; rb.textContent="Resend verification email"; rb.style.marginTop="10px"; rb.onclick=async()=>{const rr=await state.supabase.auth.resend({type:"signup",email}); msg.textContent=rr.error?rr.error.message:"Verification email resent. Inbox/Spam check karein."}; msg.appendChild(rb); return}
     state.user=s.data.user; closeModal();await loadMyRelations(false);await loadCloudVideos();toast("Creator account created");
   }else{
     const l=await state.supabase.auth.signInWithPassword({email,password:pass});
     if(l.error){msg.textContent=l.error.message;return}
     state.user=l.data.user;closeModal();await loadMyRelations(false);await loadCloudVideos();toast("Login successful");
   }
 };
}
function setupUI(){
 openModal(`<h2>Supabase Setup</h2><p style="color:#aaa">VibeShort V12 is already configured with your existing Supabase project.</p><p><b>Project:</b> dmwutlgstwfftoxithiu</p><button class="primary" id="testSB">Test Connection</button><button id="ytSetup">YouTube Shorts Setup</button>`);
 $("ytSetup").onclick=openYouTubeSetup;
 $("testSB").onclick=async()=>{
  if(connectSB()){await refreshUser();closeModal();toast("Supabase connected successfully")}else toast("Supabase connection failed");
 };
}

$("loginBtn").onclick=authUI;
$("profileBtn").onclick=openMyProfile;
$("notifyBtn").onclick=async()=>{
 if(!state.supabase||!state.user){openModal(`<h2>Notifications</h2><p style="color:#aaa">Login to see notifications.</p>`);return}
 const r=await state.supabase.from("vibe_notifications").select("id,message,is_read,created_at").order("created_at",{ascending:false}).limit(50);
 const rows=r.data||[];
 const html=rows.length?rows.map(n=>`<div class="result">${n.is_read?"":"🔴 "}${esc(n.message)}<br><small>${new Date(n.created_at).toLocaleString()}</small></div>`).join(""):"<p style='color:#aaa'>No notifications yet.</p>";
 openModal(`<h2>Notifications</h2><div class="results">${html}</div><button class="primary" id="readAll">Mark all as read</button>`);
 $("readAll").onclick=async()=>{await state.supabase.from("vibe_notifications").update({is_read:true}).eq("user_id",state.user.id).eq("is_read",false);closeModal();toast("Notifications marked read")};
};
$("setupBtn").onclick=setupUI;


async function adminUI(){
 if(!state.supabase||!state.user){toast("Login required");return}
 const {data:me}=await state.supabase.from("vibe_profiles").select("role,banned").eq("id",state.user.id).maybeSingle();
 const admin=me?.role==="admin";
 if(!admin){toast("Admin access required");return}
 const {data:reports}=await state.supabase.from("vibe_reports").select("id,video_id,reason,status,created_at,vibe_videos(caption)").eq("status","open").order("created_at",{ascending:false}).limit(30);
 const {data:users}=await state.supabase.from("vibe_profiles").select("id,username,display_name,role,banned,created_at").order("created_at",{ascending:false}).limit(50);
 openModal(`<h2>Admin Moderation</h2><p style="color:#aaa">${reports?.length||0} open reports</p><h3>Reports</h3><div class="results">${(reports||[]).map(r=>`<div class="result"><b>${esc(r.reason)}</b><br>${esc(r.vibe_videos?.caption||"Video")}<br><button class="primary removeBtn" data-id="${r.video_id}" style="margin-top:8px">Remove Video</button><button class="primary dismissBtn" data-id="${r.id}">Dismiss Report</button></div>`).join("")||"<p>No open reports.</p>"}</div><h3>Users</h3><div class="results">${(users||[]).map(u=>`<div class="result"><b>@${esc(u.username||"user")}</b> ${u.role==="admin"?"👑":""}<br>${esc(u.display_name||"")}<br>Status: ${u.banned?"BANNED":"Active"} ${u.id===state.user.id?"(you)":""}<br>${u.id!==state.user.id&&u.role!=="admin"?`<button class="primary banBtn" data-id="${u.id}" data-ban="${u.banned?"0":"1"}">${u.banned?"Unban":"Ban User"}</button>`:""}</div>`).join("")}</div>`);
 document.querySelectorAll(".removeBtn").forEach(x=>x.onclick=async()=>{const {error}=await state.supabase.from("vibe_videos").update({status:"removed"}).eq("id",x.dataset.id);if(error)toast(error.message);else{toast("Video removed");adminUI()}});
 document.querySelectorAll(".dismissBtn").forEach(x=>x.onclick=async()=>{await state.supabase.from("vibe_reports").update({status:"dismissed"}).eq("id",x.dataset.id);adminUI()});
 document.querySelectorAll(".banBtn").forEach(x=>x.onclick=async()=>{const {error}=await state.supabase.from("vibe_profiles").update({banned:x.dataset.ban==="1"}).eq("id",x.dataset.id);if(error)toast(error.message);else{toast(x.dataset.ban==="1"?"User banned":"User unbanned");adminUI()}});
}

function searchUI(){
 openModal(`<h2>Search</h2><input id="searchInput" placeholder="Search @creator, #hashtag, caption or music"><div class="results" id="results"></div>`);
 $("searchInput").oninput=()=>{
   const q=$("searchInput").value.trim().toLowerCase();
   const found=state.videos.filter(v=>(v.user+" "+v.caption+" "+v.music).toLowerCase().includes(q)).slice(0,50);
   $("results").innerHTML=found.map(v=>`<div class="result openSearch" data-id="${esc(v.id)}"><b>${esc(v.user)}</b> — ${esc(v.caption)}</div>`).join("")||"<p class='muted'>No results</p>";
 };
 $("results").onclick=e=>{let r=e.target.closest(".openSearch");if(r){const id=r.dataset.id;closeModal();render();setTimeout(()=>document.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:"smooth"}),80)}};
}
function uploadUI(){openModal(`<h2>Upload Short</h2><input id="file" type="file" accept="video/*"><input id="cap" placeholder="Caption"><button class="primary" id="upload">Publish Now</button><p style="color:#aaa;font-size:12px">Your video will publish immediately to VibeShort when you are logged in.</p>`);$("upload").onclick=async()=>{const f=$("file").files[0];if(!f){toast("Select a video first");return}
 if(state.supabase&&state.user){
   const prof=await state.supabase.from("vibe_profiles").select("banned").eq("id",state.user.id).maybeSingle();
   if(prof.data?.banned){toast("Your account is banned");return}
   const ok=await publishCloud(f,$("cap").value.trim());if(ok){closeModal();await loadCloudVideos();feed.scrollTo({top:0,behavior:"smooth"});toast("Published to VibeShort")}
 }else{
   state.videos.unshift({id:"local_"+Date.now(),user:"@you",caption:$("cap").value||"My new Short 🎬",music:"Original sound",src:URL.createObjectURL(f)});closeModal();render();feed.scrollTo({top:0,behavior:"smooth"});toast("Published locally")
 }
}}
document.querySelectorAll(".navbtn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".navbtn").forEach(x=>x.classList.remove("active"));b.classList.add("active");const n=b.dataset.nav;if(n==="upload")uploadUI();else if(n==="search")searchUI();else if(n==="following"){const x=state.videos.filter(v=>state.followed.has(v.user));render(x.length?x:[{...demo[0],caption:"Follow creators to see their videos here."}])}else render(state.videos.slice().sort((a,b)=>rankForYou(b)-rankForYou(a)))});
window.addEventListener("keydown",e=>{if(e.key==="ArrowDown"||e.key==="PageDown")feed.scrollBy({top:innerHeight,behavior:"smooth"});if(e.key==="ArrowUp"||e.key==="PageUp")feed.scrollBy({top:-innerHeight,behavior:"smooth"})});

async function handlePasswordReset(){
  if(!state.supabase)return;
  const isReset=new URLSearchParams(location.search).get("reset")==="1" || /type=recovery/.test(location.hash);
  if(!isReset)return;
  openModal(`<h2>Set New Password</h2><input id="newPass" type="password" placeholder="New password (minimum 6 characters)"><input id="newPass2" type="password" placeholder="Confirm new password"><button class="primary" id="saveNewPass">Update Password</button><p id="resetMsg" class="muted"></p>`);
  $("saveNewPass").onclick=async()=>{
    const a=$("newPass").value,b=$("newPass2").value,m=$("resetMsg");
    if(a.length<6){m.textContent="Password must be at least 6 characters.";return}
    if(a!==b){m.textContent="Passwords do not match.";return}
    const r=await state.supabase.auth.updateUser({password:a});
    if(r.error){m.textContent=r.error.message;return}
    history.replaceState({},document.title,location.pathname);
    closeModal();toast("Password updated successfully");
  };
}
connectSB();refreshUser().then(async()=>{if(state.user)await loadMyRelations(false);await loadCloudVideos();if(state.youtubeKey)setTimeout(()=>loadYouTubeRandom(12),600)});render();
handlePasswordReset();
})();