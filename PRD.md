# PRD — Adu Layangan

Game adu layangan harian untuk Reddit. Peserta **Reddit's Game of the Day Hackathon**, batas kirim **Rabu 9 Desember 2026, 09.00 WIB**.

Versi 0.1 — 14 November 2026 — **menunggu persetujuanmu**. Belum ada kode untuk konsep ini.

Konsep ini menggantikan Tebar (PRD lamanya di [archive/PRD-tebar.md](archive/PRD-tebar.md)). Alasan dan kriteria pemilihannya ada di [../HACKATHON-REDDIT.md](../HACKATHON-REDDIT.md), bagian "Konteks kompetisi".

## 1. Ringkasan

Setiap hari ada satu langit baru di atas kampung: arah angin, rintangan, dan layangan lawan. Kamu menerbangkan layangan aduan dengan satu jari, lalu memakai **benangmu sendiri untuk memotong benang layangan lain**. Satu ronde berlangsung 60 detik, atau selesai lebih cepat kalau benangmu yang putus.

Lawanmu adalah:
- jagoan kampung yang dikendalikan komputer;
- rekaman terbang pemain lain hari itu;
- **Raja Langit**, yaitu rekaman pemain terbaik kemarin. Semua orang hari ini berusaha menjatuhkannya.

Rekaman terbangmu sendiri ikut jadi lawan bagi pemain lain, dan layangan yang kamu potong masuk ke koleksimu.

Hook dalam satu kalimat: **"Fly your kite. Cut their strings. Yesterday's champion is today's target."**

## 2. Kenapa konsep ini

| Kriteria | Bagaimana dipenuhi |
|---|---|
| K1 Dipahami dalam 5 detik | Layangan, benang, potong. Kontrolnya satu jari: tahan dan lepas |
| K2 Konten dari komunitas | Setiap ronde terekam dan menjadi lawan orang lain; juara kemarin menjadi bos hari ini; desain layanganmu terlihat oleh semua yang melawannya |
| K3 Sesi harian singkat | Tiga gulungan benang per hari, masing-masing satu ronde 60 detik |
| K4 Bukan genre padat | Tidak ada game layangan di 1.888 entri lima hackathon Reddit sebelumnya, maupun di 86 game Reddit yang aktif (dicek 14 Nov) |
| K5 Seru walau sendirian | Jagoan kampung (AI) selalu ada; rekaman pemain bisa kita isi sebelum penjurian |
| K6 Selesai dalam 24 hari | 2D, satu layar, fisika sederhana; kerangka server dari Tebar dipakai ulang |
| K7 Kamu menyukainya | Kamu yang memilih |

Pola juara yang ditiru: *Tower Race* (mengalahkan menara milik pemain lain), *Delta-V Racing* (balapan melawan rekaman pemain), *BridgeDit!* (konten harian dengan papan peringkat), dan *Sketchy Solutions* (hasil pemain jadi tontonan bagi pemain lain).

## 3. Cara main

### 3.1 Kontrol: satu jari, gaya layangan aduan sungguhan
- **Tahan (tarik benang):** layangan melesat ke arah hidungnya menghadap.
- **Lepas (ulur benang):** layangan berputar perlahan di tempat dan terbawa angin.

Itulah cara layangan aduan dikendalikan di dunia nyata: biarkan berputar sampai hidungnya menghadap arah yang kamu mau, lalu tarik.

Di layar, petunjuknya cukup dua kata: **Hold to pull · Release to turn**.

### 3.2 Benang dan potong-memotong
- Benang terbentang dari tempatmu berdiri (atap di bawah layar) ke layangan.
- Kalau dua benang bersilangan:
  - benang yang sedang **ditarik** memotong benang yang sedang **diulur**;
  - kalau dua-duanya ditarik, yang bergerak lebih cepat menang;
  - kalau dua-duanya diulur, tidak terjadi apa-apa.
- Layangan yang benangnya putus melayang pergi terbawa angin: **"Layangan putus!"**
- Ronde selesai saat benangmu putus, atau setelah 60 detik.

### 3.3 Skor
| Kejadian | Poin |
|---|---|
| Memotong jagoan kampung atau rekaman pemain | 100 |
| Memotong Raja Langit | 300 |
| Bertahan sampai detik ke-60 | 150 |
| Sisa detik saat semua lawan sudah terpotong | 5 per detik |

Angka ini awal dan akan disetel setelah uji main.

### 3.4 Tiga gulungan benang
- Setiap hari kamu punya **3 gulungan benang**, artinya 3 ronde yang dihitung. **Ronde terbaik** yang masuk papan peringkat.
- Setelah benang habis, kamu tetap bisa berlatih tanpa batas, tapi latihan tidak dicatat dan tidak menjadi rekaman lawan.
- Tiga kesempatan lebih adil untuk game ketangkasan daripada "hanya ronde pertama yang dihitung", tapi tetap membuat tiap ronde terasa berharga.

### 3.5 Koin dan toko kosmetik (disetujui 14 Nov)
Koin hanya untuk tampilan. Tidak ada yang bisa dibeli untuk membuat layangan lebih cepat atau benang lebih kuat, karena semua pemain terbang di langit yang sama dan skor harian harus menunjukkan keahlian.

**Mendapat koin.** Server yang menghitung, dari ronde yang diputar ulang (F4), jadi koin tidak bisa dipalsukan. Hanya 3 gulungan pertama tiap hari yang memberi koin; latihan sesudahnya tidak.

| Dari | Koin |
|---|---|
| Modal awal, sekali saat pertama main | 100 |
| Setiap layangan yang kamu potong | 10 |
| Bertahan sampai waktu habis | 15 |
| Membersihkan langit | 25 |
| Gulungan pertama hari itu | 20 |
| Streak: hari ke-2 berturut-turut dan seterusnya, di gulungan pertama | 5 per hari, paling banyak 25 |

**Toko** ada di dalam lembar *Your kite*. Barang terkunci bisa dicoba dulu di pratinjau, lalu dibeli. Barang yang sudah dibeli tetap milikmu (selama data pemain disimpan, lihat 7.5).

| Barang | Harga |
|---|---|
| Motif batik Mega Mendung, motif Truntum | 60 |
| Motif Sisik | 80 |
| Motif Pelangi | 120 |
| Ekor Pita Ganda | 50 |
| Ekor Rumbai | 70 |
| Ekor Lampion (bercahaya) | 140 |
| Benang Emas | 80 |
| Benang Neon | 100 |
| Benang Pelangi | 140 |

Semua barang awal (3 bentuk, 8 motif, 12 warna, ekor pita, benang biasa) tetap gratis. Koin tidak bisa dibeli dengan uang, tidak bisa ditukar, dan tidak ada hadiah acak. Angka ini awal dan akan disetel setelah uji main.

## 4. Langit harian

Dibuat otomatis dari tanggal (UTC), jadi semua pemain mendapat langit yang sama:
- **Angin:** arah dan kekuatan dasar, plus jadwal hembusan.
- **Rintangan** (mulai M4): burung, tiang listrik, pohon kelapa.
- **Jagoan kampung (AI):** 3–4 layangan dengan watak berbeda, misalnya *Si Gesit* (cepat), *Si Nekat* (menyerang), dan *Si Kalem* (bertahan).
- **Raja Langit:** rekaman skor tertinggi kemarin. Kalau belum ada pemain, diganti jagoan AI terkuat.
- **Rekaman pemain hari ini:** hingga 4 rekaman, dipilih acak dari ronde hari itu, sehingga setiap ronde terasa berbeda.

Setiap hari pukul 00.00 UTC (07.00 WIB) app membuat post baru. Judulnya menyebut Raja Langit hari itu, misalnya *"Day 5 · Can you cut down u/raja's kite?"*

## 5. Lingkup fitur

### 5.1 Wajib
- **F1 — Terbang dan memotong** (bagian 3), dengan fisika yang deterministik.
- **F2 — Langit harian** (bagian 4), dengan jagoan kampung AI.
- **F3 — Tiga gulungan benang** dan latihan tanpa batas.
- **F4 — Penilaian di server.** Client hanya mengirim urutan ketukan (kapan tahan, kapan lepas). Server memutar ulang ronde di langit yang sama dan menghitung skornya sendiri, jadi skor tidak bisa dipalsukan.
- **F5 — Rekaman sebagai lawan.** Ronde yang dihitung disimpan sebagai rekaman, termasuk Raja Langit dari kemarin.
- **F6 — Kartu hasil:** skor, layangan yang terpotong (dengan desain dan nama pemiliknya), peringkat hari ini, streak, lalu satu langkah berikutnya.
- **F7 — Kartu di feed:** langit hari ini yang bergerak, Raja Langit, jumlah pemain, satu tombol Play.
- **F8 — Terbang pertama:** latihan 15 detik dengan petunjuk di layar, sekali untuk pemain baru, bisa dilewati.
- **F9 — Papan peringkat** harian dan mingguan, plus streak (memakai kerangka server Tebar).
- **F10 — Bagikan hasil** sebagai komentar atas nama pengguna, berupa balasan ke komentar tersemat, lewat tombol terpisah dengan pratinjau.
- **F11 — Devvit Journeys**, lapor masalah, post harian otomatis, menu moderator.

### 5.2 Sebaiknya ada
- **F12 — Desain layangan:** pilih bentuk, warna, dan motif (batik kawung, parang, garis) dari pilihan yang tersedia, tanpa teks bebas. Desainmu terlihat di layar semua orang yang melawan rekamanmu. *(Dibuat 14 Nov, bersama nama dari daftar kata.)*
- **F19 — Koin dan toko kosmetik** (bagian 3.5). *(Disetujui 14 Nov.)*
- **F13 — Koleksi layangan putus:** setiap layangan yang kamu potong tersimpan dengan desain dan nama pemiliknya.
- **F14 — Animasi "ngejar layangan putus"** di akhir ronde, sebagai momen lucu yang enak di-screenshot.
- **F15 — Rintangan** dan variasi waktu (pagi, sore, malam dengan lampion).

### 5.3 Kalau sempat
- **F16 — Lintasan buatan pemain** yang diterbitkan sebagai post.
- **F17 — Tim kampung** lewat flair, dengan total potongan per tim.
- **F18 — Suara:** angin, tarikan benang, dan bunyi "tas!" saat benang putus.

### 5.4 Tidak masuk
- Wallet, blockchain, token, taruhan, dan pembayaran.
- Tautan ke luar Reddit, panggilan ke server luar, dan LLM.
- Teks bebas dari pemain di dalam app.
- Main bersamaan secara langsung (realtime). Semua lawan berupa AI atau rekaman.

## 6. Layar

| Layar | Isi |
|---|---|
| Kartu feed | Langit hari ini yang bergerak, Raja Langit, jumlah pemain, tombol Play |
| Arena | Langit tegak penuh layar, layangan dan benang, sisa waktu, skor, 3 ikon gulungan, petunjuk "Hold to pull" |
| Hasil | Skor, layangan terpotong, peringkat, streak; tombol Fly again (jika benang masih ada), Share, Standings |
| Standings | Peringkat hari ini dan minggu ini, Raja Langit |
| Layanganku | Desain layangan dan koleksi layangan putus |

Tata letak tegak, dirancang untuk ponsel lebih dulu. Di desktop arena berada di tengah dengan latar kampung di kiri dan kanan.

## 7. Rancangan teknis

### 7.1 Yang dipakai ulang dari Tebar
- **Server:** antarmuka penyimpanan dan versi memorinya, rute, post harian sekali sehari, streak, peringkat, dan masa simpan 30 hari.
- **Pendukung:** kalender UTC, pratinjau lokal dengan server sungguhan, kerangka uji, dan konfigurasi Devvit.
- **Yang tidak dipakai:** mesin dan tampilan Tebar. Kodenya dipindah ke `archive/`, dan tidak ikut di-build.

### 7.2 Simulasi
- Ditulis di `src/shared/` dan dipakai oleh client (untuk bermain) dan server (untuk menilai).
- Langkah waktu tetap: 60 tick per detik, jadi satu ronde 3.600 tick.
- **Deterministik di semua perangkat:** hanya memakai operasi aritmetika dasar; sinus dan kosinus dari tabel buatan sendiri, karena hasil `Math.sin` bisa berbeda tipis antara iPhone dan server. Tidak memakai angka acak tanpa seed.
- Log ketukan hanya berisi nomor tick saat jari menekan dan melepas, jadi ukurannya beberapa ratus byte.
- Server menghitung ulang 3.600 tick untuk sekitar 10 layangan; perkiraannya di bawah 50 ms.

### 7.3 Rekaman
- Posisi layangan dan status tarik/ulur disimpan 20 kali per detik, dalam bentuk angka bulat yang dipadatkan: sekitar 5 KB per ronde.
- Disimpan per hari: rekaman yang dihitung (satu per pemain), dan Raja Langit.

### 7.4 Gambar
- Satu kanvas 2D. Benang digambar sebagai kurva melengkung; untuk deteksi potong, benang diperlakukan sebagai beberapa ruas garis.
- Target 60 fps di ponsel menengah.
- Semua aset digambar dengan kode atau dibundel di dalam app. Tidak ada aset dari luar.

### 7.5 Penyimpanan (Redis)
| Data | Masa simpan |
|---|---|
| Ronde terbaik dan rekaman tiap pemain per hari | 30 hari |
| Raja Langit per hari | 30 hari |
| Profil: nama, streak, desain layangan, koleksi | 30 hari sejak terakhir main |
| Dompet: koin, barang yang dimiliki, streak | 30 hari sejak terakhir berubah |
| Peringkat harian dan mingguan | 30 hari |

## 8. Kepatuhan Devvit Rules

| Aturan | Cara dipenuhi |
|---|---|
| Tanpa kripto, keuangan, atau judi | Tidak ada taruhan atau hadiah bernilai uang |
| Tanpa tautan keluar | Tidak ada |
| Orisinal, bukan clone | Mekanik layangan aduan dari tradisi, bukan dari game tertentu; nama, gambar, dan UI buatan sendiri |
| Tanpa merek Reddit | Tidak ada Snoo atau logo Reddit |
| Aksi atas nama pengguna eksplisit | Share, flair, dan subscribe masing-masing lewat tombol sendiri dengan pratinjau |
| Ekspresi pengguna dibatasi | Desain layangan hanya dari pilihan bentuk, warna, dan motif |
| Data seminimal mungkin dan bisa terhapus | Semua data kedaluwarsa paling lama 30 hari |

## 9. Kecocokan dengan kriteria juri

| Kriteria | Yang kita tawarkan |
|---|---|
| Delightful UX | Kontrol satu jari yang terasa nyata, benang putus yang dramatis, langit kampung yang hangat |
| Polish | Terbang pertama yang mengajari dalam 15 detik, satu kartu hasil, tampil penuh di layar ponsel |
| Reddit-y | Juara kemarin jadi bos hari ini; rekamanmu jadi lawan orang lain; layanganmu terlihat oleh semua yang melawannya; hasil dibagikan di komentar |
| Daily Content | Langit, angin, dan Raja Langit baru setiap hari; tiga gulungan benang per hari |

## 10. Pengujian

- **Simulasi:** uji otomatis, termasuk bahwa ronde yang sama dari log ketukan yang sama selalu menghasilkan skor yang sama.
- **Server:** penilaian ulang, batas tiga gulungan, rekaman, dan Raja Langit.
- **Tampilan:** saya periksa di browser lokal, desktop dan 375 px.
- **Rasa terbang — gerbang di akhir M1:** kamu mencoba prototipe sendiri. Kalau terbangnya tidak terasa seru, kita setel atau ganti arah sebelum membangun yang lain.
- **Reddit:** playtest olehmu di setiap akhir tahap.
- **Pemain sungguhan:** minimal 5 orang sebelum submit.

## 11. Tahapan

| Tahap | Isi | Sampai |
|---|---|---|
| M0 | PRD disetujui; nama, app, dan subreddit diputuskan | 15 Nov |
| M1 | Prototipe: terbang, benang, potong, 3 jagoan AI, main lokal. **Gerbang: kamu mencobanya** | 18 Nov |
| M2 | Langit harian, skor, 3 gulungan, penilaian ulang di server, rekaman dan Raja Langit, kartu hasil dan feed; **playtest di Reddit** | 23 Nov |
| M3 | Terbang pertama, bagikan hasil, desain layangan, koleksi, Journeys, lapor masalah | 29 Nov |
| M4 | Gambar kampung, animasi layangan putus, rintangan, suara, rapikan untuk ponsel, isi rekaman awal, uji pemain | 4 Des |
| M5 | README, deskripsi Devpost, video di bawah 1 menit, submit | 7 Des |
| Cadangan | Perbaikan terakhir | 8 Des |

Saya melapor di setiap akhir tahap, terutama di gerbang M1.

## 12. Pembagian kerja

| Saya | Kamu |
|---|---|
| Semua kode, uji otomatis, pemeriksaan tampilan lokal | Mencoba prototipe di gerbang M1 |
| README, deskripsi Devpost, naskah video | Playtest di Reddit dan melaporkan hasilnya |
| Menyetel angka dari data uji | Membuat app dan subreddit baru (kalau diputuskan); daftar di Devpost |
| | Mengajak 5 orang mencoba; merekam video dan menekan submit |

## 13. Keputusan yang perlu darimu

1. **Nama app dan subreddit.** App `tebar-game` dan r/TebarGame sudah permanen. Pilihannya:
   - **Buat baru (saran saya):** app `adu-layangan` dan subreddit misalnya r/AduLayangan. Butuh sekitar 5 menit: `npx devvit init --force` sekali lagi, ditambah membuat subreddit. Juri melihat nama yang sama di mana-mana.
   - **Pakai yang ada:** tetap di `tebar-game` dan r/TebarGame. Lebih cepat, tapi juri melihat game "Adu Layangan" di subreddit bernama Tebar.
2. **Folder dan repo.** Tetap di folder `tebar/` seperti permintaanmu. Folder ini belum punya commit, jadi bisa diganti nama menjadi `adu-layangan/` kapan saja kalau mau.
3. **Bahasa.** Antarmuka berbahasa Inggris untuk juri dan pemain Reddit, dengan istilah Indonesia sebagai identitas (Layangan putus!, Raja Langit).

## 14. Risiko

| Risiko | Penanganan |
|---|---|
| Rasa terbang tidak seru | Prototipe lebih dulu; gerbang di akhir M1 sebelum membangun yang lain |
| Kontrol "lepas untuk berputar" asing bagi pemain baru | Terbang pertama 15 detik; putaran awal yang lebih cepat; lingkaran penunjuk arah hidung |
| Hasil simulasi berbeda antara ponsel dan server | Hanya aritmetika dasar dan tabel trigonometri sendiri; uji yang membandingkan hasil dengan rekaman |
| Subreddit demo sepi saat dinilai | Jagoan AI selalu ada; kita isi rekaman dari penguji sebelum penjurian |
| Waktu 24 hari | Fitur 5.1 selesai di M3; fitur 5.2 dan 5.3 dipotong dari bawah bila perlu |
| Penjurian sulit ditebak | Penuhi keempat kriteria tanpa titik lemah, kirim 2 hari sebelum batas, dan aktif di r/Devvit serta Discord |
