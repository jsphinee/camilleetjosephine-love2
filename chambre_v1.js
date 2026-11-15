// Chambre : une fois le prénom et le nom saisis dans le formulaire RSVP, affiche la chambre
// uniquement si elle est confirmée (🔒) dans l'onglet "Chambres". Sinon, rien n'apparaît.
(function () {
  const fn = document.getElementById('contact_firstname');
  const ln = document.getElementById('contact_lastname');
  const rsvp = document.getElementById('rsvpForm');
  const box = document.getElementById('chambreResult');
  if (!fn || !ln || !rsvp || !box) return;
  const scriptURL = rsvp.dataset.scriptUrl;
  let lastKey = '', seq = 0;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function row(list, label, value) { const li = el('li'); li.appendChild(el('b', null, label)); li.appendChild(el('span', null, value)); list.appendChild(li); }
  function hide() { box.innerHTML = ''; box.hidden = true; }

  function render(d) {
        if (!d || d.found === false || d.status !== 'confirmed') { box.innerHTML = ''; box.hidden = true; return; }
    box.innerHTML = '';
    const card = el('div', 'chambre-card');
    card.appendChild(el('h3', null, d.dorm ? 'Le dortoir' : d.room));
    card.appendChild(el('p', 'chambre-sub', d.dorm ? 'Jardin du manoir' : d.zone + ' · ' + d.cat));
    const ul = el('ul', 'chambre-rows');
    if (d.mates && d.mates.length) row(ul, d.dorm ? 'Avec' : 'Avec vous', d.mates.join(', '));
    if (!d.dorm) row(ul, 'Couchage', d.bed);
    row(ul, 'Arrivée', 'le ' + d.arrival + ', à partir de ' + d.checkin);
    row(ul, 'Départ', 'le ' + d.departure + ', avant ' + d.checkout + ' (' + d.nights + ' nuit' + (d.nights > 1 ? 's' : '') + ')');
    if (d.access && d.access.length) row(ul, 'À savoir', d.access.join(' · '));
    row(ul, 'Réservation', 'au nom de ' + d.bookedBy);
    if (d.payer === 'Mariés') row(ul, 'Règlement', 'Cette chambre est prise en charge par Camille et Joséphine.');
    else if (d.dorm) row(ul, 'Règlement', d.dortPay.indexOf('Nous') === 0 ? 'Le dortoir est pris en charge par Camille et Joséphine.' : 'À régler directement au manoir.');
    else row(ul, 'Règlement', 'Le manoir vous facture directement : acompte de 50 % à la réservation, solde sur place.' + (d.price != null ? ' Tarif de la chambre : ' + d.price + ' € (hors petit-déjeuner et taxe de séjour).' : ''));
    card.appendChild(ul);
    card.appendChild(el('p', 'chambre-note', 'Le manoir enverra la confirmation de réservation à l\'adresse e-mail communiquée. Une question ? Écrivez-nous, nous sommes là !'));
    box.appendChild(card); box.hidden = false;
  }


  function lookup() {
    const prenom = fn.value.trim(), nom = ln.value.trim();
    if (!prenom || !nom || !scriptURL) { lastKey = ''; hide(); return; }
    const key = prenom.toLowerCase() + '|' + nom.toLowerCase();
    if (key === lastKey) return;
    lastKey = key; hide();
    const my = ++seq, cb = 'roomCb_' + Date.now();
    const tag = document.createElement('script');
    const done = function () { delete window[cb]; tag.remove(); };
    window[cb] = function (data) { done(); if (my === seq) render(data); };
    tag.src = scriptURL + '?' + new URLSearchParams({ action: 'room', prenom: prenom, nom: nom, callback: cb }).toString();
    tag.onerror = function () { done(); lastKey = ''; };
    document.body.appendChild(tag);
  }
  fn.addEventListener('blur', lookup);
  ln.addEventListener('blur', lookup);
  fn.addEventListener('input', function () { seq++; lastKey = ''; hide(); });
  ln.addEventListener('input', function () { seq++; lastKey = ''; hide(); });
})();
