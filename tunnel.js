import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TUNNEL_URL_FILE = path.join(__dirname, 'data', 'tunnel_url.txt');
const PUBLIC_JSON_FILE = path.join(__dirname, 'public', 'tunnel_url.json');

let currentProcess = null;

function log(msg) {
  console.log(`[QUİCK EKPRESS CANLI TÜNEL ${new Date().toLocaleTimeString('tr-TR')}] ${msg}`);
}

function saveUrl(url) {
  try {
    fs.writeFileSync(TUNNEL_URL_FILE, url, 'utf8');
    fs.writeFileSync(PUBLIC_JSON_FILE, JSON.stringify({ url, status: 'PERMANENT_ONLINE', updatedAt: new Date().toISOString() }), 'utf8');
  } catch (e) {}
}

function startTunnel() {
  if (currentProcess) {
    try { currentProcess.kill(); } catch (e) {}
    currentProcess = null;
  }

  log(`===========================================================`);
  log(`🌐 7/24 CANLI İNTERNET TÜNELİ BAŞLATILIYOR (localhost.run)...`);
  log(`===========================================================`);

  currentProcess = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=10',
    '-o', 'ServerAliveCountMax=99999',
    '-o', 'ConnectTimeout=10',
    '-R', '80:127.0.0.1:3000',
    'nokey@localhost.run'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const handleData = (data) => {
    const text = data.toString();
    console.log(text);
    const match = text.match(/https:\/\/[a-zA-Z0-9.-]+\.lhr\.life/);
    if (match) {
      const url = match[0];
      saveUrl(url);
      log('\n===========================================================');
      log('🎉 %100 AKTİF CANLI İNTERNET LİNKİNİZ YAYINDA!');
      log(`👉 KURYELER İÇİN 7/24 LİNK: ${url}`);
      log(`👑 YÖNETİCİ PANELİ LİNKİ:   ${url}/admin`);
      log('===========================================================\n');
    }
  };

  currentProcess.stdout.on('data', handleData);
  currentProcess.stderr.on('data', handleData);

  currentProcess.on('close', (code) => {
    log(`Tünel kapandı (${code}). 2 saniye içinde otomatik yeniden bağlanılıyor...`);
    setTimeout(startTunnel, 2000);
  });

  currentProcess.on('error', (err) => {
    log(`Tünel hatası: ${err.message}. Yeniden deneniyor...`);
    setTimeout(startTunnel, 2000);
  });
}

startTunnel();
