/* =============================================================
 * polls.js — nicoArea背景投票
 * Realtime Database: /polls/{pollId}, /pollVotes/{pollId}/{uid}
 * ============================================================= */
(() => {
  const area = document.getElementById('nicoArea');
  if (!area) return;

  const style = document.createElement('style');
  style.textContent = `
    #pollBackground { position:absolute; inset:0; z-index:1; display:grid; grid-template-columns:1fr; grid-template-rows:1fr; gap:3px; padding:5px; box-sizing:border-box; pointer-events:none; overflow:hidden; }
    #pollBackground.poll-count-2 { grid-template-columns:1fr 1fr; }
    #pollBackground.poll-count-3, #pollBackground.poll-count-4 { grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; }
    .nico-poll { min-width:0; min-height:0; overflow:hidden; border:1px solid rgba(255,255,255,.2); border-radius:12px; padding:clamp(5px,1.2vw,12px); box-sizing:border-box; background:rgba(12,25,42,.78); color:#fff; backdrop-filter:blur(3px); display:flex; flex-direction:column; justify-content:center; gap:4px; pointer-events:auto; font-family:'GenZenGothicKaiC',sans-serif; text-shadow:0 1px 2px #000; }
    .nico-poll-title { font-size:clamp(11px,2.1vw,19px); font-weight:bold; line-height:1.25; overflow-wrap:anywhere; }
    .nico-poll-meta { font-size:clamp(9px,1.4vw,12px); opacity:.8; }
    .nico-poll-options { display:grid; grid-template-columns:1fr; gap:3px; overflow:auto; }
    .nico-poll-option { min-height:25px; border:1px solid rgba(255,255,255,.35); border-radius:7px; padding:3px 7px; color:white; background:rgba(255,255,255,.13); text-align:left; font:inherit; font-size:clamp(10px,1.7vw,15px); line-height:1.2; cursor:pointer; position:relative; overflow:hidden; }
    .nico-poll-option:disabled { opacity:.9; cursor:default; }
    .nico-poll-option .poll-result-bar { position:absolute; inset:0 auto 0 0; background:rgba(105,170,255,.32); z-index:0; }
    .nico-poll-option .poll-option-label { position:relative; z-index:1; display:flex; justify-content:space-between; gap:5px; }
    .nico-poll-option.selected { border-color:#a8d2ff; background:rgba(70,130,210,.35); }
    .nico-poll-empty { border:1px dashed rgba(255,255,255,.12); border-radius:12px; background:rgba(0,0,0,.12); }
    #pollCreatorButton { position:relative; z-index:8; width:100%; margin-top:6px; min-height:34px; border:1px solid rgba(255,255,255,.18); border-radius:12px; background:rgba(130,170,220,.16); color:inherit; font:inherit; cursor:pointer; }
    #pollCreatorModal { position:fixed; inset:0; z-index:10000; display:none; align-items:center; justify-content:center; padding:14px; background:rgba(0,0,0,.68); }
    #pollCreatorModal.open { display:flex; }
    #pollCreatorBox { width:min(520px,100%); max-height:90dvh; overflow:auto; box-sizing:border-box; padding:16px; border:1px solid rgba(255,255,255,.2); border-radius:18px; background:#17334e; color:#fff; box-shadow:0 12px 40px #0008; font-family:'GenZenGothicKaiC',sans-serif; }
    #pollCreatorBox h3 { margin:0 0 12px; font-size:20px; }
    #pollCreatorBox label { display:block; margin:8px 0 4px; font-size:13px; }
    #pollCreatorBox input[type=text], #pollCreatorBox select { box-sizing:border-box; width:100%; min-height:36px; padding:7px 9px; border:1px solid #ffffff40; border-radius:9px; background:#10283e; color:#fff; font:inherit; }
    #pollCreatorBox .poll-creator-actions { display:flex; gap:8px; margin-top:14px; }
    #pollCreatorBox button { min-height:36px; padding:6px 12px; border:0; border-radius:999px; background:#8db9eb; color:#10243a; font:inherit; cursor:pointer; }
    #pollCreatorBox button.secondary { background:#42586d; color:#fff; }
    #pollCreatorBox .poll-check { display:flex; align-items:center; gap:7px; }
    #pollCreatorBox .poll-check input { width:auto; }
    #pollCreatorStatus { min-height:18px; margin-top:7px; font-size:12px; color:#ffdca0; }
    @media (max-width:520px) { #pollCreatorBox { padding:13px; } }
  `;
  document.head.appendChild(style);

  const layer = document.createElement('div');
  layer.id = 'pollBackground';
  layer.setAttribute('aria-label', '投票エリア');
  area.insertBefore(layer, area.firstChild);

  const modal = document.createElement('div');
  modal.id = 'pollCreatorModal';
  modal.innerHTML = `
    <div id="pollCreatorBox" role="dialog" aria-modal="true" aria-labelledby="pollCreatorTitle">
      <h3 id="pollCreatorTitle">投票を作成</h3>
      <label for="pollTitle">質問・投票タイトル</label><input id="pollTitle" type="text" maxlength="80" placeholder="例：次の企画は何がいい？">
      <label>選択肢（2〜6個）</label>
      <div id="pollChoiceFields">
        <input type="text" maxlength="40" placeholder="選択肢1">
        <input type="text" maxlength="40" placeholder="選択肢2">
      </div>
      <div class="poll-creator-actions"><button type="button" id="pollAddChoice" class="secondary">＋ 選択肢を追加</button></div>
      <label for="pollDuration">投票期間</label>
      <select id="pollDuration"><option value="10">10秒</option><option value="15">15秒</option><option value="30" selected>30秒</option><option value="60">1分</option><option value="120">2分</option><option value="180">3分</option><option value="240">4分</option><option value="300">5分</option></select>
      <label class="poll-check"><input type="checkbox" id="pollMultiple"> 複数選択を許可</label>
      <label class="poll-check"><input type="checkbox" id="pollShowResults" checked> 投票前でも途中経過を表示</label>
      <label class="poll-check"><input type="checkbox" id="pollShowVoters"> 投票者数を表示</label>
      <div id="pollCreatorStatus" role="status"></div>
      <div class="poll-creator-actions"><button type="button" id="pollCreateSubmit">作成して表示</button><button type="button" id="pollCreateCancel" class="secondary">キャンセル</button></div>
    </div>`;
  document.body.appendChild(modal);

  const sidebar = document.getElementById('utilitySidebarContent');
  const createButton = document.createElement('button');
  createButton.type = 'button';
  createButton.id = 'pollCreatorButton';
  createButton.textContent = '＋ 投票を作成';
  sidebar?.appendChild(createButton);

  const choicesBox = modal.querySelector('#pollChoiceFields');
  const status = modal.querySelector('#pollCreatorStatus');
  let dbRef = null;
  let uid = null;
  let polls = {};
  let votes = {};
  let activePollId = null;
  let pollListener = null;
  let voteListeners = new Map();
  let timer = null;

  const escapeText = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const remaining = poll => Math.max(0, Math.ceil((poll.endsAt - Date.now()) / 1000));
  const active = poll => poll && Number(poll.endsAt) > Date.now();

  function openModal() { modal.classList.add('open'); status.textContent=''; modal.querySelector('#pollTitle').focus(); }
  function closeModal() { modal.classList.remove('open'); }
  createButton.addEventListener('click', openModal);
  modal.querySelector('#pollCreateCancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  modal.querySelector('#pollAddChoice').addEventListener('click', () => {
    if (choicesBox.children.length >= 6) return;
    const input = document.createElement('input');
    input.type='text'; input.maxLength=40; input.placeholder='選択肢'+(choicesBox.children.length+1);
    choicesBox.appendChild(input);
  });

  function render() {
    const list = Object.entries(polls).filter(([,p]) => active(p)).sort((a,b) => a[1].createdAt-b[1].createdAt).slice(-4);
    layer.className = '';
    layer.classList.add('poll-count-'+list.length);
    layer.replaceChildren();
    const slots = list.length === 3 ? [...list, null] : list;
    slots.forEach(([id,poll] = []) => {
      if (!poll) { const empty=document.createElement('div'); empty.className='poll-empty'; layer.appendChild(empty); return; }
      const card=document.createElement('section'); card.className='nico-poll';
      const title=document.createElement('div'); title.className='nico-poll-title'; title.textContent=poll.title;
      const meta=document.createElement('div'); meta.className='nico-poll-meta';
      const left=remaining(poll);
      meta.textContent = left ? '投票受付中 · 残り'+left+'秒' : '投票終了';
      card.append(title,meta);
      const optionList=document.createElement('div'); optionList.className='nico-poll-options';
      const pollVotes=votes[id]||{};
      const counts=(poll.choices||[]).map((_,i)=>Object.values(pollVotes).filter(v => Array.isArray(v) ? v.includes(i) : v===i).length);
      const total=Object.keys(pollVotes).length;
      const myVote=pollVotes[uid];
      (poll.choices||[]).forEach((choice,index)=>{
        const count=counts[index]||0, percent=total?Math.round(count/total*100):0;
        const show=(poll.showResults || !active(poll) || myVote!==undefined);
        const button=document.createElement('button'); button.type='button'; button.className='nico-poll-option';
        if ((Array.isArray(myVote)?myVote.includes(index):myVote===index) && myVote!==undefined) button.classList.add('selected');
        if(show){const bar=document.createElement('span');bar.className='poll-result-bar';bar.style.width=percent+'%';button.appendChild(bar);}
        const label=document.createElement('span');label.className='poll-option-label';
        const name=document.createElement('span');name.textContent=choice;
        const result=document.createElement('span');result.textContent=show?percent+'%'+(poll.showVoters?' · '+count+'票':''):'';
        label.append(name,result);button.appendChild(label);
        button.disabled=!active(poll) || myVote!==undefined;
        button.addEventListener('click',()=>castVote(id,index,poll));
        optionList.appendChild(button);
      });
      card.appendChild(optionList);
      if (poll.creatorUid===uid) {
        const remove=document.createElement('button');remove.type='button';remove.textContent='投票を終了';remove.className='nico-poll-option';remove.style.fontSize='11px';
        remove.addEventListener('click',()=>dbRef.child(id).update({endsAt:Date.now()}));card.appendChild(remove);
      }
      layer.appendChild(card);
    });
  }

  async function castVote(id,index,poll) {
    if (!uid || !active(poll)) return;
    const voteRef=db.ref('pollVotes/'+id+'/'+uid);
    try {
      const snap=await voteRef.once('value');
      if(snap.exists()) return;
      const value=poll.allowMultiple ? [index] : index;
      await voteRef.set(value);
    } catch(error) { console.error('投票に失敗しました',error); }
  }

  function attachVoteListener(id) {
    if(voteListeners.has(id)) return;
    const ref=db.ref('pollVotes/'+id);
    const handler=ref.on('value',snap=>{votes[id]=snap.val()||{};render();},err=>console.error('投票集計取得失敗',err));
    voteListeners.set(id,{ref,handler});
  }

  function start() {
    if(!db || !uid || pollListener) return;
    dbRef=db.ref('polls');
    pollListener=dbRef.on('value',snap=>{
      polls=snap.val()||{};
      Object.keys(polls).forEach(attachVoteListener);
      render();
    },error=>console.error('投票データ取得失敗',error));
    timer=setInterval(render,1000);
  }

  modal.querySelector('#pollCreateSubmit').addEventListener('click',async()=>{
    const title=modal.querySelector('#pollTitle').value.trim();
    const choices=[...choicesBox.querySelectorAll('input')].map(input=>input.value.trim()).filter(Boolean);
    const duration=Number(modal.querySelector('#pollDuration').value);
    if(!title || choices.length<2 || choices.length>6){status.textContent='タイトルと2〜6個の選択肢を入力してください。';return;}
    if(!uid || !db){status.textContent='Firebase接続を準備中です。';return;}
    const now=Date.now(), ref=db.ref('polls').push();
    const data={title,choices,durationSeconds:duration,createdAt:now,endsAt:now+duration*1000,creatorUid:uid,allowMultiple:modal.querySelector('#pollMultiple').checked,showResults:modal.querySelector('#pollShowResults').checked,showVoters:modal.querySelector('#pollShowVoters').checked};
    try{await ref.set(data);modal.querySelector('#pollTitle').value='';choicesBox.innerHTML='<input type="text" maxlength="40" placeholder="選択肢1"><input type="text" maxlength="40" placeholder="選択肢2">';modal.querySelector('#pollMultiple').checked=false;closeModal();}
    catch(error){status.textContent='保存できませんでした。Firebaseルールを更新してください。';console.error(error);}
  });

  if(typeof authReady!=='undefined') authReady.then(userId=>{uid=userId;start();}).catch(console.error);
  else console.error('投票機能: Firebase初期化後に polls.js を読み込んでください。');
  window.addEventListener('beforeunload',()=>{if(pollListener)dbRef.off('value',pollListener);voteListeners.forEach(v=>v.ref.off('value',v.handler));if(timer)clearInterval(timer);});
})();
