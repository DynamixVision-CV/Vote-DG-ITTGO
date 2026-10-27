// ===== CONFIG =====
const ADMIN_CODE = 'ITTGO-2026'; // <-- change ce code admin !
const NB_CODES = 250; // ~200 étudiants + marge de sécurité
const POSTES = [
  { id: 'DG', nom: 'Délégué Général (DG)' },
  { id: 'DGA', nom: 'Délégué Général Adjoint (DGA)' },
  { id: 'CT', nom: 'Chargé de la Trésorerie (CT)' },
  { id: 'CTA', nom: 'Chargé de la Trésorerie Adjoint (CTA)' },
  { id: 'CC', nom: 'Chargé de la Communication (CC)' },
  { id: 'CCA', nom: 'Chargé de la Communication Adjoint (CCA)' },
  { id: 'CAS', nom: 'Chargé des Activités Sportives (CAS)' },
  { id: 'CASA', nom: 'Chargé des Activités Sportives Adjoint (CASA)' },
  { id: 'CASC', nom: 'Chargé des Activités Sociaux Culturelles (CA-SC)' },
  { id: 'CASCA', nom: 'Chargé des Activités Sociaux Culturelles Adjoint (CA-SCA)' },
  { id: 'SG', nom: 'Secrétariat Général' },
  { id: 'SGA', nom: 'Secrétariat Général Adjoint' },
  { id: 'CRE', nom: 'Chargé des Relations Extérieures (CRE)' },
  { id: 'CREA', nom: 'Chargé des Relations Extérieures Adjoint (CREA)' }
];

const sh = n => SpreadsheetApp.getActive().getSheetByName(n);
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

// À exécuter UNE SEULE FOIS : crée les feuilles et les codes (EFFACE tout)
function setup() {
  const ss = SpreadsheetApp.getActive();
  ['Codes', 'Candidats', 'Votes'].forEach(n => { if (!ss.getSheetByName(n)) ss.insertSheet(n); sh(n).clearContents(); });
  sh('Candidats').getRange(1, 1, 1, 6).setValues([['id', 'nom', 'classe', 'description', 'photo', 'poste']]);
  sh('Votes').getRange(1, 1, 1, 2).setValues([['poste', 'candidatId']]);
  sh('Codes').getRange(1, 1, 1, 3).setValues([['code', 'statut', 'postes_votes']]);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const set = {};
  while (Object.keys(set).length < NB_CODES) {
    let c = '';
    for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)];
    set[c] = 1;
  }
  const rows = Object.keys(set).map(c => [c, 'NON', '']);
  sh('Codes').getRange(2, 1, rows.length, 3).setValues(rows);
  const rng = sh('Codes').getRange('B2:B' + (NB_CODES + 1));
  const rule = (t, col) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t).setBackground(col).setRanges([rng]).build();
  sh('Codes').setConditionalFormatRules([rule('NON', '#c8f0d2'), rule('EN COURS', '#ffe3b0'), rule('TERMINÉ', '#f6c9c9')]);
  sh('Codes').getRange('E1:F4').setFormulas([
    ['Total', '=COUNTA(A2:A)'],
    ['Non utilisés', '=COUNTIF(B2:B,"NON")'],
    ['En cours', '=COUNTIF(B2:B,"EN COURS")'],
    ['Terminés', '=COUNTIF(B2:B,"TERMINÉ")']
  ]);
  sh('Codes').setColumnWidth(1, 140);
  sh('Codes').setColumnWidth(3, 220);
}

function getCandidats() {
  const v = sh('Candidats').getDataRange().getValues();
  v.shift();
  return v.filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), nom: r[1], classe: r[2], description: r[3], photo: r[4], poste: String(r[5])
  }));
}

function doGet() { return out({ ok: true, postes: POSTES, candidats: getCandidats() }); }

function findCode(code) {
  code = String(code || '').trim().toUpperCase();
  const v = sh('Codes').getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) === code) return { row: i + 1, voted: String(v[i][2] || '').split(',').filter(Boolean) };
  }
  return null;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'status') {
      const c = findCode(d.code);
      return out(c ? { ok: true, voted: c.voted } : { ok: false, error: 'Code invalide' });
    }
    if (d.action === 'vote') return out(vote(d));
    if (d.adminCode !== ADMIN_CODE) return out({ ok: false, error: 'Code admin invalide' });
    if (d.action === 'login') return out({ ok: true });
    if (d.action === 'results') return out(results());
    if (d.action === 'add') {
      const id = Utilities.getUuid().slice(0, 8);
      sh('Candidats').appendRow([id, d.nom, d.classe, d.description, d.photo || '', d.poste]);
      return out({ ok: true });
    }
    if (d.action === 'delete') {
      const v = sh('Candidats').getDataRange().getValues();
      for (let i = 1; i < v.length; i++) {
        if (String(v[i][0]) === String(d.id)) { sh('Candidats').deleteRow(i + 1); break; }
      }
      return out({ ok: true });
    }
    return out({ ok: false, error: 'Action inconnue' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function vote(d) {
  const c = findCode(d.code);
  if (!c) return { ok: false, error: 'Code invalide' };
  if (c.voted.indexOf(d.posteId) >= 0) return { ok: false, error: 'Tu as déjà voté pour ce poste' };
  const cands = getCandidats();
  if (!cands.some(x => x.id === String(d.candidatId) && x.poste === d.posteId)) return { ok: false, error: 'Candidat introuvable' };
  sh('Votes').appendRow([d.posteId, String(d.candidatId)]); // anonyme : aucun lien avec le code
  c.voted.push(d.posteId);
  const actifs = {};
  cands.forEach(x => actifs[x.poste] = 1);
  const fini = Object.keys(actifs).every(p => c.voted.indexOf(p) >= 0);
  sh('Codes').getRange(c.row, 2, 1, 2).setValues([[fini ? 'TERMINÉ' : 'EN COURS', c.voted.join(',')]]);
  return { ok: true };
}

function results() {
  const counts = {};
  sh('Votes').getDataRange().getValues().slice(1).forEach(r => { const k = String(r[1]); counts[k] = (counts[k] || 0) + 1; });
  const codes = sh('Codes').getDataRange().getValues().slice(1, NB_CODES + 1);
  return {
    ok: true, postes: POSTES, total: NB_CODES,
    started: codes.filter(r => r[1] !== 'NON').length,
    finished: codes.filter(r => r[1] === 'TERMINÉ').length,
    candidats: getCandidats().map(c => Object.assign(c, { votes: counts[c.id] || 0 }))
  };
}
