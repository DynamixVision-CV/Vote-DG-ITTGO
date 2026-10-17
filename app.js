// === COLLE ICI L'URL DE TON APPLICATION WEB APPS SCRIPT ===
const API = 'https://script.google.com/macros/s/AKfycbyumf7Yzr6yV1vlpNgk5Do_Vu6VY6tyDQDGaJmlkq8jTnM-rFQLU6FoQjs9eUyJAiqH/exec';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const views = ['vote-view', 'done-view', 'login-view', 'admin-view'];
const show = id => { views.forEach(v => $('#' + v).hidden = v !== id); $('footer').hidden = id !== 'vote-view'; };

async function call(body) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}

let adminCode = '', timer = null, chosen = null;
const pic = c => c.photo ? `<img src="${esc(c.photo)}" alt="">` : `<div class="ph">${esc((c.nom || '?')[0])}</div>`;

// ---------- Vote ----------
async function loadCandidates() {
  try {
    const d = await (await fetch(API)).json();
    $('#cards').innerHTML = d.candidats.length ? d.candidats.map(c => `
      <div class="card">${pic(c)}
        <div class="body"><h3>${esc(c.nom)}</h3><span class="tag">${esc(c.classe)}</span>
        <p>${esc(c.description)}</p>
        <button class="btn" data-id="${esc(c.id)}" data-nom="${esc(c.nom)}">Voter</button></div>
      </div>`).join('') : '<p class="muted">Aucun candidat pour le moment.</p>';
  } catch (e) { $('#cards').innerHTML = '<p class="err">Impossible de charger les candidats.</p>'; }
}

$('#cards').addEventListener('click', e => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  chosen = b.dataset.id;
  $('#m-title').textContent = 'Voter pour ' + b.dataset.nom;
  $('#m-code').value = ''; $('#m-err').textContent = '';
  $('#modal').hidden = false; $('#m-code').focus();
});
$('#m-cancel').onclick = () => $('#modal').hidden = true;
$('#m-ok').onclick = async () => {
  const code = $('#m-code').value.trim();
  if (!code) { $('#m-err').textContent = 'Entre ton code.'; return; }
  $('#m-ok').disabled = true; $('#m-err').textContent = '';
  try {
    const r = await call({ action: 'vote', code, candidatId: chosen });
    if (r.ok) { $('#modal').hidden = true; show('done-view'); }
    else $('#m-err').textContent = r.error;
  } catch (e) { $('#m-err').textContent = 'Erreur réseau, réessaie.'; }
  $('#m-ok').disabled = false;
};

// ---------- Admin ----------
$('#admin-link').onclick = () => { $('#login-err').textContent = ''; show('login-view'); };
$('#back1').onclick = () => show('vote-view');
$('#back2').onclick = () => { clearInterval(timer); adminCode = ''; show('vote-view'); loadCandidates(); };

$('#login-btn').onclick = async () => {
  const code = $('#admin-code').value.trim();
  try {
    const r = await call({ action: 'login', adminCode: code });
    if (!r.ok) { $('#login-err').textContent = r.error; return; }
    adminCode = code; $('#admin-code').value = '';
    show('admin-view'); refresh();
    timer = setInterval(refresh, 10000); // temps réel : toutes les 10 s
  } catch (e) { $('#login-err').textContent = 'Erreur réseau.'; }
};

async function refresh() {
  try {
    const r = await call({ action: 'results', adminCode });
    if (!r.ok) return;
    const total = r.candidats.reduce((s, c) => s + c.votes, 0);
    $('#stats').textContent = `${total} vote(s) — ${r.used} / ${r.total} codes utilisés`;
    const sorted = [...r.candidats].sort((a, b) => b.votes - a.votes);
    $('#results').innerHTML = sorted.map(c => `
      <div class="res-row"><div class="res-top"><span>${esc(c.nom)} <small class="muted">(${esc(c.classe)})</small></span>
      <span>${c.votes} (${total ? Math.round(c.votes * 100 / total) : 0}%)</span></div>
      <div class="bar"><i style="width:${total ? c.votes * 100 / total : 0}%"></i></div></div>`).join('') || '<p class="muted">Aucun candidat.</p>';
    $('#manage').innerHTML = r.candidats.map(c => `
      <div class="m-row"><span>${esc(c.nom)} — ${esc(c.classe)}</span>
      <button class="del" data-id="${esc(c.id)}" data-nom="${esc(c.nom)}">Supprimer</button></div>`).join('');
  } catch (e) { }
}

$('#manage').addEventListener('click', async e => {
  const b = e.target.closest('.del');
  if (!b || !confirm('Supprimer ' + b.dataset.nom + ' ?')) return;
  await call({ action: 'delete', adminCode, id: b.dataset.id });
  refresh();
});

function resize(file) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 300 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', .7));
    };
    img.src = URL.createObjectURL(file);
  });
}

$('#add-btn').onclick = async () => {
  const nom = $('#c-nom').value.trim(), classe = $('#c-classe').value.trim(), description = $('#c-desc').value.trim();
  if (!nom || !classe) { alert('Nom et classe obligatoires.'); return; }
  const f = $('#c-photo').files[0];
  $('#add-btn').disabled = true;
  const photo = f ? await resize(f) : '';
  const r = await call({ action: 'add', adminCode, nom, classe, description, photo });
  $('#add-btn').disabled = false;
  if (!r.ok) { alert(r.error); return; }
  ['#c-nom', '#c-classe', '#c-desc', '#c-photo'].forEach(s => $(s).value = '');
  refresh();
};

show('vote-view');
loadCandidates();
