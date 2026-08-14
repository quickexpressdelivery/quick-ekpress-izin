# 🛵 QUİCK EKPRESS DELİVERY — Haftalık İzin ve Vardiya Çizelgesi Portalı

Motorlu kuryeler ve saha operasyon ekipleri için geliştirilmiş, 7/24 canlı senkronizasyona (SSE) sahip, mobil veri ve Wi-Fi uyumlu haftalık izin ve vardiya yönetim sistemi.

---

## ✨ Özellikler

- 🛵 **Kurye Portalı:**
  - Kuryelerin telefon numaralarıyla doğrudan kendi gruplarına odaklanma (`smooth-scroll` & grup parlaması).
  - **Gizlilik Koruması (KVKK):** İzin seçim ekranında çalışanların telefon numaraları gizlenir, yalnızca kurye adları ve vardiyalar görünür.
  - **Tek İzin Kuralı:** Hafta boyunca kurye başına en fazla 1 gün izin seçimi (yeni gün seçilince eski gün otomatik devredilir).
  - **Grup İçi Kota (Çakışma Önleme):** Aynı grupta aynı güne 2. kişinin izin alması sunucu seviyesinde engellenir (`HTTP 409 Conflict`).
  - **Zaman Penceresi Kilidi:** Belirlenen gün ve saat aralıkları dışında izin seçimi otomatik kilitlenir (`HTTP 403 Forbidden`).

- 👑 **Yönetici Kontrol Paneli (`/admin`):**
  - PIN ve rol yetkilendirmesi.
  - 📋 **Elle Vardiya Saati Düzenleme:** Açılır popup pencereye gerek kalmadan, doğrudan tablo kutucuklarına klavyeyle vardiya saati yazabilme.
  - ✏️ **Kurye Düzenleme:** Kurye adı, telefon numarası, vardiya saatleri ve grup transferi yönetimi.
  - 🏢 **Dinamik Grup & Kurye:** Sınırsız yeni grup ekleme/silme, kurye ekleme/silme.
  - 💬 **WhatsApp Paylaşım Entegrasyonu:** Tek tıkla canlı link içeren hazır mesaj şablonu.
  - 📊 **Excel / CSV Dışa Aktarma:** UTF-8 BOM'lu Türkçe karakter uyumlu dışa aktarım.
  - 🖨️ **Resmi PDF Baskı Şablonu:** Antetli başlık ve yetkili onay/imza kutulu A4 çıktı.

- ⚡ **Canlı Senkronizasyon (SSE):** Sayfayı yenilemeye gerek kalmadan tüm bağlı cihazlarda anlık veri güncellemesi.

---

## 🚀 Kurulum ve Yerel Çalıştırma

```bash
# Bağımlılık gerektirmez (Saf Node.js mimarisi)
node server.js
```

Tarayıcınızdan erişin:
- **Kurye Portalı:** `http://localhost:3000`
- **Yönetici Paneli:** `http://localhost:3000/admin` *(PIN: `1234`)*

---

## 🌐 Vercel & Cloud Yayınlama

1. Bu depoyu GitHub hesabınıza aktarın (`quick-ekpress-izin`).
2. [Vercel](https://vercel.com) üzerinden projeyi import edin.
3. Proje `vercel.json` ve `api/index.js` ile serverless olarak anında yayına girer.

---

## 📄 Lisans
MIT License © 2026 QUİCK EKPRESS DELİVERY
