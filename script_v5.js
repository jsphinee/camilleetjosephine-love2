// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Scroll progress wave
const wavePath = document.querySelector('.scroll-wave path');
const waveLength = wavePath.getTotalLength();
wavePath.style.strokeDasharray = waveLength;
wavePath.style.strokeDashoffset = waveLength;

function updateWave() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? scrollTop / docHeight : 0;
  wavePath.style.strokeDashoffset = waveLength - waveLength * progress;
}
window.addEventListener('scroll', updateWave, { passive: true });
updateWave();

// RSVP form: submits via a hidden iframe (bypasses CORS restrictions that
// can block direct fetch() calls to Google Apps Script from some browsers)
const form = document.getElementById('rsvpForm');
const formNote = document.getElementById('formNote');
const hiddenFrame = document.getElementById('hiddenRsvpFrame');
const submitBtn = form.querySelector('button[type="submit"]');
let rsvpSubmitted = false;

// --- RSVP dynamic fields ---
const contactControlContainer = document.getElementById('contactControlContainer');
const contactProfileName = document.getElementById('contactProfileName');
const addedGuestsContainer = document.getElementById('addedGuestsContainer');
const householdBox = document.getElementById('householdSuggestions');
const contactFirstname = document.getElementById('contact_firstname');
const contactLastname = document.getElementById('contact_lastname');
const addManualGuestBtn = document.getElementById('addManualGuestBtn');

let lastQueriedKey = '';
let addedGuests = []; // { firstname, lastname, manual: boolean }
let lastMembers = [];
let manualCounter = 0;

const PROFILE_OPTIONS = `
  <option value="" selected disabled>— Choisir —</option>
  <option value="Adulte - Omnivore">Adulte - Omnivore</option>
  <option value="Adulte - Végétarien">Adulte - Végétarien</option>
  <option value="Enfant - Omnivore">Enfant - Omnivore</option>
  <option value="Enfant - Végétarien">Enfant - Végétarien</option>
  <option value="Bébé">Bébé</option>
`;

// Construit le HTML "Présent/Absent" + bloc Profil (masqué tant que non Présent)
function reponseControlHtml(prefix) {
  return `
    <div class="form-row">
      <label>Présent(e) ou absent(e) ?</label>
      <select class="${prefix}-reponse" required>
        <option value="" selected disabled>— Choisir —</option>
        <option value="Présent">Présent</option>
        <option value="Absent">Absent</option>
      </select>
    </div>
    <div class="form-row ${prefix}-profile-wrapper" hidden>
      <label>Profil</label>
      <select class="${prefix}-profile">${PROFILE_OPTIONS}</select>
    </div>
  `;
}

function wireReponseToggle(container, prefix) {
  const reponseSelect = container.querySelector(`.${prefix}-reponse`);
  const profileWrapper = container.querySelector(`.${prefix}-profile-wrapper`);
  const profileSelect = container.querySelector(`.${prefix}-profile`);
  reponseSelect.addEventListener('change', () => {
    const isPresent = reponseSelect.value === 'Présent';
    profileWrapper.hidden = !isPresent;
    // Un champ obligatoire mais caché bloque silencieusement l'envoi du
    // formulaire dans certains navigateurs : on retire "required" tant
    // qu'il n'est pas affiché.
    profileSelect.required = isPresent;
    if (!isPresent) profileSelect.value = '';
  });
}

// Met en forme "jean-pierre dupont" -> "Jean-Pierre Dupont"
function titleCase(str) {
  return (str || '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, sep, letter) => sep + letter.toUpperCase());
}

function updateContactProfileName() {
  contactFirstname.value = titleCase(contactFirstname.value);
  contactLastname.value = titleCase(contactLastname.value);
  const firstname = contactFirstname.value.trim();
  const lastname = contactLastname.value.trim();
  contactProfileName.textContent = (firstname + ' ' + lastname).trim() || 'Vous';
}
contactFirstname.addEventListener('blur', updateContactProfileName);
contactLastname.addEventListener('blur', updateContactProfileName);
contactFirstname.addEventListener('blur', maybeLookupHousehold);
contactLastname.addEventListener('blur', maybeLookupHousehold);

// Initialise le contrôle du contact une fois au chargement
contactControlContainer.innerHTML = reponseControlHtml('contact');
wireReponseToggle(contactControlContainer, 'contact');

// --- Recherche du foyer (via JSONP pour contourner les restrictions CORS d'Apps Script) ---
function maybeLookupHousehold() {
  const firstname = contactFirstname.value.trim();
  const lastname = contactLastname.value.trim();
  if (!firstname || !lastname) return;

  const key = firstname.toLowerCase() + '|' + lastname.toLowerCase();
  if (key === lastQueriedKey) return; // pas de changement réel depuis la dernière recherche

  const scriptURL = form.dataset.scriptUrl;
  if (!scriptURL || scriptURL.includes('COLLE_TON_URL')) return;
  lastQueriedKey = key;

  // Affiche un message d'attente : la recherche peut prendre quelques
  // secondes (temps de démarrage normal d'un script Google Apps Script).
  householdBox.hidden = false;
  householdBox.innerHTML = '<p class="household-note">Recherche des membres de votre foyer…</p>';

  const callbackName = 'householdCb_' + Date.now();
  window[callbackName] = function (data) {
    handleHouseholdResponse(data || {});
    delete window[callbackName];
    scriptTag.remove();
  };

  const scriptTag = document.createElement('script');
  const params = new URLSearchParams({
    action: 'household',
    prenom: firstname,
    nom: lastname,
    callback: callbackName
  });
  scriptTag.src = scriptURL + '?' + params.toString();
  scriptTag.onerror = () => { delete window[callbackName]; lastQueriedKey = ''; };
  document.body.appendChild(scriptTag);
}

function handleHouseholdResponse(data) {
  if (data.found === false) {
    householdBox.hidden = false;
    householdBox.innerHTML = '<p class="household-note">Nous n\'avons pas retrouvé votre nom sur notre liste — pas de souci, vous pouvez continuer votre réponse normalement.</p>';
    lastMembers = [];
    return;
  }

  // Corrige l'orthographe (accents, majuscules) avec celle de la liste
  if (data.contact) {
    contactFirstname.value = data.contact.prenom;
    contactLastname.value = data.contact.nom;
    updateContactProfileName();
  }

  lastMembers = data.members || [];
  renderSuggestionChips();
}

function renderSuggestionChips() {
  if (!lastMembers.length) {
    householdBox.hidden = true;
    householdBox.innerHTML = '';
    return;
  }

  householdBox.hidden = false;
  householdBox.innerHTML = '<p>Nous avons trouvé ces membres de votre foyer — cliquez pour les ajouter :</p><div class="suggestion-chips"></div>';
  const chipsContainer = householdBox.querySelector('.suggestion-chips');

  lastMembers.forEach(m => {
    const alreadyAdded = addedGuests.some(g => g && !g.manual &&
      g.firstname.toLowerCase() === m.prenom.toLowerCase() &&
      g.lastname.toLowerCase() === m.nom.toLowerCase());

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'suggestion-chip' + (alreadyAdded ? ' added' : '');
    chip.textContent = `${alreadyAdded ? '✓' : '+'} ${m.prenom} ${m.nom}`;
    chip.addEventListener('click', () => {
      if (chip.classList.contains('added')) return;
      addGuestCard(m.prenom, m.nom, false);
      chip.classList.add('added');
      chip.textContent = `✓ ${m.prenom} ${m.nom}`;
    });
    chipsContainer.appendChild(chip);
  });
}

// --- Convives (suggérés ou ajoutés manuellement) ---
function addGuestCard(firstname, lastname, manual) {
  const id = addedGuests.length;
  addedGuests.push({ firstname, lastname, manual });
  const prefix = `guest${id}`;

  const card = document.createElement('div');
  card.className = 'guest-card';
  card.dataset.guestId = id;

  const nameHtml = manual
    ? `<div class="form-row form-row-split">
         <div><label>Prénom</label><input type="text" class="${prefix}-firstname" required></div>
         <div><label>Nom</label><input type="text" class="${prefix}-lastname" required></div>
       </div>`
    : `<p class="guest-card-title">${firstname} ${lastname}</p>`;

  card.innerHTML = `
    <div class="guest-card-header">
      ${nameHtml}
      ${manual ? '<button type="button" class="remove-guest-btn" aria-label="Retirer ce convive">✕</button>' : ''}
    </div>
    ${reponseControlHtml(prefix)}
  `;
  addedGuestsContainer.appendChild(card);
  wireReponseToggle(card, prefix);

  if (manual) {
    card.querySelector(`.${prefix}-firstname`).addEventListener('blur', (e) => { e.target.value = titleCase(e.target.value); });
    card.querySelector(`.${prefix}-lastname`).addEventListener('blur', (e) => { e.target.value = titleCase(e.target.value); });
    card.querySelector('.remove-guest-btn').addEventListener('click', () => {
      card.remove();
      addedGuests[id] = null; // conserve les index des autres cartes
    });
  }
}

addManualGuestBtn.addEventListener('click', () => {
  addGuestCard('', '', true);
});

// --- Compilation finale des convives juste avant l'envoi ---
function collectGuests() {
  const guests = [{
    firstname: contactFirstname.value.trim(),
    lastname: contactLastname.value.trim(),
    reponse: (contactControlContainer.querySelector('.contact-reponse') || {}).value || '',
    profile: (contactControlContainer.querySelector('.contact-profile') || {}).value || ''
  }];

  addedGuestsContainer.querySelectorAll('.guest-card').forEach(card => {
    const id = parseInt(card.dataset.guestId, 10);
    const entry = addedGuests[id];
    if (!entry) return; // a été retiré
    const prefix = `guest${id}`;

    let firstname = entry.firstname;
    let lastname = entry.lastname;
    if (entry.manual) {
      firstname = card.querySelector(`.${prefix}-firstname`).value.trim();
      lastname = card.querySelector(`.${prefix}-lastname`).value.trim();
    }

    guests.push({
      firstname,
      lastname,
      reponse: card.querySelector(`.${prefix}-reponse`).value,
      profile: card.querySelector(`.${prefix}-profile`).value
    });
  });

  return guests;
}

function injectHiddenGuestFields() {
  form.querySelectorAll('input[data-injected="1"]').forEach(el => el.remove());

  const guests = collectGuests();

  const addHidden = (name, value) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    input.dataset.injected = '1';
    form.appendChild(input);
  };

  addHidden('guestCount', String(guests.length));
  guests.forEach((g, idx) => {
    const i = idx + 1;
    addHidden(`guest_${i}_firstname`, g.firstname);
    addHidden(`guest_${i}_lastname`, g.lastname);
    addHidden(`guest_${i}_reponse`, g.reponse);
    addHidden(`guest_${i}_profile`, g.reponse === 'Présent' ? g.profile : '');
  });

  return guests;
}

// --- Submission ---

form.addEventListener('submit', (event) => {
  if (!form.action || form.action.includes('COLLE_TON_URL')) {
    formNote.textContent = "⚠️ Formulaire pas encore connecté.";
    formNote.style.color = '#c85a44';
    event.preventDefault();
    return;
  }
  if (rsvpSubmitted) {
    event.preventDefault();
    return; // envoi déjà en cours, on ignore les clics supplémentaires
  }
  injectHiddenGuestFields();
  rsvpSubmitted = true;
  submitBtn.disabled = true;
  formNote.textContent = 'Envoi en cours…';
  formNote.style.color = '#1b5a5a';
  // Let the browser submit the form normally into the hidden iframe.
});

hiddenFrame.addEventListener('load', () => {
  if (!rsvpSubmitted) return; // ignore the iframe's initial blank load
  submitBtn.disabled = false;
  formNote.textContent = 'Merci, votre réponse a bien été envoyée ! 🎉';
  formNote.style.color = '#1b5a5a';
  form.reset();
  addedGuestsContainer.innerHTML = '';
  addedGuests = [];
  lastMembers = [];
  householdBox.innerHTML = '';
  householdBox.hidden = true;
  contactControlContainer.innerHTML = reponseControlHtml('contact');
  wireReponseToggle(contactControlContainer, 'contact');
  contactProfileName.textContent = 'Vous';
  lastQueriedKey = '';
  rsvpSubmitted = false;
});
