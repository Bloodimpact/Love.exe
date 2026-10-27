/* LOVE.exe — Supabase-backed two-player couples game.
   Configure SUPABASE_URL and SUPABASE_ANON_KEY below after creating your project. */
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR_') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('YOUR_');
const $ = (id) => document.getElementById(id);
const LEVELS = [
 {title:'First Impression',description:'Where your story began.',category:'FIRST IMPRESSION',questions:[
 'What was your very first impression of me, and what changed it?',
 'When did you first realize I might be someone special to you?',
 'What little detail about me did you notice before I realized you noticed?',
 'What song, place, or moment reminds you of the beginning of us?',
 'What were you nervous to tell me when we first got close?',
 'What is one early memory of us that still makes you smile?',
 'What do you think we misunderstood about each other at first?',
 'When did talking to me become part of your daily routine?',
 'What would you tell the version of you who was just getting to know me?',
 'Describe the beginning of our story in three words.' ]},
 {title:'Heart.exe',description:'The small things that mean everything.',category:'THE HEART FILES',questions:[
 'What is one thing I do that makes you feel genuinely loved?',
 'When you have a rough day, what kind of support do you want from me?',
 'What is a tiny thing about us that you hope never changes?',
 'What makes you feel safest when you are with me?',
 'What is something you wish I understood about you without you having to explain it?',
 'Which memory of us would you replay on a bad day?',
 'What kind of affection makes you feel closest to me?',
 'What is one way I have helped you grow?',
 'What is something you want us to do more often?',
 'Finish this sentence: I feel most like myself with you when…' ]},
 {title:'No Filter',description:'Honest answers, gentle hearts.',category:'NO FILTER',questions:[
 'What is something difficult for you to talk about, even with someone you love?',
 'When we disagree, what helps you feel heard instead of judged?',
 'What is one fear you have about relationships that you want me to understand?',
 'Is there a habit we could improve together as a couple?',
 'What does trust look like to you in everyday life?',
 'What do you need more of from me lately: time, reassurance, affection, space, or something else?',
 'What is a boundary that helps you feel respected?',
 'When you get quiet, what is the kindest way for me to check in?',
 'What is something you are proud of us for working through?',
 'What is one honest conversation you would like us to have someday, when we both feel ready?' ]},
 {title:'Forever?',description:'Dreaming out loud, one answer at a time.',category:'OUR NEXT CHAPTER',questions:[
 'What would your perfect ordinary day together look like?',
 'What place would you love to explore with me someday?',
 'What tradition should we start that belongs only to us?',
 'What is one shared goal you would be excited to work toward?',
 'What kind of home or space would feel like “us” to you?',
 'What is one new experience you want us to try together?',
 'How do you hope we handle stressful seasons as a team?',
 'What is one promise we can realistically make to each other right now?',
 'What do you hope we will laugh about when we look back years from now?',
 'If our story had a title, what would you call the next chapter?' ]},
 {title:'Only Us',description:'Secret level unlocked. Make a memory.',category:'SECRET LEVEL',questions:[
 'Send a voice note saying one thing you adore about your co-player.',
 'Invent a ridiculous couple nickname for the two of you and explain it.',
 'Plan a dream date together using only three emojis each.',
 'Share one photo or memory you would put in a tiny museum about your relationship.',
 'Give your co-player a sincere compliment you do not say often enough.',
 'Create a two-line theme song for your relationship.',
 'What is one harmless, funny challenge we should do together this week?',
 'Describe your co-player as a fictional character archetype and explain why.',
 'Write a one-sentence message your co-player can save for a difficult day.',
 'Final save point: what is one thing you choose about us, today?' ]}
];
let supabase = null, currentUser = null, currentRoom = null, roomChannel = null, roomCode = null, playerName = '', toastTimer = null, refreshBusy = false;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800)}
function setupMessage(message,error=false){$('setup-message').textContent=message;$('setup-message').classList.toggle('error',error)}
function setBusy(button,busy,label){button.disabled=busy;if(busy){button.dataset.oldLabel=button.textContent;button.textContent=label||'Please wait…'}else if(button.dataset.oldLabel){button.textContent=button.dataset.oldLabel;delete button.dataset.oldLabel}}
function safeName(name){return String(name||'').trim().slice(0,24)}
function getName(){return safeName($('player-name').value)}
function getRoomCode(){return $('room-code-input').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}
function makeCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';for(let i=0;i<6;i++)code+=chars[Math.floor(Math.random()*chars.length)];return code}
function showScreen(game){$('setup-screen').classList.toggle('hidden',game);$('setup-footer').classList.toggle('hidden',game);$('game-screen').classList.toggle('hidden',!game)}
function meIsHost(){return currentRoom&&currentRoom.host_id===currentUser.id}
function myAnswer(){if(!currentRoom)return '';const key=String(currentRoom.level),qkey=String(currentRoom.question_index);return currentRoom.answers?.[key]?.[qkey]?.[currentUser.id]||''}
function bothAnswers(){if(!currentRoom||!currentRoom.guest_id)return false;const row=currentRoom.answers?.[String(currentRoom.level)]?.[String(currentRoom.question_index)]||{};return Boolean(row[currentRoom.host_id]&&row[currentRoom.guest_id])}
function levelData(){return LEVELS[Math.max(0,Math.min(LEVELS.length-1,(currentRoom?.level||1)-1))]}
function updateGameUI(){if(!currentRoom)return;const hostName=currentRoom.host_name||'Player 1',guestName=currentRoom.guest_name||'Waiting for them';$('room-code-display').textContent=currentRoom.code;$('large-room-code').textContent=currentRoom.code;$('host-name').textContent=hostName;$('guest-name').textContent=guestName;$('guest-status').textContent=currentRoom.guest_id?'Connected':'Share your code';$('guest-dot').classList.toggle('waiting',!currentRoom.guest_id);$('host-status').textContent='Connected';$('waiting-panel').classList.toggle('hidden',Boolean(currentRoom.guest_id));$('question-panel').classList.toggle('hidden',!currentRoom.guest_id||currentRoom.completed);$('complete-panel').classList.toggle('hidden',!currentRoom.completed);if(currentRoom.completed){$('waiting-panel').classList.add('hidden');$('question-panel').classList.add('hidden');return}if(!currentRoom.guest_id)return;
 const level=levelData(),q=currentRoom.question_index||1,question=level.questions[q-1];$('level-kicker').textContent=`LEVEL ${String(currentRoom.level).padStart(2,'0')} / 05`;$('level-title').textContent=level.title;$('level-description').textContent=level.description;$('level-stamp').textContent=String(currentRoom.level).padStart(2,'0');$('question-category').textContent=level.category;$('question-text').textContent=question;$('question-count').textContent=`${String(q).padStart(2,'0')} / 10`;$('progress-fill').style.width=`${q*10}%`;
 const answer=myAnswer(),both=bothAnswers();$('answer-input').value=answer;$('answer-input').disabled=Boolean(answer)||both;$('submit-answer-btn').disabled=Boolean(answer)||both;$('submit-answer-btn').classList.toggle('hidden',Boolean(answer)||both);$('answer-state').textContent=answer?'Answer locked in — waiting for your person.':'Only you and your co-player can see this room.';$('answer-status-card').classList.toggle('hidden',!answer||both);$('answer-status-title').textContent='Your answer is locked in ♥';$('answer-status-copy').textContent='Waiting for your person to answer. You can stay here; this updates automatically.';$('both-answered-panel').classList.toggle('hidden',!both);
 if(both){const answers=currentRoom.answers[String(currentRoom.level)][String(q)];$('answer-one-name').textContent=`${currentRoom.host_name} · PLAYER 1`;$('answer-two-name').textContent=`${currentRoom.guest_name} · PLAYER 2`;$('answer-one-text').textContent=answers[currentRoom.host_id];$('answer-two-text').textContent=answers[currentRoom.guest_id];$('next-question-btn').textContent=currentRoom.level===5&&q===10?'Finish LOVE.exe ✦':q===10?`Unlock ${LEVELS[currentRoom.level]?.title||'next level'} →`:'Next question →';$('next-question-btn').disabled=!meIsHost();$('next-question-btn').title=meIsHost()?'Both players answered. Continue together.':'Player 1 advances the shared game.'}
}
async function ensureAuth(){if(!configured)throw new Error('Add your Supabase URL and anon key in app.js first.');if(!supabase)supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});let {data,error}=await supabase.auth.getSession();if(error)throw error;if(data.session){currentUser=data.session.user;return}const result=await supabase.auth.signInAnonymously();if(result.error)throw result.error;currentUser=result.data.user}
async function createRoom(){const button=$('create-btn');try{const name=getName();if(!name){setupMessage('Add your player name first.',true);$('player-name').focus();return}playerName=name;setBusy(button,true,'Creating…');await ensureAuth();let code,created=false;for(let i=0;i<5&&!created;i++){code=makeCode();const {data,error}=await supabase.rpc('love_create_room',{p_code:code,p_player_name:playerName});if(!error){currentRoom=data;created=true}else if(!String(error.message).toLowerCase().includes('duplicate')&&!String(error.message).toLowerCase().includes('unique'))throw error}if(!created)throw new Error('Could not create a unique room code. Try again.');enterRoom(code);toast('Room created. Send your code to your person ♥')}catch(e){setupMessage(e.message||'Could not create room.',true)}finally{setBusy(button,false)}}
async function joinRoom(){const button=$('join-btn');try{const name=getName(),code=getRoomCode();if(!name){setupMessage('Add your player name first.',true);$('player-name').focus();return}if(code.length!==6){setupMessage('Enter the 6-character room code.',true);$('room-code-input').focus();return}playerName=name;setBusy(button,true,'Joining…');await ensureAuth();const {data,error}=await supabase.rpc('love_join_room',{p_code:code,p_player_name:playerName});if(error)throw error;currentRoom=data;enterRoom(code);toast('You joined the room. Let the love.exe begin ♥')}catch(e){setupMessage(e.message||'Could not join room.',true)}finally{setBusy(button,false)}}
function enterRoom(code){roomCode=code;showScreen(true);$('connection-label').textContent='CONNECTED';updateGameUI();subscribeToRoom()}
function subscribeToRoom(){if(!supabase||!roomCode)return;if(roomChannel)supabase.removeChannel(roomChannel);roomChannel=supabase.channel('love-room-'+roomCode+'-'+currentUser.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'love_rooms',filter:`code=eq.${roomCode}`},payload=>{if(payload.new&&payload.new.code===roomCode){currentRoom=payload.new;updateGameUI()}}).subscribe(status=>{if(status==='SUBSCRIBED')refreshRoom().catch(()=>{});if(status==='CHANNEL_ERROR'){$('connection-label').textContent='RECONNECTING'}});refreshRoom().catch(e=>toast(e.message))}
async function refreshRoom(){if(!supabase||!roomCode||refreshBusy)return;refreshBusy=true;try{const {data,error}=await supabase.from('love_rooms').select('*').eq('code',roomCode).single();if(error)throw error;currentRoom=data;updateGameUI()}finally{refreshBusy=false}}
async function submitAnswer(){const button=$('submit-answer-btn'),answer=$('answer-input').value.trim();if(!answer){toast('Give your answer a little heart first.');$('answer-input').focus();return}try{setBusy(button,true,'Locking in…');const {data,error}=await supabase.rpc('love_submit_answer',{p_code:roomCode,p_level:currentRoom.level,p_question:currentRoom.question_index,p_answer:answer});if(error)throw error;currentRoom=data;updateGameUI();toast('Answer saved. Waiting for your person ♥')}catch(e){toast(e.message||'Could not save answer.')}finally{setBusy(button,false)}}
async function nextQuestion(){try{$('next-question-btn').disabled=true;const {data,error}=await supabase.rpc('love_advance',{p_code:roomCode});if(error)throw error;currentRoom=data;updateGameUI();toast(currentRoom.completed?'LOVE.exe completed. Keep choosing each other ♥':currentRoom.level===5&&currentRoom.question_index===1?'SECRET LEVEL UNLOCKED ✦':'Progress saved. Next question unlocked.')}catch(e){toast(e.message||'Could not advance.')}finally{if(currentRoom)updateGameUI()}}
async function copyCode(){if(!roomCode)return;try{await navigator.clipboard.writeText(roomCode);toast('Room code copied. Send it to your person!')}catch{toast(`Your room code is ${roomCode}`)}}
function leaveRoom(){if(roomChannel&&supabase){supabase.removeChannel(roomChannel);roomChannel=null}currentRoom=null;roomCode=null;showScreen(false);$('connection-label').textContent='MULTIPLAYER READY'}
$('create-btn').addEventListener('click',createRoom);$('join-btn').addEventListener('click',joinRoom);$('room-code-input').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));$('room-code-input').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom()});$('submit-answer-btn').addEventListener('click',submitAnswer);$('next-question-btn').addEventListener('click',nextQuestion);$('copy-code-btn').addEventListener('click',copyCode);$('copy-code-big').addEventListener('click',copyCode);$('leave-btn').addEventListener('click',leaveRoom);$('back-to-game-btn').addEventListener('click',leaveRoom);
window.addEventListener('online',()=>{if(roomCode)refreshRoom().catch(()=>{});$('connection-label').textContent='CONNECTED'});window.addEventListener('offline',()=>$('connection-label').textContent='OFFLINE');
if(!configured){$('connection-label').textContent='SETUP REQUIRED';setupMessage('One-time setup needed: connect a free Supabase project using the README instructions.');}
