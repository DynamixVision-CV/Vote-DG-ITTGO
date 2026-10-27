// === COLLE ICI L'URL DE TON APPLICATION WEB APPS SCRIPT ===
const API = 'https://script.google.com/macros/s/AKfycbyumf7Yzr6yV1vlpNgk5Do_Vu6VY6tyDQDGaJmlkq8jTnM-rFQLU6FoQjs9eUyJAiqH/exec';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const views = ['code-view', 'postes-view', 'cands-view', 'done-view', 'login-view', 'admin-view'];
const show = id => { views.forEach(v => $('#' + v).hidden = v !== id); $('footer').hidden = !['code-view', 'postes-view', 'cands-view'].includes(id); };
async function call(body) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}
async function load() { DATA = await (await fetch(API)).json(); }

let DATA = { postes: [], candidats: [] }, myCode = '', voted = [], adminCode = '', timer = null, pending = null;
const pic = c => c.photo ? `<img src="${esc(c.photo)}" alt="">` : `<div class="ph">${esc((c.nom || '?')[0])}</div>`;

// ---------- Étudiant ----------
$('#v-ok').onclick = async () => {
  const code = $('#v-code').value.trim();
  if (!code) { $('#v-err').textContent = 'Entre ton code.'; return; }
  $('#v-ok').disabled = true; $('#v-err').textContent = '';
  try {
    const r = await call({ action: 'status', code });
    if (!r.ok) $('#v-err').textContent = r.error;
    else { myCode = code; voted = r.voted; await load(); renderPostes(); }
  } catch (e) { $('#v-err').textContent = 'Erreur réseau, réessaie.'; }
  $('#v-ok').disabled = false;
};

function renderPostes() {
  const actifs = DATA.postes.filter(p => DATA.candidats.some(c => c.poste === p.id));
  if (actifs.length && actifs.every(p => voted.includes(p.id))) { show('done-view'); return; }
  $('#postes').innerHTML = DATA.postes.map(p => {
    const n = DATA.candidats.filter(c => c.poste === p.id).length, done = voted.includes(p.id), off = done || !n;
    return `<button class="poste ${off ? 'off' : ''}" data-id="${esc(p.id)}" ${off ? 'disabled' : ''}>
      <span>${esc(p.nom)}</span><small>${done ? '✅ Déjà voté' : n ? n + ' candidat(s)' : 'Aucun candidat'}</small></button>`;
  }).join('');
  show('postes-view');
}

$('#postes').addEventListener('click', e => {
  const b = e.target.closest('.poste');
  if (!b || b.disabled) return;
  const p = DATA.postes.find(x => x.id === b.dataset.id);
  $('#cands-title').textContent = p.nom;
  $('#cards').innerHTML = DATA.candidats.filter(c => c.poste === p.id).map(c => `
    <div class="card">${pic(c)}
      <div class="body"><h3>${esc(c.nom)}</h3><span class="tag">${esc(c.classe)}</span>
      <p>${esc(c.description)}</p>
      <button class="btn" data-id="${esc(c.id)}" data-nom="${esc(c.nom)}" data-poste="${esc(p.id)}">Voter</button></div>
    </div>`).join('');
  show('cands-view');
});
$('#back-postes').onclick = renderPostes;

$('#cards').addEventListener('click', e => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  pending = { posteId: b.dataset.poste, candidatId: b.dataset.id };
  $('#m-title').textContent = 'Voter pour ' + b.dataset.nom + ' ?';
  $('#m-err').textContent = ''; $('#modal').hidden = false;
});
$('#m-cancel').onclick = () => $('#modal').hidden = true;
$('#m-ok').onclick = async () => {
  $('#m-ok').disabled = true; $('#m-err').textContent = '';
  try {
    const r = await call({ action: 'vote', code: myCode, ...pending });
    if (r.ok) { voted.push(pending.posteId); $('#modal').hidden = true; renderPostes(); }
    else $('#m-err').textContent = r.error;
  } catch (e) { $('#m-err').textContent = 'Erreur réseau, réessaie.'; }
  $('#m-ok').disabled = false;
};

// ---------- Admin ----------
$('#admin-link').onclick = () => { $('#login-err').textContent = ''; show('login-view'); };
$('#back1').onclick = () => show(myCode ? 'postes-view' : 'code-view');
$('#back2').onclick = () => { clearInterval(timer); adminCode = ''; myCode = ''; voted = []; $('#v-code').value = ''; show('code-view'); };

$('#login-btn').onclick = async () => {
  const code = $('#admin-code').value.trim();
  try {
    const r = await call({ action: 'login', adminCode: code });
    if (!r.ok) { $('#login-err').textContent = r.error; return; }
    adminCode = code; $('#admin-code').value = '';
    show('admin-view'); refresh();
    timer = setInterval(refresh, 10000);
  } catch (e) { $('#login-err').textContent = 'Erreur réseau.'; }
};

async function refresh() {
  try {
    const r = await call({ action: 'results', adminCode });
    if (!r.ok) return;
    if (!$('#c-poste').options.length) $('#c-poste').innerHTML = r.postes.map(p => `<option value="${esc(p.id)}">${esc(p.nom)}</option>`).join('');
    $('#stats').textContent = `${r.started} étudiant(s) ont commencé à voter, dont ${r.finished} ont terminé. Les pourcentages sont calculés sur les votes exprimés pour chaque poste.`;
    $('#results').innerHTML = r.postes.map(p => {
      const cs = r.candidats.filter(c => c.poste === p.id).sort((a, b) => b.votes - a.votes);
      if (!cs.length) return '';
      const tot = cs.reduce((s, c) => s + c.votes, 0);
      return `<div class="res-h">${esc(p.nom)} <small class="muted">(${tot} vote(s))</small></div>` + cs.map(c => `
        <div class="res-row"><div class="res-top"><span>${esc(c.nom)} <small class="muted">(${esc(c.classe)})</small></span>
        <span>${c.votes} (${tot ? Math.round(c.votes * 100 / tot) : 0}%)</span></div>
        <div class="bar"><i style="width:${tot ? c.votes * 100 / tot : 0}%"></i></div></div>`).join('');
    }).join('') || '<p class="muted">Aucun candidat.</p>';
    const pn = id => (r.postes.find(p => p.id === id) || {}).nom || id;
    $('#manage').innerHTML = r.candidats.map(c => `
      <div class="m-row"><span>${esc(c.nom)} — ${esc(c.classe)}<br><small class="muted">${esc(pn(c.poste))}</small></span>
      <button class="del" data-id="${esc(c.id)}" data-nom="${esc(c.nom)}">Supprimer</button></div>`).join('');
  } catch (e) { }
}

$('#manage').addEventListener('click', async e => {
  const b = e.target.closest('.del');
  if (!b || !confirm('Supprimer ' + b.dataset.nom + ' ?')) return;
  await call({ action: 'delete', adminCode, id: b.dataset.id });
  refresh();
});

// ---------- Recadrage photo (carré fixe 280x280) ----------
const cv = $('#crop-cv'), cx = cv.getContext('2d'), SZ = 280;
let img = null, zoom = 1, offX = 0, offY = 0;
function draw() {
  if (!img) return;
  const s = Math.max(SZ / img.width, SZ / img.height) * zoom;
  const dw = img.width * s, dh = img.height * s, mx = (dw - SZ) / 2, my = (dh - SZ) / 2;
  offX = Math.max(-mx, Math.min(mx, offX)); offY = Math.max(-my, Math.min(my, offY));
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, SZ, SZ);
  cx.drawImage(img, (SZ - dw) / 2 + offX, (SZ - dh) / 2 + offY, dw, dh);
}
$('#c-photo').onchange = e => {
  const f = e.target.files[0];
  if (!f) { img = null; $('#crop').hidden = true; return; }
  const im = new Image();
  im.onload = () => { img = im; zoom = 1; offX = offY = 0; $('#crop-zoom').value = 1; $('#crop').hidden = false; draw(); };
  im.src = URL.createObjectURL(f);
};
$('#crop-zoom').oninput = e => { zoom = +e.target.value; draw(); };
let drag = null;
cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); };
cv.onpointermove = e => {
  if (!drag) return;
  const k = SZ / cv.getBoundingClientRect().width;
  offX += (e.clientX - drag.x) * k; offY += (e.clientY - drag.y) * k;
  drag = { x: e.clientX, y: e.clientY }; draw();
};
cv.onpointerup = cv.onpointercancel = () => drag = null;

$('#add-btn').onclick = async () => {
  const nom = $('#c-nom').value.trim(), classe = $('#c-classe').value.trim(), description = $('#c-desc').value.trim(), poste = $('#c-poste').value;
  if (!nom || !classe) { alert('Nom et classe obligatoires.'); return; }
  $('#add-btn').disabled = true;
  const photo = img ? cv.toDataURL('image/jpeg', .72) : '';
  const r = await call({ action: 'add', adminCode, nom, classe, description, photo, poste });
  $('#add-btn').disabled = false;
  if (!r.ok) { alert(r.error); return; }
  ['#c-nom', '#c-classe', '#c-desc', '#c-photo'].forEach(s => $(s).value = '');
  img = null; $('#crop').hidden = true;
  refresh();
};

show('code-view');
