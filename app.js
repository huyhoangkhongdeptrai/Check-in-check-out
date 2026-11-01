/**
 * =========================================================================
 * CHẤM CÔNG & KM - ỨNG DỤNG ANDROID / PWA (HỖ TRỢ OFFLINE & AUTO-SYNC)
 * Tự động chuyển tháng mới, lưu trữ cả năm, tự động đồng bộ Google Sheets khi có mạng
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
  scriptUrl: localStorage.getItem('chamcong_sheet_api_url') || '',
  monthData: {},
  offlineQueue: JSON.parse(localStorage.getItem('chamcong_offline_queue') || '[]'),
  isSyncing: false
};

// --- Sample Data (Từ file ví dụ người dùng cung cấp) ---
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
  liveClock: document.getElementById('liveClock'),
  currentDateDisplay: document.getElementById('currentDateDisplay'),
  onlineStatusBadge: document.getElementById('onlineStatusBadge'),
  btnSyncQueue: document.getElementById('btnSyncQueue'),
  syncStatusText: document.getElementById('syncStatusText'),
  syncQueueBadge: document.getElementById('syncQueueBadge'),
  todaySummaryCard: document.getElementById('todaySummaryCard'),
  todayCheckInTime: document.getElementById('todayCheckInTime'),
  todayKmIn: document.getElementById('todayKmIn'),
  todayCheckOutTime: document.getElementById('todayCheckOutTime'),
  todayKmOut: document.getElementById('todayKmOut'),
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
  btnConfirmSave: document.getElementById('btnConfirmSave'),
  btnRetake: document.getElementById('btnRetake'),
  btnCancelModal: document.getElementById('btnCancelModal'),
  // Tab & Table
  tabButtons: document.querySelectorAll('.tab-btn'),
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
  editCheckIn: document.getElementById('editCheckIn'),
  editCheckOut: document.getElementById('editCheckOut'),
  editKmIn: document.getElementById('editKmIn'),
  editKmOut: document.getElementById('editKmOut'),
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

  // Đăng ký Service Worker cho PWA Android
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('PWA Service Worker đã sẵn sàng'))
      .catch((err) => console.log('Lỗi Service Worker:', err));
  }

  // Load URL Google Sheets đã lưu
  if (AppState.scriptUrl) {
    elements.sheetApiUrl.value = AppState.scriptUrl;
  }

  // Nếu mở app mà có mạng và có hàng chờ offline -> tự động đồng bộ ngay
  if (navigator.onLine && AppState.offlineQueue.length > 0) {
    processOfflineSyncQueue();
  }
});

// --- Live Clock & Date ---
function initLiveClock() {
  const updateClock = () => {
    const now = new Date();
    AppState.currentDate = now;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    elements.liveClock.textContent = `${hours}:${minutes}:${seconds}`;

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeek = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    elements.currentDateDisplay.textContent = `${dayOfWeek}, ${day}/${month}/${year}`;
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

// --- Offline Queue & Network Auto-Sync ---
function setupNetworkSyncListeners() {
  window.addEventListener('online', () => {
    updateSyncStatusUI();
    showToast('📶 Đã có kết nối mạng! Đang tự động tải dữ liệu lên Google Sheets...', 'info');
    processOfflineSyncQueue();
  });

  window.addEventListener('offline', () => {
    updateSyncStatusUI();
    showToast('📵 Mất kết nối mạng. Ứng dụng đã chuyển sang chế độ Offline (ảnh và dữ liệu lưu an toàn trên máy).', 'info');
  });

  // Tự động thử lại mỗi 25 giây nếu còn hàng chờ và đang online
  setInterval(() => {
    if (navigator.onLine && AppState.offlineQueue.length > 0 && !AppState.isSyncing) {
      processOfflineSyncQueue();
    }
  }, 25000);
}

function enqueueOfflineRecord(record) {
  AppState.offlineQueue.push(record);
  localStorage.setItem('chamcong_offline_queue', JSON.stringify(AppState.offlineQueue));
  updateSyncStatusUI();
}

function updateSyncStatusUI() {
  const isOnline = navigator.onLine;
  const queueLen = AppState.offlineQueue.length;

  if (AppState.isSyncing) {
    elements.btnSyncQueue.className = 'sync-status-pill syncing';
    elements.syncStatusText.textContent = 'Đang đồng bộ...';
    elements.syncQueueBadge.style.display = 'none';
    elements.onlineStatusBadge.innerHTML = '<span class="status-dot" style="background:#38bdf8"></span> Đang đồng bộ';
    return;
  }

  if (!isOnline) {
    elements.btnSyncQueue.className = 'sync-status-pill offline';
    elements.syncStatusText.textContent = queueLen > 0 ? 'Offline (chờ mạng)' : 'Offline';
    elements.onlineStatusBadge.innerHTML = '<span class="status-dot" style="background:#ef4444"></span> Ngoại tuyến';
  } else {
    if (queueLen > 0) {
      elements.btnSyncQueue.className = 'sync-status-pill offline';
      elements.syncStatusText.textContent = 'Chờ đồng bộ';
      elements.onlineStatusBadge.innerHTML = '<span class="status-dot" style="background:#f59e0b"></span> Có bản ghi chờ';
    } else {
      elements.btnSyncQueue.className = 'sync-status-pill online';
      elements.syncStatusText.textContent = 'Đã đồng bộ';
      elements.onlineStatusBadge.innerHTML = '<span class="status-dot"></span> Trực tuyến';
    }
  }

  if (queueLen > 0) {
    elements.syncQueueBadge.textContent = queueLen;
    elements.syncQueueBadge.style.display = 'inline-block';
  } else {
    elements.syncQueueBadge.style.display = 'none';
  }
}

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
      // Đã đồng bộ thành công -> xóa các item đã gửi khỏi queue
      AppState.offlineQueue = AppState.offlineQueue.filter(item => !itemsToSend.some(sent => sent.id === item.id));
      localStorage.setItem('chamcong_offline_queue', JSON.stringify(AppState.offlineQueue));
      showToast(`☁️ Đã tự động đồng bộ ${itemsToSend.length} bản ghi lên Google Sheets!`, 'success');
    }
  } catch (err) {
    console.warn('Đồng bộ thất bại, sẽ tự động thử lại khi có mạng ổn định:', err);
  } finally {
    AppState.isSyncing = false;
    updateSyncStatusUI();
  }
}

// --- Status & Auto-Detect Shift Mode ---
function updateTodayShiftStatus() {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Chỉ phản ánh trạng thái hôm nay khi người dùng đang xem tháng và năm hiện tại
  if (AppState.selectedMonth !== currentMonth || AppState.selectedYear !== currentYear) {
    return;
  }

  const record = AppState.monthData[today] || {};
  elements.todayCheckInTime.textContent = record.checkIn || '--:--:--';
  elements.todayKmIn.textContent = record.kmIn ? `Km: ${record.kmIn.toLocaleString()}` : 'Km: ---';
  elements.todayCheckOutTime.textContent = record.checkOut || '--:--:--';
  elements.todayKmOut.textContent = record.kmOut ? `Km: ${record.kmOut.toLocaleString()}` : 'Km: ---';

  // Tự động chọn Vào ca hoặc Tan ca thông minh
  if (!record.checkIn) {
    elements.modeRadioIn.checked = true;
    elements.btnCaptureLabel.textContent = 'Chụp Check-in Giờ Vào';
    elements.actionIndicatorText.textContent = `Hôm nay (Ngày ${today}) chưa check-in. Bấm nút để chụp giờ vào ca & số Km đầu.`;
  } else if (record.checkIn && !record.checkOut) {
    elements.modeRadioOut.checked = true;
    elements.btnCaptureLabel.textContent = 'Chụp Check-out Tan Ca';
    elements.actionIndicatorText.textContent = `Đã vào ca lúc ${record.checkIn} (Km: ${record.kmIn || '---'}). Bấm nút để chụp Tan ca & số Km sau.`;
  } else {
    elements.modeRadioOut.checked = true;
    elements.btnCaptureLabel.textContent = 'Chụp Cập Nhật Lại';
    elements.actionIndicatorText.textContent = `Đã hoàn thành ca hôm nay (Vào: ${record.checkIn} | Về: ${record.checkOut}).`;
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
    km: ''
  });

  openConfirmationModal(mode, day, month, year, dateStr, timeStr);
}

// --- Draw Timestamp & Watermark Overlay ---
function drawWatermarkOnCanvas(ctx, w, h, data) {
  const scale = Math.max(w, h) / 1000;
  const badgeWidth = Math.min(w * 0.92, 540 * scale);
  const badgeHeight = 110 * scale;
  const margin = 24 * scale;
  const x = margin;
  const y = h - badgeHeight - margin;
  const radius = 16 * scale;

  ctx.save();

  // Nền badge tối mờ có viền đổ bóng
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

  const tagColor = data.mode === 'in' ? '#34d399' : '#fbbf24';
  const tagText = data.mode === 'in' ? '🟢 CHECK IN (GIỜ VÀO LÀM)' : '🟠 CHECK OUT (GIỜ TAN CA)';
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

  ctx.restore();
}

// --- Open Confirmation Modal with Prominent Km Input ---
function openConfirmationModal(mode, day, month, year, dateStr, timeStr) {
  elements.confirmModal.classList.add('show');

  if (mode === 'in') {
    elements.modalBadge.textContent = 'CHECK IN';
    elements.modalBadge.className = 'modal-badge';
    elements.modalTitle.textContent = 'Xác Nhận Giờ Vào Làm';
    elements.kmInputLabel.innerHTML = '<i class="fa-solid fa-gauge-high"></i> <span>Nhập số Km lúc đầu (bắt buộc):</span>';
    elements.kmInputHint.textContent = 'Nhập số công tơ mét xe lúc bạn bắt đầu ca làm việc.';
    elements.modalPrevKmRow.style.display = 'none';
  } else {
    elements.modalBadge.textContent = 'CHECK OUT';
    elements.modalBadge.className = 'modal-badge out';
    elements.modalTitle.textContent = 'Xác Nhận Giờ Tan Ca';
    elements.kmInputLabel.innerHTML = '<i class="fa-solid fa-gauge-high"></i> <span>Nhập số Km lúc sau (bắt buộc):</span>';
    elements.kmInputHint.textContent = 'Nhập số công tơ mét xe khi bạn kết thúc ca làm.';

    const todayRecord = AppState.monthData[day];
    if (todayRecord && todayRecord.kmIn) {
      elements.modalPrevKmRow.style.display = 'flex';
      elements.modalPrevKmVal.textContent = `${todayRecord.kmIn.toLocaleString()} km (lúc ${todayRecord.checkIn || '--'})`;
    } else {
      elements.modalPrevKmRow.style.display = 'none';
    }
  }

  elements.modalDateVal.textContent = `${dateStr} (Ngày ${day} Tháng ${month})`;
  elements.modalTimeVal.textContent = timeStr;

  elements.kmInput.value = '';
  setTimeout(() => {
    elements.kmInput.focus();
  }, 200);

  elements.kmInput.oninput = () => {
    const kmVal = elements.kmInput.value.trim();
    const canvas = elements.watermarkedCanvas;
    const ctx = canvas.getContext('2d');
    drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
      date: dateStr,
      time: timeStr,
      mode: mode,
      km: kmVal
    });
  };
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
  const time = AppState.capturedTimeStr;
  const date = AppState.capturedDateStr;

  // Cập nhật canvas lần cuối với số Km vừa nhập
  const canvas = elements.watermarkedCanvas;
  const ctx = canvas.getContext('2d');
  drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
    date: date,
    time: time,
    mode: mode,
    km: kmNum
  });

  // 1. Lưu ảnh đóng dấu ngày giờ & Km vào điện thoại (Hoạt động hoàn toàn Offline)
  try {
    saveCanvasImageToPhone(canvas, mode, date, time);
  } catch (err) {
    console.error('Lỗi khi tải ảnh:', err);
  }

  // 2. Chuyển view sang tháng được ghi nhận nếu đang ở tháng khác
  if (AppState.selectedMonth !== month || AppState.selectedYear !== year) {
    AppState.selectedMonth = month;
    AppState.selectedYear = year;
    loadMonthData();
  }

  // 3. Ghi nhận dữ liệu vào bộ nhớ máy (LocalStorage)
  if (!AppState.monthData[day]) {
    AppState.monthData[day] = { checkIn: '', checkOut: '', kmIn: null, kmOut: null };
  }

  if (mode === 'in') {
    AppState.monthData[day].checkIn = time;
    AppState.monthData[day].kmIn = kmNum;
  } else {
    AppState.monthData[day].checkOut = time;
    AppState.monthData[day].kmOut = kmNum;
  }

  saveMonthData();
  closeConfirmationModal();

  // 4. Đưa vào Hàng chờ Offline (Sync Queue) để tự động đẩy lên Google Sheets
  const syncRecordItem = {
    id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    year: year,
    month: month,
    day: day,
    type: mode,
    time: time,
    km: kmNum,
    timestamp: Date.now()
  };

  enqueueOfflineRecord(syncRecordItem);

  if (navigator.onLine && AppState.scriptUrl) {
    showToast('Đang tải lên Google Sheets...', 'info');
    processOfflineSyncQueue();
  } else {
    showToast('💾 Đã lưu ảnh vào máy & ghi nhận Offline (sẽ tự động lên Sheets khi có mạng)!', 'success');
  }

  setTimeout(() => {
    switchTab('tab-timesheet');
    highlightDayRow(day);
  }, 400);
}

// --- Download Canvas to Phone Storage ---
function saveCanvasImageToPhone(canvas, mode, dateStr, timeStr) {
  const cleanDate = dateStr.replace(/\//g, '');
  const cleanTime = timeStr.replace(/:/g, '');
  const filename = `ChamCong_${mode === 'in' ? 'CheckIn' : 'CheckOut'}_${cleanDate}_${cleanTime}.jpg`;

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
  if (diff < 0) diff += 24 * 3600; // Qua đêm

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
  const daysInMonth = 31; // Luôn hiển thị đủ 31 ngày theo đúng bảng chấm công chuẩn
  const currentDay = (AppState.selectedMonth === (new Date().getMonth() + 1) && AppState.selectedYear === new Date().getFullYear())
    ? new Date().getDate()
    : null;

  const mStr = String(AppState.selectedMonth).padStart(2, '0');
  elements.currentMonthDisplay.textContent = `Tháng ${mStr} / ${AppState.selectedYear}`;
  elements.monthSelectDropdown.value = AppState.selectedMonth;

  let totalSeconds = 0;
  let totalKm = 0;
  let rowsHtml = '';

  for (let day = 1; day <= daysInMonth; day++) {
    const record = AppState.monthData[day] || {};
    const checkIn = record.checkIn || '';
    const checkOut = record.checkOut || '';
    const kmIn = (record.kmIn !== undefined && record.kmIn !== null && record.kmIn !== '') ? record.kmIn : '';
    const kmOut = (record.kmOut !== undefined && record.kmOut !== null && record.kmOut !== '') ? record.kmOut : '';

    const duration = calculateDuration(checkIn, checkOut);
    const kmDiff = calculateKmDiff(kmIn, kmOut);

    if (checkIn && checkOut) {
      const [h, m, s] = duration.split(':').map(Number);
      totalSeconds += (h * 3600 + m * 60 + s);
    }
    totalKm += kmDiff;

    const isToday = (day === currentDay);
    const hasData = Boolean(checkIn || checkOut || kmIn || kmOut);

    rowsHtml += `
      <tr class="${isToday ? 'today-row' : ''} ${hasData ? 'filled-row' : ''}" id="row-day-${day}">
        <td class="col-day">${day}</td>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${kmIn !== '' ? Number(kmIn).toLocaleString() : ''}</td>
        <td>${kmOut !== '' ? Number(kmOut).toLocaleString() : ''}</td>
        <td style="font-weight:600; color: ${duration !== '00:00:00' ? '#38bdf8' : 'inherit'}">${duration}</td>
        <td style="font-weight:600; color: ${kmDiff > 0 ? '#34d399' : 'inherit'}">${kmDiff}</td>
        <td class="col-act">
          <button onclick="openEditModal(${day})" title="Sửa hàng này">
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

    const daysInM = new Date(year, m, 0).getDate();
    for (let d = 1; d <= daysInM; d++) {
      const rec = mData[d];
      if (rec && (rec.checkIn || rec.checkOut || rec.kmIn || rec.kmOut)) {
        daysWithData++;
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
};

// --- Edit Row Modal ---
window.openEditModal = function(day) {
  const record = AppState.monthData[day] || {};
  elements.editDayInput.value = day;
  elements.editModalTitle.textContent = `Chỉnh Sửa Dữ Liệu Ngày ${day}/${AppState.selectedMonth}`;
  elements.editCheckIn.value = record.checkIn || '';
  elements.editCheckOut.value = record.checkOut || '';
  elements.editKmIn.value = record.kmIn !== undefined && record.kmIn !== null ? record.kmIn : '';
  elements.editKmOut.value = record.kmOut !== undefined && record.kmOut !== null ? record.kmOut : '';
  elements.editModal.classList.add('show');
};

function saveEditRow() {
  const day = parseInt(elements.editDayInput.value, 10);
  if (!day) return;

  const checkIn = elements.editCheckIn.value.trim();
  const checkOut = elements.editCheckOut.value.trim();
  const kmIn = elements.editKmIn.value.trim() !== '' ? parseFloat(elements.editKmIn.value.trim()) : null;
  const kmOut = elements.editKmOut.value.trim() !== '' ? parseFloat(elements.editKmOut.value.trim()) : null;

  AppState.monthData[day] = {
    checkIn,
    checkOut,
    kmIn,
    kmOut
  };

  saveMonthData();
  elements.editModal.classList.remove('show');
  showToast(`✅ Đã cập nhật ngày ${day}`, 'success');

  // Enqueue sync item
  if (checkIn && kmIn !== null) {
    enqueueOfflineRecord({
      id: 'edit_in_' + Date.now(),
      year: AppState.selectedYear,
      month: AppState.selectedMonth,
      day: day,
      type: 'in',
      time: checkIn,
      km: kmIn,
      timestamp: Date.now()
    });
  }
  if (checkOut && kmOut !== null) {
    enqueueOfflineRecord({
      id: 'edit_out_' + Date.now(),
      year: AppState.selectedYear,
      month: AppState.selectedMonth,
      day: day,
      type: 'out',
      time: checkOut,
      km: kmOut,
      timestamp: Date.now()
    });
  }

  if (navigator.onLine) {
    processOfflineSyncQueue();
  }
}

// --- Export to CSV / Excel ---
function exportToCsv() {
  const daysInMonth = 31; // Luôn xuất đủ 31 ngày
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
  // Tabs
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // Mode radio change
  elements.modeRadioIn.addEventListener('change', () => {
    elements.btnCaptureLabel.textContent = 'Chụp Check-in Giờ Vào';
  });
  elements.modeRadioOut.addEventListener('change', () => {
    elements.btnCaptureLabel.textContent = 'Chụp Check-out Tan Ca';
  });

  // Camera buttons
  elements.btnCapture.addEventListener('click', captureCurrentFrame);
  elements.btnSwitchCamera.addEventListener('click', switchCamera);
  elements.fileFallbackInput.addEventListener('change', handleFallbackCapture);

  // Modal actions
  elements.btnConfirmSave.addEventListener('click', handleConfirmAndSave);
  elements.btnRetake.addEventListener('click', closeConfirmationModal);
  elements.btnCancelModal.addEventListener('click', closeConfirmationModal);

  elements.kmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleConfirmAndSave();
    }
  });

  // Month navigation
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
  });

  // Month select dropdown
  elements.monthSelectDropdown.addEventListener('change', (e) => {
    AppState.selectedMonth = parseInt(e.target.value, 10);
    loadMonthData();
    renderTimesheetTable();
  });

  // Year Navigation (Tab 3)
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

  // Timesheet actions
  elements.btnExportExcel.addEventListener('click', exportToCsv);
  elements.btnSyncOnline.addEventListener('click', () => {
    if (!AppState.scriptUrl) {
      elements.settingsModal.classList.add('show');
      showToast('⚠️ Vui lòng cấu hình URL Google Sheets trước', 'error');
    } else {
      showToast('🔄 Đang đồng bộ toàn bộ dữ liệu tháng lên Google Sheets...', 'info');
      syncWholeMonthDirectly();
    }
  });

  // Bấm vào nút trạng thái đồng bộ trên Header
  elements.btnSyncQueue.addEventListener('click', () => {
    if (!navigator.onLine) {
      showToast(`📵 Đang ngoại tuyến. Có ${AppState.offlineQueue.length} bản ghi chờ có mạng để tự tải lên.`, 'info');
      return;
    }
    if (AppState.offlineQueue.length > 0) {
      processOfflineSyncQueue();
    } else {
      showToast('🟢 Tất cả dữ liệu đã được đồng bộ lên Google Sheets!', 'success');
    }
  });

  // Load sample data button
  elements.btnLoadSampleData.addEventListener('click', () => {
    AppState.monthData = JSON.parse(JSON.stringify(USER_SAMPLE_DATA));
    saveMonthData();
    showToast('✨ Đã nạp dữ liệu mẫu ví dụ của bạn!', 'success');
  });

  // Clear month data
  elements.btnClearData.addEventListener('click', () => {
    if (confirm(`Bạn có chắc muốn xóa tất cả dữ liệu tháng ${AppState.selectedMonth}/${AppState.selectedYear}?`)) {
      AppState.monthData = {};
      saveMonthData();
      showToast('🗑️ Đã xóa dữ liệu tháng này', 'info');
    }
  });

  // Settings modal
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
      processOfflineSyncQueue();
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

  // Edit modal
  elements.btnCloseEdit.addEventListener('click', () => elements.editModal.classList.remove('show'));
  elements.btnSaveEdit.addEventListener('click', saveEditRow);
}

// --- Bulk Sync Whole Month to Sheets ---
async function syncWholeMonthDirectly() {
  if (!AppState.scriptUrl) return;
  try {
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
    if (result.status === 'success') {
      showToast(`✅ Đã đồng bộ toàn bộ tháng ${AppState.selectedMonth}/${AppState.selectedYear} lên Google Sheets!`, 'success');
    }
  } catch (err) {
    showToast('⚠️ Lỗi khi đồng bộ toàn bộ tháng.', 'error');
  }
}
