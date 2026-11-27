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
    .nico-poll { min-width:0; min-height:0; overflow:hidden; border:1px solid rgba(255,255,255,.2); border-radius:12px; padding:clamp(5px,1.2vw,12px); box-sizing:border-box; background:rgba(12,25,42,.82); color:#fff; backdrop-filter:blur(3px); display:flex; flex-direction:column; justify-content:center; gap:4px; pointer-events:auto; font-family:'GenZenGothicKaiC',sans-serif; text-shadow:0 1px 2px #000; }
    .nico-poll-title { font-size:clamp(11px,2.1vw,19px); font-weight:bold; line-height:1.25; overflow-wrap:anywhere; }
    .nico-poll-meta { font-size:clamp(9px,1.4vw,12px); opacity:.82; line-height:1.25; }
    .nico-poll-creator { font-size:clamp(9px,1.35vw,11px); opacity:.9; overflow-wrap:anywhere; }
    .nico-poll-options { display:grid; grid-template-columns:1fr; gap:4px; overflow:auto; }
    .nico-poll-option { display:block; width:100%; min-height:27px; border:1px solid rgba(255,255,255,.35); border-radius:9px; padding:4px 8px; color:white; background:rgba(255,255,255,.10); text-align:left; font:inherit; font-size:clamp(10px,1.7vw,15px); line-height:1.2; cursor:pointer; position:relative; overflow:hidden; isolation:isolate; }
    .nico-poll-option:disabled { opacity:.92; cursor:default; }
    .nico-poll-option.selected { border-color:#c5ddff; background:rgba(110,165,230,.22); }
    .poll-wavy-progress { position:absolute; inset:0; z-index:0; width:100%; height:100%; pointer-events:none; }
    .nico-poll-option .poll-option-label { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:center; gap:5px; min-height:16px; }
    .nico-poll-option .poll-option-name { overflow-wrap:anywhere; }
    .nico-poll-option .poll-option-result { white-space:nowrap; flex-shrink:0; font-family:'Akshar',sans-serif; font-size:1.02em; }
    .poll-multi-hint { font-size:clamp(9px,1.35vw,11px); opacity:.82; }
    .poll-submit-vote { min-height:28px; border:0; border-radius:999px; padding:4px 12px; background:#c2dcff; color:#10243a; font:inherit; font-size:clamp(10px,1.5vw,13px); font-weight:bold; cursor:pointer; }
    .poll-submit-vote:disabled { opacity:.45; cursor:default; }
    .poll-empty { border:1px dashed rgba(255,255,255,.12); border-radius:12px; background:rgba(0,0,0,.12); }
    #pollCreatorButton { position:relative; z-index:8; width:100%; margin-top:6px; min-height:34px; border:1px solid rgba(255,255,255,.18); border-radius:12px; background:rgba(130,170,220,.16); color:inherit; font:inherit; cursor:pointer; }
    #pollCreatorButton:disabled { opacity:.55; cursor:not-allowed; }
    #pollCreatorModal { position:fixed; inset:0; z-index:10000; display:none; align-items:center; justify-content:center; padding:14px; background:rgba(0,0,0,.68); }
    #pollCreatorModal.open { display:flex; }
    #pollCreatorBox { width:min(520px,100%); max-height:90dvh; overflow:auto; box-sizing:border-box; padding:16px; border:1px solid rgba(255,255,255,.2); border-radius:18px; background:#17334e; color:#fff; box-shadow:0 12px 40px #0008; font-family:'GenZenGothicKaiC',sans-serif; }
    #pollCreatorBox h3 { margin:0 0 12px; font-size:20px; }
    #pollCreatorBox label { display:block; margin:8px 0 4px; font-size:13px; }
    #pollCreatorBox input[type=text], #pollCreatorBox select { box-sizing:border-box; width:100%; min-height:36px; padding:7px 9px; border:1px solid #ffffff40; border-radius:9px; background:#10283e; color:#fff; font:inherit; }
    #pollCreatorBox .poll-choice-row { display:flex; align-items:center; gap:6px; margin-top:5px; }
    #pollCreatorBox .poll-choice-row input { flex:1; min-width:0; }
    #pollCreatorBox .poll-choice-remove { flex:0 0 34px; width:34px; min-height:34px; padding:0; border:1px solid #ffffff30; border-radius:50%; background:#42586d; color:#fff; font-size:18px; line-height:1; }
    #pollCreatorBox .poll-choice-remove:disabled { opacity:.35; cursor:not-allowed; }
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
      <div id="pollChoiceFields"></div>
      <div class="poll-creator-actions"><button type="button" id="pollAddChoice" class="secondary">＋ 選択肢を追加</button></div>
      <label for="pollDuration">投票期間</label>
      <select id="pollDuration"><option value="10">10秒</option><option value="15">15秒</option><option value="30" selected>30秒</option><option value="60">1分</option><option value="120">2分</option><option value="180">3分</option><option value="240">4分</option><option value="300">5分</option></select>
      <label class="poll-check"><input type="checkbox" id="pollMultiple"> 複数選択を許可</label>
      <label class="poll-check"><input type="checkbox" id="pollShowResults" checked> 投票前でも途中経過を表示</label>
      <label class="poll-check"><input type="checkbox" id="pollShowVoters"> 選択肢ごとの票数を表示</label>
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
  const nicknameInput = document.getElementById('nickname');

  let dbRef = null;
  let uid = null;
  let polls = {};
  let votes = {};
  let pollListener = null;
  let voteListeners = new Map();
  let timer = null;
  let waveId = 0;
  let creatingPoll = false;
  const pendingSelections = new Map();
  const submittingVotes = new Set();

  const remaining = poll => Math.max(0, Math.ceil((Number(poll.endsAt) - Date.now()) / 1000));
  const active = poll => !!poll && Number(poll.endsAt) > Date.now();
  const activeEntries = () => Object.entries(polls || {}).filter(([, poll]) => active(poll));
  const getCreatorName = () => nicknameInput ? nicknameInput.value.trim() : '';

  function updateCreateButton() {
    const full = activeEntries().length >= 4;
    createButton.disabled = full || creatingPoll;
    createButton.textContent = full ? '進行中の投票は最大4件です' : '＋ 投票を作成';
    createButton.title = full ? '投票が終了すると新しい投票を作成できます' : '新しい投票を作成';
  }

  function addChoiceField(value) {
    const row = document.createElement('div');
    row.className = 'poll-choice-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 40;
    input.placeholder = '選択肢' + (choicesBox.children.length + 1);
    input.value = value || '';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'poll-choice-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'この選択肢を削除');
    remove.addEventListener('click', () => {
      if (choicesBox.children.length <= 2) return;
      row.remove();
      refreshChoiceControls();
    });
    row.append(input, remove);
    choicesBox.appendChild(row);
    refreshChoiceControls();
  }

  function refreshChoiceControls() {
    const rows = [...choicesBox.querySelectorAll('.poll-choice-row')];
    const count = rows.length;
    rows.forEach((row, index) => {
      const input = row.querySelector('input');
      const remove = row.querySelector('.poll-choice-remove');
      input.placeholder = '選択肢' + (index + 1);
      remove.disabled = count <= 2;
    });
    const add = modal.querySelector('#pollAddChoice');
    add.disabled = count >= 6;
    add.textContent = count >= 6 ? '選択肢は最大6個です' : '＋ 選択肢を追加';
  }

  function resetChoiceFields() {
    choicesBox.replaceChildren();
    addChoiceField('');
    addChoiceField('');
  }

  function openModal() {
    if (activeEntries().length >= 4) {
      window.alert('進行中の投票は最大4件です。投票が終了してから作成してください。');
      return;
    }
    if (!getCreatorName()) {
      window.alert('先に投稿フォームの「名前」を入力してください。入力した名前が投票の作成者として表示されます。');
      nicknameInput?.focus();
      return;
    }
    status.textContent = '';
    modal.classList.add('open');
    modal.querySelector('#pollTitle').focus();
  }

  function closeModal() {
    modal.classList.remove('open');
  }

  createButton.addEventListener('click', openModal);
  modal.querySelector('#pollCreateCancel').addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  modal.querySelector('#pollAddChoice').addEventListener('click', () => {
    if (choicesBox.children.length < 6) addChoiceField('');
  });
  resetChoiceFields();

  function createWavyProgress(percent) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'poll-wavy-progress');
    svg.setAttribute('viewBox', '0 0 100 20');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const defs = document.createElementNS(svgNS, 'defs');
    const clip = document.createElementNS(svgNS, 'clipPath');
    const clipName = 'pollWaveClip' + (++waveId);
    clip.setAttribute('id', clipName);
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(Math.max(0, Math.min(100, percent))));
    rect.setAttribute('height', '20');
    clip.appendChild(rect);
    defs.appendChild(clip);
    svg.appendChild(defs);

    const wavePath = 'M0 10 C8 1 16 19 24 10 S40 1 48 10 S64 19 72 10 S88 1 100 10';
    const background = document.createElementNS(svgNS, 'path');
    background.setAttribute('d', wavePath);
    background.setAttribute('fill', 'none');
    background.setAttribute('stroke', 'rgba(220,235,255,.22)');
    background.setAttribute('stroke-width', '13');
    background.setAttribute('stroke-linecap', 'round');
    svg.appendChild(background);

    const foreground = document.createElementNS(svgNS, 'path');
    foreground.setAttribute('d', wavePath);
    foreground.setAttribute('fill', 'none');
    foreground.setAttribute('stroke', 'rgba(155,202,255,.74)');
    foreground.setAttribute('stroke-width', '13');
    foreground.setAttribute('stroke-linecap', 'round');
    foreground.setAttribute('clip-path', 'url(#' + clipName + ')');
    svg.appendChild(foreground);
    return svg;
  }

  function voteIndexes(value) {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isInteger);
    if (typeof value === 'number' && Number.isInteger(value)) return [value];
    if (value && typeof value === 'object') {
      return Object.keys(value).filter(key => /^\d+$/.test(key) && value[key] !== null && value[key] !== false).map(Number);
    }
    return [];
  }

  function render() {
    const list = activeEntries().sort((a, b) => Number(a[1].createdAt) - Number(b[1].createdAt)).slice(-4);
    layer.className = '';
    layer.classList.add('poll-count-' + list.length);
    layer.replaceChildren();
    updateCreateButton();

    const slots = list.length === 3 ? [...list, null] : list;
    slots.forEach(entry => {
      if (!entry) {
        const empty = document.createElement('div');
        empty.className = 'poll-empty';
        layer.appendChild(empty);
        return;
      }
      const [id, poll] = entry;
      const card = document.createElement('section');
      card.className = 'nico-poll';

      const title = document.createElement('div');
      title.className = 'nico-poll-title';
      title.textContent = poll.title || '（タイトルなし）';

      const creator = document.createElement('div');
      creator.className = 'nico-poll-creator';
      creator.textContent = '作成者：' + (poll.creatorName || '旧投票・名前未登録');

      const meta = document.createElement('div');
      meta.className = 'nico-poll-meta';
      const left = remaining(poll);
      meta.textContent = left > 0 ? '投票受付中 · 残り' + left + '秒' : '投票終了';
      card.append(title, creator, meta);

      const optionList = document.createElement('div');
      optionList.className = 'nico-poll-options';
      const pollVotes = votes[id] || {};
      const allVotes = Object.values(pollVotes);
      const totalVoters = allVotes.length;
      const choices = Array.isArray(poll.choices) ? poll.choices : Object.values(poll.choices || {});
      const counts = choices.map((choice, index) => allVotes.reduce((sum, value) => {
        return sum + (voteIndexes(value).includes(index) ? 1 : 0);
      }, 0));
      const myVote = uid ? pollVotes[uid] : undefined;
      const hasVoted = myVote !== undefined && myVote !== null;
      const savedIndexes = voteIndexes(myVote);
      const pending = pendingSelections.get(id) || new Set();
      const show = !!poll.showResults || !active(poll) || hasVoted;

      choices.forEach((choice, index) => {
        const count = counts[index] || 0;
        const percent = totalVoters ? Math.round(count / totalVoters * 100) : 0;
        const selected = hasVoted ? savedIndexes.includes(index) : pending.has(index);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nico-poll-option' + (selected ? ' selected' : '');
        if (show) button.appendChild(createWavyProgress(percent));

        const label = document.createElement('span');
        label.className = 'poll-option-label';
        const name = document.createElement('span');
        name.className = 'poll-option-name';
        name.textContent = choice;
        const result = document.createElement('span');
        result.className = 'poll-option-result';
        result.textContent = show ? percent + '%' + (poll.showVoters ? ' · ' + count + '票' : '') : '';
        label.append(name, result);
        button.appendChild(label);

        button.disabled = !active(poll) || hasVoted || submittingVotes.has(id);
        button.addEventListener('click', () => {
          if (poll.allowMultiple) {
            if (hasVoted || !active(poll)) return;
            const next = new Set(pendingSelections.get(id) || []);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            pendingSelections.set(id, next);
            render();
          } else {
            castVote(id, index, poll);
          }
        });
        optionList.appendChild(button);
      });
      card.appendChild(optionList);

      if (poll.allowMultiple && active(poll) && !hasVoted) {
        const hint = document.createElement('div');
        hint.className = 'poll-multi-hint';
        hint.textContent = '複数選択できます。選択後に投票を確定してください。';
        const submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'poll-submit-vote';
        const selected = [...pending];
        submit.textContent = '選択した' + selected.length + '件に投票';
        submit.disabled = selected.length === 0 || submittingVotes.has(id);
        submit.addEventListener('click', () => castVote(id, selected.sort((a, b) => a - b), poll));
        card.append(hint, submit);
      }

      if (poll.creatorUid === uid) {
        const endButton = document.createElement('button');
        endButton.type = 'button';
        endButton.textContent = '投票を終了';
        endButton.className = 'nico-poll-option';
        endButton.style.fontSize = '11px';
        endButton.addEventListener('click', async () => {
          try {
            await dbRef.child(id).update({ endsAt: Date.now() });
          } catch (error) {
            console.error('投票の終了に失敗しました', error);
          }
        });
        card.appendChild(endButton);
      }
      layer.appendChild(card);
    });
  }

  async function castVote(id, value, poll) {
    if (!uid || !active(poll) || submittingVotes.has(id)) return;
    submittingVotes.add(id);
    render();
    const voteRef = db.ref('pollVotes/' + id + '/' + uid);
    try {
      const snapshot = await voteRef.once('value');
      if (snapshot.exists()) return;
      await voteRef.set(value);
      pendingSelections.delete(id);
    } catch (error) {
      console.error('投票に失敗しました', error);
      window.alert('投票を保存できませんでした。通信状態とFirebaseルールを確認してください。');
    } finally {
      submittingVotes.delete(id);
      render();
    }
  }

  function attachVoteListener(id) {
    if (voteListeners.has(id)) return;
    const ref = db.ref('pollVotes/' + id);
    const handler = ref.on('value', snapshot => {
      votes[id] = snapshot.val() || {};
      render();
    }, error => console.error('投票集計取得失敗', error));
    voteListeners.set(id, { ref, handler });
  }

  function start() {
    if (!db || !uid || pollListener) return;
    dbRef = db.ref('polls');
    pollListener = dbRef.on('value', snapshot => {
      polls = snapshot.val() || {};
      Object.keys(polls).forEach(attachVoteListener);
      render();
    }, error => console.error('投票データ取得失敗', error));
    timer = setInterval(render, 1000);
  }

  modal.querySelector('#pollCreateSubmit').addEventListener('click', async () => {
    const title = modal.querySelector('#pollTitle').value.trim();
    const creatorName = getCreatorName();
    const choiceInputs = [...choicesBox.querySelectorAll('input')];
    const choices = choiceInputs.map(input => input.value.trim());
    const duration = Number(modal.querySelector('#pollDuration').value);

    if (!creatorName) {
      status.textContent = '投稿フォームの「名前」を入力してください。';
      return;
    }
    if (creatorName.length > 15) {
      status.textContent = '作成者名は15文字以内にしてください。';
      return;
    }
    if (!title || choices.length < 2 || choices.length > 6 || choices.some(choice => !choice)) {
      status.textContent = 'タイトルと、空欄のない2〜6個の選択肢を入力してください。';
      return;
    }
    if (!uid || !db) {
      status.textContent = 'Firebase接続を準備中です。';
      return;
    }
    if (activeEntries().length >= 4) {
      status.textContent = '進行中の投票は最大4件です。投票が終了してから作成してください。';
      updateCreateButton();
      return;
    }
    if (creatingPoll) return;

    creatingPoll = true;
    updateCreateButton();
    const now = Date.now();
    const ref = db.ref('polls').push();
    const data = {
      title,
      creatorName,
      choices,
      durationSeconds: duration,
      createdAt: now,
      endsAt: now + duration * 1000,
      creatorUid: uid,
      allowMultiple: modal.querySelector('#pollMultiple').checked,
      showResults: modal.querySelector('#pollShowResults').checked,
      showVoters: modal.querySelector('#pollShowVoters').checked
    };

    try {
      await ref.set(data);
      polls[ref.key] = data;
      attachVoteListener(ref.key);
      modal.querySelector('#pollTitle').value = '';
      resetChoiceFields();
      modal.querySelector('#pollMultiple').checked = false;
      modal.querySelector('#pollShowResults').checked = true;
      modal.querySelector('#pollShowVoters').checked = false;
      closeModal();
      render();
    } catch (error) {
      status.textContent = '保存できませんでした（' + (error.code || 'Firebaseエラー') + '）。FirebaseルールのcreatorName設定も確認してください。';
      console.error('投票の作成に失敗しました', error);
    } finally {
      creatingPoll = false;
      updateCreateButton();
    }
  });

  if (typeof authReady !== 'undefined') {
    authReady.then(userId => {
      uid = userId;
      start();
    }).catch(console.error);
  } else {
    console.error('投票機能: Firebase初期化後に polls.js を読み込んでください。');
  }

  window.addEventListener('beforeunload', () => {
    if (pollListener && dbRef) dbRef.off('value', pollListener);
    voteListeners.forEach(listener => listener.ref.off('value', listener.handler));
    if (timer) clearInterval(timer);
  });
})();
