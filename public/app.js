// QUİCK EKPRESS DELİVERY - Client Controller & UI
let appState = {
  activeWeek: { id: 'week_current', label: '17 Ağustos - 23 Ağustos 2026' },
  settings: {
    systemTitle: 'QUİCK EKPRESS DELİVERY',
    systemSubtitle: 'Motorlu Kurye Haftalık İzin ve Vardiya Çizelgesi',
    windowStartDay: 'Pazartesi',
    windowStartTime: '08:00',
    windowEndDay: 'Cuma',
    windowEndTime: '23:59',
    isLockManual: false
  },
  groups: [],
  admins: []
};

let isWindowOpen = true;
let currentSession = JSON.parse(localStorage.getItem('quick_session') || 'null');
let currentAdminSession = JSON.parse(localStorage.getItem('quick_admin_session') || 'null');
let currentAdminTab = 'shifts'; // 'shifts', 'groups', 'admins', 'settings'
let activeTunnelUrl = '';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

// Fetch state and active tunnel URL
async function fetchState() {
  try {
    const [stateRes, tunnelRes] = await Promise.all([
      fetch('/api/state').then(r => r.json()),
      fetch('/api/tunnel-url').then(r => r.json()).catch(() => ({ success: false }))
    ]);

    if (stateRes.success && stateRes.data) {
      appState = stateRes.data;
      isWindowOpen = stateRes.isWindowOpen !== false;
    }
    if (tunnelRes.success && tunnelRes.url) {
      activeTunnelUrl = tunnelRes.url;
    }
    renderApp();
  } catch (err) {
    console.error('Fetch state error:', err);
  }
}

// SSE Live Synchronization (24/7 Realtime Updates)
function initSse() {
  const evtSource = new EventSource('/api/stream');
  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data) {
        appState = data;
        renderApp();
      }
    } catch (e) {}
  };
  evtSource.onerror = () => {
    setTimeout(fetchState, 3000);
  };
}

window.navigateToAdmin = function() {
  window.history.pushState({}, '', '/admin');
  renderApp();
};

window.navigateToHome = function() {
  window.history.pushState({}, '', '/');
  renderApp();
};

window.addEventListener('popstate', () => {
  renderApp();
});

// Main Render Function
function renderApp() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const pathname = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase();
  const search = (window.location.search || '').toLowerCase();
  const isAdminRoute = pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin') || hash === '#admin' || search.includes('admin');

  if (isAdminRoute && !currentAdminSession) {
    renderAdminLogin(appEl);
    return;
  }

  if (isAdminRoute && currentAdminSession) {
    renderAdminDashboard(appEl);
    return;
  }

  renderCourierPortal(appEl);
}

// ----------------------------------------------------
// 1. COURIER PORTAL VIEW
// ----------------------------------------------------
function renderCourierPortal(container) {
  const title = appState.settings?.systemTitle || 'QUİCK EKPRESS DELİVERY';
  const subtitle = appState.settings?.systemSubtitle || 'Motorlu Kurye Haftalık İzin ve Vardiya Çizelgesi';
  const weekLabel = appState.activeWeek?.label || '17 Ağustos - 23 Ağustos 2026';
  const totalEmployees = (appState.groups || []).reduce((acc, g) => acc + (g.employees?.length || 0), 0);

  const windowStartText = `${appState.settings?.windowStartDay || 'Pazartesi'} ${appState.settings?.windowStartTime || '08:00'}`;
  const windowEndText = `${appState.settings?.windowEndDay || 'Cuma'} ${appState.settings?.windowEndTime || '23:59'}`;

  let html = `
    <!-- Printable Header for PDF Print -->
    <div class="print-only-header">
      <h1>${title}</h1>
      <p><strong>${subtitle}</strong> • Çizelge Dönemi: <strong>${weekLabel}</strong></p>
      <p style="font-size: 8pt; margin-top: 4px;">Toplam ${appState.groups?.length || 0} Grup • ${totalEmployees} Kurye</p>
    </div>

    <div class="container">
      <header class="app-header">
        <div class="header-brand">
          <div class="brand-icon-box">🛵</div>
          <div class="header-title">
            <h1 class="brand-text-title">${title}</h1>
            <p class="brand-text-sub">${subtitle} • <strong>${weekLabel}</strong></p>
          </div>
        </div>
        <div class="header-actions">
          <a href="/admin" onclick="event.preventDefault(); navigateToAdmin();" class="btn btn-secondary" style="border-color: rgba(59, 130, 246, 0.5); background: rgba(59, 130, 246, 0.12); color: #60a5fa; font-weight: 700;">
            👑 Yönetici Girişi 🔑
          </a>
        </div>
      </header>

      <!-- Time Window & Status Banner -->
      <div class="info-banner ${!isWindowOpen ? 'danger' : ''}">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <span class="status-badge ${isWindowOpen ? 'live' : 'locked'}">
            <span class="pulse-dot ${!isWindowOpen ? 'red' : ''}"></span>
            ${isWindowOpen ? 'İzin Seçimi Açık' : 'İzin Seçimi Kapalı'}
          </span>
          <span style="font-size: 0.84rem; color: var(--text-muted);">
            ⏰ Seçim Penceresi: <strong>${windowStartText}</strong> - <strong>${windowEndText}</strong>
          </span>
        </div>
        ${!isWindowOpen ? `
          <div style="font-size: 0.84rem; color: #fca5a5; font-weight: 700;">
            ⚠️ Belirlenen saatler dışındasınız. Şu anda yeni izin işaretlenemez.
          </div>
        ` : `
          <div style="font-size: 0.82rem; color: #34d399; font-weight: 600;">
            ✓ Günde en fazla 1 kişi • Kurye başına haftalık 1 gün izin
          </div>
        `}
      </div>

      <!-- Employee Phone Login / Active Session -->
      ${currentSession ? `
        <div class="info-banner" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);">
          <div>
            <span style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Giriş Yapılan Kurye</span>
            <div style="font-weight: 800; font-size: 1.2rem; color: #ffffff; margin-top: 0.1rem;">
              🛵 ${currentSession.employee.name} — <span style="color: #60a5fa;">${currentSession.group.name}</span>
            </div>
            <div style="font-size: 0.84rem; color: #34d399; margin-top: 0.2rem;">
              ✓ Oturum Açıldı • Doğrudan grubunuza yönlendirildiniz. Haftalık izin gününüzü aşağıdan seçebilirsiniz.
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-primary btn-sm" onclick="scrollToMyGroup()">📍 Grubuma Git</button>
            <button class="btn btn-secondary btn-sm" onclick="handleLogout()">Oturumu Kapat ✕</button>
          </div>
        </div>
      ` : `
        <div class="info-banner" style="border-color: rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.06);">
          <div>
            <h3 style="font-size: 1rem; font-weight: 800; color: #ffffff;">📱 Kurye Telefon Numarası ile Giriş</h3>
            <p style="font-size: 0.84rem; color: var(--text-muted); margin-top: 0.15rem;">
              Telefon numaranızı yazdıktan sonra sistem <strong>doğrudan adınızın bulunduğu gruba yönlendirme</strong> yapacaktır.
            </p>
          </div>
          <form onsubmit="handlePhoneLogin(event)" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <input type="tel" id="input-phone" class="form-input" placeholder="05XX XXX XX XX" style="width: 200px;" required>
            <button type="submit" class="btn btn-primary">Grubuma Git & Giriş Yap ➔</button>
          </form>
        </div>
      `}

      <!-- Groups List (10 Groups x 7 Employees) -->
      <div class="groups-container">
        ${(appState.groups || []).map(group => renderCourierGroupCard(group)).join('')}
      </div>

      <!-- PDF Printable Footer -->
      <div class="print-footer">
        <div>Onaylayan Yönetici: ___________________</div>
        <div>Tarih / Kaşe / İmza: ___________________</div>
      </div>

      <!-- Footer -->
      <footer class="no-print" style="text-align: center; margin-top: 3rem; padding: 1.5rem; color: var(--text-muted); font-size: 0.82rem; border-top: 1px solid var(--border-color);">
        <p style="font-weight: 700; color: #ffffff;">${title}</p>
        <p style="margin-top: 0.25rem;">Haftalık İzin & Vardiya Sistemi • 7/24 Kesintisiz Mobil ve Web Erişimi</p>
        <div style="margin-top: 0.75rem;">
          <a href="/admin" onclick="event.preventDefault(); navigateToAdmin();" style="color: #60a5fa; text-decoration: none; font-weight: 700;">👑 Yönetici Kontrol Paneli 🔑</a>
        </div>
      </footer>
    </div>
  `;

  container.innerHTML = html;
}

// Render Single Group for Courier View
function renderCourierGroupCard(group) {
  const isUserGroup = currentSession && currentSession.group.id === group.id;

  return `
    <div id="group-${group.id}" class="group-card ${isUserGroup ? 'active-focused-group' : ''}">
      <div class="group-header">
        <div class="group-title">
          <span>${group.name}</span>
          <span class="group-badge-count">${group.employees.length} Kurye</span>
          <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-dim); margin-left: 0.25rem;">
            (Günde Max ${group.capacityPerDay || 1} İzin)
          </span>
        </div>
        ${isUserGroup ? `<span class="status-badge live" style="font-size: 0.82rem;">📍 SİZİN GRUBUNUZ</span>` : ''}
      </div>

      <div class="days-table-wrapper">
        <table class="days-table">
          <thead>
            <tr>
              <th style="width: 190px;">Kurye Adı</th>
              <th style="width: 130px;">Vardiya Saati</th>
              ${DAYS.map(day => `<th style="text-align: center;">${day}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${group.employees.map(emp => {
              const isCurrentEmp = currentSession && currentSession.employee.id === emp.id;
              const shiftDisplay = (emp.shiftStart && emp.shiftEnd) ? `${emp.shiftStart} - ${emp.shiftEnd}` : '08:30 - 17:30';

              return `
                <tr id="emp-row-${emp.id}" class="${isCurrentEmp ? 'active-focused-row' : ''}">
                  <td>
                    <div style="font-weight: 800; color: ${isCurrentEmp ? '#60a5fa' : '#ffffff'}; font-size: 0.92rem;">
                      ${isCurrentEmp ? '🛵 ' : ''}${emp.name}
                    </div>
                    ${isCurrentEmp ? `
                      <div style="font-size: 0.76rem; color: #34d399; font-weight: 600;">
                        • (Siz)
                      </div>
                    ` : ''}
                  </td>
                  <td>
                    <span class="shift-badge-readonly">${shiftDisplay}</span>
                  </td>
                  ${DAYS.map(day => {
                    const isSelectedByThisEmp = emp.selectedDay === day;
                    const takenByOtherEmp = group.employees.find(e => e.id !== emp.id && e.selectedDay === day);

                    if (isSelectedByThisEmp) {
                      return `
                        <td style="text-align: center;">
                          <div class="day-slot selected" ${isCurrentEmp ? `onclick="selectDayOff(${group.id}, '${emp.id}', '${day}')" title="İptal etmek veya değiştirmek için tıklayın"` : ''}>
                            ✓ İZİNLİ
                          </div>
                        </td>
                      `;
                    }

                    if (takenByOtherEmp) {
                      return `
                        <td style="text-align: center;">
                          <div class="day-slot taken" title="Bu gün ${takenByOtherEmp.name} tarafından seçildi">
                            🔒 DOLU
                          </div>
                        </td>
                      `;
                    }

                    if (isCurrentEmp) {
                      return `
                        <td style="text-align: center;">
                          <button class="day-slot available" onclick="selectDayOff(${group.id}, '${emp.id}', '${day}')" ${!isWindowOpen ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            + Seç
                          </button>
                        </td>
                      `;
                    }

                    return `
                      <td style="text-align: center;">
                        <span style="color: rgba(255, 255, 255, 0.15); font-size: 0.8rem;">-</span>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Courier Phone Login with Automatic Scroll & Focus to Group
window.handlePhoneLogin = async function(e) {
  e.preventDefault();
  const phoneInput = document.getElementById('input-phone');
  if (!phoneInput) return;

  try {
    const res = await fetch('/api/register-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneInput.value })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Giriş başarısız.');
      return;
    }
    currentSession = { employee: data.employee, group: data.group };
    localStorage.setItem('quick_session', JSON.stringify(currentSession));
    
    renderApp();

    // Smoothly scroll directly to the courier's group and row
    setTimeout(() => {
      scrollToMyGroup();
    }, 150);

  } catch (err) {
    alert('Sunucuya bağlanırken hata oluştu.');
  }
};

window.scrollToMyGroup = function() {
  if (!currentSession) return;
  const targetEl = document.getElementById(`emp-row-${currentSession.employee.id}`) || document.getElementById(`group-${currentSession.group.id}`);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

window.handleLogout = function() {
  currentSession = null;
  localStorage.removeItem('quick_session');
  renderApp();
};

// Select Day Off API (Enforces 1 leave per courier & window check)
window.selectDayOff = async function(groupId, employeeId, day) {
  if (!currentSession) {
    alert('Lütfen önce telefon numaranız ile giriş yapınız.');
    return;
  }

  try {
    const res = await fetch('/api/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId,
        employeeId,
        day,
        callerPhone: currentSession.employee.phone
      })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'İzin seçimi yapılamadı.');
      return;
    }
    appState = data.data;
    renderApp();
  } catch (err) {
    alert('Bağlantı hatası.');
  }
};

// ----------------------------------------------------
// 2. WHATSAPP & SHARE LINK UTILITIES
// ----------------------------------------------------
async function getEffectiveShareUrl() {
  try {
    const res = await fetch('/api/tunnel-url');
    const data = await res.json();
    if (data.success && data.url) {
      activeTunnelUrl = data.url;
      return data.url;
    }
  } catch (e) {}

  return activeTunnelUrl || window.location.origin;
}

window.shareOnWhatsApp = async function() {
  const shareUrl = await getEffectiveShareUrl();
  const week = appState.activeWeek?.label || 'Mevcut Hafta';
  const start = `${appState.settings?.windowStartDay || 'Pazartesi'} ${appState.settings?.windowStartTime || '08:00'}`;
  const end = `${appState.settings?.windowEndDay || 'Cuma'} ${appState.settings?.windowEndTime || '23:59'}`;

  const message = `🛵 *${appState.settings?.systemTitle || 'QUİCK EKPRESS DELİVERY'}*\n📋 *Haftalık İzin Çizelgesi (${week})*\n\nDeğerli Kuryelerimiz,\nHaftalık izin günü seçimleri açılmıştır. Telefon numaranızı girerek doğrudan adınızın bulunduğu gruba yönlendirilebilir ve izin gününüzü seçebilirsiniz:\n\n🔗 *Giriş Linki (7/24 Mobil & Wifi):*\n${shareUrl}\n\n⏰ *İzin Seçim Aralığı:* ${start} - ${end}\n⚠️ *Kural:* Her kurye haftada 1 gün izin seçebilir. Grupta günde 1 kişi izin alabilir.`;

  const encoded = encodeURIComponent(message);
  const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
  window.open(waUrl, '_blank');
};

window.copyShareLink = async function() {
  const shareUrl = await getEffectiveShareUrl();
  try {
    await navigator.clipboard.writeText(shareUrl);
    alert(`7/24 Canlı Bağlantı Kopyalandı:\n\n${shareUrl}`);
  } catch (e) {
    prompt('7/24 Canlı Kurye Linkiniz (Kopyalayabilirsiniz):', shareUrl);
  }
};

window.printSchedulePDF = function() {
  window.print();
};

// ----------------------------------------------------
// 3. ADMIN LOGIN & DASHBOARD
// ----------------------------------------------------
function renderAdminLogin(container) {
  container.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; background: radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15), transparent 70%), var(--bg-dark);">
      <div class="modal-content" style="max-width: 460px; border-color: rgba(99, 102, 241, 0.4); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);">
        <div style="text-align: center; margin-bottom: 1.75rem;">
          <div style="width: 60px; height: 60px; margin: 0 auto 0.75rem; background: rgba(99, 102, 241, 0.2); border: 2px solid rgba(99, 102, 241, 0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
            👑
          </div>
          <h2 style="font-family: var(--font-display); font-size: 1.6rem; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em;">
            YÖNETİCİ GİRİŞ PANELİ
          </h2>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">
            ${appState.settings?.systemTitle || 'QUİCK EKPRESS DELİVERY'} • Yetkili Yönetim Alanı
          </p>
        </div>

        <div id="admin-login-error" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: #fca5a5; text-align: center; font-weight: 600;"></div>

        <form onsubmit="handleAdminLogin(event)">
          <div style="margin-bottom: 1.15rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">
              👤 Yönetici Hesabı Seçiniz
            </label>
            <select id="admin-name" class="form-input" style="padding: 0.7rem 0.85rem; font-size: 0.92rem;">
              ${(appState.admins || [{ name: 'Murat Arslan' }]).map(a => `<option value="${a.name}">${a.name} (${a.role || 'Yönetici'})</option>`).join('')}
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">
              🔑 Yönetici Şifresi / PIN Kodu
            </label>
            <input type="password" id="admin-pin" class="form-input" placeholder="Şifrenizi veya PIN Kodunuzu Giriniz" style="padding: 0.7rem 0.85rem; font-size: 0.92rem;" required autofocus>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.85rem; font-size: 1rem; font-weight: 800; letter-spacing: 0.03em;">
            Yönetici Paneline Giriş Yap ➔
          </button>
        </form>

        <div style="text-align: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          <a href="/" style="font-size: 0.85rem; color: var(--text-muted); text-decoration: none; font-weight: 600;">← Kurye İzin Portalı Ekranına Dön</a>
        </div>
      </div>
    </div>
  `;
}

window.handleAdminLogin = async function(e) {
  e.preventDefault();
  const name = document.getElementById('admin-name').value;
  const pin = document.getElementById('admin-pin').value;
  const errEl = document.getElementById('admin-login-error');

  try {
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminName: name, pin })
    });
    const data = await res.json();
    if (!data.success) {
      if (errEl) {
        errEl.innerText = '⚠️ ' + (data.error || 'Hatalı Şifre / PIN Kodu.');
        errEl.style.display = 'block';
      } else {
        alert(data.error || 'Hatalı Şifre / PIN Kodu.');
      }
      return;
    }
    currentAdminSession = data.admin;
    localStorage.setItem('quick_admin_session', JSON.stringify(currentAdminSession));
    if (window.location.pathname !== '/admin') {
      window.location.href = '/admin';
    } else {
      renderApp();
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = '⚠️ Sunucu bağlantı hatası.';
      errEl.style.display = 'block';
    } else {
      alert('Bağlantı hatası.');
    }
  }
};

window.openAdminLoginModal = function() {
  window.location.href = '/admin';
};

window.handleAdminLogout = function() {
  currentAdminSession = null;
  localStorage.removeItem('quick_admin_session');
  window.history.pushState({}, '', '/admin');
  renderApp();
};

// Admin Dashboard Screen
function renderAdminDashboard(container) {
  const totalEmployees = (appState.groups || []).reduce((acc, g) => acc + (g.employees?.length || 0), 0);
  const totalLeaves = (appState.groups || []).reduce((acc, g) => acc + (g.employees?.filter(e => e.selectedDay)?.length || 0), 0);

  container.innerHTML = `
    <!-- Printable Header for PDF Print -->
    <div class="print-only-header">
      <h1>${appState.settings?.systemTitle || 'QUİCK EKPRESS DELİVERY'}</h1>
      <p><strong>YÖNETİCİ HAFTALIK VARDİYA & İZİN ÇİZELGESİ</strong> • ${appState.activeWeek?.label || ''}</p>
      <p style="font-size: 8pt; margin-top: 4px;">Toplam ${appState.groups?.length || 0} Grup • ${totalEmployees} Kurye • ${totalLeaves} İzinli</p>
    </div>

    <div class="container">
      <header class="app-header" style="border-color: rgba(59, 130, 246, 0.4);">
        <div class="header-brand">
          <div class="brand-icon-box" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3);">👑</div>
          <div class="header-title">
            <h1 class="brand-text-title">YÖNETİCİ KONTROL PANELİ</h1>
            <p class="brand-text-sub">${appState.settings?.systemTitle || 'QUİCK EKPRESS'} • Hoş Geldiniz, <strong>${currentAdminSession.name}</strong> (${currentAdminSession.role || 'Yönetici'})</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-whatsapp btn-sm" onclick="shareOnWhatsApp()">💬 WhatsApp Paylaş</button>
          <button class="btn btn-secondary btn-sm" onclick="copyShareLink()">📋 Link Kopyala</button>
          <a href="/api/export/csv" class="btn btn-secondary btn-sm">📊 Excel / CSV</a>
          <button class="btn btn-secondary btn-sm" onclick="printSchedulePDF()">🖨️ PDF Yazdır</button>
          <a href="/" class="btn btn-secondary btn-sm" style="border-color: #3b82f6; color: #60a5fa;">👁️ Kurye Görünümü</a>
          <button class="btn btn-danger btn-sm" onclick="handleAdminLogout()">Çıkış ✕</button>
        </div>
      </header>

      <!-- Admin Top Metrics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        <div class="info-banner" style="margin-bottom: 0; padding: 0.85rem 1rem;">
          <div>
            <span style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Toplam Grup</span>
            <div style="font-size: 1.4rem; font-weight: 900; color: #ffffff;">${appState.groups?.length || 0}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openAddGroupModal()">+ Grup Ekle</button>
        </div>

        <div class="info-banner" style="margin-bottom: 0; padding: 0.85rem 1rem;">
          <div>
            <span style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Toplam Kurye</span>
            <div style="font-size: 1.4rem; font-weight: 900; color: #60a5fa;">${totalEmployees}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">+ Kurye Ekle</button>
        </div>

        <div class="info-banner" style="margin-bottom: 0; padding: 0.85rem 1rem;">
          <div>
            <span style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">İzinli Kurye</span>
            <div style="font-size: 1.4rem; font-weight: 900; color: #34d399;">${totalLeaves}</div>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${totalEmployees - totalLeaves} Çalışıyor</span>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="admin-nav-tabs no-print">
        <button class="admin-tab-btn ${currentAdminTab === 'shifts' ? 'active' : ''}" onclick="setAdminTab('shifts')">
          📋 Vardiyalar & İzin Yönetimi (Elle Saat Girişi)
        </button>
        <button class="admin-tab-btn ${currentAdminTab === 'groups' ? 'active' : ''}" onclick="setAdminTab('groups')">
          🏢 Grup & Kurye İşlemleri (Ekle / Sil)
        </button>
        <button class="admin-tab-btn ${currentAdminTab === 'admins' ? 'active' : ''}" onclick="setAdminTab('admins')">
          👑 Yönetici Hesapları & PIN
        </button>
        <button class="admin-tab-btn ${currentAdminTab === 'settings' ? 'active' : ''}" onclick="setAdminTab('settings')">
          ⚙️ İzin Saat Penceresi & Ayarlar
        </button>
      </div>

      <!-- Tab Contents -->
      ${renderCurrentAdminTabContent()}

      <!-- PDF Printable Footer -->
      <div class="print-footer">
        <div>Onaylayan Yönetici: <strong>${currentAdminSession.name}</strong></div>
        <div>Tarih / İmza: ___________________</div>
      </div>
    </div>
  `;
}

window.setAdminTab = function(tab) {
  currentAdminTab = tab;
  renderApp();
};

function renderCurrentAdminTabContent() {
  if (currentAdminTab === 'groups') return renderAdminGroupsTab();
  if (currentAdminTab === 'admins') return renderAdminManagementTab();
  if (currentAdminTab === 'settings') return renderAdminSettingsTab();
  return renderAdminShiftsTab();
}

// ----------------------------------------------------
// TAB 1: SHIFTS & LEAVE MANAGEMENT (WITH INLINE KEYBOARD TIME INPUT)
// ----------------------------------------------------
function renderAdminShiftsTab() {
  return `
    <div class="info-banner" style="background: rgba(59, 130, 246, 0.06); border-color: rgba(59, 130, 246, 0.3);">
      <div>
        <span style="font-weight: 800; color: #ffffff;">⚡ Elle Vardiya Saati & İzin Düzenleme:</span>
        <p style="font-size: 0.83rem; color: var(--text-muted); margin-top: 0.2rem;">
          Açılır pencereye gerek kalmadan, doğrudan kutulara klavyenizle vardiya başlangıç ve bitiş saatini yazabilirsiniz (Yazıp çıktığınızda otomatik kaydedilir).
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">+ Yeni Kurye Ekle</button>
      </div>
    </div>

    <div class="groups-container">
      ${(appState.groups || []).map(group => `
        <div class="group-card">
          <div class="group-header">
            <div class="group-title">
              <span>${group.name}</span>
              <span class="group-badge-count">${group.employees.length} Kurye</span>
            </div>
            <div class="no-print" style="display: flex; gap: 0.4rem;">
              <button class="btn btn-secondary btn-sm" onclick="openAddEmployeeModal(${group.id})">+ Bu Gruba Kurye Ekle</button>
              <button class="btn btn-danger btn-sm" onclick="handleDeleteGroup(${group.id}, '${group.name}')">🗑️ Grubu Sil</button>
            </div>
          </div>

          <div class="days-table-wrapper">
            <table class="days-table">
              <thead>
                <tr>
                  <th style="width: 170px;">Kurye Adı</th>
                  <th style="width: 120px;">Telefon</th>
                  <th style="width: 160px;">Vardiya Saati (Elle Yaz)</th>
                  <th style="width: 140px;">İzin Durumu</th>
                  <th style="text-align: center; width: 150px;">Yönetici İzin Ataması</th>
                  <th class="no-print" style="text-align: center; width: 80px;">İşlem</th>
                </tr>
              </thead>
              <tbody>
                ${group.employees.map(emp => `
                  <tr>
                    <td style="font-weight: 700; color: #ffffff;">🛵 ${emp.name}</td>
                    <td style="color: var(--text-muted); font-size: 0.8rem;">${emp.phone || '-'}</td>
                    <td>
                      <!-- INLINE KEYBOARD SHIFT INPUT (NO POPUP WINDOW!) -->
                      <div class="shift-input-group">
                        <input type="text"
                               class="shift-input"
                               value="${emp.shiftStart || '08:30'}"
                               placeholder="08:30"
                               title="Başlangıç Saati (Klavyeyle Yazınız)"
                               onblur="handleInlineShiftChange(${group.id}, '${emp.id}', this.value, null)">
                        <span style="color: var(--text-dim); font-size: 0.75rem;">-</span>
                        <input type="text"
                               class="shift-input"
                               value="${emp.shiftEnd || '17:30'}"
                               placeholder="17:30"
                               title="Bitiş Saati (Klavyeyle Yazınız)"
                               onblur="handleInlineShiftChange(${group.id}, '${emp.id}', null, this.value)">
                      </div>
                    </td>
                    <td>
                      <span class="status-badge ${emp.selectedDay ? 'live' : ''}">
                        ${emp.selectedDay ? `✓ ${emp.selectedDay}` : 'Çalışıyor'}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <select class="form-input" style="padding: 0.25rem 0.4rem; font-size: 0.78rem; width: 140px;" onchange="handleAdminOverride(${group.id}, '${emp.id}', this.value)">
                        <option value="">-- İzin Yok --</option>
                        ${DAYS.map(day => `<option value="${day}" ${emp.selectedDay === day ? 'selected' : ''}>${day}</option>`).join('')}
                      </select>
                    </td>
                    <td class="no-print" style="text-align: center;">
                      <div style="display: flex; gap: 0.3rem; justify-content: center;">
                        <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.74rem;" onclick="openEditEmployeeModal(${group.id}, '${emp.id}')" title="Kurye İsim ve Telefonunu Düzenle">
                          ✏️ Düzenle
                        </button>
                        <button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.45rem; font-size: 0.72rem;" onclick="handleDeleteEmployee(${group.id}, '${emp.id}', '${emp.name}')" title="Kuryeyi Sil">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Inline Shift Keyboard Hours Update Handler
window.handleInlineShiftChange = async function(groupId, employeeId, shiftStart, shiftEnd) {
  try {
    const payload = { groupId, employeeId };
    if (shiftStart !== null) payload.shiftStart = shiftStart.trim();
    if (shiftEnd !== null) payload.shiftEnd = shiftEnd.trim();

    await fetch('/api/admin/update-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Shift update error:', err);
  }
};

window.handleAdminOverride = async function(groupId, employeeId, day) {
  try {
    const res = await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, employeeId, day })
    });
    const data = await res.json();
    if (data.success) {
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Atama hatası.');
  }
};

// ----------------------------------------------------
// TAB 2: GROUPS & COURIERS MANAGEMENT
// ----------------------------------------------------
function renderAdminGroupsTab() {
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
      <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: #ffffff;">
        🏢 Grup & Çalışan Organizasyonu
      </h3>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn btn-primary" onclick="openAddGroupModal()">+ Yeni Grup Ekle</button>
        <button class="btn btn-secondary" onclick="openAddEmployeeModal()">+ Yeni Kurye Ekle</button>
      </div>
    </div>

    <div class="groups-container">
      ${(appState.groups || []).map(group => `
        <div class="group-card">
          <div class="group-header">
            <div class="group-title">
              <span>${group.name}</span>
              <span class="group-badge-count">${group.employees.length} Kurye</span>
            </div>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-secondary btn-sm" onclick="openAddEmployeeModal(${group.id})">+ Kurye Ekle</button>
              <button class="btn btn-danger btn-sm" onclick="handleDeleteGroup(${group.id}, '${group.name}')">🗑️ Grubu Sil</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem;">
            ${group.employees.map(emp => `
              <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <div>
                  <div style="font-weight: 700; color: #ffffff; font-size: 0.9rem;">🛵 ${emp.name}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.1rem;">📱 ${emp.phone || '-'}</div>
                  <div style="font-size: 0.76rem; color: #60a5fa; margin-top: 0.1rem; font-family: monospace;">⏰ ${emp.shiftStart || '08:30'} - ${emp.shiftEnd || '17:30'}</div>
                </div>
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-secondary btn-sm" onclick="openEditEmployeeModal(${group.id}, '${emp.id}')">✏️ Düzenle</button>
                  <button class="btn btn-danger btn-sm" onclick="handleDeleteEmployee(${group.id}, '${emp.id}', '${emp.name}')">Sil</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ----------------------------------------------------
// TAB 3: ADMIN MANAGEMENT & PASSWORDS
// ----------------------------------------------------
function renderAdminManagementTab() {
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
      <div>
        <h3 style="font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; color: #ffffff;">
          👑 Yönetici Hesapları ve Giriş Şifreleri
        </h3>
        <p style="font-size: 0.82rem; color: var(--text-muted);">
          Sisteme yeni yönetici ekleyebilir, mevcut yöneticilerin PIN / şifrelerini güncelleyebilirsiniz.
        </p>
      </div>
      <button class="btn btn-primary" onclick="openAddAdminModal()">+ Yeni Yönetici Ekle</button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
      ${(appState.admins || []).map(adm => `
        <div class="group-card" style="margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 1.1rem; font-weight: 800; color: #ffffff;">👑 ${adm.name}</div>
              <div style="font-size: 0.8rem; color: #60a5fa; margin-top: 0.15rem;">${adm.role || 'Yönetici'}</div>
            </div>
            ${(appState.admins || []).length > 1 ? `
              <button class="btn btn-danger btn-sm" onclick="handleDeleteAdmin('${adm.id}', '${adm.name}')">Sil</button>
            ` : ''}
          </div>

          <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--border-subtle);">
            <form onsubmit="handleUpdateAdminPin(event, '${adm.id}')" style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" class="form-input" id="pin-${adm.id}" value="${adm.pin || ''}" placeholder="PIN Kodu" style="font-family: monospace; font-size: 0.88rem;" required>
              <button type="submit" class="btn btn-secondary btn-sm" style="white-space: nowrap;">PIN Güncelle</button>
            </form>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ----------------------------------------------------
// TAB 4: SETTINGS & SCHEDULE TIME WINDOW
// ----------------------------------------------------
function renderAdminSettingsTab() {
  const s = appState.settings || {};
  return `
    <div class="modal-content" style="max-width: 680px; margin: 0 auto; box-shadow: none; border-color: var(--border-color);">
      <h3 style="font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: #ffffff; margin-bottom: 1.25rem;">
        ⚙️ İzin Seçim Gün & Saat Penceresi ve Sistem Ayarları
      </h3>

      <form onsubmit="handleSaveSettings(event)">
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">
            Sistem / Şirket Başlığı
          </label>
          <input type="text" id="setting-title" class="form-input" value="${s.systemTitle || 'QUİCK EKPRESS DELİVERY'}" required>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">
            Haftalık Dönem Etiketi
          </label>
          <input type="text" id="setting-week" class="form-input" value="${appState.activeWeek?.label || '17 Ağustos - 23 Ağustos 2026'}" required>
        </div>

        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.15rem; margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #60a5fa; margin-bottom: 0.85rem;">
            ⏰ İzin İşaretleme İzin Penceresi (Otomatik Kilit)
          </h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
            Kuryeler yalnızca bu gün ve saat aralığında izin seçebilir. Bu saatler dışında seçim otomatik kilitlenir.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Başlangıç Günü</label>
              <select id="setting-start-day" class="form-input">
                ${DAYS.map(d => `<option value="${d}" ${s.windowStartDay === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Başlangıç Saati</label>
              <input type="time" id="setting-start-time" class="form-input" value="${s.windowStartTime || '08:00'}">
            </div>

            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Bitiş Günü (Son Gün)</label>
              <select id="setting-end-day" class="form-input">
                ${DAYS.map(d => `<option value="${d}" ${s.windowEndDay === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Bitiş Saati</label>
              <input type="time" id="setting-end-time" class="form-input" value="${s.windowEndTime || '23:59'}">
            </div>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
          <input type="checkbox" id="setting-lock-manual" style="width: 18px; height: 18px;" ${s.isLockManual ? 'checked' : ''}>
          <label for="setting-lock-manual" style="font-size: 0.85rem; font-weight: 700; color: #ffffff; cursor: pointer;">
            🔒 İzin Seçimini Şimdi Tamamen Kilitle (Manuel Zorunlu Kilit)
          </label>
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%; padding: 0.75rem;">
          Ayarları Kaydet ve Canlı Uygula ➔
        </button>
      </form>
    </div>
  `;
}

window.handleSaveSettings = async function(e) {
  e.preventDefault();
  const systemTitle = document.getElementById('setting-title').value;
  const weekLabel = document.getElementById('setting-week').value;
  const windowStartDay = document.getElementById('setting-start-day').value;
  const windowStartTime = document.getElementById('setting-start-time').value;
  const windowEndDay = document.getElementById('setting-end-day').value;
  const windowEndTime = document.getElementById('setting-end-time').value;
  const isLockManual = document.getElementById('setting-lock-manual').checked;

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          systemTitle,
          windowStartDay,
          windowStartTime,
          windowEndDay,
          windowEndTime,
          isLockManual
        },
        activeWeek: {
          label: weekLabel
        }
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Ayarlar başarıyla kaydedildi!');
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Ayarlar kaydedilirken hata oluştu.');
  }
};

// ----------------------------------------------------
// 4. MODALS & HANDLERS (GROUP, COURIER, ADMIN)
// ----------------------------------------------------

// Add Group Modal
window.openAddGroupModal = function() {
  const modalHtml = `
    <div class="modal-overlay" id="add-group-modal">
      <div class="modal-content">
        <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; color: #ffffff; margin-bottom: 1rem;">
          + Yeni Grup Ekle
        </h3>
        <form onsubmit="handleAddGroupSubmit(event)">
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Grup Adı</label>
            <input type="text" id="new-group-name" class="form-input" placeholder="Örn: 11. Grup" required>
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('add-group-modal').remove()">İptal</button>
            <button type="submit" class="btn btn-primary">Grubu Oluştur ➔</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.handleAddGroupSubmit = async function(e) {
  e.preventDefault();
  const name = document.getElementById('new-group-name').value;
  try {
    const res = await fetch('/api/admin/add-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('add-group-modal')?.remove();
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Grup eklenirken hata oluştu.');
  }
};

window.handleDeleteGroup = async function(groupId, groupName) {
  if (!confirm(`"${groupName}" grubunu ve içindeki kuryeleri silmek istediğinizden emin misiniz?`)) return;
  try {
    const res = await fetch('/api/admin/delete-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId })
    });
    const data = await res.json();
    if (data.success) {
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Grup silinirken hata oluştu.');
  }
};

// Add Employee Modal
window.openAddEmployeeModal = function(preselectedGroupId = null) {
  const groupOptions = (appState.groups || []).map(g => `
    <option value="${g.id}" ${preselectedGroupId === g.id ? 'selected' : ''}>${g.name}</option>
  `).join('');

  const modalHtml = `
    <div class="modal-overlay" id="add-emp-modal">
      <div class="modal-content">
        <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; color: #ffffff; margin-bottom: 1rem;">
          + Yeni Kurye / Çalışan Ekle
        </h3>
        <form onsubmit="handleAddEmployeeSubmit(event)">
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Grup</label>
            <select id="new-emp-group" class="form-input">${groupOptions}</select>
          </div>
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Kurye Adı Soyadı</label>
            <input type="text" id="new-emp-name" class="form-input" placeholder="Örn: Caner Yılmaz" required>
          </div>
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Telefon Numarası (Giriş İçin)</label>
            <input type="tel" id="new-emp-phone" class="form-input" placeholder="Örn: 0532 999 88 77" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Vardiya Başlangıç</label>
              <input type="text" id="new-emp-start" class="form-input" value="08:30" placeholder="08:30">
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Vardiya Bitiş</label>
              <input type="text" id="new-emp-end" class="form-input" value="17:30" placeholder="17:30">
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('add-emp-modal').remove()">İptal</button>
            <button type="submit" class="btn btn-primary">Kaydet ➔</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.handleAddEmployeeSubmit = async function(e) {
  e.preventDefault();
  const groupId = document.getElementById('new-emp-group').value;
  const name = document.getElementById('new-emp-name').value;
  const phone = document.getElementById('new-emp-phone').value;
  const shiftStart = document.getElementById('new-emp-start').value;
  const shiftEnd = document.getElementById('new-emp-end').value;

  try {
    const res = await fetch('/api/admin/add-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, name, phone, shiftStart, shiftEnd })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('add-emp-modal')?.remove();
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Kurye eklenirken hata oluştu.');
  }
};

window.handleDeleteEmployee = async function(groupId, employeeId, name) {
  if (!confirm(`"${name}" adlı kuryeyi silmek istediğinizden emin misiniz?`)) return;
  try {
    const res = await fetch('/api/admin/delete-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, employeeId })
    });
    const data = await res.json();
    if (data.success) {
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Kurye silinirken hata oluştu.');
  }
};

// Edit Employee Modal (Edit Name, Phone, Shift & Group)
window.openEditEmployeeModal = function(groupId, employeeId) {
  const group = (appState.groups || []).find(g => g.id === Number(groupId));
  if (!group) return;
  const emp = (group.employees || []).find(e => e.id === employeeId);
  if (!emp) return;

  const groupOptions = (appState.groups || []).map(g => `
    <option value="${g.id}" ${g.id === Number(groupId) ? 'selected' : ''}>${g.name}</option>
  `).join('');

  const modalHtml = `
    <div class="modal-overlay" id="edit-emp-modal">
      <div class="modal-content">
        <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; color: #ffffff; margin-bottom: 1rem;">
          ✏️ Kurye Bilgilerini Düzenle
        </h3>
        <form onsubmit="handleEditEmployeeSubmit(event, ${groupId}, '${employeeId}')">
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Grup</label>
            <select id="edit-emp-group" class="form-input">${groupOptions}</select>
          </div>
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Kurye Adı Soyadı</label>
            <input type="text" id="edit-emp-name" class="form-input" value="${emp.name || ''}" placeholder="Örn: Ahmet Yılmaz" required>
          </div>
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Telefon Numarası (Giriş İçin)</label>
            <input type="tel" id="edit-emp-phone" class="form-input" value="${emp.phone || ''}" placeholder="Örn: 0532 100 00 01" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Vardiya Başlangıç</label>
              <input type="text" id="edit-emp-start" class="form-input" value="${emp.shiftStart || '08:30'}" placeholder="08:30">
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Vardiya Bitiş</label>
              <input type="text" id="edit-emp-end" class="form-input" value="${emp.shiftEnd || '17:30'}" placeholder="17:30">
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('edit-emp-modal').remove()">İptal</button>
            <button type="submit" class="btn btn-primary">Değişiklikleri Kaydet ➔</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.handleEditEmployeeSubmit = async function(e, originalGroupId, employeeId) {
  e.preventDefault();
  const newGroupId = document.getElementById('edit-emp-group').value;
  const name = document.getElementById('edit-emp-name').value;
  const phone = document.getElementById('edit-emp-phone').value;
  const shiftStart = document.getElementById('edit-emp-start').value;
  const shiftEnd = document.getElementById('edit-emp-end').value;

  try {
    const res = await fetch('/api/admin/update-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: originalGroupId,
        employeeId,
        newGroupId,
        name,
        phone,
        shiftStart,
        shiftEnd
      })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('edit-emp-modal')?.remove();
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Kurye bilgileri güncellenirken hata oluştu.');
  }
};

// Admin Management Modals
window.openAddAdminModal = function() {
  const modalHtml = `
    <div class="modal-overlay" id="add-admin-modal">
      <div class="modal-content">
        <h3 style="font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; color: #ffffff; margin-bottom: 1rem;">
          + Yeni Yönetici Ekle
        </h3>
        <form onsubmit="handleAddAdminSubmit(event)">
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Yönetici Adı Soyadı</label>
            <input type="text" id="new-admin-name" class="form-input" placeholder="Örn: Ahmet Yönetici" required>
          </div>
          <div style="margin-bottom: 0.85rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Unvan / Rol</label>
            <input type="text" id="new-admin-role" class="form-input" placeholder="Örn: Vardiya Amiri / Operasyon Müdürü" required>
          </div>
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Giriş PIN / Şifre</label>
            <input type="text" id="new-admin-pin" class="form-input" placeholder="Örn: 5566" required>
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('add-admin-modal').remove()">İptal</button>
            <button type="submit" class="btn btn-primary">Yöneticiyi Ekle ➔</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.handleAddAdminSubmit = async function(e) {
  e.preventDefault();
  const name = document.getElementById('new-admin-name').value;
  const role = document.getElementById('new-admin-role').value;
  const pin = document.getElementById('new-admin-pin').value;

  try {
    const res = await fetch('/api/admin/manage-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        admin: { name, role, pin }
      })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('add-admin-modal')?.remove();
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('Yönetici eklenirken hata oluştu.');
  }
};

window.handleDeleteAdmin = async function(id, name) {
  if (!confirm(`"${name}" yöneticisini silmek istediğinizden emin misiniz?`)) return;
  try {
    const res = await fetch('/api/admin/manage-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        admin: { id }
      })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Silinemedi.');
      return;
    }
    appState = data.data;
    renderApp();
  } catch (err) {
    alert('Yönetici silinirken hata oluştu.');
  }
};

window.handleUpdateAdminPin = async function(e, id) {
  e.preventDefault();
  const pinInput = document.getElementById(`pin-${id}`);
  if (!pinInput) return;

  try {
    const res = await fetch('/api/admin/manage-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        admin: { id, pin: pinInput.value }
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Yönetici PIN kodu başarıyla güncellendi!');
      appState = data.data;
      renderApp();
    }
  } catch (err) {
    alert('PIN güncellenirken hata oluştu.');
  }
};

// Initialize App
fetchState();
initSse();
