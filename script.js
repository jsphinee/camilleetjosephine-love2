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
let rsvpSubmitted = false;

// --- RSVP dynamic fields ---
const presenceRadios = form.querySelectorAll('input[name="presence"]');
const contactProfileRow = document.getElementById('contactProfileRow');
const contactProfileSelect = document.getElementById('contactProfile');
const contactProfileName = document.getElementById('contactProfileName');
const addedGuestsContainer = document.getElementById('addedGuestsContainer');
const householdBox = document.getElementById('householdSuggestions');
const contactFirstname = document.getElementById('contact_firstname');
const contactLastname = document.getElementById('contact_lastname');

let householdLookupDone = false;
let addedFamilyMembers = []; // { firstname, lastname }

const PROFILE_OPTIONS = `
  <option value="Adulte - Omnivore">Adulte - Omnivore</option>
  <option value="Adulte - Végétarien">Adulte - Végétarien</option>
  <option value="Enfant - Omnivore">Enfant - Omnivore</option>
  <option value="Enfant - Végétarien">Enfant - Végétarien</option>
  <option value="Bébé">Bébé</option>
`;

function updateContactProfileName() {
  const firstname = contactFirstname.value.trim();
  const lastname = contactLastname.value.trim();
  contactProfileName.textContent = (firstname + ' ' + lastname).trim() || 'Vous';
}

function updatePresenceUI() {
  const selected = form.querySelector('input[name="presence"]:checked');
  const isComing = selected && selected.value === 'oui';
  contactProfileRow.hidden = !isComing;
  if (isComing) {
    updateContactProfileName();
  } else {
    addedGuestsContainer.innerHTML = '';
    addedFamilyMembers = [];
  }
}
presenceRadios.forEach(radio => radio.addEventListener('change', updatePresenceUI));
contactFirstname.addEventListener('blur', updateContactProfileName);
contactLastname.addEventListener('blur', updateContactProfileName);

// Recherche les suggestions dès que Prénom + Nom sont remplis
contactFirstname.addEventListener('blur', maybeLookupHousehold);
contactLastname.addEventListener('blur', maybeLookupHousehold);

// --- Recherche du foyer (via JSONP pour contourner les restrictions CORS d'Apps Script) ---
function maybeLookupHousehold() {
  const firstname = contactFirstname.value.trim();
  const lastname = contactLastname.value.trim();
  if (!firstname || !lastname || householdLookupDone) return;

  const scriptURL = form.dataset.scriptUrl;
  if (!scriptURL || scriptURL.includes('COLLE_TON_URL')) return;
  householdLookupDone = true;

  const callbackName = 'householdCb_' + Date.now();
  window[callbackName] = function (data) {
    renderHouseholdSuggestions(data || {});
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
  scriptTag.onerror = () => { delete window[callbackName]; householdLookupDone = false; };
  document.body.appendChild(scriptTag);
}

function renderHouseholdSuggestions(data) {
  const members = data.members || [];

  if (data.found === false) {
    householdBox.hidden = false;
    householdBox.innerHTML = '<p class="household-note">Nous n\'avons pas retrouvé votre nom sur notre liste — pas de souci, vous pouvez continuer votre réponse normalement.</p>';
    return;
  }

  if (!members.length) {
    householdBox.hidden = true;
    householdBox.innerHTML = '';
    return;
  }

  householdBox.hidden = false;
  householdBox.innerHTML = '<p>Nous avons trouvé ces membres de votre foyer — cliquez pour les ajouter :</p><div class="suggestion-chips"></div>';
  const chipsContainer = householdBox.querySelector('.suggestion-chips');

  members.forEach(m => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'suggestion-chip';
    chip.textContent = `+ ${m.prenom} ${m.nom}`;
    chip.addEventListener('click', () => {
      if (chip.classList.contains('added')) return;
      addFamilyMember(m.prenom, m.nom);
      chip.classList.add('added');
      chip.textContent = `✓ ${m.prenom} ${m.nom}`;
    });
    chipsContainer.appendChild(chip);
  });
}

function addFamilyMember(firstname, lastname) {
  const id = addedFamilyMembers.length;
  addedFamilyMembers.push({ firstname, lastname });

  const card = document.createElement('div');
  card.className = 'guest-card';
  card.dataset.memberId = id;
  card.innerHTML = `
    <div class="guest-card-header">
      <p class="guest-card-title">${firstname} ${lastname}</p>
    </div>
    <div class="form-row">
      <label>Profil</label>
      <select class="added-guest-profile">${PROFILE_OPTIONS}</select>
    </div>
  `;
  addedGuestsContainer.appendChild(card);
}

// --- Compilation finale des convives juste avant l'envoi ---
function collectGuests() {
  const guests = [{
    firstname: contactFirstname.value.trim(),
    lastname: contactLastname.value.trim(),
    profile: contactProfileSelect.value
  }];

  addedGuestsContainer.querySelectorAll('.guest-card').forEach(card => {
    const id = parseInt(card.dataset.memberId, 10);
    const member = addedFamilyMembers[id];
    if (member) {
      guests.push({
        firstname: member.firstname,
        lastname: member.lastname,
        profile: card.querySelector('.added-guest-profile').value
      });
    }
  });

  return guests;
}

function injectHiddenGuestFields() {
  form.querySelectorAll('input[data-injected="1"]').forEach(el => el.remove());

  const selected = form.querySelector('input[name="presence"]:checked');
  const isComing = selected && selected.value === 'oui';
  const guests = isComing ? collectGuests() : [];

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
    addHidden(`guest_${i}_profile`, g.profile);
  });
}

// --- Submission ---

form.addEventListener('submit', (event) => {
  if (!form.action || form.action.includes('COLLE_TON_URL')) {
    formNote.textContent = "⚠️ Formulaire pas encore connecté.";
    formNote.style.color = '#c85a44';
    event.preventDefault();
    return;
  }
  injectHiddenGuestFields();
  rsvpSubmitted = true;
  formNote.textContent = 'Envoi en cours…';
  formNote.style.color = '#1b5a5a';
  // Let the browser submit the form normally into the hidden iframe.
});

hiddenFrame.addEventListener('load', () => {
  if (!rsvpSubmitted) return; // ignore the iframe's initial blank load
  formNote.textContent = 'Merci, votre réponse a bien été envoyée ! 🎉';
  formNote.style.color = '#1b5a5a';
  form.reset();
  addedGuestsContainer.innerHTML = '';
  addedFamilyMembers = [];
  householdBox.innerHTML = '';
  householdBox.hidden = true;
  contactProfileRow.hidden = true;
  householdLookupDone = false;
  rsvpSubmitted = false;
});
