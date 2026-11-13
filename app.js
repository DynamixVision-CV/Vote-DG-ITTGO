// === COLLE ICI L'URL DE TON APPLICATION WEB APPS SCRIPT ===
const API = 'https://script.google.com/macros/s/AKfycbwNskhen8dX_K4uyHkh9c6tM0FOQNGlRngBMWFXbfg-j2kpfwtNbUG4fsFSmom7neU6/exec';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const views = ['code-view', 'postes-view', 'cands-view', 'done-view', 'login-view', 'admin-view'];
const show = id => {
  views.forEach(v => $('#' + v).hidden = v !== id);
  const vv = ['postes-view', 'cands-view'].includes(id);
  $('#preview-bar').hidden = !(preview && vv);
  $('footer').hidden = preview || !['code-view', 'postes-view', 'cands-view'].includes(id);
};
async function call(body) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return r.json();
}
async function load() { DATA = await (await fetch(API)).json(); }

let preview = false, DATA = { postes: [], candidats: [] }, myCode = '', voted = [], adminCode = '', timer = null, pending = null;
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
  if (!preview && actifs.length && actifs.every(p => voted.includes(p.id))) { show('done-view'); return; }
  $('#postes').innerHTML = DATA.postes.map(p => {
    const n = DATA.candidats.filter(c => c.poste === p.id).length, done = !preview && voted.includes(p.id), off = done || !n;
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
      ${preview ? '' : `<button class="btn" data-id="${esc(c.id)}" data-nom="${esc(c.nom)}" data-poste="${esc(p.id)}">Voter</button>`}</div>
    </div>`).join('');
  show('cands-view');
});
$('#back-postes').onclick = renderPostes;

$('#cards').addEventListener('click', e => {
  const b = e.target.closest('button[data-id]');
  if (!b || preview) return;
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

let ADM = [], PS = [], editId = null;
async function refresh() {
  try {
    const r = await call({ action: 'results', adminCode });
    if (!r.ok) return;
    PS = r.postes; ADM = r.candidats;
    if (!$('#c-poste').options.length) $('#c-poste').innerHTML = optsPostes();
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
      <div class="m-row"><div class="m-info">${c.photo ? `<img class="thumb" src="${esc(c.photo)}" alt="">` : '<div class="thumb none">Pas de photo</div>'}
      <span>${esc(c.nom)} — ${esc(c.classe)}<br><small class="muted">${esc(pn(c.poste))}</small></span></div>
      <div class="m-act"><button class="edit" data-id="${esc(c.id)}">Modifier</button>
      <button class="del" data-id="${esc(c.id)}" data-nom="${esc(c.nom)}">Supprimer</button></div></div>`).join('');
  } catch (e) { }
}
const optsPostes = () => PS.map(p => `<option value="${esc(p.id)}">${esc(p.nom)}</option>`).join('');

// ---------- Recadrage photo (carré fixe 280x280), réutilisable ----------
function makeCropper(fileSel, boxSel, cvSel, zoomSel) {
  const cv = $(cvSel), cx = cv.getContext('2d'), SZ = 280;
  let img = null, zoom = 1, offX = 0, offY = 0, drag = null;
  const draw = () => {
    if (!img) return;
    const s = Math.max(SZ / img.width, SZ / img.height) * zoom;
    const dw = img.width * s, dh = img.height * s, mx = (dw - SZ) / 2, my = (dh - SZ) / 2;
    offX = Math.max(-mx, Math.min(mx, offX)); offY = Math.max(-my, Math.min(my, offY));
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, SZ, SZ);
    cx.drawImage(img, (SZ - dw) / 2 + offX, (SZ - dh) / 2 + offY, dw, dh);
  };
  $(fileSel).onchange = e => {
    const f = e.target.files[0];
    if (!f) { img = null; $(boxSel).hidden = true; return; }
    const im = new Image();
    im.onload = () => { img = im; zoom = 1; offX = offY = 0; $(zoomSel).value = 1; $(boxSel).hidden = false; draw(); };
    im.src = URL.createObjectURL(f);
  };
  $(zoomSel).oninput = e => { zoom = +e.target.value; draw(); };
  cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => {
    if (!drag) return;
    const k = SZ / cv.getBoundingClientRect().width;
    offX += (e.clientX - drag.x) * k; offY += (e.clientY - drag.y) * k;
    drag = { x: e.clientX, y: e.clientY }; draw();
  };
  cv.onpointerup = cv.onpointercancel = () => drag = null;
  return {
    data: () => img ? cv.toDataURL('image/jpeg', .72) : '',
    reset() { img = null; $(fileSel).value = ''; $(boxSel).hidden = true; }
  };
}
const addCrop = makeCropper('#c-photo', '#crop', '#crop-cv', '#crop-zoom');
const editCrop = makeCropper('#e-photo', '#e-crop', '#e-cv', '#e-zoom');

// ---------- Ajouter ----------
$('#add-btn').onclick = async () => {
  const nom = $('#c-nom').value.trim(), classe = $('#c-classe').value.trim(), description = $('#c-desc').value.trim(), poste = $('#c-poste').value;
  if (!nom || !classe) { alert('Nom et classe obligatoires.'); return; }
  $('#add-btn').disabled = true;
  try {
    const r = await call({ action: 'add', adminCode, nom, classe, description, photo: addCrop.data(), poste });
    if (!r.ok) alert(r.error);
    else { ['#c-nom', '#c-classe', '#c-desc'].forEach(s => $(s).value = ''); addCrop.reset(); refresh(); }
  } catch (e) { alert('Erreur réseau, réessaie.'); }
  $('#add-btn').disabled = false;
};

// ---------- Modifier / Supprimer ----------
$('#manage').addEventListener('click', async e => {
  const ed = e.target.closest('.edit');
  if (ed) {
    const c = ADM.find(x => x.id === ed.dataset.id);
    if (!c) return;
    editId = c.id;
    $('#e-poste').innerHTML = optsPostes(); $('#e-poste').value = c.poste;
    $('#e-nom').value = c.nom; $('#e-classe').value = c.classe; $('#e-desc').value = c.description;
    $('#e-cur').hidden = !c.photo; if (c.photo) $('#e-cur').src = c.photo;
    editCrop.reset(); $('#e-err').textContent = ''; $('#edit-modal').hidden = false;
    return;
  }
  const b = e.target.closest('.del');
  if (!b || !confirm('Supprimer ' + b.dataset.nom + ' ?')) return;
  await call({ action: 'delete', adminCode, id: b.dataset.id });
  refresh();
});

$('#e-cancel').onclick = () => { $('#edit-modal').hidden = true; editCrop.reset(); };
$('#e-save').onclick = async () => {
  const nom = $('#e-nom').value.trim(), classe = $('#e-classe').value.trim();
  if (!nom || !classe) { $('#e-err').textContent = 'Nom et classe obligatoires.'; return; }
  $('#e-save').disabled = true; $('#e-err').textContent = '';
  try {
    const r = await call({ action: 'update', adminCode, id: editId, nom, classe, description: $('#e-desc').value.trim(), poste: $('#e-poste').value, photo: editCrop.data() });
    if (!r.ok) $('#e-err').textContent = r.error;
    else { $('#edit-modal').hidden = true; editCrop.reset(); refresh(); }
  } catch (e) { $('#e-err').textContent = 'Erreur réseau, réessaie.'; }
  $('#e-save').disabled = false;
};

$('#preview-btn').onclick = async () => {
  try { await load(); } catch (e) { alert('Impossible de charger les données.'); return; }
  preview = true; renderPostes();
};
$('#pv-back').onclick = () => { preview = false; show('admin-view'); };

show('code-view');
