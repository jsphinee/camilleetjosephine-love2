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
const guestCountRow = document.getElementById('guestCountRow');
const guestCountSelect = document.getElementById('guestCount');
const guestsContainer = document.getElementById('guestsContainer');
const householdBox = document.getElementById('householdSuggestions');
const contactFirstname = document.getElementById('contact_firstname');
const contactLastname = document.getElementById('contact_lastname');

let householdLookupDone = false;
// Noms + profils préremplis pour certains index de convive (issus des suggestions de foyer)
let presetGuestNames = {};

const PROFILE_OPTIONS = `
  <option value="Adulte - Omnivore">Adulte - Omnivore</option>
  <option value="Adulte - Végétarien">Adulte - Végétarien</option>
  <option value="Enfant - Omnivore">Enfant - Omnivore</option>
  <option value="Enfant - Végétarien">Enfant - Végétarien</option>
  <option value="Bébé">Bébé</option>
`;

function renderGuestFields() {
  const count = parseInt(guestCountSelect.value, 10) || 0;
  guestsContainer.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const preset = i === 1
      ? { firstname: contactFirstname.value.trim(), lastname: contactLastname.value.trim(), profile: presetGuestNames[1] ? presetGuestNames[1].profile : '' }
      : (presetGuestNames[i] || { firstname: '', lastname: '', profile: '' });

    const card = document.createElement('div');
    card.className = 'guest-card';
    card.innerHTML = `
      <p class="guest-card-title">Convive ${i}</p>
      <div class="guest-card-grid">
        <div>
          <label for="guest_${i}_firstname">Prénom</label>
          <input type="text" id="guest_${i}_firstname" name="guest_${i}_firstname" value="${preset.firstname}" required>
        </div>
        <div>
          <label for="guest_${i}_lastname">Nom</label>
          <input type="text" id="guest_${i}_lastname" name="guest_${i}_lastname" value="${preset.lastname}" required>
        </div>
        <div>
          <label for="guest_${i}_profile">Profil</label>
          <select id="guest_${i}_profile" name="guest_${i}_profile">${PROFILE_OPTIONS}</select>
        </div>
      </div>
    `;
    guestsContainer.appendChild(card);
    if (preset.profile) {
      card.querySelector(`#guest_${i}_profile`).value = preset.profile;
    }
  }
}

function updatePresenceUI() {
  const selected = form.querySelector('input[name="presence"]:checked');
  const isComing = selected && selected.value === 'oui';
  guestCountRow.hidden = !isComing;
  if (isComing) {
    renderGuestFields();
    maybeLookupHousehold();
  } else {
    guestsContainer.innerHTML = '';
    householdBox.hidden = true;
    householdBox.innerHTML = '';
  }
}

presenceRadios.forEach(radio => radio.addEventListener('change', updatePresenceUI));
guestCountSelect.addEventListener('change', renderGuestFields);

contactLastname.addEventListener('blur', () => {
  const selected = form.querySelector('input[name="presence"]:checked');
  if (selected && selected.value === 'oui') {
    renderGuestFields(); // rafraîchit convive 1 avec le nom fraîchement tapé
    maybeLookupHousehold();
  }
});

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
  householdBox.innerHTML = '<p>Nous avons trouvé ces membres de votre foyer :</p>';
  members.forEach(m => {
    const row = document.createElement('div');
    row.className = 'household-row';
    row.innerHTML = `
      <div class="household-row-name">${m.prenom} ${m.nom}</div>
      <div class="household-row-fields">
        <select class="household-presence" data-firstname="${m.prenom}" data-lastname="${m.nom}">
          <option value="non" selected>Ne sera pas présent(e)</option>
          <option value="oui">Sera présent(e)</option>
        </select>
        <select class="household-profile" hidden>${PROFILE_OPTIONS}</select>
      </div>
    `;
    householdBox.appendChild(row);

    const presenceSelect = row.querySelector('.household-presence');
    const profileSelect = row.querySelector('.household-profile');
    presenceSelect.addEventListener('change', () => {
      profileSelect.hidden = presenceSelect.value !== 'oui';
      syncHouseholdSelections();
    });
    profileSelect.addEventListener('change', syncHouseholdSelections);
  });
}

function syncHouseholdSelections() {
  const rows = householdBox.querySelectorAll('.household-row');

  presetGuestNames = {};
  let nextIndex = 2; // convive 1 = le contact lui-même
  rows.forEach(row => {
    const presenceSelect = row.querySelector('.household-presence');
    if (presenceSelect.value === 'oui') {
      const profileSelect = row.querySelector('.household-profile');
      presetGuestNames[nextIndex] = {
        firstname: presenceSelect.dataset.firstname,
        lastname: presenceSelect.dataset.lastname,
        profile: profileSelect.value
      };
      nextIndex++;
    }
  });

  const neededCount = Math.min(10, Math.max(1, nextIndex - 1));
  guestCountSelect.value = String(neededCount);
  renderGuestFields();
}

// --- Submission ---

form.addEventListener('submit', (event) => {
  if (!form.action || form.action.includes('COLLE_TON_URL')) {
    formNote.textContent = "⚠️ Formulaire pas encore connecté.";
    formNote.style.color = '#c85a44';
    event.preventDefault();
    return;
  }
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
  guestsContainer.innerHTML = '';
  householdBox.innerHTML = '';
  householdBox.hidden = true;
  guestCountRow.hidden = true;
  guestCountSelect.value = '1';
  presetGuestNames = {};
  householdLookupDone = false;
  rsvpSubmitted = false;
});
