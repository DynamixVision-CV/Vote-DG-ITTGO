// Génère le PDF officiel des résultats (jsPDF + autoTable)
async function genererPDF(R) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 15;
  const G = [11, 94, 48], Y = [245, 235, 40], GRIS = [90, 98, 110];
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const pct = (v, t) => (t ? (v * 100 / t).toFixed(1).replace('.', ',') : '0,0') + ' %';

  const logo = await new Promise(res => {
    fetch('logo.jpg').then(r => r.blob()).then(b => {
      const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b);
    }).catch(() => res(null));
  });

  // ----- En-tête -----
  doc.setFillColor(...G); doc.rect(0, 0, W, 54, 'F');
  doc.setFillColor(...Y); doc.rect(0, 54, W, 3, 'F');
  if (logo) doc.addImage(logo, 'JPEG', M, 9, 36, 36);
  const tx = logo ? M + 44 : M;
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(23);
  doc.text('RÉSULTATS OFFICIELS', tx, 24);
  doc.setTextColor(...Y); doc.setFontSize(13);
  doc.text('Élection du Bureau des Étudiants', tx, 33);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  doc.text('Institut Teng Tuuma Géosciences de Ouagadougou (I.T.T.G.O)', tx, 41);
  doc.text('Proclamation du ' + date, tx, 47);

  const postes = R.postes.filter(p => R.candidats.some(c => c.poste === p.id));
  doc.setFillColor(240, 244, 241); doc.roundedRect(M, 64, W - 2 * M, 12, 2, 2, 'F');
  doc.setTextColor(...G); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.text(`${R.started} étudiant(s) ont participé au scrutin   •   ${postes.length} poste(s) à pourvoir`, W / 2, 71.5, { align: 'center' });

  // ----- Un bloc par poste -----
  let y = 88;
  postes.forEach(p => {
    const cs = R.candidats.filter(c => c.poste === p.id).sort((a, b) => b.votes - a.votes);
    const tot = cs.reduce((t, c) => t + c.votes, 0);
    const nbTop = cs.filter(c => c.votes === cs[0].votes).length;
    if (y + 20 + (cs.length + 2) * 9 > H - 22) { doc.addPage(); y = 20; }

    doc.setFillColor(...G); doc.roundedRect(M, y, W - 2 * M, 10, 2, 2, 'F');
    doc.setFillColor(...Y); doc.rect(M, y + 2, 2.5, 6, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5);
    doc.text(p.nom.toUpperCase(), M + 6, y + 6.8);

    let rang = 0;
    const body = cs.map((c, i) => {
      if (i === 0 || c.votes < cs[i - 1].votes) rang = i + 1;
      const top = rang === 1 && tot > 0;
      return [rang, c.nom, c.classe, c.votes, pct(c.votes, tot), top ? (nbTop > 1 ? 'ÉGALITÉ' : 'ÉLU(E)') : ''];
    });
    doc.autoTable({
      startY: y + 12,
      head: [['Rang', 'Candidat', 'Classe', 'Votes', '% des votes', 'Résultat']],
      body,
      foot: [['', 'Total des votes exprimés', '', tot, tot ? '100 %' : '0 %', '']],
      theme: 'grid',
      margin: { left: M, right: M },
      pageBreak: 'avoid',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.6, lineColor: [215, 222, 217], lineWidth: 0.2, textColor: [30, 35, 45], valign: 'middle' },
      headStyles: { fillColor: [230, 240, 232], textColor: G, fontStyle: 'bold' },
      footStyles: { fillColor: [245, 247, 246], textColor: GRIS, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 32 }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 26, halign: 'center' }, 5: { cellWidth: 26, halign: 'center' } },
      didParseCell: d => {
        if (d.section === 'body' && body[d.row.index][5]) {
          d.cell.styles.fillColor = [255, 251, 170]; d.cell.styles.fontStyle = 'bold';
          if (d.column.index === 5) d.cell.styles.textColor = G;
        }
      }
    });
    y = doc.lastAutoTable.finalY + 12;
  });

  // ----- Signature -----
  if (y + 40 > H - 22) { doc.addPage(); y = 25; }
  doc.setTextColor(...GRIS); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Fait à Ouagadougou, le ' + date, W - M, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...G);
  doc.text('La Commission électorale', W - M, y + 12, { align: 'right' });
  doc.setDrawColor(...GRIS); doc.setLineWidth(0.3); doc.line(W - M - 55, y + 30, W - M, y + 30);

  // ----- Pied de page -----
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...G); doc.setLineWidth(0.6); doc.line(M, H - 15, W - M, H - 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    doc.text('I.T.T.G.O – Résultats officiels des élections', M, H - 10);
    doc.text(`Page ${i} / ${n}`, W - M, H - 10, { align: 'right' });
  }
  return doc;
}
