import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

process.setMaxListeners(0);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = __dirname;
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'db.json');
const TMP_DB_PATH = path.join('/tmp', 'db.json');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

const PORT = process.env.PORT || 3000;

// Connected SSE clients for 24/7 live sync
const sseClients = new Set();

let inMemoryDb = null;

export function readDb() {
  try {
    if (inMemoryDb) return inMemoryDb;
    
    if (process.env.VERCEL && fs.existsSync(TMP_DB_PATH)) {
      const tmpData = fs.readFileSync(TMP_DB_PATH, 'utf8');
      inMemoryDb = JSON.parse(tmpData);
      return inMemoryDb;
    }

    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      inMemoryDb = JSON.parse(data);
      return inMemoryDb;
    }

    const fallbackPath = path.join(process.cwd(), 'data', 'db.json');
    if (fs.existsSync(fallbackPath)) {
      const data = fs.readFileSync(fallbackPath, 'utf8');
      inMemoryDb = JSON.parse(data);
      return inMemoryDb;
    }

    return null;
  } catch (err) {
    console.error('Error reading DB:', err);
    return inMemoryDb || null;
  }
}

export function writeDb(data) {
  try {
    inMemoryDb = data;
    
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (e) {}

    if (process.env.VERCEL) {
      try {
        fs.writeFileSync(TMP_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
      } catch (e) {}
    }

    notifySseClients(data);
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

function notifySseClients(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Check if current time is within allowed schedule window
function isSelectionWindowOpen(settings) {
  if (!settings) return true;
  if (settings.isLockManual === true) return false;

  const dayMap = { 'Pazartesi': 1, 'Salı': 2, 'Çarşamba': 3, 'Perşembe': 4, 'Cuma': 5, 'Cumartesi': 6, 'Pazar': 7 };
  const now = new Date();
  
  // Turkey Time (UTC+3)
  const utcOffset = 3 * 60;
  const localMinutes = now.getTime() + (now.getTimezoneOffset() + utcOffset) * 60000;
  const trDate = new Date(localMinutes);

  const currentJsDay = trDate.getDay();
  const currentDayNum = currentJsDay === 0 ? 7 : currentJsDay;
  const currentHours = trDate.getHours().toString().padStart(2, '0');
  const currentMins = trDate.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMins}`;

  const startDayNum = dayMap[settings.windowStartDay || 'Pazartesi'] || 1;
  const endDayNum = dayMap[settings.windowEndDay || 'Cuma'] || 5;
  const startTimeStr = settings.windowStartTime || '08:00';
  const endTimeStr = settings.windowEndTime || '23:59';

  if (startDayNum <= endDayNum) {
    if (currentDayNum < startDayNum || currentDayNum > endDayNum) return false;
    if (currentDayNum === startDayNum && currentTimeStr < startTimeStr) return false;
    if (currentDayNum === endDayNum && currentTimeStr > endTimeStr) return false;
    return true;
  } else {
    if (currentDayNum > endDayNum && currentDayNum < startDayNum) return false;
    if (currentDayNum === startDayNum && currentTimeStr < startTimeStr) return false;
    if (currentDayNum === endDayNum && currentTimeStr > endTimeStr) return false;
    return true;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

export async function getRequestBody(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') return resolve(req.body);
      try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); }
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning');
  res.setHeader('Bypass-Tunnel-Reminder', 'true');
  res.setHeader('ngrok-skip-browser-warning', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. SSE Live Stream Endpoint (24/7 Updates)
  if (pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    sseClients.add(res);

    const initialDb = readDb();
    if (initialDb) {
      res.write(`data: ${JSON.stringify(initialDb)}\n\n`);
    }

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. GET State
  if (pathname === '/api/state' && req.method === 'GET') {
    const db = readDb();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: db,
      isWindowOpen: isSelectionWindowOpen(db?.settings)
    }));
    return;
  }

  // 3. GET Active Tunnel URL
  if (pathname === '/api/tunnel-url' && req.method === 'GET') {
    const tunnelFile = path.join(PROJECT_ROOT, 'data', 'tunnel_url.txt');
    let url = '';
    if (fs.existsSync(tunnelFile)) {
      url = fs.readFileSync(tunnelFile, 'utf8').trim();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, url }));
    return;
  }

  // 4. POST Courier Phone Verification / Login
  if (pathname === '/api/register-employee' && req.method === 'POST') {
    try {
      const { phone } = await getRequestBody(req);
      const db = readDb();
      if (!db) throw new Error('Veritabanı hazır değil.');

      const cleanPhone = (phone || '').replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 7) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Lütfen geçerli bir telefon numarası giriniz.' }));
        return;
      }

      let foundEmp = null;
      let foundGroup = null;

      for (const g of db.groups) {
        for (const e of g.employees) {
          const empClean = (e.phone || '').replace(/\D/g, '');
          if (empClean === cleanPhone || empClean.endsWith(cleanPhone) || cleanPhone.endsWith(empClean)) {
            foundEmp = e;
            foundGroup = g;
            break;
          }
        }
        if (foundEmp) break;
      }

      if (!foundEmp) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Bu telefon numarasına ait kurye kaydı bulunamadı. Lütfen yöneticinize başvurunuz.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        employee: foundEmp,
        group: { id: foundGroup.id, name: foundGroup.name }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 5. POST Select Day Off
  if (pathname === '/api/select' && req.method === 'POST') {
    try {
      const { groupId, employeeId, day, callerPhone } = await getRequestBody(req);
      const db = readDb();
      if (!db) throw new Error('Veritabanı erişilemez.');

      // Time window check
      if (!isSelectionWindowOpen(db.settings)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `İzin seçim süresi kapalıdır. İzinler ${db.settings.windowStartDay} ${db.settings.windowStartTime} ile ${db.settings.windowEndDay} ${db.settings.windowEndTime} arasında seçilebilir.`
        }));
        return;
      }

      const group = db.groups.find(g => g.id === Number(groupId));
      if (!group) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Grup bulunamadı.' }));
        return;
      }

      const emp = group.employees.find(e => e.id === employeeId);
      if (!emp) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Çalışan bulunamadı.' }));
        return;
      }

      // Phone check if callerPhone is sent
      if (callerPhone) {
        const cleanCaller = callerPhone.replace(/\D/g, '');
        const cleanEmp = (emp.phone || '').replace(/\D/g, '');
        if (cleanCaller !== cleanEmp && !cleanEmp.endsWith(cleanCaller)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Yalnızca kendi adınıza izin seçebilirsiniz.' }));
          return;
        }
      }

      if (emp.selectedDay === day) {
        emp.selectedDay = null;
        writeDb(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'İzin seçimi kaldırıldı.', employee: emp, data: db }));
        return;
      }

      const capacity = group.capacityPerDay || 1;
      const takenByOtherEmp = group.employees.find(e => e.id !== employeeId && e.selectedDay === day);
      if (takenByOtherEmp) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `${day} günü grubunuzda "${takenByOtherEmp.name}" tarafından seçilmiştir. Günde en fazla ${capacity} kişi izin alabilir.`
        }));
        return;
      }

      emp.selectedDay = day;
      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `${day} günü izin olarak belirlendi.`, employee: emp, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 6. POST Admin Verify PIN
  if (pathname === '/api/admin/verify-pin' && req.method === 'POST') {
    try {
      const { adminName, pin } = await getRequestBody(req);
      const cleanPin = String(pin || '').trim();
      const cleanName = String(adminName || '').trim();
      const db = readDb();

      let admin = (db?.admins || []).find(a => 
        (cleanName ? a.name.toLowerCase() === cleanName.toLowerCase() : true) && 
        String(a.pin).trim() === cleanPin
      );

      if (!admin && cleanPin) {
        admin = (db?.admins || []).find(a => String(a.pin).trim() === cleanPin);
      }

      if (!admin) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Hatalı Yönetici Şifresi / PIN Kodu' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, admin: { id: admin.id, name: admin.name, role: admin.role } }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 7. POST Admin Add Group
  if (pathname === '/api/admin/add-group' && req.method === 'POST') {
    try {
      const { name } = await getRequestBody(req);
      const db = readDb();
      
      const nextId = (db.groups.length > 0 ? Math.max(...db.groups.map(g => g.id)) + 1 : 1);
      const groupName = name || `${nextId}. Grup`;

      const newGroup = {
        id: nextId,
        name: groupName,
        capacityPerDay: 1,
        employees: []
      };

      db.groups.push(newGroup);
      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 8. POST Admin Delete Group
  if (pathname === '/api/admin/delete-group' && req.method === 'POST') {
    try {
      const { groupId } = await getRequestBody(req);
      const db = readDb();
      
      db.groups = db.groups.filter(g => g.id !== Number(groupId));
      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 9. POST Admin Add Employee
  if (pathname === '/api/admin/add-employee' && req.method === 'POST') {
    try {
      const { groupId, name, phone, shiftStart, shiftEnd } = await getRequestBody(req);
      const db = readDb();

      const group = db.groups.find(g => g.id === Number(groupId));
      if (!group) throw new Error('Grup bulunamadı');

      const newId = `emp_${groupId}_${Date.now()}`;
      group.employees.push({
        id: newId,
        name: name || 'Yeni Kurye',
        phone: phone || `0532${Math.floor(1000000 + Math.random() * 9000000)}`,
        shiftStart: shiftStart || '08:30',
        shiftEnd: shiftEnd || '17:30',
        selectedDay: null
      });

      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 10. POST Admin Delete Employee
  if (pathname === '/api/admin/delete-employee' && req.method === 'POST') {
    try {
      const { groupId, employeeId } = await getRequestBody(req);
      const db = readDb();

      const group = db.groups.find(g => g.id === Number(groupId));
      if (!group) throw new Error('Grup bulunamadı');

      group.employees = group.employees.filter(e => e.id !== employeeId);
      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 11. POST Admin Update Employee
  if (pathname === '/api/admin/update-employee' && req.method === 'POST') {
    try {
      const body = await getRequestBody(req);
      const { groupId, employeeId, name, phone, shiftStart, shiftEnd, newGroupId } = body;
      const db = readDb();

      const group = db.groups.find(g => g.id === Number(groupId));
      if (!group) throw new Error('Grup bulunamadı');

      const emp = group.employees.find(e => e.id === employeeId);
      if (!emp) throw new Error('Çalışan bulunamadı');

      if (name !== undefined) emp.name = name.trim();
      if (phone !== undefined) emp.phone = phone.trim();
      if (shiftStart !== undefined) emp.shiftStart = shiftStart.trim();
      if (shiftEnd !== undefined) emp.shiftEnd = shiftEnd.trim();

      if (newGroupId && Number(newGroupId) !== Number(groupId)) {
        const targetGroup = db.groups.find(g => g.id === Number(newGroupId));
        if (targetGroup) {
          group.employees = group.employees.filter(e => e.id !== employeeId);
          targetGroup.employees.push(emp);
        }
      }

      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, employee: emp, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 12. POST Admin Override Day Off
  if (pathname === '/api/admin/override' && req.method === 'POST') {
    try {
      const { groupId, employeeId, day } = await getRequestBody(req);
      const db = readDb();

      const group = db.groups.find(g => g.id === Number(groupId));
      if (!group) throw new Error('Grup bulunamadı');

      const emp = group.employees.find(e => e.id === employeeId);
      if (!emp) throw new Error('Çalışan bulunamadı');

      emp.selectedDay = day || null;
      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 13. POST Admin Manage Admins
  if (pathname === '/api/admin/manage-admins' && req.method === 'POST') {
    try {
      const { action, admin } = await getRequestBody(req);
      const db = readDb();
      if (!db.admins) db.admins = [];

      if (action === 'add') {
        const newAdmin = {
          id: `adm_${Date.now()}`,
          name: admin.name || 'Yeni Yönetici',
          pin: admin.pin || '1234',
          role: admin.role || 'Yönetici'
        };
        db.admins.push(newAdmin);
      } else if (action === 'delete') {
        if (db.admins.length <= 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Sistemde en az 1 yönetici kalmalıdır.' }));
          return;
        }
        db.admins = db.admins.filter(a => a.id !== admin.id);
      } else if (action === 'update') {
        const target = db.admins.find(a => a.id === admin.id);
        if (target) {
          if (admin.name) target.name = admin.name;
          if (admin.pin) target.pin = admin.pin;
          if (admin.role) target.role = admin.role;
        }
      }

      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 14. POST Admin Settings
  if (pathname === '/api/admin/settings' && req.method === 'POST') {
    try {
      const { settings, activeWeek } = await getRequestBody(req);
      const db = readDb();

      if (settings) {
        db.settings = { ...db.settings, ...settings };
      }
      if (activeWeek) {
        db.activeWeek = { ...db.activeWeek, ...activeWeek };
      }

      writeDb(db);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: db }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 15. GET Excel CSV Export
  if (pathname === '/api/export/csv' && req.method === 'GET') {
    const db = readDb();
    let csv = '\uFEFFGrup;Kurye Adı;Telefon;Vardiya Başlangıç;Vardiya Bitiş;İzin Günü;Durum\n';

    for (const g of db.groups) {
      for (const e of g.employees) {
        csv += `"${g.name}";"${e.name}";"${e.phone || ''}";"${e.shiftStart || ''}";"${e.shiftEnd || ''}";"${e.selectedDay || 'Seçilmedi'}";"${e.selectedDay ? 'İzinli' : 'Çalışıyor'}"\n`;
      }
    }

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Quick_Ekpress_Izin_Listesi_${Date.now()}.csv"`
    });
    res.end(csv);
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' || pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin') ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': 'true'
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Server File Error');
  }
}

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const server = http.createServer(handleRequest);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================================`);
    console.log(`🚀 HAFTALIK ÇALIŞAN İZİN VE VARDİYA SİSTEMİ BAŞLATILDI!`);
    console.log(`👉 Yerel Bağlantı: http://localhost:${PORT}`);
    console.log(`👉 10 Grup x 7 Çalışan | 24/7 Canlı Senkronizasyon: AKTİF`);
    console.log(`===========================================================`);
  });
}
