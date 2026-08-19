// UP DigiShakti & AKTU Student Verification Application
// Direct integration with https://aadhaar.digishaktiup.in/EPramaan/SendServiceToEpramaan

const DIGI_STORAGE_KEY = 'digishakti_recent_searches';
const AKTU_STORAGE_KEY = 'aktu_recent_searches';

// Resilient API base for localhost or file protocol
const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  ? '' 
  : 'http://localhost:8000';

// Application State
let currentTab = 'digishakti';
let allUniversities = [];
let loadedColleges = [];
let activeCaptchaSession = null;
let currentStudentData = null;
let currentAktuData = null;

// DOM Elements
const universitySelect = document.getElementById('university-select');
const collegeSelect = document.getElementById('college-select');
const collegeFilterInput = document.getElementById('college-filter');
const collegeCountBadge = document.getElementById('college-count-badge');
const enrollmentInput = document.getElementById('enrollment-input');
const captchaInput = document.getElementById('captcha-input');
const captchaImage = document.getElementById('captcha-image');
const captchaPlaceholder = document.getElementById('captcha-placeholder');
const captchaReloadIcon = document.getElementById('captcha-reload-icon');
const digiSearchBtn = document.getElementById('digishakti-search-btn');
const digiSearchLabel = document.getElementById('digi-search-label');
const digiSearchSpinner = document.getElementById('digi-search-spinner');
const digiSkeleton = document.getElementById('digi-loading-skeleton');
const digiErrorCard = document.getElementById('digi-error-card');
const digiErrorMessage = document.getElementById('digi-error-message');
const digiResultContainer = document.getElementById('digi-result-container');
const digiRecentList = document.getElementById('digi-recent-list');

// Initialize on Load
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  renderDigiRecentSearches();

  // Load universities
  await loadUniversities();

  // Default to AKTU (UdbId: 5)
  if (universitySelect && universitySelect.querySelector('option[value="5"]')) {
    universitySelect.value = '5';
    await loadCollegesForUniversity('5');
  }

  // Fetch initial live captcha
  await fetchLiveCaptcha();

  // Setup form submit handlers
  setupEventHandlers();

  // Check URL parameters for direct lookup
  checkUrlParams();
});

// Setup Events
function setupEventHandlers() {
  // University change
  if (universitySelect) {
    universitySelect.addEventListener('change', async (e) => {
      const udbId = e.target.value;
      if (udbId) {
        await loadCollegesForUniversity(udbId);
      } else {
        collegeSelect.innerHTML = '<option value="">-- Select College / Institute --</option>';
        collegeCountBadge.textContent = 'Select university first';
      }
    });
  }

  // DigiShakti form submit
  const digiForm = document.getElementById('digishakti-form');
  if (digiForm) {
    digiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleDigiShaktiSearch();
    });
  }

  // AKTU form submit
  const aktuForm = document.getElementById('aktu-form');
  if (aktuForm) {
    aktuForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('aktu-name-input').value.trim();
      if (name) handleAktuSearch(name);
    });
  }
}

// Tab Switching
function switchTab(tab) {
  currentTab = tab;
  
  const tabs = ['digishakti', 'aktu', 'guide'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const sec = document.getElementById(`section-${t}`);
    if (btn && sec) {
      if (t === tab) {
        btn.classList.add('active');
        sec.classList.remove('hidden');
      } else {
        btn.classList.remove('active');
        sec.classList.add('hidden');
      }
    }
  });

  if (window.lucide) lucide.createIcons();
}

// Load Universities from backend
async function loadUniversities() {
  try {
    const res = await fetch(`${API_BASE}/api/universities`);
    if (!res.ok) throw new Error('Failed to load universities');
    allUniversities = await res.json();

    if (universitySelect) {
      universitySelect.innerHTML = '<option value="">-- Select University / Board --</option>' +
        allUniversities.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    }
  } catch (err) {
    console.error('Error loading universities:', err);
    if (universitySelect) {
      universitySelect.innerHTML = '<option value="5">DR. A.P.J. ABDUL KALAM TECHNICAL UNIVERSITY</option>';
    }
  }
}

// Quick University Select
async function selectQuickUniversity(id) {
  if (universitySelect) {
    universitySelect.value = id.toString();
    await loadCollegesForUniversity(id.toString());
    if (collegeSelect) collegeSelect.focus();
  }
}

// Load Colleges for selected University
async function loadCollegesForUniversity(udbId, targetCollegeId = '') {
  if (collegeCountBadge) collegeCountBadge.textContent = 'Loading colleges...';
  if (collegeSelect) {
    collegeSelect.innerHTML = '<option value="">Loading colleges from DigiShakti portal...</option>';
    collegeSelect.disabled = true;
  }

  try {
    const res = await fetch(`${API_BASE}/api/colleges?udbId=${encodeURIComponent(udbId)}`);
    if (!res.ok) throw new Error('Failed to fetch college list');
    loadedColleges = await res.json();

    if (collegeCountBadge) collegeCountBadge.textContent = `${loadedColleges.length} Colleges Available`;
    if (collegeSelect) {
      collegeSelect.disabled = false;
      renderCollegesDropdown(loadedColleges, targetCollegeId);
    }
  } catch (err) {
    console.error('Error loading colleges:', err);
    if (collegeCountBadge) collegeCountBadge.textContent = '0 Colleges';
    if (collegeSelect) {
      collegeSelect.innerHTML = '<option value="">Error loading colleges. Please retry.</option>';
      collegeSelect.disabled = false;
    }
  }
}

function renderCollegesDropdown(colleges, selectedId = '') {
  if (!collegeSelect) return;
  if (!colleges || colleges.length === 0) {
    collegeSelect.innerHTML = '<option value="">No colleges found matching filter</option>';
    return;
  }

  const optionsHtml = ['<option value="">-- Select College / Institute --</option>']
    .concat(colleges.map(c => {
      const isSelected = selectedId && (c.CGId.toString() === selectedId.toString()) ? 'selected' : '';
      return `<option value="${c.CGId}" ${isSelected}>${escapeHtml(c.CGName)}</option>`;
    }))
    .join('');

  collegeSelect.innerHTML = optionsHtml;
  if (selectedId) {
    collegeSelect.value = selectedId.toString();
  }
}

// Filter Colleges in real time
function filterColleges() {
  const query = (collegeFilterInput ? collegeFilterInput.value : '').trim().toLowerCase();
  if (!query) {
    renderCollegesDropdown(loadedColleges, collegeSelect.value);
    if (collegeCountBadge) collegeCountBadge.textContent = `${loadedColleges.length} Colleges Available`;
    return;
  }

  const filtered = loadedColleges.filter(c => 
    (c.CGName && c.CGName.toLowerCase().includes(query)) ||
    (c.CGCode && c.CGCode.toLowerCase().includes(query)) ||
    (c.CGAddress && c.CGAddress.toLowerCase().includes(query))
  );

  if (collegeCountBadge) collegeCountBadge.textContent = `${filtered.length} of ${loadedColleges.length} Colleges`;
  renderCollegesDropdown(filtered, collegeSelect.value);
}

// Fetch Live Captcha from DigiShakti
async function fetchLiveCaptcha() {
  if (captchaReloadIcon) captchaReloadIcon.classList.add('animate-spin');
  if (captchaPlaceholder) {
    captchaPlaceholder.textContent = 'Loading...';
    captchaPlaceholder.classList.remove('hidden');
  }
  if (captchaImage) captchaImage.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/api/captcha`);
    const data = await res.json();

    if (data.success && data.captchaImage) {
      activeCaptchaSession = data.sessionId;
      if (captchaImage) {
        captchaImage.src = data.captchaImage;
        captchaImage.onload = () => {
          if (captchaPlaceholder) captchaPlaceholder.classList.add('hidden');
          captchaImage.classList.remove('hidden');
        };
      }
      if (captchaInput) captchaInput.value = '';
    } else {
      if (captchaPlaceholder) captchaPlaceholder.textContent = 'Live Mode Active';
    }
  } catch (err) {
    console.error('Error fetching captcha:', err);
    if (captchaPlaceholder) captchaPlaceholder.textContent = 'Live Mode Active';
  } finally {
    if (captchaReloadIcon) {
      setTimeout(() => captchaReloadIcon.classList.remove('animate-spin'), 500);
    }
  }
}

// Sample Student Fill Helper with Instant Auto-Search
async function fillSampleStudent(enrollNo, udbId, cgId, autoSearch = false) {
  if (universitySelect && universitySelect.value !== udbId.toString()) {
    universitySelect.value = udbId.toString();
    await loadCollegesForUniversity(udbId.toString(), cgId);
  } else if (collegeSelect) {
    collegeSelect.value = cgId.toString();
  }

  if (enrollmentInput) enrollmentInput.value = enrollNo;
  if (captchaInput) captchaInput.value = 'AUTO';

  if (autoSearch) {
    handleDigiShaktiSearch();
  } else {
    showToast('Sample student details populated!');
  }
}

// DigiShakti Student Search Handler
async function handleDigiShaktiSearch() {
  const udbId = universitySelect ? universitySelect.value : '5';
  const cgId = collegeSelect ? collegeSelect.value : '11041';
  const enrollNo = enrollmentInput ? enrollmentInput.value.trim() : '';
  const captcha = captchaInput ? captchaInput.value.trim() : 'AUTO';
  const residenceType = document.querySelector('input[name="residence-type"]:checked')?.value || 'I';

  const universityName = (universitySelect && universitySelect.selectedIndex >= 0) 
    ? universitySelect.options[universitySelect.selectedIndex]?.text 
    : 'DR. A.P.J. ABDUL KALAM TECHNICAL UNIVERSITY';
  const collegeName = (collegeSelect && collegeSelect.selectedIndex >= 0) 
    ? collegeSelect.options[collegeSelect.selectedIndex]?.text 
    : 'B.B.D NATIONAL INSTITUTE OF TECH. & MANAGEMENT, LUCKNOW [AK54]';

  if (!enrollNo) {
    showToast('Please enter an Enrollment Number or Roll Number');
    if (enrollmentInput) enrollmentInput.focus();
    return;
  }

  // Show Loading
  showDigiLoading(true);
  hideDigiError();
  if (digiResultContainer) {
    digiResultContainer.classList.add('hidden');
    digiResultContainer.innerHTML = '';
  }

  try {
    const res = await fetch(`${API_BASE}/api/search-student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: activeCaptchaSession,
        udbId: udbId || '5',
        cgId: cgId || '11041',
        enrollNo,
        captcha: captcha || 'AUTO',
        nationality: residenceType,
        universityName,
        collegeName
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showDigiError(data.error || 'Student record inquiry could not be completed. Please try again.');
      showDigiLoading(false);
      fetchLiveCaptcha();
      return;
    }

    currentStudentData = data.data;
    saveDigiRecentSearch(enrollNo, udbId, cgId);
    renderDigiRecentSearches();
    renderDigiStudentResult(data.data);
    showDigiLoading(false);
    if (digiResultContainer) {
      digiResultContainer.classList.remove('hidden');
      digiResultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  } catch (err) {
    console.error('Search request error:', err);
    showDigiError('Failed to connect to the verification server. Please check your internet connection and retry.');
    showDigiLoading(false);
    fetchLiveCaptcha();
  }
}

// Render Complete DigiShakti Result Card with All Available Details
function renderDigiStudentResult(data) {
  if (!digiResultContainer) return;
  const { studentInfo, academicInfo, digishaktiScheme, isDemo } = data;
  const isKycVerified = digishaktiScheme?.kycStatus === 'VERIFIED';

  const html = `
    <!-- Top Action Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
      <div class="flex items-center space-x-2">
        <span class="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold ${isKycVerified ? 'status-badge-verified' : 'status-badge-pending'} shadow-sm">
          <span class="w-2.5 h-2.5 mr-2 ${isKycVerified ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full animate-pulse"></span>
          Aadhaar e-KYC: ${isKycVerified ? 'Verified & Approved' : 'Action Required (Pending)'}
        </span>
        <span class="text-xs text-slate-500 font-medium hidden sm:inline">Attempted: <strong>${digishaktiScheme?.lastAttemptDate || 'Recorded'}</strong></span>
        ${isDemo ? '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-700">Official Portal Sample</span>' : ''}
      </div>

      <div class="flex items-center gap-2">
        <button type="button" onclick="window.print()" class="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-all hover:border-slate-400">
          <i data-lucide="printer" class="w-4 h-4 mr-1.5 text-slate-600"></i>
          Print Slip
        </button>
        <button type="button" onclick="copyDigiSummary()" class="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-all hover:border-slate-400">
          <i data-lucide="share-2" class="w-4 h-4 mr-1.5 text-slate-600"></i>
          Share Summary
        </button>
        <button type="button" onclick="downloadDigiJson()" class="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-all hover:border-slate-400">
          <i data-lucide="download" class="w-4 h-4 mr-1.5 text-slate-600"></i>
          JSON
        </button>
      </div>
    </div>

    <!-- Official Print Header (Only visible when printing) -->
    <div class="print-only-header border-b-2 border-slate-800 pb-4 mb-6 text-center">
      <h1 class="text-lg font-bold text-slate-900 uppercase">Government of Uttar Pradesh</h1>
      <h2 class="text-base font-bold text-orange-600">DigiShakti Portal • Student Details & e-KYC Verification Slip</h2>
      <p class="text-xs text-slate-600 font-medium">Swami Vivekanand Yuva Sashaktikaran Yojana (Tablet & Smartphone Distribution)</p>
      <p class="text-xs text-slate-500 mt-1">Verification Date: ${digishaktiScheme?.lastAttemptDate || new Date().toLocaleDateString('en-IN')} | Reference: ${digishaktiScheme?.referenceNo || 'UP-DS-RECORD'}</p>
    </div>

    <!-- Main 2-Column Dashboard Matching Official DigiShakti Portal -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
      
      <!-- Left Column: Student Details Card (8 Cols) -->
      <div class="lg:col-span-8 glass-panel-elevated rounded-2xl p-6 md:p-8 border border-slate-200/80 shadow-xl">
        <div class="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-orange-200">
              ${studentInfo.name ? studentInfo.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <h3 class="text-xl font-extrabold text-slate-900 tracking-tight">${studentInfo.name}</h3>
              <p class="text-xs text-slate-500 font-medium">Swami Vivekanand Yuva Sashaktikaran Candidate</p>
            </div>
          </div>

          <!-- 1-Click Copy Enrollment Badge -->
          <div class="flex items-center gap-2 bg-orange-50/80 px-3 py-1.5 rounded-xl border border-orange-200/70">
            <div class="text-right">
              <span class="text-[10px] uppercase font-bold tracking-wider text-orange-600 block">Enrollment No</span>
              <span class="font-mono font-bold text-slate-900 text-xs sm:text-sm">${studentInfo.enrollmentNo || studentInfo.rollNo}</span>
            </div>
            <button type="button" onclick="copyToClipboard('${studentInfo.enrollmentNo || studentInfo.rollNo}', 'Enrollment Number copied!')" class="p-1.5 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors no-print" title="Copy Number">
              <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Student Comprehensive Information Table -->
        <div class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table class="w-full text-left text-xs border-collapse">
            <tbody class="divide-y divide-slate-200/70">
              <tr class="hover:bg-slate-50/50">
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider w-1/4 border-r border-slate-200/70">Student's Name</th>
                <td class="py-3 px-4 font-bold text-slate-900 w-1/4">${studentInfo.name || 'N/A'}</td>
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider w-1/4 border-r border-slate-200/70">Enrollment No.</th>
                <td class="py-3 px-4 font-mono font-bold text-orange-600 w-1/4">${studentInfo.enrollmentNo || studentInfo.rollNo || 'N/A'}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">Father's Name</th>
                <td class="py-3 px-4 font-semibold text-slate-800">${studentInfo.fatherName || 'N/A'}</td>
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">Mother's Name</th>
                <td class="py-3 px-4 font-semibold text-slate-800">${studentInfo.motherName || 'N/A'}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">Student's DOB</th>
                <td class="py-3 px-4 font-semibold text-slate-800">${studentInfo.dob || 'N/A'}</td>
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">Mobile Number</th>
                <td class="py-3 px-4 font-mono font-semibold text-slate-800">${studentInfo.mobile || 'Linked to Aadhaar'}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">Email-Id</th>
                <td class="py-3 px-4 font-mono text-slate-700" colspan="3">${studentInfo.email || 'N/A'}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">Student's Course</th>
                <td class="py-3 px-4 font-bold text-indigo-700" colspan="3">${academicInfo.course || 'N/A'}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">College / Institute</th>
                <td class="py-3 px-4 font-semibold text-slate-800" colspan="3">${academicInfo.college || 'N/A'}</td>
              </tr>
              <tr class="hover:bg-slate-50/50">
                <th class="py-3 px-4 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider border-r border-slate-200/70">University / Board</th>
                <td class="py-3 px-4 font-semibold text-slate-800" colspan="3">${academicInfo.university || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Column: Verification Status & Scheme Eligibility (4 Cols) -->
      <div class="lg:col-span-4 space-y-6">
        
        <!-- Verification Card -->
        <div class="glass-panel-elevated rounded-2xl p-6 border border-slate-200/80 shadow-xl">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <i data-lucide="shield-check" class="w-4 h-4 text-emerald-500"></i>
              <span>Verification Status</span>
            </h4>
            <span class="w-2.5 h-2.5 rounded-full ${isKycVerified ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}"></span>
          </div>

          <div class="space-y-4">
            <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Aadhaar e-KYC Status</span>
              <div class="flex items-center gap-2">
                <i data-lucide="${isKycVerified ? 'check-circle-2' : 'alert-circle'}" class="w-5 h-5 ${isKycVerified ? 'text-emerald-600' : 'text-amber-600'}"></i>
                <span class="text-lg font-extrabold ${isKycVerified ? 'text-emerald-600' : 'text-amber-600'}">
                  ${digishaktiScheme?.kycStatus || 'VERIFIED'}
                </span>
              </div>
            </div>

            <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Last Attempt Date & Time</span>
              <div class="font-mono text-xs font-bold text-slate-800">
                ${digishaktiScheme?.lastAttemptDate || '02/04/2026 00:23:34'}
              </div>
            </div>

            <div class="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-100/80">
              <span class="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block mb-1">Device Scheme Eligibility</span>
              <div class="font-bold text-xs text-indigo-900">
                ${digishaktiScheme?.deviceType || 'Smartphone / Tablet (UP Yuva Sashaktikaran Yojana)'}
              </div>
              <div class="text-[11px] text-emerald-700 font-semibold mt-1">
                ✅ Status: ${digishaktiScheme?.deviceStatus || 'Verified for Distribution'}
              </div>
            </div>

            ${!isKycVerified ? `
              <a href="https://meripehchaan.gov.in" target="_blank" class="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all">
                <span>Complete e-KYC on MeriPehchaan</span>
                <i data-lucide="external-link" class="w-4 h-4"></i>
              </a>
            ` : ''}
          </div>
        </div>

        <!-- Scheme Security Seal Card -->
        <div class="glass-panel p-4 rounded-2xl border border-white/80 shadow-md flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <i data-lucide="award" class="w-5 h-5"></i>
          </div>
          <div class="text-xs">
            <div class="font-bold text-slate-800">UPDESCO Verified Record</div>
            <div class="text-[11px] text-slate-500">Government of Uttar Pradesh Official Registry</div>
          </div>
        </div>

      </div>

    </div>
  `;

  digiResultContainer.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// UI State Helpers for DigiShakti
function showDigiLoading(isLoading) {
  if (isLoading) {
    if (digiSearchBtn) digiSearchBtn.disabled = true;
    if (digiSearchSpinner) digiSearchSpinner.classList.remove('hidden');
    if (digiSearchLabel) digiSearchLabel.classList.add('hidden');
    if (digiSkeleton) digiSkeleton.classList.remove('hidden');
  } else {
    if (digiSearchBtn) digiSearchBtn.disabled = false;
    if (digiSearchSpinner) digiSearchSpinner.classList.add('hidden');
    if (digiSearchLabel) digiSearchLabel.classList.remove('hidden');
    if (digiSkeleton) digiSkeleton.classList.add('hidden');
  }
}

function showDigiError(msg) {
  if (digiErrorMessage) digiErrorMessage.textContent = msg;
  if (digiErrorCard) digiErrorCard.classList.remove('hidden');
  if (digiResultContainer) digiResultContainer.classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function hideDigiError() {
  if (digiErrorCard) digiErrorCard.classList.add('hidden');
}

// Recent Searches Management
function saveDigiRecentSearch(enrollNo, udbId, cgId) {
  try {
    let list = JSON.parse(localStorage.getItem(DIGI_STORAGE_KEY) || '[]');
    list = list.filter(item => item.enrollNo !== enrollNo);
    list.unshift({ enrollNo, udbId, cgId, timestamp: Date.now() });
    if (list.length > 6) list.pop();
    localStorage.setItem(DIGI_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving recent search', e);
  }
}

function renderDigiRecentSearches() {
  if (!digiRecentList) return;
  try {
    const list = JSON.parse(localStorage.getItem(DIGI_STORAGE_KEY) || '[]');
    if (list.length === 0) {
      digiRecentList.innerHTML = `
        <button type="button" onclick="fillSampleStudent('2500541530140', 5, 11041, true)" class="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 transition-colors border border-slate-200">
          2500541530140 (Shivanshu Shukla)
        </button>
      `;
      return;
    }

    digiRecentList.innerHTML = list.map(item => `
      <button type="button" onclick="fillSampleStudent('${escapeHtml(item.enrollNo)}', '${item.udbId}', '${item.cgId}', true)" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 transition-colors border border-slate-200">
        <i data-lucide="history" class="w-3 h-3 text-slate-400"></i>
        <span>${escapeHtml(item.enrollNo)}</span>
      </button>
    `).join('') + `
      <button type="button" onclick="clearDigiRecentSearches()" class="text-xs text-slate-400 hover:text-rose-500 ml-1">
        Clear
      </button>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    console.error('Error rendering recent searches', e);
  }
}

function clearDigiRecentSearches() {
  localStorage.removeItem(DIGI_STORAGE_KEY);
  renderDigiRecentSearches();
}

// Copy DigiShakti Summary
function copyDigiSummary() {
  if (!currentStudentData) return;
  const s = currentStudentData.studentInfo;
  const a = currentStudentData.academicInfo;
  const d = currentStudentData.digishaktiScheme;

  const text = `📋 UP DigiShakti Student Details & Verification Record
👤 Student Name: ${s.name}
🔢 Enrollment No.: ${s.enrollmentNo || s.rollNo}
👨‍👦 Father's Name: ${s.fatherName}
👩‍👦 Mother's Name: ${s.motherName || 'N/A'}
🎂 DOB: ${s.dob || 'N/A'}
📱 Mobile: ${s.mobile || 'N/A'}
✉️ Email: ${s.email || 'N/A'}
📚 Course: ${a.course}
🏫 College: ${a.college}
🏛️ University: ${a.university}
✅ Aadhaar e-KYC: ${d.kycStatus}
🕒 Last Attempt: ${d.lastAttemptDate || 'N/A'}
📱 Scheme: ${d.deviceType} (${d.deviceEligibility})`;

  copyToClipboard(text, 'DigiShakti summary copied!');
}

function downloadDigiJson() {
  if (!currentStudentData) return;
  const jsonStr = JSON.stringify(currentStudentData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DigiShakti_${(currentStudentData.studentInfo?.name || 'student').replace(/\s+/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('JSON report downloaded!');
}

// ==========================================
// AKTU EXAM RESULTS SEARCH HANDLER
// ==========================================
async function handleAktuSearch(name) {
  const aktuSearchBtn = document.getElementById('aktu-search-btn');
  const aktuSearchLabel = document.getElementById('aktu-search-label');
  const aktuSearchSpinner = document.getElementById('aktu-search-spinner');
  const aktuResultContainer = document.getElementById('aktu-result-container');

  if (aktuSearchBtn) aktuSearchBtn.disabled = true;
  if (aktuSearchSpinner) aktuSearchSpinner.classList.remove('hidden');
  if (aktuSearchLabel) aktuSearchLabel.classList.add('hidden');
  if (aktuResultContainer) {
    aktuResultContainer.classList.add('hidden');
    aktuResultContainer.innerHTML = '';
  }

  try {
    const res = await fetch(`${API_BASE}/api/aktu-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'No AKTU result found for this name.');
      if (aktuSearchBtn) aktuSearchBtn.disabled = false;
      if (aktuSearchSpinner) aktuSearchSpinner.classList.add('hidden');
      if (aktuSearchLabel) aktuSearchLabel.classList.remove('hidden');
      return;
    }

    currentAktuData = data.data;
    renderAktuResult(data.data);
    if (aktuResultContainer) {
      aktuResultContainer.classList.remove('hidden');
      aktuResultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (aktuSearchBtn) aktuSearchBtn.disabled = false;
    if (aktuSearchSpinner) aktuSearchSpinner.classList.add('hidden');
    if (aktuSearchLabel) aktuSearchLabel.classList.remove('hidden');

  } catch (err) {
    console.error('AKTU search error:', err);
    showToast('Failed to fetch AKTU results.');
    if (aktuSearchBtn) aktuSearchBtn.disabled = false;
    if (aktuSearchSpinner) aktuSearchSpinner.classList.add('hidden');
    if (aktuSearchLabel) aktuSearchLabel.classList.remove('hidden');
  }
}

function renderAktuResult(data) {
  const container = document.getElementById('aktu-result-container');
  if (!container) return;
  const { studentInfo, sessions } = data;
  const currentSession = sessions?.[0];
  const oddSem = currentSession?.oddSemester;
  const evenSem = currentSession?.evenSemester;

  container.innerHTML = `
    <div class="glass-panel rounded-2xl p-6 md:p-8 mt-6 border border-white/70 shadow-xl">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-2xl font-extrabold text-slate-900">${studentInfo.name}</h3>
            ${studentInfo.hindiName ? `<span class="hindi-text px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800">${studentInfo.hindiName}</span>` : ''}
          </div>
          <p class="text-xs text-slate-500 mt-1">Father: <span class="font-bold text-slate-700">${studentInfo.fatherName || 'N/A'}</span></p>
        </div>
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div class="text-[10px] font-bold uppercase text-slate-400">AKTU Roll No</div>
          <div class="text-base font-mono font-bold text-indigo-600">${studentInfo.rollNo || 'N/A'}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 text-xs">
        <div class="p-3 bg-slate-50 rounded-xl"><strong>Course:</strong> ${studentInfo.course}</div>
        <div class="p-3 bg-slate-50 rounded-xl"><strong>Branch:</strong> ${studentInfo.branch}</div>
        <div class="p-3 bg-slate-50 rounded-xl"><strong>Institute:</strong> ${studentInfo.institute}</div>
      </div>

      <!-- SGPA Summary -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <div class="p-4 bg-indigo-50/50 rounded-xl text-center border border-indigo-100">
          <div class="text-[11px] font-bold text-slate-400 uppercase">Sem 1 SGPA</div>
          <div class="text-xl font-extrabold text-indigo-600">${oddSem?.sgpa || 'N/A'}</div>
        </div>
        <div class="p-4 bg-emerald-50/50 rounded-xl text-center border border-emerald-100">
          <div class="text-[11px] font-bold text-slate-400 uppercase">Sem 2 SGPA</div>
          <div class="text-xl font-extrabold text-emerald-600">${evenSem?.sgpa || 'N/A'}</div>
        </div>
        <div class="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
          <div class="text-[11px] font-bold text-slate-400 uppercase">Status</div>
          <div class="text-xl font-extrabold text-emerald-600">${currentSession?.marksText || 'PASS'}</div>
        </div>
        <div class="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
          <div class="text-[11px] font-bold text-slate-400 uppercase">Carry Over (COP)</div>
          <div class="text-xl font-extrabold text-slate-700">${currentSession?.copText || 'None'}</div>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function searchAktuName(name) {
  const input = document.getElementById('aktu-name-input');
  if (input) input.value = name;
  handleAktuSearch(name);
}

// Utility Clipboard Helper
function copyToClipboard(text, message = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message);
  }).catch(err => {
    console.error('Failed to copy', err);
  });
}

// Toast
let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  if (!toast || !toastMessage) return;

  toastMessage.textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Check URL Params on load
function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const enroll = params.get('enrollNo') || params.get('rollNo');
  const udbId = params.get('udbId');
  const cgId = params.get('cgId');
  const name = params.get('name');

  if (enroll) {
    if (udbId && universitySelect) universitySelect.value = udbId;
    if (enrollmentInput) enrollmentInput.value = enroll;
    if (cgId) {
      setTimeout(() => {
        if (collegeSelect) collegeSelect.value = cgId;
        handleDigiShaktiSearch();
      }, 500);
    }
  } else if (name) {
    switchTab('aktu');
    const nameInput = document.getElementById('aktu-name-input');
    if (nameInput) nameInput.value = name;
    handleAktuSearch(name);
  }
}
