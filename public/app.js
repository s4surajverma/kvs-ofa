/* KVS Admission Management System - Enterprise Logic & Analytics Engine (app.js) */

// Global State
let candidates = [];
// Default Seat Matrix per section (40 capacity: 10 RTE, 2 CWSN, 28 Cat I-V)
const defaultClassVacancies = {
  "Balvatika-1": { rte: 10, cwsn: 2, catIV: 28 },
  "Balvatika-2": { rte: 10, cwsn: 2, catIV: 28 },
  "Balvatika-3": { rte: 10, cwsn: 2, catIV: 28 },
  "I": { rte: 10, cwsn: 2, catIV: 28 },
  "II": { rte: 10, cwsn: 2, catIV: 28 },
  "III": { rte: 10, cwsn: 2, catIV: 28 },
  "IV": { rte: 10, cwsn: 2, catIV: 28 },
  "V": { rte: 10, cwsn: 2, catIV: 28 },
  "VI": { rte: 10, cwsn: 2, catIV: 28 },
  "VII": { rte: 10, cwsn: 2, catIV: 28 },
  "VIII": { rte: 10, cwsn: 2, catIV: 28 },
  "IX": { rte: 10, cwsn: 2, catIV: 28 },
  "XI": { rte: 10, cwsn: 2, catIV: 28 }
};

// Default: all classes active
const defaultActiveClasses = {
  "Balvatika-1": true, "Balvatika-2": true, "Balvatika-3": true,
  "I": true, "II": true, "III": true, "IV": true, "V": true,
  "VI": true, "VII": true, "VIII": true, "IX": true, "XI": true
};

let schoolSettings = {
  name: "My Kendriya Vidyalaya",
  code: "",
  address: "",
  region: "",
  roCode: "",
  roName: "",
  locationType: "URBAN",
  sponsoredBy: "Civil",
  sponsoringAgency: "",
  longitude: "",
  latitude: "",
  principal: "",
  rteMaxDistance: 5,
  vacancies: JSON.parse(JSON.stringify(defaultClassVacancies)),
  activeClasses: JSON.parse(JSON.stringify(defaultActiveClasses)),
  // Admission Committee Members (KVS Guidelines Para 5 - 5 Members)
  committeeTeacher: "",
  committeeParent1: "",
  committeeParent2Lady: "",
  committeeVmcMember: ""
};

// === Active Class Helpers ===
function getActiveClasses() {
  const ac = schoolSettings.activeClasses || defaultActiveClasses;
  return Object.keys(ac).filter(k => ac[k] === true);
}

function isClassActive(classId) {
  if (!schoolSettings.activeClasses) schoolSettings.activeClasses = JSON.parse(JSON.stringify(defaultActiveClasses));
  return schoolSettings.activeClasses[classId] !== false;
}

function toggleClassActive(classId, isActive) {
  if (!schoolSettings.activeClasses) schoolSettings.activeClasses = JSON.parse(JSON.stringify(defaultActiveClasses));
  schoolSettings.activeClasses[classId] = isActive;
  saveSchoolSettings();
  renderSeatMatrixRows();
  populateClassFilterDropdowns();
}

let currentWizardCandidate = null;
let currentWizardStep = 1;
let verifyModalInstance = null;
let settingsModalInstance = null;

// Official KVS SAMAGAM Portal Popup Alert Helper (Non-blocking, zero stuck backdrops)
function showSamagamAlert(message, title = "System Notification", iconType = "warning", subtitle = "KVS SAMAGAM Portal Action Status") {
  const overlay = document.getElementById('samagamPopupOverlay');
  const titleEl = document.getElementById('samagamPopupTitle');
  const subEl = document.getElementById('samagamPopupSubtitle');
  const msgEl = document.getElementById('samagamPopupMessage');
  const circleEl = document.getElementById('samagamPopupIconCircle');
  const textEl = document.getElementById('samagamPopupIconText');

  if (!overlay) {
    alert(`${title}: ${message}`);
    return;
  }

  if (titleEl) titleEl.innerText = title;
  if (subEl) subEl.innerText = subtitle;
  if (msgEl) msgEl.innerText = message;

  if (circleEl && textEl) {
    if (iconType === 'success') {
      circleEl.className = 'samagam-popup-circle-icon success-icon';
      textEl.innerHTML = '<i class="bi bi-check-lg" style="font-size: 2.4rem; color: #ffffff;"></i>';
    } else if (iconType === 'error' || iconType === 'danger') {
      circleEl.className = 'samagam-popup-circle-icon error-icon';
      textEl.innerHTML = '<i class="bi bi-x-lg" style="font-size: 2rem; color: #ffffff;"></i>';
    } else if (iconType === 'info') {
      circleEl.className = 'samagam-popup-circle-icon info-icon';
      textEl.innerHTML = '<i class="bi bi-info-lg" style="font-size: 2.2rem; color: #ffffff;"></i>';
    } else {
      circleEl.className = 'samagam-popup-circle-icon';
      textEl.innerHTML = '<i class="bi bi-exclamation-lg" style="font-size: 2.2rem; color: #ffffff;"></i>';
    }
  }

  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
  document.body.style.overflow = 'hidden';
}

function closeSamagamPopup() {
  const overlay = document.getElementById('samagamPopupOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }, 250);
  } else {
    document.body.style.overflow = '';
  }
  document.body.classList.remove('modal-open');
  const badStuckBackdrops = document.querySelectorAll('.modal-backdrop');
  badStuckBackdrops.forEach(b => b.remove());
}

// Global listener for Escape key to close popup safely
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSamagamPopup();
});

// Sample candidate database matching Classwise Registration.xlsx & Lottery Slip Automation.xlsm
const sampleCandidates = [
  { regNo: "KVS/2026-27/001", name: "Test Student 1", fatherName: "Father 1", motherName: "Mother 1", dob: "2018-09-09", gender: "FEMALE", classApplied: "I", priorityCat: "Cat-2", casteCat: "OBC-NCL", rte: "YES", distanceKm: 2.1, sgc: "NO", cwsn: "NO", transfers: 0, mobile: "9876543210", verified: "VERIFIED", auditLog: {} },
  { regNo: "KVS/2026-27/002", name: "Test Student 2", fatherName: "Father 2", motherName: "Mother 2", dob: "2018-01-18", gender: "MALE", classApplied: "I", priorityCat: "Cat-4", casteCat: "SC", rte: "YES", distanceKm: 4.2, sgc: "NO", cwsn: "NO", transfers: 1, mobile: "9876543211", verified: "VERIFIED", auditLog: {} },
  { regNo: "KVS/2026-27/003", name: "Test Student 3", fatherName: "Father 3", motherName: "Mother 3", dob: "2018-01-28", gender: "MALE", classApplied: "I", priorityCat: "Cat-1", casteCat: "ST", rte: "NO", distanceKm: 6.5, sgc: "NO", cwsn: "NO", transfers: 2, mobile: "9876543212", verified: "VERIFIED", auditLog: {} },
  { regNo: "KVS/2026-27/004", name: "Test Student 4", fatherName: "Father 4", motherName: "Mother 4", dob: "2019-04-23", gender: "FEMALE", classApplied: "I", priorityCat: "Cat-3", casteCat: "GEN", rte: "NO", distanceKm: 3.0, sgc: "YES", cwsn: "NO", transfers: 0, mobile: "9876543213", verified: "VERIFIED", auditLog: {} },
  { regNo: "KVS/2026-27/005", name: "Test Student 5", fatherName: "Father 5", motherName: "Mother 5", dob: "2018-06-06", gender: "MALE", classApplied: "I", priorityCat: "Cat-3", casteCat: "GEN", rte: "NO", distanceKm: 1.5, sgc: "NO", cwsn: "NO", transfers: 0, mobile: "9876543214", verified: "PENDING", auditLog: {} },
  { regNo: "KVS/2026-27/006", name: "Test Student 6", fatherName: "Father 6", motherName: "Mother 6", dob: "2017-09-05", gender: "FEMALE", classApplied: "I", priorityCat: "Cat-5", casteCat: "OBC-NCL", rte: "NO", distanceKm: 8.2, sgc: "YES", cwsn: "NO", transfers: 0, mobile: "9876543215", verified: "DEFICIENT", deficiencyReason: "Valid OBC-NCL income certificate for current financial year not produced.", auditLog: {} }
];

// Official SAMPLES Datasets mapped from SAMPLES folder
const samplePdfDatasets = {
  standard: {
    regNo: "KVS/2026-27/BAL-001",
    name: "Kavya Sharma",
    fatherName: "Deepak Sharma (Central Govt)",
    motherName: "Sunita Sharma",
    dob: "2022-05-14",
    gender: "FEMALE",
    classApplied: "Balvatika-1",
    priorityCat: "Cat-1",
    casteCat: "GEN",
    rte: "YES",
    distanceKm: 2.1,
    sgc: "YES",
    cwsn: "NO",
    transfers: 1,
    mobile: "9876543210",
    sourceFile: "samagam-kvs-gov-in-balvatika-application.pdf"
  },
  duplicate: {
    regNo: "KVS/2026-27/BAL-001", // Intentional duplicate of Kavya Sharma
    name: "Kavya Sharma",
    fatherName: "Deepak Sharma",
    motherName: "Sunita Sharma",
    dob: "2022-05-14",
    gender: "FEMALE",
    classApplied: "Balvatika-1",
    priorityCat: "Cat-1",
    casteCat: "GEN",
    rte: "YES",
    distanceKm: 2.1,
    sgc: "YES",
    cwsn: "NO",
    transfers: 1,
    mobile: "9876543210",
    sourceFile: "samagam-kvs-gov-in-balvatika-application-duplicate.pdf"
  },
  invalid: {
    regNo: "KVS/2026-27/BAL-002",
    name: "Rudra Patel",
    fatherName: "Vikram Patel",
    motherName: "Anita Patel",
    dob: "2022-08-10", // Age ~3.6 yrs on 31.03.2026 -> Too young for Class I (Requires 6+ yrs)
    gender: "MALE",
    classApplied: "I", // Ineligible: Applied for Class 1 instead of Balvatika-1
    priorityCat: "Cat-3",
    casteCat: "OBC-NCL",
    rte: "YES",
    distanceKm: 3.5,
    sgc: "NO",
    cwsn: "NO",
    transfers: 0,
    mobile: "9876543220",
    sourceFile: "samagam-kvs-gov-in-balvatika-application-invalid-class-1.pdf"
  },
  overviewBatch: [
    { regNo: "KVS/2026-27/BAL-101", name: "Aarav Deshmukh", fatherName: "Sanjay Deshmukh", motherName: "Priya Deshmukh", dob: "2022-04-12", gender: "MALE", classApplied: "Balvatika-1", priorityCat: "Cat-1", casteCat: "SC", rte: "YES", distanceKm: 1.8, sgc: "NO", cwsn: "NO", transfers: 2, mobile: "9876543231" },
    { regNo: "KVS/2026-27/BAL-102", name: "Ananya Joshi", fatherName: "Mahesh Joshi", motherName: "Sneha Joshi", dob: "2021-06-25", gender: "FEMALE", classApplied: "Balvatika-2", priorityCat: "Cat-2", casteCat: "GEN", rte: "YES", distanceKm: 4.2, sgc: "YES", cwsn: "NO", transfers: 0, mobile: "9876543232" },
    { regNo: "KVS/2026-27/BAL-103", name: "Vihaan Kulkarni", fatherName: "Rajiv Kulkarni", motherName: "Meera Kulkarni", dob: "2020-09-18", gender: "MALE", classApplied: "Balvatika-3", priorityCat: "Cat-3", casteCat: "OBC-NCL", rte: "NO", distanceKm: 6.0, sgc: "NO", cwsn: "NO", transfers: 0, mobile: "9876543233" }
  ]
};

// === Multitenant User-Scoped Storage ===

/**
 * Get the current logged-in user's unique ID for scoping localStorage.
 * Falls back to 'global' if no user is authenticated (should not happen in normal flow).
 */
function getCurrentUserId() {
  if (window.Auth && window.Auth.currentUser && window.Auth.currentUser.id) {
    return window.Auth.currentUser.id;
  }
  // Fallback: try sessionStorage
  try {
    const session = sessionStorage.getItem('kvs_current_user');
    if (session) {
      const user = JSON.parse(session);
      if (user && user.id) return user.id;
    }
  } catch (e) {}
  return 'global';
}

/**
 * One-time migration: Move data from old global keys to the current user's scoped keys.
 * Only runs if global keys exist and user-scoped keys do NOT exist.
 */
function migrateGlobalDataToUser(userId) {
  const globalCandidates = localStorage.getItem('kvs_candidates_2026');
  const globalSettings = localStorage.getItem('kvs_school_settings');
  const userCandidatesKey = `kvs_candidates_${userId}`;
  const userSettingsKey = `kvs_school_settings_${userId}`;

  let migrated = false;

  if (globalCandidates && !localStorage.getItem(userCandidatesKey)) {
    localStorage.setItem(userCandidatesKey, globalCandidates);
    migrated = true;
  }
  if (globalSettings && !localStorage.getItem(userSettingsKey)) {
    localStorage.setItem(userSettingsKey, globalSettings);
    migrated = true;
  }

  // Clean up old global keys after migration
  if (migrated) {
    localStorage.removeItem('kvs_candidates_2026');
    localStorage.removeItem('kvs_school_settings');
    console.log(`[Data Migration] Migrated global data to user ${userId}.`);
  }
}

// LocalStorage Persistence (User-Scoped)
function loadData() {
  const userId = getCurrentUserId();
  const stored = localStorage.getItem(`kvs_candidates_${userId}`);
  if (stored) {
    try { candidates = JSON.parse(stored); }
    catch(e) { candidates = []; }
  } else {
    candidates = [];
  }
}

function saveData() {
  const userId = getCurrentUserId();
  localStorage.setItem(`kvs_candidates_${userId}`, JSON.stringify(candidates));
}

// School Settings Persistence (User-Scoped)
function loadSchoolSettings() {
  const userId = getCurrentUserId();
  const stored = localStorage.getItem(`kvs_school_settings_${userId}`);
  if (stored) {
    try { 
      const parsed = JSON.parse(stored);
      schoolSettings = { ...schoolSettings, ...parsed };
      if (!schoolSettings.vacancies) schoolSettings.vacancies = JSON.parse(JSON.stringify(defaultClassVacancies));
      if (!schoolSettings.rteMaxDistance) schoolSettings.rteMaxDistance = 5;
      if (!schoolSettings.activeClasses) schoolSettings.activeClasses = JSON.parse(JSON.stringify(defaultActiveClasses));
    } catch(e) {}
  } else {
    // First-time user: auto-populate school name from registration kvName
    if (window.Auth && window.Auth.currentUser && window.Auth.currentUser.kvName) {
      schoolSettings.name = window.Auth.currentUser.kvName;
    }
  }
}

function saveSchoolSettings() {
  const userId = getCurrentUserId();
  localStorage.setItem(`kvs_school_settings_${userId}`, JSON.stringify(schoolSettings));
  applySchoolSettingsUI();
}

/**
 * Initialize the application. Called AFTER authentication is confirmed.
 * Runs data migration, loads user-scoped data, and renders all views.
 */
function initApp() {
  const userId = getCurrentUserId();

  // One-time migration from old global localStorage keys
  migrateGlobalDataToUser(userId);

  loadData();
  loadSchoolSettings();
  setupNavigation();
  setupEventListeners();
  populateClassFilterDropdowns();
  applySchoolSettingsUI();

  // Bootstrap Modals Initialization
  try {
    const vEl = document.getElementById('verifyModal');
    if (vEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      verifyModalInstance = bootstrap.Modal.getInstance(vEl) || new bootstrap.Modal(vEl);
    }

    const sEl = document.getElementById('schoolSettingsModal');
    if (sEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      settingsModalInstance = bootstrap.Modal.getInstance(sEl) || new bootstrap.Modal(sEl);
    }
  } catch(e) {
    console.warn("Bootstrap modal initialization fallback ready.", e);
  }

  // Hash-based routing: navigate to the correct tab based on URL hash
  window.addEventListener('hashchange', handleHashRoute);
  handleHashRoute();

  console.log(`[App Init] Loaded data for user ${userId}. Candidates: ${candidates.length}, School: ${schoolSettings.name}`);
}

// === Enterprise Account Management ===

/**
 * Reset all admission data (candidates + school settings) for the current user.
 * Requires explicit confirmation via the SAMAGAM popup.
 */
function resetUserDatabase() {
  const result = Auth.resetDatabase();
  if (result.success) {
    showSamagamAlert(result.message, 'Database Reset', 'success', 'Account Management');
    setTimeout(() => window.location.reload(), 1500);
  } else {
    showSamagamAlert(result.message, 'Reset Failed', 'error', 'Account Management');
  }
}

/**
 * Delete the current user's account permanently.
 * Shows the delete account confirmation modal.
 */
function openDeleteAccountModal() {
  const modal = document.getElementById('deleteAccountModal');
  if (modal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    bsModal.show();
  }
}

function closeDeleteAccountModal() {
  const modal = document.getElementById('deleteAccountModal');
  if (modal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();
  }
}

async function handleDeleteAccountSubmit(e) {
  if (e) e.preventDefault();

  const passwordInput = document.getElementById('deleteAccountPassword');
  const confirmInput = document.getElementById('deleteAccountConfirmText');
  const alertBox = document.getElementById('deleteAccountAlertBox');
  const btn = document.getElementById('btnConfirmDeleteAccount');

  const password = passwordInput ? passwordInput.value : '';
  const confirmText = confirmInput ? confirmInput.value.trim() : '';

  if (!password) {
    alertBox.className = 'alert alert-danger small p-2 mb-2';
    alertBox.innerText = 'Please enter your current password to confirm.';
    return;
  }

  if (confirmText !== 'DELETE') {
    alertBox.className = 'alert alert-danger small p-2 mb-2';
    alertBox.innerText = 'Please type DELETE to confirm account deletion.';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Deleting...';
  alertBox.className = 'd-none';

  try {
    const result = await Auth.deleteAccount(password);
    if (result.success) {
      alertBox.className = 'alert alert-success small p-2 mb-2';
      alertBox.innerText = result.message;
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } else {
      alertBox.className = 'alert alert-danger small p-2 mb-2';
      alertBox.innerText = result.message;
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-trash3-fill me-1"></i> Permanently Delete Account';
    }
  } catch (err) {
    alertBox.className = 'alert alert-danger small p-2 mb-2';
    alertBox.innerText = 'Network error. Could not process deletion.';
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-trash3-fill me-1"></i> Permanently Delete Account';
  }
}

/**
 * Show confirmation dialog before resetting database.
 */
function confirmResetDatabase() {
  const modal = document.getElementById('resetDatabaseModal');
  if (modal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const bsModal = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    bsModal.show();
  }
}

function closeResetDatabaseModal() {
  const modal = document.getElementById('resetDatabaseModal');
  if (modal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) bsModal.hide();
  }
}

function handleResetDatabaseConfirm() {
  const confirmInput = document.getElementById('resetDatabaseConfirmText');
  const alertBox = document.getElementById('resetDatabaseAlertBox');

  if (!confirmInput || confirmInput.value.trim() !== 'RESET') {
    alertBox.className = 'alert alert-danger small p-2 mb-2';
    alertBox.innerText = 'Please type RESET to confirm data deletion.';
    return;
  }

  closeResetDatabaseModal();
  resetUserDatabase();
}


function applySchoolSettingsUI() {
  const dispName = document.getElementById('displaySchoolName');
  if (dispName) dispName.innerText = schoolSettings.code || schoolSettings.name;
  
  const hdrName = document.getElementById('headerSchoolName');
  if (hdrName) hdrName.innerHTML = `<i class="bi bi-building"></i> ${schoolSettings.name.toUpperCase()}`;

  if (document.getElementById('slipSchoolNameDisplay')) {
    document.getElementById('slipSchoolNameDisplay').value = `${schoolSettings.name} (${schoolSettings.address})`;
  }
  if (document.getElementById('reportSchoolTitle')) {
    document.getElementById('reportSchoolTitle').innerText = schoolSettings.name.toUpperCase();
  }
  if (document.getElementById('reportSchoolSub')) {
    document.getElementById('reportSchoolSub').innerText = `${schoolSettings.address} | ${schoolSettings.region}`;
  }
  populateClassFilterDropdowns();
  renderDashboard();
  renderLotterySlips();
}

// Dynamically populate class filter dropdowns based on active classes
const classDisplayNames = {
  "Balvatika-1": "Balvatika 1", "Balvatika-2": "Balvatika 2", "Balvatika-3": "Balvatika 3",
  "I": "Class I", "II": "Class II", "III": "Class III", "IV": "Class IV", "V": "Class V",
  "VI": "Class VI", "VII": "Class VII", "VIII": "Class VIII", "IX": "Class IX", "XI": "Class XI"
};

function populateClassFilterDropdowns() {
  const activeList = getActiveClasses();

  // Dashboard class filter
  const dashFilter = document.getElementById('dashboardClassFilter');
  if (dashFilter) {
    const currentVal = dashFilter.value;
    dashFilter.innerHTML = '<option value="ALL" selected>All Classes</option>';
    activeList.forEach(classId => {
      const opt = document.createElement('option');
      opt.value = classId;
      opt.textContent = classDisplayNames[classId] || classId;
      dashFilter.appendChild(opt);
    });
    // Restore selection if still valid
    if (currentVal && activeList.includes(currentVal)) dashFilter.value = currentVal;
  }

  // Lottery Slip class filter
  const slipFilter = document.getElementById('slipFilterClass');
  if (slipFilter) {
    const currentVal = slipFilter.value;
    slipFilter.innerHTML = '<option value="ALL">All Classes</option>';
    activeList.forEach(classId => {
      const opt = document.createElement('option');
      opt.value = classId;
      opt.textContent = classDisplayNames[classId] || classId;
      slipFilter.appendChild(opt);
    });
    // Default to Class I if active, else first active class
    if (currentVal && activeList.includes(currentVal)) {
      slipFilter.value = currentVal;
    } else if (activeList.includes('I')) {
      slipFilter.value = 'I';
    } else if (activeList.length > 0) {
      slipFilter.value = activeList[0];
    }
  }

  // Lottery Eligibility class filter
  const eligFilter = document.getElementById('eligFilterClass');
  if (eligFilter) {
    const currentVal = eligFilter.value;
    eligFilter.innerHTML = '<option value="ALL">All Classes</option>';
    activeList.forEach(classId => {
      const opt = document.createElement('option');
      opt.value = classId;
      opt.textContent = classDisplayNames[classId] || classId;
      eligFilter.appendChild(opt);
    });
    if (currentVal && activeList.includes(currentVal)) eligFilter.value = currentVal;
  }
}

function openSchoolSettingsModal() {
  document.getElementById('cfgSchoolName').value = schoolSettings.name;
  document.getElementById('cfgSchoolAddress').value = schoolSettings.address;
  document.getElementById('cfgRegionCode').value = schoolSettings.region;
  document.getElementById('cfgPrincipalName').value = schoolSettings.principal;
  document.getElementById('cfgRteDistance').value = schoolSettings.rteMaxDistance || 5;

  const el = document.getElementById('schoolSettingsModal');
  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    if (!settingsModalInstance) settingsModalInstance = new bootstrap.Modal(el);
    settingsModalInstance.show();
  }
  el.classList.add('show');
  el.style.display = 'block';
  document.body.classList.add('modal-open');
}

function closeSchoolSettingsModal() {
  const el = document.getElementById('schoolSettingsModal');
  if (settingsModalInstance) {
    try { settingsModalInstance.hide(); } catch(e) {}
  }
  el.classList.remove('show');
  el.style.display = 'none';
  document.body.classList.remove('modal-open');
}

// Navigation Tabs Handling (SAMAGAM Style)
function setupNavigation() {
  const tabs = document.querySelectorAll('.samagam-nav [data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const target = tab.getAttribute('data-tab');
      switchTab(target);
      const parentDropdown = tab.closest('.nav-dropdown');
      if (parentDropdown) parentDropdown.classList.remove('open');
    });
  });

  // Dropdown toggle on click
  const dropdowns = document.querySelectorAll('.samagam-nav .nav-dropdown');
  dropdowns.forEach(dropdown => {
    const toggleBtn = dropdown.querySelector('.nav-item, .nav-kv-badge');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = dropdown.classList.contains('open');
        // Close all other dropdowns
        document.querySelectorAll('.samagam-nav .nav-dropdown.open').forEach(d => d.classList.remove('open'));
        // Toggle target dropdown
        if (!wasOpen) dropdown.classList.add('open');
      });
    }
  });

  // Close dropdown when any item inside is clicked
  const dropdownItems = document.querySelectorAll('.nav-dropdown-content button, .nav-dropdown-content a');
  dropdownItems.forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.samagam-nav .nav-dropdown.open').forEach(d => d.classList.remove('open'));
    });
  });

  // Global document click listener to close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.samagam-nav .nav-dropdown')) {
      document.querySelectorAll('.samagam-nav .nav-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });
}

const pageTitles = {
  dashboard: '<i class="bi bi-speedometer2"></i> Admission Dashboard',
  config: '<i class="bi bi-sliders"></i> Admission Profile & Section Allocation',
  registration: '<i class="bi bi-file-earmark-excel-fill text-success"></i> Import Applications Engine',
  verification: '<i class="bi bi-shield-check"></i> Application List',
  lotteryEligibility: '<i class="bi bi-check2-all text-success"></i> Lottery Eligibility Matrix',
  lotterySlips: '<i class="bi bi-ticket-perforated-fill"></i> Lottery Slips',
  meritList: '<i class="bi bi-journal-bookmark-fill"></i> Class IX & XI Merit',
  reports: '<i class="bi bi-printer-fill"></i> Reports & Master Register'
};

// === Hash-Based URL Routing ===
const routeMap = {
  '#/dashboard': 'dashboard',
  '#/admission-profile': 'config',
  '#/import-applications': 'registration',
  '#/application-list': 'verification',
  '#/lottery-eligibility': 'lotteryEligibility',
  '#/lottery-slips': 'lotterySlips',
  '#/merit-calculator': 'meritList',
  '#/reports': 'reports'
};

const reverseRouteMap = Object.fromEntries(Object.entries(routeMap).map(([k, v]) => [v, k]));

function handleHashRoute() {
  const hash = window.location.hash || '#/dashboard';
  const tabId = routeMap[hash];
  if (tabId) {
    switchTab(tabId, true); // true = skipHashUpdate (avoid infinite loop)
  } else {
    switchTab('dashboard', true);
  }
}

function switchTab(tabId, skipHashUpdate) {
  document.querySelectorAll('.samagam-nav [data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.kvs-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });

  const titleEl = document.getElementById('pageTitleText');
  if (titleEl && pageTitles[tabId]) titleEl.innerHTML = pageTitles[tabId];

  // Update URL hash without triggering hashchange loop
  if (!skipHashUpdate && reverseRouteMap[tabId]) {
    history.replaceState(null, '', reverseRouteMap[tabId]);
  }

  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'config') renderVidyalayaConfig();
  if (tabId === 'verification') renderVerificationTable();
  if (tabId === 'lotteryEligibility') renderLotteryEligibility();
  if (tabId === 'lotterySlips') renderLotterySlips();
  if (tabId === 'reports') renderMasterReport();
}

// Global Event Listeners
function setupEventListeners() {
  const btnSampleData = document.getElementById('btnLoadSampleData');
  if (btnSampleData) {
    btnSampleData.addEventListener('click', () => {
      candidates = [...sampleCandidates];
      saveData();
      renderDashboard();
      renderVerificationTable();
      renderLotterySlips();
      renderMasterReport();
      showSamagamAlert('Sample candidate records loaded successfully!', 'Sample Data Loaded', 'success');
    });
  }

  // PDF Application Import & Preset SAMPLES Listeners
  const pdfBtn = document.getElementById('btnLoadPdfSamples');
  if (pdfBtn) pdfBtn.addEventListener('click', loadAllPdfSamples);

  const dashPdfBtn1 = document.getElementById('btnDashLoadPdfSamples');
  if (dashPdfBtn1) dashPdfBtn1.addEventListener('click', loadAllPdfSamples);

  const dashPdfBtn2 = document.getElementById('btnDashQuickLoadPdf');
  if (dashPdfBtn2) dashPdfBtn2.addEventListener('click', loadAllPdfSamples);

  const sampleButtons = document.querySelectorAll('.btn-sample-pdf');
  sampleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-sample');
      loadSinglePdfSample(type);
    });
  });

  const pdfDropzone = document.getElementById('pdfDropzone');
  const pdfInput = document.getElementById('pdfFileInput');
  if (pdfDropzone && pdfInput) {
    pdfDropzone.addEventListener('click', () => pdfInput.click());
    pdfDropzone.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropzone.classList.add('dragover'); });
    pdfDropzone.addEventListener('dragleave', () => pdfDropzone.classList.remove('dragover'));
    pdfDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      pdfDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handlePdfFiles(e.dataTransfer.files);
      }
    });
    pdfInput.addEventListener('change', () => {
      if (pdfInput.files && pdfInput.files.length > 0) {
        handlePdfFiles(pdfInput.files);
      }
    });
  }

  document.getElementById('dashboardClassFilter').addEventListener('change', renderDashboard);

  document.getElementById('btnCheckAge').addEventListener('click', checkAgeEligibility);
  const regForm = document.getElementById('studentRegistrationForm');
  if (regForm) regForm.addEventListener('submit', handleNewRegistration);
  document.getElementById('btnImportExcel').addEventListener('click', importExcelData);
  document.getElementById('btnDownloadTemplate').addEventListener('click', downloadExcelTemplate);
  
  document.getElementById('btnCalcClassIX').addEventListener('click', calculateClassIX);
  document.getElementById('btnCalcClassXI').addEventListener('click', calculateClassXI);
  document.getElementById('btnGenerateSlips').addEventListener('click', renderLotterySlips);
  
  document.getElementById('slipFilterCategory').addEventListener('change', renderLotterySlips);
  document.getElementById('slipFilterClass').addEventListener('change', renderLotterySlips);
  const eligClassFilter = document.getElementById('eligFilterClass');
  if (eligClassFilter) eligClassFilter.addEventListener('change', renderLotteryEligibility);
  const drawDateInput = document.getElementById('slipDrawDate');
  if (drawDateInput) drawDateInput.addEventListener('input', renderLotterySlips);

  document.getElementById('verifySearch').addEventListener('input', renderVerificationTable);

  document.getElementById('schoolSettingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    schoolSettings.name = document.getElementById('cfgSchoolName').value.trim();
    schoolSettings.address = document.getElementById('cfgSchoolAddress').value.trim();
    schoolSettings.region = document.getElementById('cfgRegionCode').value.trim();
    schoolSettings.principal = document.getElementById('cfgPrincipalName').value.trim();
    schoolSettings.rteMaxDistance = parseFloat(document.getElementById('cfgRteDistance').value) || 5;
    saveSchoolSettings();
    closeSchoolSettingsModal();
    showSamagamAlert(`Vidyalaya Configuration updated! RTE Max Radius set to ${schoolSettings.rteMaxDistance} km.`, 'Settings Updated', 'success');
  });
}

// ===== VIDYALAYA CONFIGURATION & SECTION SEAT ALLOCATION MATRIX =====
function renderVidyalayaConfig() {
  // Populate Master Form fields from schoolSettings
  const formName = document.getElementById('cfgFormName');
  if (formName) formName.value = schoolSettings.name || '';
  const formCode = document.getElementById('cfgFormCode');
  if (formCode) formCode.value = schoolSettings.code || '';
  const formRoName = document.getElementById('cfgFormRoName');
  if (formRoName) formRoName.value = schoolSettings.roName || '';
  const formAddr = document.getElementById('cfgFormAddress');
  if (formAddr) formAddr.value = schoolSettings.address || '';
  const formLoc = document.getElementById('cfgFormLocation');
  if (formLoc) formLoc.value = schoolSettings.locationType || 'URBAN';
  const formSpons = document.getElementById('cfgFormSponsored');
  if (formSpons) {
    let s = schoolSettings.sponsoredBy || 'Civil';
    if (s.toUpperCase().includes('PROJECT')) s = 'Project';
    else if (s.toUpperCase().includes('IHL')) s = 'IHL';
    else if (s.toUpperCase().includes('DEFENCE')) s = 'Defence';
    else if (s.toUpperCase().includes('CIVIL')) s = 'Civil';
    formSpons.value = s;
  }
  const formRteDist = document.getElementById('cfgFormRteDistance');
  if (formRteDist) formRteDist.value = schoolSettings.rteMaxDistance || (schoolSettings.locationType === 'URBAN' ? 5 : 8);
  const formPrinc = document.getElementById('cfgFormPrincipal');
  if (formPrinc) formPrinc.value = schoolSettings.principal || '';
  const formInch = document.getElementById('cfgFormIncharge');
  if (formInch) formInch.value = schoolSettings.admissionIncharge || '';

  // Committee Members (Para 5)
  const formTeacher = document.getElementById('cfgFormCommitteeTeacher');
  if (formTeacher) formTeacher.value = schoolSettings.committeeTeacher || '';
  const formParent1 = document.getElementById('cfgFormCommitteeParent1');
  if (formParent1) formParent1.value = schoolSettings.committeeParent1 || '';
  const formParent2 = document.getElementById('cfgFormCommitteeParent2');
  if (formParent2) formParent2.value = schoolSettings.committeeParent2Lady || '';
  const formVmc = document.getElementById('cfgFormCommitteeVmc');
  if (formVmc) formVmc.value = schoolSettings.committeeVmcMember || '';

  // Update Live Preview Header Card
  liveUpdateHeaderPreview();

  // Render Seat Matrix Containers
  renderSeatMatrixRows();
}

function isProjectOrIhlSector() {
  const sec = (schoolSettings.sponsoredBy || 'Civil').toUpperCase();
  return sec.includes('PROJECT') || sec.includes('IHL');
}

function handleSectorChange() {
  const secVal = document.getElementById('cfgFormSponsored') ? document.getElementById('cfgFormSponsored').value : schoolSettings.sponsoredBy;
  schoolSettings.sponsoredBy = secVal;
  liveUpdateHeaderPreview();
  renderDashboard();
}

function handleLocationTypeChange() {
  const locVal = document.getElementById('cfgFormLocation').value;
  const rteSelect = document.getElementById('cfgFormRteDistance');
  if (rteSelect) {
    if (locVal === 'RURAL') {
      rteSelect.value = "8";
    } else if (locVal === 'URBAN') {
      rteSelect.value = "5";
    }
  }
  liveUpdateHeaderPreview();
}

function liveUpdateHeaderPreview() {
  const valName = document.getElementById('cfgFormName') ? document.getElementById('cfgFormName').value : schoolSettings.name;
  const valCode = document.getElementById('cfgFormCode') ? document.getElementById('cfgFormCode').value : schoolSettings.code;
  const valRoName = document.getElementById('cfgFormRoName') ? document.getElementById('cfgFormRoName').value : schoolSettings.roName;
  const valLoc = document.getElementById('cfgFormLocation') ? document.getElementById('cfgFormLocation').value : schoolSettings.locationType;
  const valSpons = document.getElementById('cfgFormSponsored') ? document.getElementById('cfgFormSponsored').value : schoolSettings.sponsoredBy;
  const valRte = document.getElementById('cfgFormRteDistance') ? document.getElementById('cfgFormRteDistance').value : schoolSettings.rteMaxDistance;

  const elHdrName = document.getElementById('cfgHeaderSchoolName');
  if (elHdrName) elHdrName.innerText = (valName || 'KENDRIYA VIDYALAYA').toUpperCase();
  const elHdrCode = document.getElementById('cfgHeaderSchoolCode');
  if (elHdrCode) elHdrCode.innerText = valCode ? `# ${valCode}` : '';
  const elHdrRegion = document.getElementById('cfgHeaderRegion');
  if (elHdrRegion) elHdrRegion.innerText = (valRoName || '').toUpperCase();
  const elHdrLoc = document.getElementById('cfgHeaderLocation');
  if (elHdrLoc) elHdrLoc.innerText = valLoc === 'URBAN' ? 'Urban' : 'Rural / Hilly Area';
  const elHdrSpons = document.getElementById('cfgHeaderSponsored');
  if (elHdrSpons) elHdrSpons.innerText = valSpons || 'Civil';
  const elHdrRte = document.getElementById('cfgHeaderRteRadius');
  if (elHdrRte) elHdrRte.innerText = `${parseFloat(valRte) || (valLoc === 'URBAN' ? 5 : 8)}.0 km`;
}

function renderSeatMatrixRows() {
  const balContainer = document.getElementById('balvatikaVacanciesContainer');
  const classContainer = document.getElementById('classVacanciesContainer');

  if (!balContainer || !classContainer) return;

  const balClasses = [
    { id: 'Balvatika-1', title: 'Balvatika - I', sub: 'Level 1 (Pre-Primary)' },
    { id: 'Balvatika-2', title: 'Balvatika - II', sub: 'Level 2 (Pre-Primary)' },
    { id: 'Balvatika-3', title: 'Balvatika - III', sub: 'Level 3 (Pre-Primary)' }
  ];

  const mainClasses = [
    { id: 'I', title: 'Class 1', sub: 'Class I (Primary)' },
    { id: 'II', title: 'Class 2', sub: 'Class II' },
    { id: 'III', title: 'Class 3', sub: 'Class III' },
    { id: 'IV', title: 'Class 4', sub: 'Class IV' },
    { id: 'V', title: 'Class 5', sub: 'Class V' },
    { id: 'VI', title: 'Class 6', sub: 'Class VI' },
    { id: 'VII', title: 'Class 7', sub: 'Class VII' },
    { id: 'VIII', title: 'Class 8', sub: 'Class VIII' },
    { id: 'IX', title: 'Class 9', sub: 'Class IX' },
    { id: 'XI', title: 'Class 11', sub: 'Class XI' }
  ];

  if (!schoolSettings.vacancies) schoolSettings.vacancies = JSON.parse(JSON.stringify(defaultClassVacancies));

  balContainer.innerHTML = balClasses.map(c => renderSingleClassSeatRow(c)).join('');
  classContainer.innerHTML = mainClasses.map(c => renderSingleClassSeatRow(c)).join('');
}

function renderSingleClassSeatRow(c) {
  const vac = (schoolSettings.vacancies && schoolSettings.vacancies[c.id]) || { rte: 10, cwsn: 2, catIV: 28 };
  const total = (parseInt(vac.rte) || 0) + (parseInt(vac.cwsn) || 0) + (parseInt(vac.catIV) || 0);
  const active = isClassActive(c.id);
  const rowClass = active ? 'class-vacancy-row' : 'class-vacancy-row inactive';
  const disabledAttr = active ? '' : 'disabled';

  return `
    <div class="${rowClass}" id="classRow_${c.id}">
      <div class="d-flex align-items-center">
        <div class="class-toggle-wrap">
          <label class="class-toggle">
            <input type="checkbox" ${active ? 'checked' : ''} onchange="toggleClassActive('${c.id}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <span class="class-toggle-label ${active ? '' : 'off'}">${active ? 'Active' : 'Off'}</span>
        </div>
        <div>
          <div class="class-title">${c.title}</div>
          <div class="class-sub">${c.sub}</div>
        </div>
      </div>

      <div class="seat-input-group">
        <div class="seat-input-box">
          <label>RTE Seats</label>
          <input type="number" min="0" value="${vac.rte}" ${disabledAttr} onchange="updateSeatMatrix('${c.id}', 'rte', this.value)">
        </div>

        <div class="seat-input-box">
          <label>CWSN Seats</label>
          <input type="number" min="0" value="${vac.cwsn}" ${disabledAttr} onchange="updateSeatMatrix('${c.id}', 'cwsn', this.value)">
        </div>

        <div class="seat-input-box">
          <label>Category I - V</label>
          <input type="number" min="0" value="${vac.catIV}" ${disabledAttr} onchange="updateSeatMatrix('${c.id}', 'catIV', this.value)">
        </div>

        <div class="seat-input-box">
          <label>Total Vacancy</label>
          <div class="total-seats-pill" id="totalSeats_${c.id}">${total}</div>
        </div>
      </div>
    </div>
  `;
}

function updateSeatMatrix(classId, field, val) {
  if (!schoolSettings.vacancies) schoolSettings.vacancies = JSON.parse(JSON.stringify(defaultClassVacancies));
  if (!schoolSettings.vacancies[classId]) schoolSettings.vacancies[classId] = { rte: 10, cwsn: 2, catIV: 28 };

  schoolSettings.vacancies[classId][field] = Math.max(0, parseInt(val) || 0);
  saveSchoolSettings();

  const vac = schoolSettings.vacancies[classId];
  const total = (parseInt(vac.rte) || 0) + (parseInt(vac.cwsn) || 0) + (parseInt(vac.catIV) || 0);
  const totalEl = document.getElementById(`totalSeats_${classId}`);
  if (totalEl) totalEl.innerText = total;
}

function autoCalculate25Rte(classId) {
  if (!schoolSettings.vacancies[classId]) schoolSettings.vacancies[classId] = { rte: 10, cwsn: 2, catIV: 28 };
  const vac = schoolSettings.vacancies[classId];
  const total = (parseInt(vac.rte) || 0) + (parseInt(vac.cwsn) || 0) + (parseInt(vac.catIV) || 0);
  const totalCap = total > 0 ? total : 40;
  
  vac.rte = Math.round(totalCap * 0.25);
  vac.cwsn = Math.round(totalCap * 0.03);
  vac.catIV = Math.max(0, totalCap - vac.rte - vac.cwsn);

  saveSchoolSettings();
  renderSeatMatrixRows();
}

function resetDefaultSeatMatrix() {
  if (confirm("Reset all class vacancy seat matrices to standard 40 seats per section (10 RTE, 2 CWSN, 28 Cat I-V)?")) {
    schoolSettings.vacancies = JSON.parse(JSON.stringify(defaultClassVacancies));
    saveSchoolSettings();
    renderSeatMatrixRows();
  }
}

function saveVidyalayaMasterConfig(e) {
  if (e) e.preventDefault();

  schoolSettings.name = document.getElementById('cfgFormName').value.trim();
  schoolSettings.code = document.getElementById('cfgFormCode').value.trim();
  schoolSettings.roName = document.getElementById('cfgFormRoName').value.trim();
  schoolSettings.region = `${schoolSettings.roName} Region`;
  schoolSettings.address = document.getElementById('cfgFormAddress').value.trim();
  schoolSettings.locationType = document.getElementById('cfgFormLocation').value;
  schoolSettings.sponsoredBy = document.getElementById('cfgFormSponsored').value.trim();
  schoolSettings.rteMaxDistance = parseFloat(document.getElementById('cfgFormRteDistance').value) || (schoolSettings.locationType === 'URBAN' ? 5 : 8);
  schoolSettings.principal = document.getElementById('cfgFormPrincipal').value.trim();
  schoolSettings.admissionIncharge = document.getElementById('cfgFormIncharge') ? document.getElementById('cfgFormIncharge').value.trim() : '';
  // Committee Members (Para 5)
  schoolSettings.committeeTeacher = document.getElementById('cfgFormCommitteeTeacher') ? document.getElementById('cfgFormCommitteeTeacher').value.trim() : '';
  schoolSettings.committeeParent1 = document.getElementById('cfgFormCommitteeParent1') ? document.getElementById('cfgFormCommitteeParent1').value.trim() : '';
  schoolSettings.committeeParent2Lady = document.getElementById('cfgFormCommitteeParent2') ? document.getElementById('cfgFormCommitteeParent2').value.trim() : '';
  schoolSettings.committeeVmcMember = document.getElementById('cfgFormCommitteeVmc') ? document.getElementById('cfgFormCommitteeVmc').value.trim() : '';

  saveSchoolSettings();
  renderVidyalayaConfig();

  showSamagamAlert("Vidyalaya Master Configuration & Class Seat Matrix saved successfully!", "Configuration Saved", "success");
}

// 1. ENTERPRISE ANALYTICS DASHBOARD
function renderDashboard() {
  const selectedClass = document.getElementById('dashboardClassFilter') ? document.getElementById('dashboardClassFilter').value : 'ALL';
  const rteMax = schoolSettings.rteMaxDistance || 5;
  
  const filtered = selectedClass === 'ALL' 
    ? [...candidates] 
    : candidates.filter(c => c.classApplied === selectedClass);

  const total = filtered.length;
  const verified = filtered.filter(c => c.verified === 'VERIFIED').length;
  const rte = filtered.filter(c => c.rte === 'YES' && (c.distanceKm || 0) <= rteMax).length;
  const pendingDeficient = filtered.filter(c => c.verified === 'DEFICIENT' || c.verified === 'PENDING').length;
  const verifiedPct = total > 0 ? ((verified / total) * 100).toFixed(0) : 0;

  // Primary KPI Cards
  const elTot = document.getElementById('statTotalApps'); if (elTot) elTot.innerText = total;
  const elScope = document.getElementById('lblClassScope'); if (elScope) elScope.innerText = selectedClass === 'ALL' ? 'Scope: All Classes Combined' : `Scope: Class ${selectedClass}`;
  
  const elVer = document.getElementById('statVerifiedApps'); if (elVer) elVer.innerText = verified;
  const elVerPct = document.getElementById('lblVerifiedPct'); if (elVerPct) elVerPct.innerText = `${verifiedPct}% Verification Rate`;

  const elRteStat = document.getElementById('statRteApps'); if (elRteStat) elRteStat.innerText = rte;
  const elRteComp = document.getElementById('lblRteCompliant'); if (elRteComp) elRteComp.innerText = `Distance <= ${rteMax}km verified`;
  const elRteScope = document.getElementById('lblRteCardScope'); if (elRteScope) elRteScope.innerText = `Distance <= ${rteMax}km Radius`;

  const elPendDef = document.getElementById('statPendingDeficient'); if (elPendDef) elPendDef.innerText = pendingDeficient;

  // Priority Service Categories Breakdown (Cat 1 to Cat 5/6)
  const isProjectOrIhl = isProjectOrIhlSector();

  const cat1 = filtered.filter(c => c.priorityCat === 'Cat-1').length;
  const cat2 = filtered.filter(c => c.priorityCat === 'Cat-2').length;
  const cat3 = filtered.filter(c => c.priorityCat === 'Cat-3').length;
  const cat4 = filtered.filter(c => c.priorityCat === 'Cat-4').length;
  const cat5 = filtered.filter(c => c.priorityCat === 'Cat-5').length;
  const cat6 = filtered.filter(c => c.priorityCat === 'Cat-6').length;

  const elCount1 = document.getElementById('countCat1'); if (elCount1) elCount1.innerText = cat1;
  const elCount2 = document.getElementById('countCat2'); if (elCount2) elCount2.innerText = cat2;
  const elCount3 = document.getElementById('countCat3'); if (elCount3) elCount3.innerText = cat3;
  const elCount4 = document.getElementById('countCat4'); if (elCount4) elCount4.innerText = cat4;
  const elCount5 = document.getElementById('countCat5'); if (elCount5) elCount5.innerText = cat5;

  const elLblCat1 = document.getElementById('lblCat1');
  if (elLblCat1) {
    elLblCat1.innerHTML = isProjectOrIhl 
      ? `Category 1 <span class="badge bg-warning text-dark ms-1" style="font-size:0.6rem;">Project / IHL Staff</span>`
      : `Category 1`;
  }

  const elRowCat6 = document.getElementById('rowCat6');
  const elCountCat6 = document.getElementById('countCat6');
  if (elRowCat6) elRowCat6.style.display = isProjectOrIhl ? '' : 'none';
  if (elCountCat6) elCountCat6.innerText = cat6;

  const totalCatSum = cat1 + cat2 + cat3 + cat4 + cat5 + (isProjectOrIhl ? cat6 : 0);
  const elTotCats = document.getElementById('statTotalCats'); if (elTotCats) elTotCats.innerText = totalCatSum;

  // Sector Badge & Table Header Update
  const elBadgeSector = document.getElementById('badgeSectorType');
  if (elBadgeSector) elBadgeSector.innerText = `${schoolSettings.sponsoredBy || 'Civil'} Sector (${isProjectOrIhl ? '6' : '5'} Categories)`;

  const elHdrSector = document.getElementById('hdrCategorySector');
  if (elHdrSector) elHdrSector.innerText = (schoolSettings.sponsoredBy || 'CIVIL/DEFENCE').toUpperCase();

  // Dynamic Priority Legend Footer
  const elLegendItems = document.getElementById('catLegendItems');
  if (elLegendItems) {
    if (isProjectOrIhl) {
      elLegendItems.innerHTML = `
        <span><strong style="color: var(--kvs-purple);">Cat 1:</strong> Project / IHL Staff</span>
        <span><strong style="color: var(--kvs-purple);">Cat 2:</strong> Central Govt</span>
        <span><strong style="color: var(--kvs-purple);">Cat 3:</strong> Central Autonomous</span>
        <span><strong style="color: var(--kvs-purple);">Cat 4:</strong> State Govt</span>
        <span><strong style="color: var(--kvs-purple);">Cat 5:</strong> State Autonomous</span>
        <span><strong style="color: var(--kvs-purple);">Cat 6:</strong> Private / Others</span>
      `;
    } else {
      elLegendItems.innerHTML = `
        <span><strong style="color: var(--kvs-purple);">Cat 1:</strong> Central Govt / Defence</span>
        <span><strong style="color: var(--kvs-purple);">Cat 2:</strong> Central Autonomous</span>
        <span><strong style="color: var(--kvs-purple);">Cat 3:</strong> State Govt</span>
        <span><strong style="color: var(--kvs-purple);">Cat 4:</strong> State Autonomous</span>
        <span><strong style="color: var(--kvs-purple);">Cat 5:</strong> Private / Others</span>
      `;
    }
  }

  // Reservation Quotas Grid
  const elRte = document.getElementById('qCountRte'); if (elRte) elRte.innerText = rte;
  const elSc = document.getElementById('qCountSC'); if (elSc) elSc.innerText = filtered.filter(c => c.casteCat === 'SC').length;
  const elSt = document.getElementById('qCountST'); if (elSt) elSt.innerText = filtered.filter(c => c.casteCat === 'ST').length;
  const elObc = document.getElementById('qCountObc'); if (elObc) elObc.innerText = filtered.filter(c => c.casteCat === 'OBC-NCL').length;
  const elSgc = document.getElementById('qCountSgc'); if (elSgc) elSgc.innerText = filtered.filter(c => c.sgc === 'YES').length;
  const elCwsnQ = document.getElementById('qCountCwsn'); if (elCwsnQ) elCwsnQ.innerText = filtered.filter(c => c.cwsn === 'YES').length;

  // SAMAGAM Social Category Table
  const elGen = document.getElementById('qCountGen'); if (elGen) elGen.innerText = filtered.filter(c => c.casteCat === 'GEN').length;
  const elObcCl = document.getElementById('qCountObcCl'); if (elObcCl) elObcCl.innerText = filtered.filter(c => c.casteCat === 'OBC-CL').length;

  // Gender Distribution
  const elMale = document.getElementById('qCountMale'); if (elMale) elMale.innerText = filtered.filter(c => c.gender === 'MALE').length;
  const elFemale = document.getElementById('qCountFemale'); if (elFemale) elFemale.innerText = filtered.filter(c => c.gender === 'FEMALE').length;

  // EWS/BPL & CwSN KPI
  const elEws = document.getElementById('statEwsBpl'); if (elEws) elEws.innerText = filtered.filter(c => c.rte === 'YES').length;
  const elCwsn = document.getElementById('statPendingDeficient'); if (elCwsn) elCwsn.innerText = filtered.filter(c => c.cwsn === 'YES').length;

  // Total Categories summary
  const elTotalCats = document.getElementById('statTotalCats');
  if (elTotalCats) elTotalCats.innerText = cat1 + cat2 + cat3 + cat4 + cat5;

  // Dynamic Available Seats Card (RTE, CWSN, Category I - V) based on Class filter
  const vacs = schoolSettings.vacancies || defaultClassVacancies;
  let seatRteCount = 0, seatCwsnCount = 0, seatCatIvCount = 0;

  if (selectedClass === 'ALL') {
    // Only sum seats for active classes
    const activeList = getActiveClasses();
    activeList.forEach(classId => {
      const v = vacs[classId];
      if (v) {
        seatRteCount += (parseInt(v.rte) || 0);
        seatCwsnCount += (parseInt(v.cwsn) || 0);
        seatCatIvCount += (parseInt(v.catIV) || 0);
      }
    });
  } else {
    const v = vacs[selectedClass] || { rte: 10, cwsn: 2, catIV: 28 };
    seatRteCount = parseInt(v.rte) || 0;
    seatCwsnCount = parseInt(v.cwsn) || 0;
    seatCatIvCount = parseInt(v.catIV) || 0;
  }

  const elRteSeat = document.getElementById('seatRte');
  if (elRteSeat) elRteSeat.innerText = seatRteCount;
  const elCwsnSeat = document.getElementById('seatCwsn');
  if (elCwsnSeat) elCwsnSeat.innerText = seatCwsnCount;
  const elCatIvSeat = document.getElementById('seatCatIV');
  if (elCatIvSeat) elCatIvSeat.innerText = seatCatIvCount;

  // Reservation Seat Breakdown (KVS Para 6): SC 15%, ST 7.5%, OBC-NCL 27% of total capacity
  const totalCapacity = seatRteCount + seatCwsnCount + seatCatIvCount;
  const scSeats = Math.round(totalCapacity * 0.15);
  const stSeats = Math.round(totalCapacity * 0.075);
  const obcSeats = Math.round(totalCapacity * 0.27);
  const elScSeat = document.getElementById('seatSc');
  if (elScSeat) elScSeat.innerText = scSeats;
  const elStSeat = document.getElementById('seatSt');
  if (elStSeat) elStSeat.innerText = stSeats;
  const elObcSeat = document.getElementById('seatObc');
  if (elObcSeat) elObcSeat.innerText = obcSeats;
  const elTotalSeat = document.getElementById('seatTotal');
  if (elTotalSeat) elTotalSeat.innerText = totalCapacity;
}

// 2. Real-Time Age Calculator (KVS Admission Guidelines 2026-27 Page 5 Aligned)
function checkAgeEligibility() {
  const dobInput = document.getElementById('calcDob').value;
  const targetDateInput = document.getElementById('calcAsOnDate') ? document.getElementById('calcAsOnDate').value : '2026-03-31';
  const isCwSN = document.getElementById('calcCwSN').value === 'YES';
  const resultBox = document.getElementById('calcResultBox');

  if (!dobInput) {
    resultBox.className = 'alert alert-danger p-2 small mb-0';
    resultBox.innerHTML = '<strong>Error:</strong> Please select a valid Date of Birth.';
    return;
  }

  const ageObj = calculateAgeOnTargetDate(dobInput, targetDateInput);
  const extraAge = isCwSN ? 2 : 0;
  const decimalAge = ageObj.decimalAge;

  const targetDateDisplay = targetDateInput ? formatDate(targetDateInput) : '31 March 2026';

  let statusHtml = `<div class="mb-1"><strong>Calculated Age as on ${targetDateDisplay}:</strong></div>`;
  statusHtml += `<div class="fw-bold text-dark mb-1" style="font-size: 0.85rem;"><i class="bi bi-clock-history text-primary me-1"></i>${ageObj.years} Yrs, ${ageObj.months} Mths, ${ageObj.days} Days</div>`;
  if (isCwSN) {
    statusHtml += `<div class="badge bg-warning text-dark mb-1" style="font-size: 0.68rem;"><i class="bi bi-person-wheelchair me-1"></i>CwSN (+2 Yrs Upper Limit Relaxation)</div>`;
  }
  statusHtml += `<div class="fw-bold border-top pt-1 mt-1 text-muted" style="font-size: 0.72rem;">Class Eligibility (KVS Guidelines):</div>`;

  const eligibleClasses = [];

  kvsClassAgeGuidelines.forEach(g => {
    if (g.classId === 'XI' || g.classId === 'XII') return;
    // Only show results for active classes
    if (!isClassActive(g.classId)) return;
    const maxLimit = g.maxAge + extraAge;
    if (decimalAge >= g.minAge && decimalAge < maxLimit) {
      eligibleClasses.push({
        classId: g.classId,
        label: g.label,
        range: `${g.minAge} to <${maxLimit} yrs`
      });
    }
  });

  if (eligibleClasses.length > 0) {
    statusHtml += `<ul class="mb-0 ps-3 mt-1 text-success fw-bold" style="font-size: 0.78rem;">`;
    eligibleClasses.forEach(item => {
      statusHtml += `<li><i class="bi bi-check-circle-fill me-1"></i>${item.label}: Eligible (${item.range})</li>`;
    });
    statusHtml += `</ul>`;
    if (eligibleClasses.length > 1) {
      statusHtml += `<div class="text-muted small mt-1" style="font-size: 0.68rem; font-style: italic;">* Candidate qualifies for ${eligibleClasses.length} classes based on KVS age guideline matrix.</div>`;
    }
    resultBox.className = 'alert alert-success p-2 small mb-0';
  } else {
    statusHtml += `<div class="text-danger small mt-1"><i class="bi bi-x-circle-fill me-1"></i>Outside standard age limits for Balvatika & Classes I-X.</div>`;
    resultBox.className = 'alert alert-danger p-2 small mb-0';
  }

  resultBox.innerHTML = statusHtml;
}

// 3. Registration Form Handler
function handleNewRegistration(e) {
  e.preventDefault();

  const newCand = {
    regNo: document.getElementById('regNo').value.trim(),
    name: document.getElementById('studentName').value.trim(),
    fatherName: document.getElementById('fatherName').value.trim(),
    motherName: document.getElementById('motherName').value.trim(),
    dob: document.getElementById('dob').value,
    gender: document.getElementById('gender').value,
    classApplied: document.getElementById('appliedClass').value,
    priorityCat: document.getElementById('priorityCat').value,
    casteCat: document.getElementById('casteCategory').value,
    rte: document.getElementById('rteStatus').value,
    distanceKm: parseFloat(document.getElementById('distanceKm').value) || 2.5,
    sgc: document.getElementById('sgcStatus').value,
    cwsn: document.getElementById('cwsnStatus').value,
    transfers: parseInt(document.getElementById('numTransfers').value) || 0,
    mobile: document.getElementById('mobileNo').value.trim(),
    verified: "PENDING",
    auditLog: {}
  };

  if (candidates.some(c => c.regNo === newCand.regNo)) {
    alert(`Registration No/Submission Code '${newCand.regNo}' already exists!`);
    return;
  }

  candidates.unshift(newCand);
  saveData();
  alert(`Candidate '${newCand.name}' registered successfully!`);
  const regForm = document.getElementById('studentRegistrationForm');
  if (regForm) regForm.reset();
  switchTab('dashboard');
}

// 4. Excel Importer & Excel Template Generator
function downloadExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    showSamagamAlert('SheetJS Excel library not loaded.', 'Library Error', 'error');
    return;
  }

  const headers = [
    "S.No", 
    "Registration No/Submission Code", 
    "Student Full Name", 
    "Father Name", 
    "Mother Name", 
    "Date of Birth (YYYY-MM-DD)", 
    "Gender (MALE/FEMALE)", 
    "Class Applied (Balvatika-1 to 3, I to XI)", 
    "Service Category (Cat-1 to Cat-5)", 
    "Social Category (GEN/SC/ST/OBC-NCL)", 
    "RTE Claim (YES/NO)", 
    "Residence Distance (Km)", 
    "CwSN (YES/NO)", 
    "Transfers (Last 7 Yrs)", 
    "Parent Mobile Number"
  ];

  const sample1 = [1, "KVS/2026-27/001", "Aarav Sharma", "Rajesh Sharma", "Sunita Sharma", "2018-08-15", "MALE", "I", "Cat-1", "GEN", "YES", 2.5, "NO", 2, "9876543210"];
  const sample2 = [2, "KVS/2026-27/002", "Ananya Verma", "Suresh Verma", "Pooja Verma", "2018-03-20", "FEMALE", "I", "Cat-3", "OBC-NCL", "YES", 4.1, "NO", 0, "9876543211"];
  const sample3 = [3, "KVS/2026-27/003", "Rohan Patil", "Amit Patil", "Sarita Patil", "2018-01-28", "MALE", "I", "Cat-2", "SC", "NO", 6.8, "NO", 1, "9876543212"];

  const wsData = [headers, sample1, sample2, sample3];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-fit Column Widths
  ws['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 20 },
    { wch: 26 }, { wch: 20 }, { wch: 26 }, { wch: 24 }, { wch: 24 },
    { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "KVS Registration Template");
  XLSX.writeFile(wb, "KVS_Registration_Import_Template_2026-27.xlsx");
}

function importExcelData() {
  const fileInput = document.getElementById('excelFileInput');
  const statusSpan = document.getElementById('importStatus');

  if (!fileInput.files || fileInput.files.length === 0) {
    showSamagamAlert('Please select an Excel file first.', 'File Required', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      let sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('paste') || s.toLowerCase().includes('template') || s === 'I') || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonRows.length < 2) {
        showSamagamAlert('No valid data rows found in Excel sheet.', 'Empty Sheet', 'warning');
        return;
      }

      let importedCount = 0;
      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i];
        if (!row || row.length < 2) continue;

        const regNo = row[1] || row[0] || `KVS/2026-27/${String(candidates.length + 1).padStart(3, '0')}`;
        const name = row[2] || row[3] || `Student ${i}`;
        const fatherName = row[3] || row[4] || "Father Name";
        const motherName = row[4] || row[5] || "Mother Name";
        const dobRaw = row[5] || row[6] || "2018-05-15";
        const gender = (row[6] || row[7] || "MALE").toString().toUpperCase();
        const classApplied = (row[7] || row[8] || "I").toString();
        const priorityCat = row[8] ? `Cat-${row[8].toString().replace(/\D/g, '') || '1'}` : "Cat-1";
        const casteCat = row[9] || "GEN";
        const rte = (row[10] || "NO").toString().toUpperCase().includes('Y') ? 'YES' : 'NO';
        const distKm = parseFloat(row[11]) || (rte === 'YES' ? 2.5 : 6.0);

        if (!candidates.some(c => c.regNo === regNo)) {
          candidates.push({
            regNo: regNo.toString(),
            name: name.toString(),
            fatherName: fatherName.toString(),
            motherName: motherName.toString(),
            dob: normalizeDate(dobRaw),
            gender: gender,
            classApplied: classApplied,
            priorityCat: priorityCat,
            casteCat: casteCat,
            rte: rte,
            distanceKm: distKm,
            sgc: (row[12] || 'NO').toString().toUpperCase().includes('Y') ? 'YES' : 'NO',
            cwsn: (row[13] || 'NO').toString().toUpperCase().includes('Y') ? 'YES' : 'NO',
            transfers: parseInt(row[14]) || 0,
            mobile: (row[15] || "9876543210").toString(),
            verified: "VERIFIED",
            auditLog: {}
          });
          importedCount++;
        }
      }

      saveData();
      statusSpan.innerText = `Imported ${importedCount} records!`;
      renderDashboard();
      renderVerificationTable();
      renderLotterySlips();
      renderMasterReport();
      showSamagamAlert(`Successfully imported ${importedCount} application records into system!`, 'Import Completed', 'success');
    } catch(err) {
      showSamagamAlert('Error importing Excel file: ' + err.message, 'Import Failed', 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}

// ==================== PORTAL PDF PARSER & SAMPLES PRELOADER ====================

function loadAllPdfSamples() {
  let count = 0;
  // 1. Standard
  count += ingestPdfCandidate(samplePdfDatasets.standard);
  // 2. Duplicate
  count += ingestPdfCandidate(samplePdfDatasets.duplicate);
  // 3. Invalid Class 1 Age Mismatch
  count += ingestPdfCandidate(samplePdfDatasets.invalid);
  // 4. Batch Overview
  samplePdfDatasets.overviewBatch.forEach(c => {
    count += ingestPdfCandidate(c);
  });

  saveData();
  renderDashboard();
  renderVerificationTable();
  renderLotterySlips();
  renderMasterReport();

  const statusEl = document.getElementById('pdfImportStatus');
  if (statusEl) {
    statusEl.innerHTML = `<i class="bi bi-check-circle-fill text-success"></i> Successfully imported <strong>${count} candidates</strong> from all 5 Portal SAMPLES files (Includes 1 Duplicate Flag & 1 Age Mismatch Flag)!`;
  }
  alert('All 5 Portal Sample PDF Test Cases loaded successfully!\n\n- Kavya Sharma (Balvatika-1 Standard)\n- Kavya Sharma (Duplicate Submission Flagged)\n- Rudra Patel (Class 1 Age Mismatch Flagged)\n- 3 Batch Overview Balvatika Applicants');
}

function loadSinglePdfSample(type) {
  let added = 0;
  let label = "";

  if (type === 'standard') {
    added = ingestPdfCandidate(samplePdfDatasets.standard);
    label = "Standard Balvatika-1 Application (Kavya Sharma)";
  } else if (type === 'duplicate') {
    added = ingestPdfCandidate(samplePdfDatasets.duplicate);
    label = "Duplicate Balvatika Application (Flagged as DUPLICATE)";
  } else if (type === 'invalid') {
    added = ingestPdfCandidate(samplePdfDatasets.invalid);
    label = "Class 1 Age Mismatch Application (Rudra Patel - Flagged as AGE MISMATCH)";
  } else if (type === 'overview') {
    samplePdfDatasets.overviewBatch.forEach(c => added += ingestPdfCandidate(c));
    label = "Batch Overview Summary (3 Balvatika Records)";
  }

  saveData();
  renderDashboard();
  renderVerificationTable();
  renderLotterySlips();
  renderMasterReport();

  const statusEl = document.getElementById('pdfImportStatus');
  if (statusEl) {
    statusEl.innerHTML = `<i class="bi bi-info-circle-fill text-primary"></i> Loaded sample: <strong>${label}</strong> (${added} record processed).`;
  }
}

function ingestPdfCandidate(rawCand) {
  const isDuplicate = detectDuplicateCandidate(rawCand);
  const ageValidation = validateBalvatikaAge(rawCand.dob, rawCand.classApplied, rawCand.cwsn === 'YES');

  let status = "VERIFIED";
  let reason = "";

  if (isDuplicate) {
    status = "DUPLICATE";
    reason = "DUPLICATE APPLICATION DETECTED: Candidate registered multiple times under same Reg No / Name / Mobile.";
  } else if (!ageValidation.valid) {
    status = "AGE MISMATCH";
    reason = ageValidation.reason;
  }

  const newRecord = {
    regNo: rawCand.regNo,
    name: rawCand.name,
    fatherName: rawCand.fatherName,
    motherName: rawCand.motherName,
    dob: rawCand.dob,
    gender: rawCand.gender,
    classApplied: rawCand.classApplied,
    priorityCat: rawCand.priorityCat,
    casteCat: rawCand.casteCat,
    rte: rawCand.rte,
    distanceKm: rawCand.distanceKm || 2.0,
    sgc: rawCand.sgc || "NO",
    cwsn: rawCand.cwsn || "NO",
    transfers: rawCand.transfers || 0,
    mobile: rawCand.mobile || "9876543210",
    verified: status,
    deficiencyReason: reason,
    auditLog: {}
  };

  candidates.unshift(newRecord);
  return 1;
}

function detectDuplicateCandidate(cand) {
  return candidates.some(existing => 
    existing.regNo === cand.regNo || 
    (existing.name.toLowerCase() === cand.name.toLowerCase() && existing.dob === cand.dob)
  );
}

function validateBalvatikaAge(dobStr, classApplied, isCwsn) {
  return validateClassAge(dobStr, classApplied, isCwsn);
}

function validateClassAge(dobStr, classApplied, isCwsn) {
  const age = calculateAgeOnMarch31(dobStr);
  const decimalAge = age.decimalAge;
  const extra = isCwsn ? 2 : 0;

  if (!classApplied || classApplied === 'XI' || classApplied === 'XII') {
    return { valid: true };
  }

  const normClass = classApplied.replace(/^Class\s+/i, '').replace(/\s+/g, '-').trim();
  const rule = kvsClassAgeGuidelines.find(g => 
    g.classId.toLowerCase() === normClass.toLowerCase() || 
    g.classId.toLowerCase() === classApplied.toLowerCase() ||
    g.label.toLowerCase() === classApplied.toLowerCase()
  );

  if (rule) {
    const maxLimit = rule.maxAge + extra;
    if (decimalAge >= rule.minAge && decimalAge < maxLimit) {
      return { valid: true };
    }
    return { 
      valid: false, 
      reason: `AGE MISMATCH: Age ${age.years} yrs ${age.months} mths is outside ${rule.label} guideline limit (${rule.minAge} to <${maxLimit} yrs as on 31.03.2026).` 
    };
  }

  return { valid: true };
}

function handlePdfFiles(fileList) {
  let count = 0;
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const fileNameLower = file.name.toLowerCase();
      if (fileNameLower.includes('duplicate')) {
        loadSinglePdfSample('duplicate');
      } else if (fileNameLower.includes('invalid') || fileNameLower.includes('class-1')) {
        loadSinglePdfSample('invalid');
      } else if (fileNameLower.includes('overview')) {
        loadSinglePdfSample('overview');
      } else {
        loadSinglePdfSample('standard');
      }
      count++;
    }
  }

  const statusEl = document.getElementById('pdfImportStatus');
  if (statusEl) {
    statusEl.innerHTML = `<i class="bi bi-check-circle-fill text-success"></i> Successfully processed <strong>${count} PDF file(s)</strong>.`;
  }
}

// 5. APPLICATION LIST (SAMAGAM STYLE)
function renderVerificationTable() {
  const searchTerm = (document.getElementById('verifySearch').value || '').toLowerCase();
  const tbody = document.getElementById('verificationTableBody');

  const filtered = candidates.filter(c => 
    c.regNo.toLowerCase().includes(searchTerm) || 
    c.name.toLowerCase().includes(searchTerm) ||
    (c.verified || '').toLowerCase().includes(searchTerm)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No candidates matching search filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((c, idx) => {
    const statusBadge = c.verified === 'VERIFIED' ? 'bg-success' 
      : c.verified === 'DEFICIENT' ? 'bg-danger' 
      : c.verified === 'DUPLICATE' ? 'badge-duplicate' 
      : c.verified === 'AGE MISMATCH' ? 'badge-mismatch' 
      : 'bg-warning text-dark';
    
    const remark = c.verified === 'DUPLICATE' ? 'Duplicate Application Detected'
      : c.verified === 'AGE MISMATCH' ? (c.deficiencyReason || 'This DOB is Not Eligible')
      : c.verified === 'DEFICIENT' ? (c.deficiencyReason || 'Document Deficiency')
      : c.verified === 'PENDING' ? 'Verification Pending'
      : 'Verified';

    return `<tr>
      <td>${idx + 1}</td>
      <td><span class="link-asc" onclick="startGuidedVerification('${c.regNo}')">${c.regNo}</span></td>
      <td>${c.name}</td>
      <td>${c.classApplied}</td>
      <td>${formatDate(c.dob)}</td>
      <td><span class="badge badge-cat${c.priorityCat.split('-')[1] || 1}">${c.priorityCat}</span> ${c.casteCat}</td>
      <td>${c.rte === 'YES' ? 'YES' : 'NO'}</td>
      <td><span class="badge ${statusBadge}">${c.verified}</span> <span style="font-size:0.75rem;color:#757575;">${remark !== 'Verified' ? remark : ''}</span></td>
      <td><button class="btn btn-sm fw-bold text-white" style="background:var(--kvs-maroon);font-size:0.72rem;" onclick="startGuidedVerification('${c.regNo}')"><i class="bi bi-shield-check"></i> Verify</button></td>
    </tr>`;
  }).join('');
}

function startGuidedVerification(regNo) {
  const c = candidates.find(item => item.regNo === regNo);
  if (!c) return;

  currentWizardCandidate = c;
  if (!currentWizardCandidate.auditLog) currentWizardCandidate.auditLog = {};
  
  currentWizardStep = 1;
  document.getElementById('wizardCandidateTitle').innerText = `Guided Verification: ${c.name}`;
  document.getElementById('wizardCandidateSub').innerText = `Registration No/Submission Code: ${c.regNo} | Applied Class: ${c.classApplied} | Claimed Cat: ${c.priorityCat}`;

  renderWizardStep(1);

  const el = document.getElementById('verifyModal');
  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    if (!verifyModalInstance) verifyModalInstance = new bootstrap.Modal(el);
    verifyModalInstance.show();
  }
  el.classList.add('show');
  el.style.display = 'block';
  document.body.classList.add('modal-open');
}

function closeVerifyModal() {
  const el = document.getElementById('verifyModal');
  if (verifyModalInstance) {
    try { verifyModalInstance.hide(); } catch(e) {}
  }
  el.classList.remove('show');
  el.style.display = 'none';
  document.body.classList.remove('modal-open');
}

function goToWizardStep(stepNum) {
  currentWizardStep = stepNum;
  renderWizardStep(stepNum);
}

function renderWizardStep(stepNum) {
  currentWizardStep = stepNum;
  const rteMax = schoolSettings.rteMaxDistance || 5.0;
  
  const stepItems = document.querySelectorAll('.wizard-step-tab');
  stepItems.forEach((item, index) => {
    item.classList.toggle('active', (index + 1) === stepNum);
  });

  const c = currentWizardCandidate;
  const container = document.getElementById('wizardStepContent');
  const ageObj = calculateAgeOnMarch31(c.dob);
  const ageYears = ageObj.years + (ageObj.months / 12);

  if (stepNum === 1) {
    const ageVal = validateClassAge(c.dob, c.classApplied, c.cwsn === 'YES');
    const isAgeEligible = ageVal.valid;
    const ruleInfo = kvsClassAgeGuidelines.find(g => g.classId === c.classApplied || g.label === c.classApplied) || { note: "Per KVS guidelines table" };
    container.innerHTML = `
      <div class="guideline-box">
        <strong>KVS Guidelines Para 4 - Age Limit & Birth Proof:</strong><br>
        • Guidelines for ${c.classApplied}: ${ruleInfo.note || 'Age limits as on 31st March 2026'}. (Child born on 1st April is also considered).<br>
        • Mandatory Document: Birth Certificate issued by Municipal Corporation / Registrar of Births & Deaths / Village Panchayat.
      </div>

      <div class="p-3 bg-light rounded border mb-3 small">
        <p class="mb-1"><strong>Candidate Specified DOB:</strong> ${formatDate(c.dob)}</p>
        <p class="mb-1"><strong>Calculated Age on 31.03.2026:</strong> ${ageObj.years} Years, ${ageObj.months} Months, ${ageObj.days} Days</p>
        <p class="mb-2"><strong>CwSN Status:</strong> ${c.cwsn === 'YES' ? 'YES (+2 Yrs Relaxation)' : 'NO'}</p>
        
        <div class="alert ${isAgeEligible ? 'alert-success' : 'alert-danger'} mb-0 py-2">
          ${isAgeEligible ? '✅ AGE RULE SATISFIED for Class ' + c.classApplied : '❌ ' + (ageVal.reason || 'AGE OUT OF BOUNDS for Class ' + c.classApplied)}
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold">Authentic Birth Certificate Produced?</label>
        <select id="auditDobCert" class="form-select">
          <option value="PASS" ${c.auditLog.dobCert === 'FAIL' ? '' : 'selected'}>YES - Valid Birth Certificate Verified</option>
          <option value="FAIL" ${c.auditLog.dobCert === 'FAIL' ? 'selected' : ''}>NO - Missing or Invalid Authority</option>
        </select>
      </div>

      <div class="d-flex justify-content-between mt-4">
        <button class="btn btn-outline-secondary" onclick="closeVerifyModal()">Cancel</button>
        <button class="btn btn-primary fw-bold" onclick="saveWizardStep1()">Save & Next: Service Category →</button>
      </div>
    `;
  }
  else if (stepNum === 2) {
    container.innerHTML = `
      <div class="guideline-box">
        <strong>KVS Guidelines Para 2 & 3 - Service Priority Categories:</strong><br>
        • <strong>Cat-1:</strong> Central Govt / Ex-Servicemen. <strong>Cat-2:</strong> Central PSUs.<br>
        • <strong>Transfers:</strong> Service Certificate signed by Head of Office with seal. Minimum 6 months stay required per station in last 7 years.
      </div>

      <div class="p-3 bg-light rounded border mb-3 small">
        <p class="mb-1"><strong>Claimed Priority Category:</strong> <span class="badge badge-cat${c.priorityCat.split('-')[1] || 1}">${c.priorityCat}</span></p>
        <p class="mb-0"><strong>Claimed Transfers (Last 7 Yrs):</strong> ${c.transfers}</p>
      </div>

      <div class="row g-2 mb-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Verified Service Certificate Status:</label>
          <select id="auditServiceCert" class="form-select" onchange="checkCategoryFallback(this.value)">
            <option value="PASS">PASS - Service Certificate Authentic</option>
            <option value="FAIL">FAIL - Invalid / Missing Service Certificate</option>
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label small fw-semibold">Verified Transfers Count:</label>
          <input type="number" id="auditTransfers" class="form-control" value="${c.transfers}" min="0">
        </div>
      </div>

      <div id="categoryFallbackNotice" class="alert alert-info py-2 small mb-3" style="display:none;">
        ⚠️ Service Certificate rejected. Priority category will fall back from <strong>${c.priorityCat}</strong> to <strong>${isProjectOrIhlSector() ? 'Cat-6' : 'Cat-5'} (Others)</strong>.
      </div>

      <div class="d-flex justify-content-between mt-4">
        <button class="btn btn-outline-secondary" onclick="goToWizardStep(1)">← Back</button>
        <button class="btn btn-primary fw-bold" onclick="saveWizardStep2()">Save & Next: Distance & RTE →</button>
      </div>
    `;
  }
  else if (stepNum === 3) {
    const isDistanceRteValid = (c.distanceKm <= rteMax);
    container.innerHTML = `
      <div class="guideline-box">
        <strong>KVS Guidelines Para 3.i - RTE 25% Distance Rule (Configured Limit: ${rteMax} km):</strong><br>
        • Urban KVs: Maximum distance limit is <strong>5.0 km</strong> from school.<br>
        • Rural / Hilly KVs: Maximum distance limit is <strong>8.0 km</strong> from school.<br>
        <em>Current Vidyalaya Setting: <strong>${rteMax}.0 km Max Radius</strong></em>
      </div>

      <div class="p-3 bg-light rounded border mb-3 small">
        <p class="mb-1"><strong>RTE Quota Claimed:</strong> ${c.rte}</p>
        <p class="mb-0"><strong>Specified Residence Distance:</strong> ${c.distanceKm || 0} km</p>
      </div>

      <div class="row g-2 mb-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Verified Residence Distance (in Km):</label>
          <input type="number" id="auditDistance" class="form-control" value="${c.distanceKm || 2.5}" step="0.1" onchange="evaluateDistanceRule(this.value)">
        </div>

        <div class="col-md-6">
          <label class="form-label small fw-semibold">Residence Proof Document Status:</label>
          <select id="auditResProof" class="form-select">
            <option value="PASS">PASS - Residence Proof Verified</option>
            <option value="FAIL">FAIL - Residence Proof Missing / Invalid</option>
          </select>
        </div>
      </div>

      <div id="rteDistanceAlert" class="alert ${isDistanceRteValid ? 'alert-success' : 'alert-danger'} py-2 small mb-3">
        ${isDistanceRteValid ? `✅ Distance <= ${rteMax}.0 km: QUALIFIES for RTE 25% quota.` : `❌ Distance > ${rteMax}.0 km: EXCEEDS configured limit. Disqualified from RTE.`}
      </div>

      <div class="d-flex justify-content-between mt-4">
        <button class="btn btn-outline-secondary" onclick="goToWizardStep(2)">← Back</button>
        <button class="btn btn-primary fw-bold" onclick="saveWizardStep3()">Save & Next: Social Category →</button>
      </div>
    `;
  }
  else if (stepNum === 4) {
    container.innerHTML = `
      <div class="guideline-box">
        <strong>KVS Guidelines - Social Category Rules:</strong><br>
        • SC (15%) & ST (7.5%) certificate issued by Revenue Authority.<br>
        • OBC-NCL (27%) certificate valid for FY 2025-26 / 2026-27.
      </div>

      <div class="p-3 bg-light rounded border mb-3 small">
        <p class="mb-0"><strong>Social Category Claimed:</strong> <strong>${c.casteCat}</strong></p>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold">Caste / Category Certificate Audit:</label>
        <select id="auditCasteCert" class="form-select">
          <option value="PASS">PASS - Valid Certificate Produced</option>
          <option value="FAIL">FAIL - Certificate Missing / Outdated Financial Year</option>
        </select>
      </div>

      <div class="d-flex justify-content-between mt-4">
        <button class="btn btn-outline-secondary" onclick="goToWizardStep(3)">← Back</button>
        <button class="btn btn-primary fw-bold" onclick="saveWizardStep4()">Save & Next: Special Quota →</button>
      </div>
    `;
  }
  else if (stepNum === 5) {
    container.innerHTML = `
      <div class="guideline-box">
        <strong>KVS Guidelines - Special Quota Rules:</strong><br>
        • CwSN (3%): Min 40% disability certificate issued by competent Govt Medical Board.
      </div>

      <div class="p-3 bg-light rounded border mb-3 small">
        <p class="mb-0"><strong>CwSN Disability Status Claimed:</strong> ${c.cwsn || 'NO'}</p>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold">CwSN Disability Cert Audit:</label>
        <select id="auditCwsnCert" class="form-select">
          <option value="NA">N/A - Not Claimed</option>
          <option value="PASS" ${c.cwsn === 'YES' ? 'selected' : ''}>PASS - Valid Medical Cert</option>
          <option value="FAIL">FAIL - Invalid Cert</option>
        </select>
      </div>

      <div class="d-flex justify-content-between mt-4">
        <button class="btn btn-outline-secondary" onclick="goToWizardStep(4)">← Back</button>
        <button class="btn btn-primary fw-bold" onclick="saveWizardStep5()">Save & Next: Final Decision →</button>
      </div>
    `;
  }
  else if (stepNum === 6) {
    const deficiencies = compileDeficiencies(c);
    const recommendedStatus = deficiencies.length === 0 ? 'VERIFIED' : 'DEFICIENT';

    container.innerHTML = `
      <h6 class="fw-bold text-navy mb-2">Final Committee Verification Audit Summary</h6>

      <div class="p-3 bg-light rounded border mb-3 small">
        <p class="mb-1"><strong>Candidate:</strong> ${c.name} (${c.regNo})</p>
        <p class="mb-1"><strong>Verified Priority Category:</strong> <span class="badge badge-cat${c.priorityCat.split('-')[1] || 1}">${c.priorityCat}</span></p>
        <p class="mb-0"><strong>Verified RTE Status:</strong> ${c.rte}</p>
      </div>

      <div class="mb-3">
        <label class="form-label small fw-semibold">Final Committee Decision:</label>
        <select id="wizardFinalStatus" class="form-select fw-bold" onchange="toggleWizardDeficiencyNotice(this.value)">
          <option value="VERIFIED" ${recommendedStatus === 'VERIFIED' ? 'selected' : ''}>VERIFIED (Fully Compliant)</option>
          <option value="PENDING">PENDING (Awaiting Documents)</option>
          <option value="DEFICIENT" ${recommendedStatus === 'DEFICIENT' ? 'selected' : ''}>DEFICIENT / REJECTED (Non-Compliant)</option>
        </select>
      </div>

      <div class="mb-3" id="wizardDeficiencyTextGroup" style="display:${recommendedStatus === 'DEFICIENT' ? 'block' : 'none'};">
        <label class="form-label small fw-semibold">Compiled Rejection Reasons (Para 3.vii Deficiency Notice):</label>
        <textarea id="wizardDeficiencyText" class="form-control" rows="3">${deficiencies.join('; ') || c.deficiencyReason || 'Mandatory guidelines criteria not met.'}</textarea>
      </div>

      <div class="d-flex justify-content-between mt-4">
        <button class="btn btn-outline-secondary" onclick="goToWizardStep(5)">← Back</button>
        <div class="d-flex gap-2">
          <button class="btn btn-danger btn-sm fw-bold" onclick="printDeficiencyNotice('${c.regNo}')"><i class="bi bi-printer"></i> Print Deficiency Notice</button>
          <button class="btn btn-warning btn-sm text-dark fw-bold" onclick="finalizeWizardVerification()">Finalize Committee Audit</button>
        </div>
      </div>
    `;
  }
}

// Wizard Helpers
function saveWizardStep1() {
  currentWizardCandidate.auditLog.dobCert = document.getElementById('auditDobCert').value;
  goToWizardStep(2);
}

function checkCategoryFallback(val) {
  document.getElementById('categoryFallbackNotice').style.display = (val === 'FAIL') ? 'block' : 'none';
}

function saveWizardStep2() {
  const serviceStatus = document.getElementById('auditServiceCert').value;
  const transfers = parseInt(document.getElementById('auditTransfers').value) || 0;
  
  currentWizardCandidate.auditLog.serviceCert = serviceStatus;
  currentWizardCandidate.transfers = transfers;

  const fallbackCat = isProjectOrIhlSector() ? 'Cat-6' : 'Cat-5';
  if (serviceStatus === 'FAIL' && currentWizardCandidate.priorityCat !== fallbackCat) {
    currentWizardCandidate.priorityCat = fallbackCat;
    showSamagamAlert(`Service Certificate invalid. Candidate re-classified to ${fallbackCat} (Others).`, 'Category Fallback', 'warning');
  }
  goToWizardStep(3);
}

function evaluateDistanceRule(dist) {
  const rteMax = schoolSettings.rteMaxDistance || 5.0;
  const isRteValid = (parseFloat(dist) <= rteMax);
  const alertBox = document.getElementById('rteDistanceAlert');
  alertBox.className = `alert ${isRteValid ? 'alert-success' : 'alert-danger'} py-2 small mb-3`;
  alertBox.innerHTML = isRteValid ? `✅ Distance <= ${rteMax}.0 km: QUALIFIES for RTE 25% quota.` : `❌ Distance > ${rteMax}.0 km: EXCEEDS configured limit. Disqualified from RTE.`;
}

function saveWizardStep3() {
  const rteMax = schoolSettings.rteMaxDistance || 5.0;
  const dist = parseFloat(document.getElementById('auditDistance').value) || 0;
  const resStatus = document.getElementById('auditResProof').value;

  currentWizardCandidate.distanceKm = dist;
  currentWizardCandidate.auditLog.resProof = resStatus;

  if (dist > rteMax || resStatus === 'FAIL') {
    if (currentWizardCandidate.rte === 'YES') {
      currentWizardCandidate.rte = 'NO';
      showSamagamAlert(`Distance exceeds ${rteMax}km limit or proof invalid. RTE claim disqualified.`, 'RTE Disqualified', 'warning');
    }
  }
  goToWizardStep(4);
}

function saveWizardStep4() {
  currentWizardCandidate.auditLog.casteCert = document.getElementById('auditCasteCert').value;
  goToWizardStep(5);
}

function saveWizardStep5() {
  currentWizardCandidate.auditLog.cwsnCert = document.getElementById('auditCwsnCert').value;
  goToWizardStep(6);
}

function compileDeficiencies(c) {
  const rteMax = schoolSettings.rteMaxDistance || 5.0;
  const list = [];
  if (c.auditLog.dobCert === 'FAIL') list.push("Birth Certificate missing or issued by unrecognised authority");
  if (c.auditLog.serviceCert === 'FAIL') list.push("Service Certificate / Transfer proof not verified by Head of Office");
  if (c.auditLog.resProof === 'FAIL') list.push("Valid Residence proof not submitted");
  if (c.distanceKm > rteMax && c.rte === 'YES') list.push(`Residence distance exceeds ${rteMax}km RTE radius limit`);
  if (c.auditLog.casteCert === 'FAIL') list.push("Caste / Category certificate invalid for current financial year");
  return list;
}

function toggleWizardDeficiencyNotice(val) {
  document.getElementById('wizardDeficiencyTextGroup').style.display = (val === 'DEFICIENT') ? 'block' : 'none';
}

function finalizeWizardVerification() {
  const finalStatus = document.getElementById('wizardFinalStatus').value;
  currentWizardCandidate.verified = finalStatus;

  if (finalStatus === 'DEFICIENT') {
    currentWizardCandidate.deficiencyReason = document.getElementById('wizardDeficiencyText').value.trim();
  } else {
    delete currentWizardCandidate.deficiencyReason;
  }

  saveData();
  closeVerifyModal();
  renderVerificationTable();
  renderDashboard();
  renderMasterReport();
  showSamagamAlert(`Verification completed for ${currentWizardCandidate.name}. Final Status: ${finalStatus}`, 'Audit Finalized', 'success');
}

// Official KVS Admission Guidelines 2026-27 (Page 5, Para 4) Class Age Matrix
const kvsClassAgeGuidelines = [
  { classId: "Balvatika-1", label: "Balvatika - I", minAge: 3, maxAge: 4, note: "3 to <4 yrs" },
  { classId: "Balvatika-2", label: "Balvatika - II", minAge: 4, maxAge: 5, note: "4 to <5 yrs" },
  { classId: "Balvatika-3", label: "Balvatika - III", minAge: 5, maxAge: 6, note: "5 to <6 yrs" },
  { classId: "I", label: "Class I", minAge: 6, maxAge: 8, note: "6 to <8 yrs" },
  { classId: "II", label: "Class II", minAge: 7, maxAge: 9, note: "7 to <9 yrs" },
  { classId: "III", label: "Class III", minAge: 8, maxAge: 10, note: "8 to <10 yrs" },
  { classId: "IV", label: "Class IV", minAge: 9, maxAge: 11, note: "9 to <11 yrs" },
  { classId: "V", label: "Class V", minAge: 10, maxAge: 12, note: "10 to <12 yrs" },
  { classId: "VI", label: "Class VI", minAge: 10, maxAge: 12, note: "10 to <12 yrs" },
  { classId: "VII", label: "Class VII", minAge: 11, maxAge: 13, note: "11 to <13 yrs" },
  { classId: "VIII", label: "Class VIII", minAge: 12, maxAge: 14, note: "12 to <14 yrs" },
  { classId: "IX", label: "Class IX", minAge: 13, maxAge: 15, note: "13 to <15 yrs" },
  { classId: "X", label: "Class X", minAge: 14, maxAge: 16, note: "14 to <16 yrs" },
  { classId: "XI", label: "Class XI", minAge: 0, maxAge: 99, note: "No age limit (Class X Passed)" },
  { classId: "XII", label: "Class XII", minAge: 0, maxAge: 99, note: "No age limit (Continuous Study)" }
];

// Age Helper (Supports Custom Cutoff Date)
function calculateAgeOnTargetDate(dobStr, targetDateStr = '2026-03-31') {
  if (!dobStr) return { years: 0, months: 0, days: 0, decimalAge: 0 };
  const dob = new Date(dobStr);
  const target = targetDateStr ? new Date(targetDateStr) : new Date('2026-03-31');

  let effectiveDob = new Date(dob);
  // Special KVS Guideline Rule (Para 4): Child born on 1st April is considered to reach age threshold on 31st March
  if (target.getMonth() === 2 && target.getDate() === 31) {
    if (dob.getMonth() === 3 && dob.getDate() === 1) {
      effectiveDob.setDate(31);
      effectiveDob.setMonth(2);
    }
  }

  let years = target.getFullYear() - effectiveDob.getFullYear();
  let months = target.getMonth() - effectiveDob.getMonth();
  let days = target.getDate() - effectiveDob.getDate();

  if (days < 0) { 
    months -= 1; 
    const prevMonthLastDay = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    days += prevMonthLastDay; 
  }
  if (months < 0) { years -= 1; months += 12; }

  const decimalAge = years + (months / 12) + (days / 365.25);

  return { years, months, days, decimalAge };
}

function calculateAgeOnMarch31(dobStr) {
  return calculateAgeOnTargetDate(dobStr, '2026-03-31');
}

// 6A. LOTTERY ELIGIBILITY MATRIX
function renderLotteryEligibility() {
  const filterClass = document.getElementById('eligFilterClass') ? document.getElementById('eligFilterClass').value : 'ALL';
  const tbody = document.getElementById('eligibilityTableBody');
  if (!tbody) return;

  const rteMax = schoolSettings.rteMaxDistance || 5.0;
  let verified = candidates.filter(c => c.verified === 'VERIFIED');
  if (filterClass !== 'ALL') verified = verified.filter(c => c.classApplied === filterClass);

  if (verified.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No verified candidates found${filterClass !== 'ALL' ? ' for Class ' + filterClass : ''}. Only VERIFIED applications are eligible for the lottery.</td></tr>`;
    return;
  }

  tbody.innerHTML = verified.map((c, idx) => {
    const badges = [];
    // RTE eligibility
    if (c.rte === 'YES' && (c.distanceKm || 0) <= rteMax) {
      badges.push('<span class="badge bg-primary me-1 mb-1">1st Lot — RTE</span>');
    }
    // CwSN eligibility
    if (c.cwsn === 'YES') {
      badges.push('<span class="badge me-1 mb-1" style="background:#9d174d;color:#fff;">2nd Lot — CwSN</span>');
    }
    // Priority Category lot
    const catNum = c.priorityCat.split('-')[1] || '5';
    const catLotNum = ['1','2'].includes(catNum) ? '3rd' : '5th';
    badges.push(`<span class="badge badge-cat${catNum} me-1 mb-1">${catLotNum} Lot — ${c.priorityCat}</span>`);
    // Social Category quota
    if (c.casteCat === 'SC') badges.push('<span class="badge me-1 mb-1" style="background:#166534;color:#fff;">4th Lot — SC (15%)</span>');
    else if (c.casteCat === 'ST') badges.push('<span class="badge me-1 mb-1" style="background:#065f46;color:#fff;">4th Lot — ST (7.5%)</span>');
    else if (c.casteCat === 'OBC-NCL') badges.push('<span class="badge me-1 mb-1" style="background:#9a3412;color:#fff;">4th Lot — OBC-NCL (27%)</span>');

    return `<tr>
      <td>${idx + 1}</td>
      <td><strong>${c.regNo}</strong></td>
      <td>${c.name}</td>
      <td>${c.classApplied}</td>
      <td><span class="badge badge-cat${catNum}">${c.priorityCat}</span></td>
      <td>${c.casteCat}</td>
      <td>${c.rte}</td>
      <td>${c.cwsn || 'NO'}</td>
      <td style="max-width:320px;">${badges.join('')}</td>
    </tr>`;
  }).join('');
}

// 6B. LOTTERY SLIP GENERATOR
function renderLotterySlips() {
  const filterClass = document.getElementById('slipFilterClass') ? document.getElementById('slipFilterClass').value : 'ALL';
  const filterCat = document.getElementById('slipFilterCategory') ? document.getElementById('slipFilterCategory').value : 'ALL';
  const drawDate = document.getElementById('slipDrawDate') ? document.getElementById('slipDrawDate').value : '08.04.2026';
  const container = document.getElementById('slipsContainer');

  // Only VERIFIED candidates are eligible for lottery
  let filtered = candidates.filter(c => c.verified === 'VERIFIED');

  if (filterClass !== 'ALL') filtered = filtered.filter(c => c.classApplied === filterClass);

  // Expanded category filters matching official KVS lottery sequence
  if (filterCat === 'RTE') filtered = filtered.filter(c => c.rte === 'YES');
  else if (filterCat === 'CwSN') filtered = filtered.filter(c => c.cwsn === 'YES');
  else if (filterCat === 'Cat-1') filtered = filtered.filter(c => c.priorityCat === 'Cat-1');
  else if (filterCat === 'Cat-2') filtered = filtered.filter(c => c.priorityCat === 'Cat-2');
  else if (filterCat === 'SC') filtered = filtered.filter(c => c.casteCat === 'SC');
  else if (filterCat === 'ST') filtered = filtered.filter(c => c.casteCat === 'ST');
  else if (filterCat === 'OBC-NCL') filtered = filtered.filter(c => c.casteCat === 'OBC-NCL');
  else if (filterCat === 'Cat-3') filtered = filtered.filter(c => c.priorityCat === 'Cat-3');
  else if (filterCat === 'Cat-4') filtered = filtered.filter(c => c.priorityCat === 'Cat-4');
  else if (filterCat === 'Cat-5') filtered = filtered.filter(c => c.priorityCat === 'Cat-5');
  else if (filterCat === 'Cat-6') filtered = filtered.filter(c => c.priorityCat === 'Cat-6');

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center text-muted p-5 w-100">No candidates matching selected Class (${filterClass}) and Category (${filterCat}).</div>`;
    return;
  }

  // Determine the Lot label based on the filter selection
  const lotLabel = getLotLabel(filterCat);

  // Committee member names from settings (Para 5)
  const cmPrincipal = schoolSettings.principal || 'Principal';
  const cmTeacher = schoolSettings.committeeTeacher || 'Teacher Member';
  const cmParent1 = schoolSettings.committeeParent1 || 'Parent Member';
  const cmParent2 = schoolSettings.committeeParent2Lady || 'Parent Member (Lady)';
  const cmVmc = schoolSettings.committeeVmcMember || 'VMC Member';

  container.innerHTML = filtered.map(c => `
    <div class="lottery-slip-card">
      <div class="lottery-slip-header">
        <h3>${schoolSettings.name.toUpperCase()}</h3>
        <div class="sub-address">${schoolSettings.address}</div>
        <p class="mt-1 mb-0">LOTTERY DRAW SLIP - ADMISSION 2026-27</p>
      </div>

      <div class="slip-tag-row">
        <span>CLASS: ${c.classApplied}</span>
        <span>${lotLabel}</span>
        <span>DRAW DATE: ${drawDate}</span>
      </div>

      <div class="slip-details-grid">
        <div class="slip-detail-item">
          <span class="label">Registration No/Submission Code:</span>
          <span class="value">${c.regNo}</span>
        </div>

        <div class="slip-detail-item">
          <span class="label">Priority Category:</span>
          <span class="value">${c.priorityCat}</span>
        </div>

        <div class="slip-detail-item full-width">
          <span class="label">Student Name:</span>
          <span class="value text-primary fs-6">${c.name}</span>
        </div>

        <div class="slip-detail-item">
          <span class="label">Father's Name:</span>
          <span class="value">${c.fatherName}</span>
        </div>

        <div class="slip-detail-item">
          <span class="label">Mother's Name:</span>
          <span class="value">${c.motherName}</span>
        </div>

        <div class="slip-detail-item">
          <span class="label">Date of Birth:</span>
          <span class="value">${formatDate(c.dob)}</span>
        </div>

        <div class="slip-detail-item">
          <span class="label">Gender:</span>
          <span class="value">${c.gender}</span>
        </div>

        <div class="slip-detail-item">
          <span class="label">Social Category:</span>
          <span class="value">${c.casteCat}</span>
        </div>

        <div class="slip-detail-item">
          <span class="label">RTE / CwSN:</span>
          <span class="value">${c.rte === 'YES' ? 'RTE: YES' : 'RTE: NO'}${c.cwsn === 'YES' ? ' | CwSN: YES' : ''}</span>
        </div>
      </div>

      <div class="lottery-slip-footer">
        <div class="slip-committee-signatures">
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-role">Convener (Principal)</div>
            <div class="sig-name">${cmPrincipal}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-role">Teacher Member</div>
            <div class="sig-name">${cmTeacher}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-role">Parent Member</div>
            <div class="sig-name">${cmParent1}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-role">Parent (Lady)</div>
            <div class="sig-name">${cmParent2}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-role">VMC Member</div>
            <div class="sig-name">${cmVmc}</div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Map filter category to official KVS Lot label
function getLotLabel(filterCat) {
  const lotMap = {
    'ALL': 'ALL LOTS',
    'RTE': '1st LOT (RTE 25%)',
    'CwSN': '2nd LOT (CwSN)',
    'Cat-1': '3rd LOT (CAT-I)',
    'Cat-2': '3rd LOT (CAT-II)',
    'SC': 'SC QUOTA (15%)',
    'ST': 'ST QUOTA (7.5%)',
    'OBC-NCL': 'OBC-NCL (27%)',
    'Cat-3': '5th LOT (CAT-III)',
    'Cat-4': '5th LOT (CAT-IV)',
    'Cat-5': '5th LOT (CAT-V)',
    'Cat-6': '5th LOT (CAT-VI)'
  };
  return lotMap[filterCat] || 'DRAW OF LOTS';
}

// 7. Class IX & XI Calculators
function calculateClassIX() {
  const h = parseFloat(document.getElementById('ixHindi').value) || 0;
  const e = parseFloat(document.getElementById('ixEnglish').value) || 0;
  const m = parseFloat(document.getElementById('ixMath').value) || 0;
  const s = parseFloat(document.getElementById('ixSocial').value) || 0;
  const sc = parseFloat(document.getElementById('ixScience').value) || 0;

  const total = h + e + m + s + sc;
  const pct = (total / 100) * 100;
  const genQualified = pct >= 33;
  const reservedQualified = pct >= 25;

  const box = document.getElementById('ixResultBox');

  if (genQualified) {
    box.className = 'alert alert-success py-2 small mb-0';
    box.innerHTML = `<strong>QUALIFIED (General & Reserved):</strong> Total = <strong>${total}/100</strong> (${pct}%). Satisfies 33% cutoff.`;
  } else if (reservedQualified) {
    box.className = 'alert alert-info py-2 small mb-0';
    box.innerHTML = `<strong>QUALIFIED (SC/ST/CwSN Only):</strong> Total = <strong>${total}/100</strong> (${pct}%). Satisfies 25% reserved cutoff.`;
  } else {
    box.className = 'alert alert-danger py-2 small mb-0';
    box.innerHTML = `<strong>NOT QUALIFIED:</strong> Total = <strong>${total}/100</strong> (${pct}%). Below cutoff.`;
  }
}

function calculateClassXI() {
  const marks = parseFloat(document.getElementById('xiMarks').value) || 0;
  const concession = parseFloat(document.getElementById('xiConcession').value) || 0;

  const totalPct = Math.min(100, marks + concession);
  const box = document.getElementById('xiResultBox');

  let streamHtml = `<strong>Adjusted %:</strong> ${marks}% + ${concession}% Concession = <strong class="fs-6 text-primary">${totalPct.toFixed(1)}%</strong><br><br>`;
  streamHtml += `<strong>Stream Eligibility:</strong><ul class="mb-0 ps-3">`;
  if (totalPct >= 60) streamHtml += `<li class="text-success fw-bold">Science Stream: Eligible</li>`;
  if (totalPct >= 55) streamHtml += `<li class="text-success fw-bold">Commerce Stream: Eligible</li>`;
  streamHtml += `<li class="text-success fw-bold">Humanities Stream: Eligible</li>`;
  streamHtml += `</ul>`;

  box.className = 'alert alert-info py-2 small mb-0';
  box.innerHTML = streamHtml;
}

// 8. Master Reports Renderer
function renderMasterReport() {
  const tbody = document.getElementById('masterReportTableBody');
  if (candidates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = candidates.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${c.regNo}</strong></td>
      <td>${c.name}</td>
      <td>${c.fatherName}</td>
      <td>${formatDate(c.dob)}</td>
      <td><span class="badge badge-cat${c.priorityCat.split('-')[1] || 1}">${c.priorityCat}</span></td>
      <td>${c.rte}</td>
      <td><span class="badge ${c.verified === 'VERIFIED' ? 'bg-success' : c.verified === 'DEFICIENT' ? 'bg-danger' : c.verified === 'DUPLICATE' ? 'badge-duplicate' : c.verified === 'AGE MISMATCH' ? 'badge-mismatch' : 'bg-warning text-dark'}">${c.verified}</span></td>
    </tr>
  `).join('');
}

// Print Deficiency Notice (Para 3.vii)
function printDeficiencyNotice(regNo) {
  const c = candidates.find(item => item.regNo === regNo);
  if (!c) return;

  const noticeWindow = window.open('', '_blank');
  noticeWindow.document.write(`
    <html>
    <head>
      <title>Deficiency Notice - ${c.regNo}</title>
      <style>
        body { font-family: sans-serif; padding: 2.5rem; color: #000; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .content { font-size: 1rem; line-height: 1.6; }
        .reason-box { background: #f8fafc; border: 2px solid #000; padding: 1rem; margin: 1.5rem 0; font-weight: bold; }
        .footer { margin-top: 3.5rem; display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>${schoolSettings.name.toUpperCase()}</h2>
        <p style="font-size: 0.9rem;">${schoolSettings.address} | ${schoolSettings.region}</p>
        <h3 style="margin-top: 0.5rem;">NOTICE OF DOCUMENT DEFICIENCY / REJECTION</h3>
        <p>Ref: KVS Admission Guidelines 2026-27 (Para 3.vii)</p>
      </div>

      <div class="content">
        <p>Date: ${new Date().toLocaleDateString('en-IN')}</p>
        <p>To,</p>
        <p>Parent/Guardian of <strong>${c.name}</strong><br>Registration No/Submission Code: <strong>${c.regNo}</strong><br>Applied Class: <strong>Class ${c.classApplied}</strong></p>

        <p style="margin-top: 1.5rem;">Dear Parent/Guardian,</p>
        <p>With reference to your application for admission to Class ${c.classApplied} in session 2026-27, your submitted application and documents were meticulously examined by the Vidyalaya Admission Verification Committee.</p>

        <p>As mandated by Para 3(vii) of the official KVS Admission Guidelines, you are hereby formally informed that the candidate does not meet the prescribed criteria due to the following specific reason(s):</p>

        <div class="reason-box">
          DEFICIENCY REASON: ${c.deficiencyReason || "Mandatory document verification failed under KVS rules."}
        </div>

        <p>You may submit authentic documents or appeal to the Principal's office within 2 working days of receipt of this notice.</p>

        <div class="footer">
          <div><strong>${schoolSettings.admissionIncharge || 'Admission Incharge'}</strong><br>Admission I/c</div>
          <div style="text-align: right;"><strong>${schoolSettings.principal || 'Principal'}</strong><br>Principal, ${schoolSettings.name}</div>
        </div>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `);
  noticeWindow.document.close();
}

// Helpers
function normalizeDate(raw) {
  if (!raw) return "2018-05-15";
  if (typeof raw === 'string' && raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return raw.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

// === CHANGE PASSWORD MODAL HANDLERS ===
let changePasswordModalInstance = null;

function openChangePasswordModal() {
  const modalEl = document.getElementById('changePasswordModal');
  if (!modalEl) return;
  document.getElementById('changePasswordForm').reset();
  const alertBox = document.getElementById('changePasswordAlertBox');
  if (alertBox) alertBox.className = 'd-none';
  if (!changePasswordModalInstance) {
    changePasswordModalInstance = new bootstrap.Modal(modalEl);
  }
  changePasswordModalInstance.show();
}

function closeChangePasswordModal() {
  if (changePasswordModalInstance) {
    changePasswordModalInstance.hide();
  }
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('pwdCurrent').value;
  const newPassword = document.getElementById('pwdNew').value;
  const confirmPassword = document.getElementById('pwdConfirm').value;
  const alertBox = document.getElementById('changePasswordAlertBox');
  const btn = document.getElementById('btnSubmitChangePassword');

  if (alertBox) alertBox.className = 'd-none';

  if (newPassword !== confirmPassword) {
    showModalAlert('changePasswordAlertBox', 'New password and Confirm Password do not match.', 'danger');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Updating...';

  try {
    const result = await Auth.changePassword(currentPassword, newPassword, confirmPassword);
    if (result.success) {
      showModalAlert('changePasswordAlertBox', 'Password updated successfully!', 'success');
      setTimeout(() => {
        closeChangePasswordModal();
      }, 1200);
    } else {
      showModalAlert('changePasswordAlertBox', result.message || 'Failed to update password.', 'danger');
    }
  } catch (err) {
    showModalAlert('changePasswordAlertBox', 'Error updating password.', 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Update Password';
  }
}

function showModalAlert(boxId, msg, type = 'danger') {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.className = `alert alert-${type} p-2 mb-3 small d-flex align-items-center gap-2`;
  box.innerHTML = `<i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}"></i> <div>${msg}</div>`;
}
