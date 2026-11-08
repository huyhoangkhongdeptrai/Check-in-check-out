/**
 * =========================================================================
 * CHẤM CÔNG & KM - ỨNG DỤNG ANDROID / PWA (HỖ TRỢ OFFLINE & AUTO-SYNC 2 CHIỀU)
 * Đồng bộ 2 chiều thời gian thực - BẢO VỆ DỮ LIỆU TUYỆT ĐỐI (KHÔNG BAO GIỜ XÓA ĐÈ)
 * =========================================================================
 */

// --- State Management ---
const AppState = {
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1, // 1-12
  currentDate: new Date(),
  stream: null,
  facingMode: 'environment', // back camera by default
  capturedTimeStr: '',
  capturedDateStr: '',
  capturedDay: 1,
  capturedMonth: 1,
  capturedYear: 2026,
  capturedMode: 'in', // 'in' or 'out'
  activeShift: 1, // 1: Ca 1, 2: Ca 2
  scriptUrl: localStorage.getItem('chamcong_sheet_api_url') || '',
  monthData: {},
  offlineQueue: JSON.parse(localStorage.getItem('chamcong_offline_queue') || '[]'),
  isSyncing: false,
  isFetchingLive: false,
  lastSyncTimestamp: 0,
  // --- Vị trí GPS (hỗ trợ offline) ---
  lastKnownAddress: localStorage.getItem('chamcong_last_address') || '',
  lastKnownCoords: JSON.parse(localStorage.getItem('chamcong_last_coords') || 'null'),
  isGettingLocation: false
};

// --- Sample Data ---
const USER_SAMPLE_DATA = {
  7:  { checkIn: '13:36:00', checkOut: '21:42:00', kmIn: 37365, kmOut: 37391 },
  8:  { checkIn: '11:47:00', checkOut: '21:50:00', kmIn: 37414, kmOut: 37452 },
  9:  { checkIn: '13:13:00', checkOut: '22:31:00', kmIn: 37488, kmOut: 37528 },
  11: { checkIn: '11:41:00', checkOut: '16:57:00', kmIn: null,  kmOut: null },
  12: { checkIn: '14:04:00', checkOut: '22:00:00', kmIn: 37610, kmOut: 37677 },
  13: { checkIn: '14:50:00', checkOut: '21:16:00', kmIn: 37707, kmOut: 37713 },
  14: { checkIn: '18:12:00', checkOut: '21:17:00', kmIn: 37782, kmOut: 37795 },
  15: { checkIn: '15:17:00', checkOut: '19:48:00', kmIn: 37869, kmOut: 37909 },
  17: { checkIn: '15:58:00', checkOut: '21:29:00', kmIn: 38093, kmOut: 38113 },
  19: { checkIn: '17:05:00', checkOut: '21:26:00', kmIn: 38191, kmOut: 38204 },
  21: { checkIn: '16:51:00', checkOut: '21:42:00', kmIn: 38369, kmOut: 38402 },
  22: { checkIn: '17:28:00', checkOut: '19:24:00', kmIn: 38418, kmOut: 38431 },
  24: { checkIn: '13:50:00', checkOut: '19:12:00', kmIn: 38537, kmOut: 38558 },
  26: { checkIn: '16:53:00', checkOut: '21:45:00', kmIn: 38654, kmOut: 38667 },
  27: { checkIn: '17:33:00', checkOut: '19:53:00', kmIn: 38693, kmOut: 38710 },
  28: { checkIn: '14:29:00', checkOut: '20:15:00', kmIn: 38757, kmOut: 38782 },
  31: { checkIn: '16:51:00', checkOut: '19:48:00', kmIn: 39112, kmOut: 39126 }
};

// --- DOM Elements ---
const elements = {
  headerLiveClock: document.getElementById('headerLiveClock'),
  currentDateDisplay: document.getElementById('currentDateDisplay'),
  onlineStatusBadge: document.getElementById('onlineStatusBadge'),
  onlineStatusText: document.getElementById('onlineStatusText'),
  btnSyncQueue: document.getElementById('btnSyncQueue'),
  syncStatusText: document.getElementById('syncStatusText'),
  syncQueueBadge: document.getElementById('syncQueueBadge'),
  // Live Watermark Badge Elements
  liveWatermarkBadge: document.getElementById('liveWatermarkBadge'),
  liveBadgeTag: document.getElementById('liveBadgeTag'),
  liveBadgeShift: document.getElementById('liveBadgeShift'),
  liveBadgeTime: document.getElementById('liveBadgeTime'),
  liveBadgeDate: document.getElementById('liveBadgeDate'),
  liveBadgeKm: document.getElementById('liveBadgeKm'),
  liveBadgeLocation: document.getElementById('liveBadgeLocation'),
  btnShift1: document.getElementById('btnShift1'),
  btnShift2: document.getElementById('btnShift2'),
  actionIndicatorText: document.getElementById('actionIndicatorText'),
  modeRadioIn: document.getElementById('modeRadioIn'),
  modeRadioOut: document.getElementById('modeRadioOut'),
  cameraVideo: document.getElementById('cameraVideo'),
  cameraPlaceholder: document.getElementById('cameraPlaceholder'),
  btnCapture: document.getElementById('btnCapture'),
  btnCaptureLabel: document.getElementById('btnCaptureLabel'),
  btnSwitchCamera: document.getElementById('btnSwitchCamera'),
  fileFallbackInput: document.getElementById('fileFallbackInput'),
  // Modal Elements
  confirmModal: document.getElementById('confirmModal'),
  watermarkedCanvas: document.getElementById('watermarkedCanvas'),
  modalBadge: document.getElementById('modalBadge'),
  modalTitle: document.getElementById('modalTitle'),
  modalDateVal: document.getElementById('modalDateVal'),
  modalTimeVal: document.getElementById('modalTimeVal'),
  modalPrevKmRow: document.getElementById('modalPrevKmRow'),
  modalPrevKmVal: document.getElementById('modalPrevKmVal'),
  kmInput: document.getElementById('kmInput'),
  kmInputLabel: document.getElementById('kmInputLabel'),
  kmInputHint: document.getElementById('kmInputHint'),
  locationInput: document.getElementById('locationInput'),
  btnConfirmSave: document.getElementById('btnConfirmSave'),
  btnRetake: document.getElementById('btnRetake'),
  btnCancelModal: document.getElementById('btnCancelModal'),
  // Tab & Table (Hỗ trợ cả bottom-nav-item)
  tabButtons: document.querySelectorAll('.bottom-nav-item, .tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  currentMonthDisplay: document.getElementById('currentMonthDisplay'),
  monthSelectDropdown: document.getElementById('monthSelectDropdown'),
  btnPrevMonth: document.getElementById('btnPrevMonth'),
  btnNextMonth: document.getElementById('btnNextMonth'),
  timesheetBody: document.getElementById('timesheetBody'),
  sumHours: document.getElementById('sumHours'),
  sumKm: document.getElementById('sumKm'),
  btnExportExcel: document.getElementById('btnExportExcel'),
  btnSyncOnline: document.getElementById('btnSyncOnline'),
  btnLoadSampleData: document.getElementById('btnLoadSampleData'),
  btnClearData: document.getElementById('btnClearData'),
  // Annual Summary
  currentYearDisplay: document.getElementById('currentYearDisplay'),
  btnPrevYear: document.getElementById('btnPrevYear'),
  btnNextYear: document.getElementById('btnNextYear'),
  annualBody: document.getElementById('annualBody'),
  yearTotalHours: document.getElementById('yearTotalHours'),
  yearTotalKm: document.getElementById('yearTotalKm'),
  // Settings & Edit Modals
  btnSettings: document.getElementById('btnSettings'),
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettings: document.getElementById('btnCloseSettings'),
  sheetApiUrl: document.getElementById('sheetApiUrl'),
  btnSaveSettings: document.getElementById('btnSaveSettings'),
  btnTestSheetConnection: document.getElementById('btnTestSheetConnection'),
  editModal: document.getElementById('editModal'),
  btnCloseEdit: document.getElementById('btnCloseEdit'),
  btnSaveEdit: document.getElementById('btnSaveEdit'),
  editModalTitle: document.getElementById('editModalTitle'),
  editDayInput: document.getElementById('editDayInput'),
  editDayLabel: document.getElementById('editDayLabel'),
  editCheckIn: document.getElementById('editCheckIn'),
  editCheckOut: document.getElementById('editCheckOut'),
  editKmIn: document.getElementById('editKmIn'),
  editKmOut: document.getElementById('editKmOut'),
  editNote: document.getElementById('editNote'),
  toastContainer: document.getElementById('toastContainer')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initLiveClock();
  populateMonthDropdown();
  loadMonthData();
  initCamera();
  setupEventListeners();
  setupNetworkSyncListeners();
  updateTodayShiftStatus();
  renderTimesheetTable();
  renderAnnualSummaryTable();
  updateSyncStatusUI();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('PWA Service Worker đã sẵn sàng'))
      .catch((err) => console.log('Lỗi Service Worker:', err));
  }

  if (AppState.scriptUrl) {
    elements.sheetApiUrl.value = AppState.scriptUrl;
  }

  // Khởi động theo dõi vị trí GPS ngay khi mở app
  initGeolocation();

  if (navigator.onLine && AppState.scriptUrl) {
    if (AppState.offlineQueue.length > 0) {
      processOfflineSyncQueue().then(() => fetchLiveDataFromSheets(true));
    } else {
      fetchLiveDataFromSheets(true);
    }
  }
});

// --- Geolocation & Reverse Geocoding (hỗ trợ Offline) ---
function initGeolocation() {
  if (!navigator.geolocation) {
    console.warn('Trình duyệt không hỗ trợ GPS');
    return;
  }
  // Lấy vị trí ngay khi mở app, cache lại để dùng offline
  updateCurrentLocation();
  // Cập nhật vị trí mỗi 60 giây khi có mạng
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      updateCurrentLocation();
    }
  }, 60000);
}

async function reverseGeocodeCoords(lat, lon) {
  // 1. Thử dịch vụ BigDataCloud (Miễn phí, cực nhanh, chuẩn tiếng Việt cho mobile)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=vi`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const parts = [bdcData.locality, bdcData.city || bdcData.principalSubdivision].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (e) {
    console.warn('BigDataCloud geocode lỗi, chuyển sang nguồn phụ:', e);
  }

  // 2. Nguồn phụ: OpenStreetMap Nominatim
  try {
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi&zoom=18`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (osmRes.ok) {
      const data = await osmRes.json();
      if (data && data.display_name) {
        const a = data.address || {};
        const parts = [a.road, a.suburb || a.quarter || a.neighbourhood, a.city || a.town || a.village || a.county].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',');
      }
    }
  } catch (e) {
    console.warn('Nominatim geocode lỗi:', e);
  }

  return '';
}

function updateCurrentLocation(onSuccessCallback) {
  if (!navigator.geolocation) return;
  if (AppState.isGettingLocation) return;
  AppState.isGettingLocation = true;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      AppState.lastKnownCoords = coords;
      localStorage.setItem('chamcong_last_coords', JSON.stringify(coords));

      if (navigator.onLine) {
        const address = await reverseGeocodeCoords(coords.lat, coords.lon);
        if (address) {
          AppState.lastKnownAddress = address;
          localStorage.setItem('chamcong_last_address', address);
          if (typeof onSuccessCallback === 'function') {
            onSuccessCallback(address);
          }
        }
      }
      AppState.isGettingLocation = false;
    },
    (err) => {
      console.warn('GPS lỗi hoặc chưa được cấp quyền:', err.message);
      AppState.isGettingLocation = false;
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
}

function getCurrentLocationString() {
  // Lấy vị trí ưu tiên: từ ô nhập tay trong modal (nếu có) -> từ Geocode tự động
  if (elements.locationInput && elements.locationInput.value.trim()) {
    const customLoc = elements.locationInput.value.trim();
    return customLoc.startsWith('📍') ? customLoc : '📍 ' + customLoc;
  }
  if (AppState.lastKnownAddress) {
    return '📍 ' + AppState.lastKnownAddress;
  }
  // Tuyệt đối không hiển thị tọa độ GPS số thô khó đọc
  return '';
}

// --- Live Clock & Date ---
function initLiveClock() {
  const updateClock = () => {
    const now = new Date();
    AppState.currentDate = now;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;

    if (elements.headerLiveClock) {
      elements.headerLiveClock.textContent = timeStr;
    }
    if (elements.liveBadgeTime) {
      elements.liveBadgeTime.textContent = `🕒 ${timeStr}`;
    }

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeek = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    if (elements.currentDateDisplay) {
      elements.currentDateDisplay.textContent = `${dayOfWeek}, ${day}/${month}/${year}`;
    }
    if (elements.liveBadgeDate) {
      elements.liveBadgeDate.textContent = `📅 ${day}/${month}/${year}`;
    }
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// --- Multi-month Dropdown Helper ---
function populateMonthDropdown() {
  let html = '';
  const currentY = AppState.selectedYear;
  for (let m = 1; m <= 12; m++) {
    const mStr = String(m).padStart(2, '0');
    const selected = (m === AppState.selectedMonth) ? 'selected' : '';
    html += `<option value="${m}" ${selected}>Tháng ${mStr} / ${currentY}</option>`;
  }
  elements.monthSelectDropdown.innerHTML = html;
}

// --- Data Persistence (LocalStorage) ---
function getStorageKey(year, month) {
  return `chamcong_data_${year}_${String(month).padStart(2, '0')}`;
}

function loadMonthData() {
  const key = getStorageKey(AppState.selectedYear, AppState.selectedMonth);
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      AppState.monthData = JSON.parse(saved);
    } catch (e) {
      AppState.monthData = {};
    }
  } else {
    AppState.monthData = {};
  }
}

function saveMonthData() {
  const key = getStorageKey(AppState.selectedYear, AppState.selectedMonth);
  localStorage.setItem(key, JSON.stringify(AppState.monthData));
  updateTodayShiftStatus();
  renderTimesheetTable();
  renderAnnualSummaryTable();
}

// --- HÀM HỢP NHẤT DỮ LIỆU AN TOÀN (BẢO VỆ DỮ LIỆU TUYỆT ĐỐI) ---
function mergeRemoteData(remoteData) {
  if (!remoteData || typeof remoteData !== 'object') return;

  const remoteKeys = Object.keys(remoteData);
  const localKeys = Object.keys(AppState.monthData);

  // Nếu Sheets rỗng mà trên App đang có dữ liệu -> KHÔNG ĐƯỢC XÓA APP, mà tự động đẩy lên Sheets!
  if (remoteKeys.length === 0 && localKeys.length > 0) {
    console.log('Google Sheets chưa có dữ liệu, giữ nguyên App và tự động đẩy lên Sheets.');
    if (navigator.onLine && AppState.scriptUrl && !AppState.isSyncing) {
      syncWholeMonthDirectly();
    }
    return;
  }

  let hasChanged = false;
  const TOTAL_ROWS = 62;

  for (let d = 1; d <= TOTAL_ROWS; d++) {
    const remoteRec = remoteData[d];
    const localRec = AppState.monthData[d];

    if (remoteRec && (remoteRec.checkIn || remoteRec.checkOut || (remoteRec.kmIn !== null && remoteRec.kmIn !== '') || (remoteRec.kmOut !== null && remoteRec.kmOut !== '') || remoteRec.note || remoteRec.photoLink || (d > 31 && remoteRec.label))) {
      const freshRec = {
        label: remoteRec.label || (localRec ? localRec.label : (d <= 31 ? `Ngày ${d}` : `Ca 2 ngày ${d - 31}`)),
        checkIn: remoteRec.checkIn || '',
        checkOut: remoteRec.checkOut || '',
        kmIn: (remoteRec.kmIn !== undefined && remoteRec.kmIn !== null && remoteRec.kmIn !== '') ? remoteRec.kmIn : null,
        kmOut: (remoteRec.kmOut !== undefined && remoteRec.kmOut !== null && remoteRec.kmOut !== '') ? remoteRec.kmOut : null,
        note: remoteRec.note || '',
        photoLink: remoteRec.photoLink || (localRec ? localRec.photoLink : '')
      };

      if (!localRec || JSON.stringify(localRec) !== JSON.stringify(freshRec)) {
        AppState.monthData[d] = freshRec;
        hasChanged = true;
      }
    }
    // Nếu trên Sheets chưa có ngày d nhưng trên App ĐANG CÓ dữ liệu:
    // GIỮ NGUYÊN localRec, TUYỆT ĐỐI KHÔNG XÓA MẤT CỦA NGƯỜI DÙNG!
  }

  if (hasChanged) {
    saveMonthData();
  }
}

// --- Offline Queue & Network Auto-Sync ---
function setupNetworkSyncListeners() {
  window.addEventListener('online', () => {
    updateSyncStatusUI();
    showToast('📶 Đã có kết nối mạng! Đang tự động đồng bộ...', 'info');
    processOfflineSyncQueue().then(() => fetchLiveDataFromSheets(true));
  });

  window.addEventListener('offline', () => {
    updateSyncStatusUI();
    showToast('📵 Mất kết nối mạng. Ứng dụng chuyển sang chế độ Ngoại tuyến (Offline).', 'info');
  });

  // TỰ ĐỘNG ĐỒNG BỘ 2 CHIỀU ĐỊNH KỲ (Mỗi 12 giây một lần)
  setInterval(() => {
    // Nếu người dùng đang mở hộp thoại nhập/chỉnh sửa -> TẠM DỪNG đồng bộ ngầm để không giật màn hình
    if (elements.confirmModal.classList.contains('show') || elements.editModal.classList.contains('show')) {
      return;
    }

    if (!navigator.onLine || !AppState.scriptUrl) return;

    if (AppState.offlineQueue.length > 0 && !AppState.isSyncing) {
      processOfflineSyncQueue();
      return;
    }

    if (document.visibilityState === 'visible' && !AppState.isSyncing && !AppState.isFetchingLive) {
      fetchLiveDataFromSheets(true);
    }
  }, 12000);

  // Kéo dữ liệu khi người dùng quay lại app (chỉ khi không mở modal)
  document.addEventListener('visibilitychange', () => {
    if (elements.confirmModal.classList.contains('show') || elements.editModal.classList.contains('show')) return;
    if (document.visibilityState === 'visible' && navigator.onLine && AppState.scriptUrl) {
      fetchLiveDataFromSheets(true);
    }
  });

  window.addEventListener('focus', () => {
    if (elements.confirmModal.classList.contains('show') || elements.editModal.classList.contains('show')) return;
    if (navigator.onLine && AppState.scriptUrl) {
      fetchLiveDataFromSheets(true);
    }
  });
}

function enqueueOfflineRecord(record) {
  AppState.offlineQueue.push(record);
  localStorage.setItem('chamcong_offline_queue', JSON.stringify(AppState.offlineQueue));
  updateSyncStatusUI();
}

function updateSyncStatusUI() {
  const isOnline = navigator.onLine;
  const queueLen = AppState.offlineQueue.length;

  if (AppState.isSyncing || AppState.isFetchingLive) {
    elements.btnSyncQueue.className = 'sync-status-pill syncing';
    elements.syncStatusText.textContent = 'Đang đồng bộ...';
    elements.syncQueueBadge.style.display = 'none';
    if (elements.onlineStatusBadge) {
      elements.onlineStatusBadge.className = 'online-status-badge';
      elements.onlineStatusBadge.innerHTML = '<span class="status-dot" style="background:#38bdf8"></span> Đang đồng bộ';
    }
    return;
  }

  if (!isOnline) {
    elements.btnSyncQueue.className = 'sync-status-pill offline';
    elements.syncStatusText.textContent = queueLen > 0 ? 'Offline (chờ mạng)' : 'Offline';
    if (elements.onlineStatusBadge) {
      elements.onlineStatusBadge.className = 'online-status-badge offline';
      elements.onlineStatusBadge.innerHTML = '<span class="status-dot"></span> Ngoại tuyến';
    }
  } else {
    if (queueLen > 0) {
      elements.btnSyncQueue.className = 'sync-status-pill offline';
      elements.syncStatusText.textContent = 'Chờ tải lên';
      if (elements.onlineStatusBadge) {
        elements.onlineStatusBadge.className = 'online-status-badge';
        elements.onlineStatusBadge.innerHTML = '<span class="status-dot" style="background:#f59e0b"></span> Có bản ghi chờ';
      }
    } else {
      elements.btnSyncQueue.className = 'sync-status-pill online';
      elements.syncStatusText.textContent = 'Đã đồng bộ';
      if (elements.onlineStatusBadge) {
        elements.onlineStatusBadge.className = 'online-status-badge';
        elements.onlineStatusBadge.innerHTML = '<span class="status-dot"></span> Trực tuyến';
      }
    }
  }

  if (queueLen > 0) {
    elements.syncQueueBadge.textContent = queueLen;
    elements.syncQueueBadge.style.display = 'inline-block';
  } else {
    elements.syncQueueBadge.style.display = 'none';
  }
}

// --- Đồng Bộ Hàng Chờ Lên Google Sheets ---
async function processOfflineSyncQueue() {
  if (!AppState.scriptUrl) {
    updateSyncStatusUI();
    return;
  }
  if (!navigator.onLine || AppState.offlineQueue.length === 0 || AppState.isSyncing) {
    return;
  }

  AppState.isSyncing = true;
  updateSyncStatusUI();

  const itemsToSend = [...AppState.offlineQueue];

  try {
    const payload = {
      action: 'sync_queue',
      items: itemsToSend
    };

    const response = await fetch(AppState.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result && result.status === 'success') {
      AppState.offlineQueue = AppState.offlineQueue.filter(item => !itemsToSend.some(sent => sent.id === item.id));
      localStorage.setItem('chamcong_offline_queue', JSON.stringify(AppState.offlineQueue));
      
      if (result.data && result.year === AppState.selectedYear && result.month === AppState.selectedMonth) {
        mergeRemoteData(result.data);
      }

      showToast(`☁️ Đã đồng bộ ${itemsToSend.length} bản ghi lên Google Sheets!`, 'success');
    }
  } catch (err) {
    console.warn('Đồng bộ hàng chờ thất bại, sẽ tự động thử lại:', err);
  } finally {
    AppState.isSyncing = false;
    updateSyncStatusUI();
  }
}

// --- KÉO DỮ LIỆU TỪ SHEETS VỀ APP (KHÔNG BAO GIỜ XÓA ĐÈ) ---
async function fetchLiveDataFromSheets(isSilent = false, year = AppState.selectedYear, month = AppState.selectedMonth) {
  // Đang mở hộp thoại nhập liệu -> dừng ngay
  if (elements.confirmModal.classList.contains('show') || elements.editModal.classList.contains('show')) {
    return;
  }

  if (!AppState.scriptUrl || !navigator.onLine || AppState.isFetchingLive) {
    return;
  }

  AppState.isFetchingLive = true;
  if (!isSilent) {
    elements.btnSyncOnline.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
  }

  try {
    const payload = {
      action: 'get_data',
      year: year,
      month: month
    };

    const res = await fetch(AppState.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result && result.status === 'success' && result.data) {
      if (year === AppState.selectedYear && month === AppState.selectedMonth) {
        mergeRemoteData(result.data);
        if (!isSilent) {
          showToast(`🟢 Đã kiểm tra & đồng bộ với Google Sheets!`, 'success');
        }
      } else {
        const storageKey = getStorageKey(year, month);
        localStorage.setItem(storageKey, JSON.stringify(result.data));
        renderAnnualSummaryTable();
      }
    }
  } catch (err) {
    console.warn('Lỗi lấy dữ liệu từ Sheets:', err);
    if (!isSilent) {
      showToast('⚠️ Không thể tải từ Google Sheets. Kiểm tra URL hoặc mạng!', 'error');
    }
  } finally {
    AppState.isFetchingLive = false;
    if (!isSilent) {
      elements.btnSyncOnline.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Đồng bộ ngay';
    }
    updateSyncStatusUI();
  }
}

// --- Status & Auto-Detect Shift Mode ---
function setShift(shiftNum) {
  AppState.activeShift = shiftNum;
  if (elements.btnShift1 && elements.btnShift2) {
    elements.btnShift1.classList.toggle('active', shiftNum === 1);
    elements.btnShift2.classList.toggle('active', shiftNum === 2);
  }
  updateTodayShiftStatus();
}

function updateTodayShiftStatus() {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (AppState.selectedMonth !== currentMonth || AppState.selectedYear !== currentYear) {
    return;
  }

  const rec1 = AppState.monthData[today] || {};
  const rec2Index = today + 31;
  const rec2 = AppState.monthData[rec2Index] || {};

  // Tự động chuyển sang Ca 2 nếu hôm nay Ca 1 đã hoàn thành cả Check-in và Check-out
  // và người dùng chưa có thao tác chọn tay khác
  if (rec1.checkIn && rec1.checkOut && !rec2.checkIn && AppState.activeShift === 1 && !AppState.manualShiftPicked) {
    AppState.activeShift = 2;
  }

  const isShift2 = (AppState.activeShift === 2);
  if (elements.btnShift1 && elements.btnShift2) {
    elements.btnShift1.classList.toggle('active', !isShift2);
    elements.btnShift2.classList.toggle('active', isShift2);
  }

  const currentRec = isShift2 ? rec2 : rec1;
  const shiftTitle = isShift2 ? 'Ca 2' : 'Ca 1';

  let currentMode = elements.modeRadioIn && elements.modeRadioIn.checked ? 'in' : 'out';

  if (!currentRec.checkIn) {
    if (elements.modeRadioIn) elements.modeRadioIn.checked = true;
    currentMode = 'in';
    elements.btnCaptureLabel.textContent = `Chụp Check-in (${shiftTitle})`;
    elements.actionIndicatorText.textContent = `Hôm nay (Ngày ${today}) chưa check-in ${shiftTitle}. Bấm nút để chụp giờ vào ca & Km đầu.`;
  } else if (currentRec.checkIn && !currentRec.checkOut) {
    if (elements.modeRadioOut) elements.modeRadioOut.checked = true;
    currentMode = 'out';
    elements.btnCaptureLabel.textContent = `Chụp Check-out (${shiftTitle})`;
    elements.actionIndicatorText.textContent = `Đã vào ${shiftTitle} lúc ${currentRec.checkIn} (Km: ${currentRec.kmIn ? Number(currentRec.kmIn).toLocaleString() : '---'}). Bấm nút để chụp Tan ca & Km sau.`;
  } else {
    if (elements.modeRadioOut) elements.modeRadioOut.checked = true;
    currentMode = 'out';
    elements.btnCaptureLabel.textContent = `Chụp Cập Nhật (${shiftTitle})`;
    elements.actionIndicatorText.textContent = `Đã hoàn thành ${shiftTitle} hôm nay (Vào: ${currentRec.checkIn} | Về: ${currentRec.checkOut}).`;
  }

  // Cập nhật Live Watermark Badge dưới nút chụp
  updateLiveWatermarkBadgeUI(currentMode, isShift2, currentRec);
}

function updateLiveWatermarkBadgeUI(mode, isShift2, record = {}) {
  if (!elements.liveWatermarkBadge) return;
  const isOut = (mode === 'out');
  elements.liveWatermarkBadge.classList.toggle('out', isOut);

  if (elements.liveBadgeTag) {
    elements.liveBadgeTag.className = `badge-tag ${isOut ? 'out' : 'in'}`;
    elements.liveBadgeTag.textContent = isOut
      ? (isShift2 ? '🟠 CHECK OUT CA 2 (GIỜ TAN CA)' : '🟠 CHECK OUT (GIỜ TAN CA)')
      : (isShift2 ? '🟢 CHECK IN CA 2 (GIỜ VÀO LÀM)' : '🟢 CHECK IN (GIỜ VÀO LÀM)');
  }

  if (elements.liveBadgeShift) {
    elements.liveBadgeShift.textContent = isShift2 ? 'Ca 2' : 'Ca 1';
  }

  if (elements.liveBadgeKm) {
    if (isOut && record.kmIn) {
      elements.liveBadgeKm.textContent = `🚗 ODO vào: ${Number(record.kmIn).toLocaleString()} KM (Chờ chụp lúc về)`;
    } else if (record.kmIn || record.kmOut) {
      const lastKm = record.kmOut || record.kmIn;
      elements.liveBadgeKm.textContent = `🚗 ODO gần nhất: ${Number(lastKm).toLocaleString()} KM`;
    } else {
      elements.liveBadgeKm.textContent = `🚗 ODO: Nhập công tơ mét sau khi chụp`;
    }
  }

  if (elements.liveBadgeLocation) {
    const locStr = getCurrentLocationString();
    elements.liveBadgeLocation.textContent = locStr || '📍 Đang lấy vị trí GPS...';
  }
}
    elements.actionIndicatorText.textContent = `Đã hoàn thành ${shiftTitle} hôm nay (Vào: ${currentRec.checkIn} | Về: ${currentRec.checkOut}).`;
  }
}

// --- Camera Handling ---
async function initCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    elements.cameraPlaceholder.style.display = 'flex';
    elements.cameraPlaceholder.innerHTML = '<i class="fa-solid fa-camera"></i><p>Trình duyệt chưa cấp quyền camera. Hãy dùng nút Chọn ảnh bên cạnh.</p>';
    return;
  }

  try {
    if (AppState.stream) {
      AppState.stream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
      video: {
        facingMode: AppState.facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    AppState.stream = await navigator.mediaDevices.getUserMedia(constraints);
    elements.cameraVideo.srcObject = AppState.stream;
    elements.cameraPlaceholder.style.display = 'none';
  } catch (err) {
    console.warn('Lỗi mở Camera:', err);
    elements.cameraPlaceholder.style.display = 'flex';
    elements.cameraPlaceholder.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b"></i>
      <p style="margin-top:8px">Không thể mở camera trực tiếp. Cần cấp quyền hoặc chạy link HTTPS.</p>
      <span style="font-size:11.5px;color:#94a3b8">Bấm nút <b>Icon Ảnh</b> bên cạnh để chụp ảnh native trực tiếp từ điện thoại.</span>
    `;
  }
}

function switchCamera() {
  AppState.facingMode = (AppState.facingMode === 'environment') ? 'user' : 'environment';
  initCamera();
  showToast(`Đã chuyển sang Camera ${AppState.facingMode === 'environment' ? 'sau' : 'trước'}`, 'info');
}

// --- Fallback File Capture ---
function handleFallbackCapture(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      processCapturedImage(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Trigger Photo Capture ---
function captureCurrentFrame() {
  if (elements.cameraVideo.srcObject && elements.cameraVideo.videoWidth > 0) {
    if (navigator.vibrate) navigator.vibrate(50);
    processCapturedImage(elements.cameraVideo);
  } else {
    elements.fileFallbackInput.click();
  }
}

// --- Process Photo & Render Watermark on Canvas ---
function processCapturedImage(sourceElement) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

  const mode = elements.modeRadioIn.checked ? 'in' : 'out';

  AppState.capturedTimeStr = timeStr;
  AppState.capturedDateStr = dateStr;
  AppState.capturedDay = day;
  AppState.capturedMonth = month;
  AppState.capturedYear = year;
  AppState.capturedMode = mode;

  const w = sourceElement.videoWidth || sourceElement.naturalWidth || 1280;
  const h = sourceElement.videoHeight || sourceElement.naturalHeight || 720;

  const canvas = elements.watermarkedCanvas;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(sourceElement, 0, 0, w, h);

  drawWatermarkOnCanvas(ctx, w, h, {
    date: dateStr,
    time: timeStr,
    mode: mode,
    shift: AppState.activeShift,
    km: '',
    location: getCurrentLocationString()
  });

  openConfirmationModal(mode, day, month, year, dateStr, timeStr);
}

// --- Draw Timestamp & Watermark Overlay (có Vị trí) ---
function drawWatermarkOnCanvas(ctx, w, h, data) {
  const scale = Math.max(w, h) / 1000;
  const badgeWidth = Math.min(w * 0.92, 540 * scale);
  const hasLocation = Boolean(data.location);
  const badgeHeight = (hasLocation ? 145 : 110) * scale;
  const margin = 24 * scale;
  const x = margin;
  const y = h - badgeHeight - margin;
  const radius = 16 * scale;

  ctx.save();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 15 * scale;
  ctx.shadowOffsetY = 4 * scale;

  ctx.beginPath();
  ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
  ctx.fill();

  ctx.strokeStyle = data.mode === 'in' ? '#10b981' : '#f59e0b';
  ctx.lineWidth = 3 * scale;
  ctx.stroke();

  ctx.shadowColor = 'transparent';
  ctx.textBaseline = 'top';

  const shiftLabel = (data.shift === 2) ? ' CA 2' : '';
  const tagColor = data.mode === 'in' ? '#34d399' : '#fbbf24';
  const tagText = data.mode === 'in' ? `🟢 CHECK IN${shiftLabel} (GIỜ VÀO LÀM)` : `🟠 CHECK OUT${shiftLabel} (GIỜ TAN CA)`;
  ctx.font = `bold ${16 * scale}px sans-serif`;
  ctx.fillStyle = tagColor;
  ctx.fillText(tagText, x + 20 * scale, y + 16 * scale);

  ctx.font = `bold ${24 * scale}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`🕒 ${data.time}  -  📅 ${data.date}`, x + 20 * scale, y + 42 * scale);

  ctx.font = `${18 * scale}px sans-serif`;
  ctx.fillStyle = '#93c5fd';
  const kmText = data.km ? `🚗 ODO: ${Number(data.km).toLocaleString()} KM` : `🚗 ODO: Đang xác nhận Km...`;
  ctx.fillText(kmText, x + 20 * scale, y + 76 * scale);

  // Dòng vị trí (nếu có)
  if (hasLocation) {
    ctx.font = `${14 * scale}px sans-serif`;
    ctx.fillStyle = '#a5b4fc';
    // Cắt ngắn nếu quá dài
    let locText = data.location;
    const maxW = badgeWidth - 40 * scale;
    while (ctx.measureText(locText).width > maxW && locText.length > 10) {
      locText = locText.slice(0, -4) + '...';
    }
    ctx.fillText(locText, x + 20 * scale, y + 110 * scale);
  }

  ctx.restore();
}

// --- Open Confirmation Modal with Prominent Km Input ---
function openConfirmationModal(mode, day, month, year, dateStr, timeStr) {
  elements.confirmModal.classList.add('show');
  const shiftText = (AppState.activeShift === 2) ? ' (Ca 2)' : '';

  if (mode === 'in') {
    elements.modalBadge.textContent = 'CHECK IN' + shiftText;
    elements.modalBadge.className = 'modal-badge';
    elements.modalTitle.textContent = 'Xác Nhận Giờ Vào Làm' + shiftText;
    elements.kmInputLabel.innerHTML = '<i class="fa-solid fa-gauge-high"></i> <span>Nhập số Km lúc đầu (bắt buộc):</span>';
    elements.kmInputHint.textContent = 'Nhập số công tơ mét xe lúc bạn bắt đầu ca làm việc.';
    elements.modalPrevKmRow.style.display = 'none';
  } else {
    elements.modalBadge.textContent = 'CHECK OUT' + shiftText;
    elements.modalBadge.className = 'modal-badge out';
    elements.modalTitle.textContent = 'Xác Nhận Giờ Tan Ca' + shiftText;
    elements.kmInputLabel.innerHTML = '<i class="fa-solid fa-gauge-high"></i> <span>Nhập số Km lúc sau (bắt buộc):</span>';
    elements.kmInputHint.textContent = 'Nhập số công tơ mét xe khi bạn kết thúc ca làm.';

    const targetDayIndex = (AppState.activeShift === 2) ? (day + 31) : day;
    const todayRecord = AppState.monthData[targetDayIndex];
    if (todayRecord && todayRecord.kmIn) {
      elements.modalPrevKmRow.style.display = 'flex';
      elements.modalPrevKmVal.textContent = `${Number(todayRecord.kmIn).toLocaleString()} km (lúc ${todayRecord.checkIn || '--'})`;
    } else {
      elements.modalPrevKmRow.style.display = 'none';
    }
  }

  elements.modalDateVal.textContent = `${dateStr} (Ngày ${day} Tháng ${month}${shiftText})`;
  elements.modalTimeVal.textContent = timeStr;

  // Điền sẵn địa chỉ nếu tự lấy được
  if (elements.locationInput) {
    elements.locationInput.value = AppState.lastKnownAddress || '';
    if (!elements.locationInput.value && navigator.geolocation) {
      updateCurrentLocation((newAddress) => {
        if (elements.locationInput && !elements.locationInput.value) {
          elements.locationInput.value = newAddress;
          redrawModalCanvas();
        }
      });
    }
  }

  elements.kmInput.value = '';
  setTimeout(() => {
    elements.kmInput.focus();
  }, 200);

  const redrawModalCanvas = () => {
    const kmVal = elements.kmInput.value.trim();
    const locVal = elements.locationInput ? elements.locationInput.value.trim() : '';
    const displayLoc = locVal ? (locVal.startsWith('📍') ? locVal : '📍 ' + locVal) : '';
    const canvas = elements.watermarkedCanvas;
    const ctx = canvas.getContext('2d');
    drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
      date: dateStr,
      time: timeStr,
      mode: mode,
      shift: AppState.activeShift,
      km: kmVal,
      location: displayLoc
    });
  };

  elements.kmInput.oninput = redrawModalCanvas;
  if (elements.locationInput) {
    elements.locationInput.oninput = redrawModalCanvas;
  }
}

function closeConfirmationModal() {
  elements.confirmModal.classList.remove('show');
}

// --- Save Action: Watermarked Image to Phone + Data to Excel / Sheets ---
async function handleConfirmAndSave() {
  const kmVal = elements.kmInput.value.trim();
  if (!kmVal) {
    showToast('⚠️ Vui lòng nhập số Km vào ô trống trước khi xác nhận!', 'error');
    elements.kmInput.focus();
    return;
  }

  const kmNum = parseFloat(kmVal);
  if (isNaN(kmNum) || kmNum < 0) {
    showToast('⚠️ Số Km không hợp lệ!', 'error');
    elements.kmInput.focus();
    return;
  }

  const day = AppState.capturedDay;
  const month = AppState.capturedMonth;
  const year = AppState.capturedYear;
  const mode = AppState.capturedMode;
  const shift = AppState.activeShift;
  const time = AppState.capturedTimeStr;
  const date = AppState.capturedDateStr;
  const targetDayIndex = (shift === 2) ? (day + 31) : day;

  const canvas = elements.watermarkedCanvas;
  const ctx = canvas.getContext('2d');
  drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
    date: date,
    time: time,
    mode: mode,
    shift: shift,
    km: kmNum,
    location: getCurrentLocationString()
  });

  try {
    saveCanvasImageToPhone(canvas, mode, date, time, shift);
  } catch (err) {
    console.error('Lỗi khi tải ảnh:', err);
  }

  if (AppState.selectedMonth !== month || AppState.selectedYear !== year) {
    AppState.selectedMonth = month;
    AppState.selectedYear = year;
    loadMonthData();
  }

  if (!AppState.monthData[targetDayIndex]) {
    AppState.monthData[targetDayIndex] = {
      label: (shift === 2) ? `Ca 2 ngày ${day}` : `Ngày ${day}`,
      checkIn: '',
      checkOut: '',
      kmIn: null,
      kmOut: null,
      note: ''
    };
  }

  if (mode === 'in') {
    AppState.monthData[targetDayIndex].checkIn = time;
    AppState.monthData[targetDayIndex].kmIn = kmNum;
  } else {
    AppState.monthData[targetDayIndex].checkOut = time;
    AppState.monthData[targetDayIndex].kmOut = kmNum;
  }

  // Tạo chuỗi ảnh Base64 nén nhẹ (~150KB - 250KB) để gửi lên Google Drive
  let imageBase64 = '';
  try {
    // Nén chất lượng JPEG 0.78 vừa nét căng vừa upload siêu tốc
    imageBase64 = canvas.toDataURL('image/jpeg', 0.78);
  } catch (err) {
    console.warn('Không thể chuyển canvas sang base64:', err);
  }

  saveMonthData();
  closeConfirmationModal();

  const syncRecordItem = {
    id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    year: year,
    month: month,
    day: day,
    shift: shift,
    type: mode,
    time: time,
    km: kmNum,
    imageBase64: imageBase64,
    timestamp: Date.now()
  };

  enqueueOfflineRecord(syncRecordItem);

  if (navigator.onLine && AppState.scriptUrl) {
    showToast('☁️ Đang tải dữ liệu & ảnh lên Google Drive...', 'info');
    processOfflineSyncQueue().then(() => fetchLiveDataFromSheets(true));
  } else {
    showToast('💾 Đã lưu ảnh vào máy & hàng chờ (sẽ tự động lên Drive & Sheets khi có mạng)!', 'success');
  }

  setTimeout(() => {
    switchTab('tab-timesheet');
    highlightDayRow(day);
  }, 400);
}

// --- Download Canvas to Phone Storage ---
function saveCanvasImageToPhone(canvas, mode, dateStr, timeStr, shift = 1) {
  const cleanDate = dateStr.replace(/\//g, '');
  const cleanTime = timeStr.replace(/:/g, '');
  const shiftPart = (shift === 2) ? '_Ca2' : '';
  const filename = `ChamCong_${mode === 'in' ? 'CheckIn' : 'CheckOut'}${shiftPart}_${cleanDate}_${cleanTime}.jpg`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/jpeg', 0.95);
}

// --- Timesheet Table Logic ---
function calculateDuration(inTime, outTime) {
  if (!inTime || !outTime) return '00:00:00';
  const [h1, m1, s1] = inTime.split(':').map(Number);
  const [h2, m2, s2] = outTime.split(':').map(Number);

  let sec1 = (h1 || 0) * 3600 + (m1 || 0) * 60 + (s1 || 0);
  let sec2 = (h2 || 0) * 3600 + (m2 || 0) * 60 + (s2 || 0);

  let diff = sec2 - sec1;
  if (diff < 0) diff += 24 * 3600;

  const h = String(Math.floor(diff / 3600)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function calculateKmDiff(kmIn, kmOut) {
  if (kmIn === null || kmIn === undefined || kmOut === null || kmOut === undefined) return 0;
  const diff = Number(kmOut) - Number(kmIn);
  return diff > 0 ? diff : 0;
}

function renderTimesheetTable() {
  const TOTAL_ROWS = 62;
  const currentDay = (AppState.selectedMonth === (new Date().getMonth() + 1) && AppState.selectedYear === new Date().getFullYear())
    ? new Date().getDate()
    : null;

  const mStr = String(AppState.selectedMonth).padStart(2, '0');
  elements.currentMonthDisplay.textContent = `Tháng ${mStr} / ${AppState.selectedYear}`;
  elements.monthSelectDropdown.value = AppState.selectedMonth;

  let totalSeconds = 0;
  let totalKm = 0;
  let rowsHtml = '';

  for (let idx = 1; idx <= TOTAL_ROWS; idx++) {
    const record = AppState.monthData[idx] || {};
    const checkIn = record.checkIn || '';
    const checkOut = record.checkOut || '';
    const kmIn = (record.kmIn !== undefined && record.kmIn !== null && record.kmIn !== '') ? record.kmIn : '';
    const kmOut = (record.kmOut !== undefined && record.kmOut !== null && record.kmOut !== '') ? record.kmOut : '';
    const note = record.note || '';
    const photoLink = record.photoLink || '';

    let label = record.label;
    if (!label) {
      if (idx <= 31) {
        label = `${idx}`;
      } else {
        label = `Ca 2 ngày ${idx - 31}`;
      }
    }

    const duration = calculateDuration(checkIn, checkOut);
    const kmDiff = calculateKmDiff(kmIn, kmOut);

    if (checkIn && checkOut) {
      const [h, m, s] = duration.split(':').map(Number);
      totalSeconds += (h * 3600 + m * 60 + s);
    }
    totalKm += kmDiff;

    const isToday = (idx === currentDay);
    const isShift2Row = (idx > 31);
    const hasData = Boolean(checkIn || checkOut || kmIn || kmOut || note || photoLink);

    // Format link ảnh hiển thị dạng nút bấm mở xem trực tiếp
    let photoHtml = '<span style="color:#64748b;font-size:11px;">--</span>';
    if (photoLink) {
      const links = photoLink.split('\n').filter(Boolean);
      photoHtml = links.map(line => {
        const parts = line.split(': http');
        if (parts.length > 1) {
          const title = parts[0];
          const url = 'http' + parts[1];
          return `<a href="${url}" target="_blank" class="table-photo-link" title="Xem ảnh"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${title}</a>`;
        }
        return `<a href="${line}" target="_blank" class="table-photo-link"><i class="fa-solid fa-image"></i> Xem ảnh</a>`;
      }).join('<br>');
    }

    rowsHtml += `
      <tr class="${isToday ? 'today-row' : ''} ${hasData ? 'filled-row' : ''} ${isShift2Row ? 'shift2-row' : ''}" id="row-day-${idx}">
        <td class="col-day" style="${isShift2Row ? 'color:#38bdf8;font-style:italic;' : ''}">${label}</td>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${kmIn !== '' ? Number(kmIn).toLocaleString() : ''}</td>
        <td>${kmOut !== '' ? Number(kmOut).toLocaleString() : ''}</td>
        <td style="font-weight:600; color: ${duration !== '00:00:00' ? '#38bdf8' : 'inherit'}">${duration}</td>
        <td style="font-weight:600; color: ${kmDiff > 0 ? '#34d399' : 'inherit'}">${kmDiff}</td>
        <td style="text-align:left; font-size:12px; color:#cbd5e1; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${note}</td>
        <td style="text-align:left; font-size:11px; white-space:nowrap;">${photoHtml}</td>
        <td class="col-act">
          <button onclick="openEditModal(${idx})" title="Sửa hàng này">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </td>
      </tr>
    `;
  }

  elements.timesheetBody.innerHTML = rowsHtml;

  const totH = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const totM = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const totS = String(totalSeconds % 60).padStart(2, '0');
  elements.sumHours.textContent = `${totH}:${totM}:${totS}`;
  elements.sumKm.textContent = `${totalKm.toLocaleString()} km`;
}

function highlightDayRow(day) {
  const row = document.getElementById(`row-day-${day}`);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
    setTimeout(() => {
      row.style.backgroundColor = '';
    }, 2500);
  }
}

// --- TAB 3: Annual Summary Table ---
function renderAnnualSummaryTable() {
  const year = AppState.selectedYear;
  elements.currentYearDisplay.textContent = `Tổng Hợp Năm ${year}`;

  let yearTotalSec = 0;
  let yearTotalKmAll = 0;
  let html = '';

  for (let m = 1; m <= 12; m++) {
    const key = getStorageKey(year, m);
    const raw = localStorage.getItem(key);
    let mData = {};
    if (raw) {
      try { mData = JSON.parse(raw); } catch(e) {}
    }

    let mSec = 0;
    let mKm = 0;
    let daysWithData = 0;

    const TOTAL_ROWS = 62;
    for (let d = 1; d <= TOTAL_ROWS; d++) {
      const rec = mData[d];
      if (rec && (rec.checkIn || rec.checkOut || rec.kmIn || rec.kmOut || rec.note)) {
        if (d <= 31) daysWithData++;
        if (rec.checkIn && rec.checkOut) {
          const dur = calculateDuration(rec.checkIn, rec.checkOut);
          const [h, mi, s] = dur.split(':').map(Number);
          mSec += (h * 3600 + mi * 60 + s);
        }
        if (rec.kmIn !== null && rec.kmOut !== null) {
          mKm += calculateKmDiff(rec.kmIn, rec.kmOut);
        }
      }
    }

    yearTotalSec += mSec;
    yearTotalKmAll += mKm;

    const mDurH = String(Math.floor(mSec / 3600)).padStart(2, '0');
    const mDurM = String(Math.floor((mSec % 3600) / 60)).padStart(2, '0');
    const mDurS = String(mSec % 60).padStart(2, '0');
    const mDurationStr = `${mDurH}:${mDurM}:${mDurS}`;

    const mStr = String(m).padStart(2, '0');
    const statusText = daysWithData > 0 ? `<span style="color:#10b981;font-weight:600">${daysWithData} ngày</span>` : `<span style="color:#64748b">Chưa có</span>`;

    html += `
      <tr>
        <td style="text-align: left; padding-left: 14px; font-weight:700; color:#38bdf8;">Tháng ${mStr}/${year}</td>
        <td>${statusText}</td>
        <td style="font-weight:600; color:${mSec > 0 ? '#38bdf8' : 'inherit'}">${mDurationStr}</td>
        <td style="font-weight:600; color:${mKm > 0 ? '#34d399' : 'inherit'}">${mKm.toLocaleString()} km</td>
        <td>
          <button class="action-btn sync-btn" style="padding:4px 8px;font-size:11px" onclick="jumpToMonth(${m})">
            Mở xem
          </button>
        </td>
      </tr>
    `;
  }

  elements.annualBody.innerHTML = html;

  const yH = String(Math.floor(yearTotalSec / 3600)).padStart(2, '0');
  const yM = String(Math.floor((yearTotalSec % 3600) / 60)).padStart(2, '0');
  const yS = String(yearTotalSec % 60).padStart(2, '0');
  elements.yearTotalHours.textContent = `${yH}:${yM}:${yS}`;
  elements.yearTotalKm.textContent = `${yearTotalKmAll.toLocaleString()} km`;
}

window.jumpToMonth = function(m) {
  AppState.selectedMonth = m;
  loadMonthData();
  renderTimesheetTable();
  switchTab('tab-timesheet');
  if (navigator.onLine && AppState.scriptUrl) {
    fetchLiveDataFromSheets(true);
  }
};

// --- Edit Row Modal (Đồng Bộ Ngay Khi Sửa Bảng Trên App) ---
window.openEditModal = function(idx) {
  const record = AppState.monthData[idx] || {};
  elements.editDayInput.value = idx;

  let defaultLabel = record.label;
  if (!defaultLabel) {
    defaultLabel = (idx <= 31) ? `Ngày ${idx}` : `Ca 2 ngày ${idx - 31}`;
  }
  elements.editDayLabel.value = defaultLabel;
  elements.editModalTitle.textContent = `Chỉnh Sửa Dữ Liệu: ${defaultLabel}`;
  elements.editCheckIn.value = record.checkIn || '';
  elements.editCheckOut.value = record.checkOut || '';
  elements.editKmIn.value = (record.kmIn !== undefined && record.kmIn !== null) ? record.kmIn : '';
  elements.editKmOut.value = (record.kmOut !== undefined && record.kmOut !== null) ? record.kmOut : '';
  elements.editNote.value = record.note || '';
  elements.editModal.classList.add('show');
};

async function saveEditRow() {
  const idx = parseInt(elements.editDayInput.value, 10);
  if (!idx) return;

  const label = elements.editDayLabel.value.trim();
  const checkIn = elements.editCheckIn.value.trim();
  const checkOut = elements.editCheckOut.value.trim();
  const kmIn = elements.editKmIn.value.trim() !== '' ? parseFloat(elements.editKmIn.value.trim()) : null;
  const kmOut = elements.editKmOut.value.trim() !== '' ? parseFloat(elements.editKmOut.value.trim()) : null;
  const note = elements.editNote.value.trim();

  AppState.monthData[idx] = {
    label,
    checkIn,
    checkOut,
    kmIn,
    kmOut,
    note
  };

  saveMonthData();
  elements.editModal.classList.remove('show');

  const rowUpdateItem = {
    id: 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    year: AppState.selectedYear,
    month: AppState.selectedMonth,
    day: idx,
    type: 'row',
    checkIn: checkIn,
    checkOut: checkOut,
    kmIn: kmIn,
    kmOut: kmOut,
    note: note,
    timestamp: Date.now()
  };

  if (navigator.onLine && AppState.scriptUrl) {
    showToast(`🔄 Đang cập nhật ${label} lên Google Sheets...`, 'info');
    try {
      AppState.isSyncing = true;
      updateSyncStatusUI();

      const res = await fetch(AppState.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'update_row',
          year: AppState.selectedYear,
          month: AppState.selectedMonth,
          day: idx,
          checkIn: checkIn,
          checkOut: checkOut,
          kmIn: kmIn,
          kmOut: kmOut,
          note: note
        })
      });

      const result = await res.json();
      if (result && result.status === 'success' && result.data) {
        mergeRemoteData(result.data);
        showToast(`✅ Google Sheets đã cập nhật!`, 'success');
      } else {
        enqueueOfflineRecord(rowUpdateItem);
      }
    } catch (err) {
      enqueueOfflineRecord(rowUpdateItem);
      showToast(`⚠️ Không kết nối được Sheets, đã lưu hàng chờ`, 'info');
    } finally {
      AppState.isSyncing = false;
      updateSyncStatusUI();
    }
  } else {
    enqueueOfflineRecord(rowUpdateItem);
    showToast(`💾 Đã lưu thay đổi (sẽ tự động lên Google Sheets khi có mạng)!`, 'success');
  }
}

// --- Export to CSV / Excel ---
function exportToCsv() {
  const daysInMonth = 31;
  let csv = '\uFEFFNgày,Check in,Check out,Km in,Km out,Giờ làm,Km đi được\r\n';

  let totalSeconds = 0;
  let totalKm = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const record = AppState.monthData[day] || {};
    const checkIn = record.checkIn || '';
    const checkOut = record.checkOut || '';
    const kmIn = record.kmIn !== undefined && record.kmIn !== null ? record.kmIn : '';
    const kmOut = record.kmOut !== undefined && record.kmOut !== null ? record.kmOut : '';
    const duration = calculateDuration(checkIn, checkOut);
    const kmDiff = calculateKmDiff(kmIn, kmOut);

    if (checkIn && checkOut) {
      const [h, m, s] = duration.split(':').map(Number);
      totalSeconds += (h * 3600 + m * 60 + s);
    }
    totalKm += kmDiff;

    csv += `${day},${checkIn},${checkOut},${kmIn},${kmOut},${duration},${kmDiff}\r\n`;
  }

  const totH = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const totM = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const totS = String(totalSeconds % 60).padStart(2, '0');
  const totalDuration = `${totH}:${totM}:${totS}`;

  csv += `,,,,,, \r\n`;
  csv += `,,,,,Tổng giờ làm,Tổng Km đi\r\n`;
  csv += `,,,,,, \r\n`;
  csv += `,,,,,${totalDuration},${totalKm}\r\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BangChamCong_Thang${AppState.selectedMonth}_${AppState.selectedYear}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('📥 Đã xuất file Excel/CSV thành công!', 'success');
}

// --- Tabs Switching ---
function switchTab(tabId) {
  elements.tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  elements.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });
  if (tabId === 'tab-year-summary') {
    renderAnnualSummaryTable();
  }
}

// --- Toast Notification ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- Setup Event Listeners ---
function setupEventListeners() {
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  elements.modeRadioIn.addEventListener('change', () => {
    const shiftTitle = (AppState.activeShift === 2) ? ' (Ca 2)' : '';
    elements.btnCaptureLabel.textContent = `Chụp Check-in Giờ Vào${shiftTitle}`;
    updateTodayShiftStatus();
  });
  elements.modeRadioOut.addEventListener('change', () => {
    const shiftTitle = (AppState.activeShift === 2) ? ' (Ca 2)' : '';
    elements.btnCaptureLabel.textContent = `Chụp Check-out Tan Ca${shiftTitle}`;
    updateTodayShiftStatus();
  });

  if (elements.btnShift1) {
    elements.btnShift1.addEventListener('click', () => {
      AppState.manualShiftPicked = true;
      setShift(1);
    });
  }
  if (elements.btnShift2) {
    elements.btnShift2.addEventListener('click', () => {
      AppState.manualShiftPicked = true;
      setShift(2);
    });
  }

  elements.btnSaveEdit.addEventListener('click', saveEditRow);
  elements.btnCloseEdit.addEventListener('click', () => elements.editModal.classList.remove('show'));

  elements.btnCapture.addEventListener('click', captureCurrentFrame);
  elements.btnSwitchCamera.addEventListener('click', switchCamera);
  elements.fileFallbackInput.addEventListener('change', handleFallbackCapture);

  elements.btnConfirmSave.addEventListener('click', handleConfirmAndSave);
  elements.btnRetake.addEventListener('click', closeConfirmationModal);
  elements.btnCancelModal.addEventListener('click', closeConfirmationModal);

  elements.kmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleConfirmAndSave();
    }
  });

  elements.btnPrevMonth.addEventListener('click', () => {
    if (AppState.selectedMonth === 1) {
      AppState.selectedMonth = 12;
      AppState.selectedYear--;
      populateMonthDropdown();
    } else {
      AppState.selectedMonth--;
    }
    loadMonthData();
    renderTimesheetTable();
    if (navigator.onLine && AppState.scriptUrl) {
      fetchLiveDataFromSheets(true);
    }
  });

  elements.btnNextMonth.addEventListener('click', () => {
    if (AppState.selectedMonth === 12) {
      AppState.selectedMonth = 1;
      AppState.selectedYear++;
      populateMonthDropdown();
    } else {
      AppState.selectedMonth++;
    }
    loadMonthData();
    renderTimesheetTable();
    if (navigator.onLine && AppState.scriptUrl) {
      fetchLiveDataFromSheets(true);
    }
  });

  elements.monthSelectDropdown.addEventListener('change', (e) => {
    AppState.selectedMonth = parseInt(e.target.value, 10);
    loadMonthData();
    renderTimesheetTable();
    if (navigator.onLine && AppState.scriptUrl) {
      fetchLiveDataFromSheets(true);
    }
  });

  elements.btnPrevYear.addEventListener('click', () => {
    AppState.selectedYear--;
    populateMonthDropdown();
    loadMonthData();
    renderTimesheetTable();
    renderAnnualSummaryTable();
  });

  elements.btnNextYear.addEventListener('click', () => {
    AppState.selectedYear++;
    populateMonthDropdown();
    loadMonthData();
    renderTimesheetTable();
    renderAnnualSummaryTable();
  });

  elements.btnExportExcel.addEventListener('click', exportToCsv);
  
  elements.btnSyncOnline.addEventListener('click', async () => {
    if (!AppState.scriptUrl) {
      elements.settingsModal.classList.add('show');
      showToast('⚠️ Vui lòng cấu hình URL Google Sheets trước', 'error');
      return;
    }
    if (!navigator.onLine) {
      showToast('📵 Đang ngoại tuyến', 'error');
      return;
    }
    showToast('🔄 Đang kiểm tra & đồng bộ 2 chiều với Google Sheets...', 'info');
    if (AppState.offlineQueue.length > 0) {
      await processOfflineSyncQueue();
    }
    await fetchLiveDataFromSheets(false);
  });

  elements.btnSyncQueue.addEventListener('click', async () => {
    if (!AppState.scriptUrl) {
      elements.settingsModal.classList.add('show');
      showToast('⚠️ Vui lòng cấu hình URL Google Sheets trước', 'error');
      return;
    }
    if (!navigator.onLine) {
      showToast(`📵 Ngoại tuyến. Có ${AppState.offlineQueue.length} bản ghi chờ có mạng để tự tải lên.`, 'info');
      return;
    }
    showToast('🔄 Đang đồng bộ 2 chiều...', 'info');
    if (AppState.offlineQueue.length > 0) {
      await processOfflineSyncQueue();
    }
    await fetchLiveDataFromSheets(false);
  });

  elements.btnLoadSampleData.addEventListener('click', () => {
    AppState.monthData = JSON.parse(JSON.stringify(USER_SAMPLE_DATA));
    saveMonthData();
    showToast('✨ Đã nạp dữ liệu mẫu ví dụ của bạn!', 'success');
    if (navigator.onLine && AppState.scriptUrl) {
      syncWholeMonthDirectly();
    }
  });

  elements.btnClearData.addEventListener('click', () => {
    if (confirm(`Bạn có chắc muốn xóa tất cả dữ liệu tháng ${AppState.selectedMonth}/${AppState.selectedYear}?`)) {
      AppState.monthData = {};
      saveMonthData();
      showToast('🗑️ Đã xóa dữ liệu tháng này', 'info');
    }
  });

  elements.btnSettings.addEventListener('click', () => {
    elements.sheetApiUrl.value = AppState.scriptUrl;
    elements.settingsModal.classList.add('show');
  });
  elements.btnCloseSettings.addEventListener('click', () => {
    elements.settingsModal.classList.remove('show');
  });
  elements.btnSaveSettings.addEventListener('click', () => {
    const url = elements.sheetApiUrl.value.trim();
    AppState.scriptUrl = url;
    localStorage.setItem('chamcong_sheet_api_url', url);
    elements.settingsModal.classList.remove('show');
    showToast('💾 Đã lưu cấu hình Google Sheets Online!', 'success');
    if (AppState.offlineQueue.length > 0 && navigator.onLine) {
      processOfflineSyncQueue().then(() => fetchLiveDataFromSheets(true));
    } else if (navigator.onLine) {
      fetchLiveDataFromSheets(true);
    }
  });

  elements.btnTestSheetConnection.addEventListener('click', async () => {
    const url = elements.sheetApiUrl.value.trim();
    if (!url) {
      showToast('Vui lòng nhập URL trước khi thử nghiệm', 'error');
      return;
    }
    showToast('Đang kiểm tra kết nối...', 'info');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        showToast('✅ Kết nối Google Sheets thành công!', 'success');
      } else {
        showToast('⚠️ Phản hồi: ' + JSON.stringify(data), 'info');
      }
    } catch (err) {
      showToast('⚠️ Không kết nối được. Kiểm tra quyền "Bất kỳ ai (Anyone)" của Apps Script!', 'error');
    }
  });

  elements.btnCloseEdit.addEventListener('click', () => elements.editModal.classList.remove('show'));
  elements.btnSaveEdit.addEventListener('click', saveEditRow);
}

// --- Bulk Sync Whole Month to Sheets ---
async function syncWholeMonthDirectly() {
  if (!AppState.scriptUrl || !navigator.onLine) return;
  try {
    AppState.isSyncing = true;
    updateSyncStatusUI();
    const payload = {
      action: 'sync_month',
      year: AppState.selectedYear,
      month: AppState.selectedMonth,
      data: AppState.monthData
    };
    const res = await fetch(AppState.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result && result.status === 'success') {
      if (result.data) {
        mergeRemoteData(result.data);
      }
      showToast(`✅ Đã đồng bộ toàn bộ tháng ${AppState.selectedMonth}/${AppState.selectedYear} lên Google Sheets!`, 'success');
    }
  } catch (err) {
    showToast('⚠️ Lỗi khi đồng bộ toàn bộ tháng.', 'error');
  } finally {
    AppState.isSyncing = false;
    updateSyncStatusUI();
  }
}
