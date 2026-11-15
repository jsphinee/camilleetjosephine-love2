// "Ma chambre" : interroge le script Google (action=room, JSONP comme la recherche de foyer du RSVP).
(function () {
  const form = document.getElementById('chambreForm');
  if (!form) return;
  const box = document.getElementById('chambreResult');
  const btn = document.getElementById('chambreBtn');
  const scriptURL = form.dataset.scriptUrl;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function message(text) { box.innerHTML = ''; box.appendChild(el('p', 'chambre-msg', text)); box.hidden = false; }
  function row(list, label, value) { const li = el('li'); li.appendChild(el('b', null, label)); li.appendChild(el('span', null, value)); list.appendChild(li); }

  function render(d) {
    btn.disabled = false; btn.textContent = 'Voir ma chambre';
    if (!d || d.found === false) { message("Nous n'avons pas retrouvé ce nom sur notre liste. Vérifiez l'orthographe, ou écrivez-nous : nous vous répondrons vite !"); return; }
    if (d.status === 'pending') { message('Merci ' + d.prenom + " ! Votre chambre n'est pas encore confirmée : nous revenons vers vous dès que c'est fait."); return; }
    if (d.status !== 'confirmed') { message('Merci ' + d.prenom + " ! Nous n'avons pas de chambre à vous indiquer pour le moment. Si vous pensez que c'est une erreur, écrivez-nous."); return; }
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

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    const prenom = document.getElementById('chambre_firstname').value.trim();
    const nom = document.getElementById('chambre_lastname').value.trim();
    if (!prenom || !nom) { message('Merci de renseigner votre prénom et votre nom.'); return; }
    btn.disabled = true; btn.textContent = 'Recherche…';
    message('Recherche de votre chambre… (cela peut prendre quelques secondes)');
    const cb = 'roomCb_' + Date.now();
    const tag = document.createElement('script');
    const timer = setTimeout(function () { delete window[cb]; tag.remove(); btn.disabled = false; btn.textContent = 'Voir ma chambre'; message('Le service ne répond pas pour le moment, merci de réessayer dans un instant.'); }, 25000);
    window[cb] = function (data) { clearTimeout(timer); delete window[cb]; tag.remove(); render(data); };
    tag.src = scriptURL + '?' + new URLSearchParams({ action: 'room', prenom: prenom, nom: nom, callback: cb }).toString();
    tag.onerror = function () { clearTimeout(timer); delete window[cb]; btn.disabled = false; btn.textContent = 'Voir ma chambre'; message('Impossible de joindre le service, merci de réessayer.'); };
    document.body.appendChild(tag);
  });
})();
