# PRD — Tebar (nama kerja)

Teka-teki tebar harian untuk Reddit, dibangun dari mesin aturan Dakon.
Untuk **Reddit's Game of the Day Hackathon**. Batas kirim: **Rabu 9 Desember 2026, 09.00 WIB**.

Versi 0.1 — 13 November 2026 — **menunggu persetujuanmu**. Belum ada kode.

Dokumen terkait: [analisis aturan lomba](../HACKATHON-REDDIT.md) · [Devvit Rules](../dakon/devvit-rulles.md) · [Devvit Journeys](../dakon/devvit-journey.md) · [Devvit Web](../dakon/devvit-web-overview.md)

## 1. Ringkasan

Setiap hari semua pemain mendapat papan congklak yang sama dan **5 kali ambil**. Setiap ambilan ditebar mengikuti aturan congklak: beranting saat biji terakhir jatuh di lubang berisi, tembak saat jatuh di lubang kosong milik sendiri. Skor adalah jumlah biji di lumbung. Server tahu skor sempurna, jadi hasil diberi bintang dan bisa dibandingkan dengan pemain lain.

Di atas itu ada tiga lapisan komunitas: papan buatan pemain yang diterbitkan sebagai post Reddit, papan pilihan warga setiap Minggu, dan lumbung desa yang diisi bersama.

Tanpa wallet, tanpa blockchain, tanpa link keluar.

## 2. Tujuan dan ukuran berhasil

| Tujuan | Ukuran |
|---|---|
| Lolos tahap 1 penjurian | Berjalan di Reddit dengan Devvit Web, sesuai tema game harian |
| Kuat di empat kriteria | Tidak ada kriteria yang kosong: UX, Polish, Reddit-y, Daily Content (tabel di bagian 11) |
| Bisa dinilai hanya dari post demo | Pemain baru menyelesaikan satu papan tanpa membaca petunjuk panjang, di ponsel, di bawah 2 menit |
| Patuh Devvit Rules | Semua butir di bagian 10 terpenuhi |

Target hadiah: Best Daily Game. Target realistis yang tetap dikejar: honorable mention. Kategori Best Ported tidak dikejar (alasannya di analisis lomba).

## 3. Aturan permainan

### 3.1 Papan
- 5 lubang per sisi dan satu lumbung, seperti papan Ringkas di Dakon.
- Pemain selalu di sisi Selatan (bawah). Tidak ada lawan; baris Utara adalah bagian papan yang ikut ditebari dan bisa ditembak.
- Isi awal tiap lubang 0–4 biji, total sekitar 16–26 biji. Angka kecil supaya tebaran bisa dihitung di kepala.

### 3.2 Satu ambilan
1. Pilih satu lubang Selatan yang berisi. Semua bijinya diambil.
2. Biji ditebar satu per satu ke lubang berikutnya, termasuk lumbung sendiri.
3. Biji terakhir menentukan lanjutannya:

| Biji terakhir jatuh di | Akibat |
|---|---|
| Lubang berisi | **Beranting**: semua biji di lubang itu diambil dan tebaran lanjut |
| Lubang kosong di sisi sendiri | **Tembak**: biji itu dan semua biji di lubang seberangnya masuk lumbung |
| Lubang kosong di sisi seberang, atau lumbung | Ambilan selesai |

### 3.3 Satu sesi
- Pemain punya **5 ambilan** (4 di hari mudah, 6 di hari sulit). Setiap pilihan lubang menghabiskan satu ambilan.
- Sesi selesai saat ambilan habis atau baris Selatan kosong.
- **Skor = biji di lumbung.** Bintang: ★★★ skor sempurna, ★★ minimal 80% dari sempurna, ★ minimal 55%. Ambang ini disetel ulang setelah uji main.
- **Sesi pertama yang dihitung.** Setelah itu pemain bebas mencoba lagi dalam mode jelajah, yang tidak mengubah skor.
- Jalur sempurna baru dibuka besok, sebagai putar ulang.

### 3.4 Beda dari Dakon
Aturan "biji terakhir di lumbung berarti jalan lagi" tidak dipakai. Alasannya dari simulasi di bawah: dengan aturan itu satu sesi bisa sampai 12 pilihan dan hasilnya sulit dibaca.

### 3.5 Hasil simulasi
Saya menjalankan mesin Dakon pada 1.200 papan acak per varian (5 lubang, 0–4 biji per lubang):

| Varian | Panjang sesi | Pemain teliti* dapat sempurna | Pemain teliti* dapat | Pilihan acak dapat |
|---|---|---|---|---|
| 3 ambilan + jalan lagi gratis | 5–12 pilihan | 2% | 63% dari sempurna | 61% |
| **5 ambilan tetap** | **selalu 5** | **10%** | **78%** | **55%** |
| 4 ambilan tetap | selalu 4 | 19% | 80% | 53% |
| 6 ambilan tetap | 5–6 | 4% | 75% | 56% |

*Pemain teliti = menghitung hasil tiap lubang satu langkah ke depan lalu memilih yang terbaik.

Artinya dengan ambilan tetap, ketelitian terbayar (78% lawan 55%), tapi skor sempurna tetap butuh perencanaan beberapa langkah. Hanya sekitar 0,5% dari semua jalur yang sempurna. Menghitung semua jalur satu papan butuh kurang dari 1 milidetik, jadi server bisa memeriksa papan apa pun seketika.

## 4. Konten harian

- **Senin–Sabtu:** papan dibuat otomatis dari tanggal (UTC), jadi semua orang mendapat papan yang sama. Server membuang kandidat yang terlalu mudah atau terlalu acak, dan tingkat sulit naik sepanjang minggu: Senin 4 ambilan, Sabtu 6 ambilan.
- **Minggu:** papan pilihan warga, yaitu papan buatan pemain dengan upvote terbanyak minggu itu. Kalau belum ada, dipakai papan otomatis.
- Setiap hari pukul 00.00 UTC (07.00 WIB) app membuat satu post baru dan satu komentar tersemat untuk tempat membagikan hasil.
- Post kemarin tetap bisa dimainkan, tapi tidak masuk papan peringkat hari ini.

## 5. Lingkup fitur

### 5.1 Wajib
- **F1 — Papan harian.** Sesuai bagian 3 dan 4.
- **F2 — Pilih lalu tebar.** Ketuk lubang untuk memilih; muncul penanda tempat putaran pertama berakhir. Ketuk tombol Tebar untuk memastikan. Ini mencegah salah ketuk di ponsel.
- **F3 — Animasi tebar.** Biji berjalan satu per satu, lubang beranting disorot, tembakan terlihat jelas. Ketuk untuk mempercepat.
- **F4 — Kartu hasil.** Skor dibanding skor sempurna, bintang, streak, sebaran skor pemain hari itu dan posisi pemain di dalamnya, lalu satu langkah berikutnya.
- **F5 — Penilaian di server.** Client hanya mengirim urutan lubang. Server memutar ulang dengan mesin yang sama dan menghitung skor, jadi skor tidak bisa dipalsukan.
- **F6 — Streak dan papan peringkat.** Peringkat harian berupa daftar pemain yang mencapai skor sempurna; peringkat mingguan dari jumlah bintang.
- **F7 — Layar awal di feed.** Nama game, satu kalimat, tanggal dan nomor hari, jumlah pemain hari ini, pratinjau papan, satu tombol Main.
- **F8 — Belajar sambil main.** Papan latihan 2 ambilan dengan petunjuk kontekstual, sekali saja untuk pemain baru, bisa dilewati. Tidak ada halaman aturan panjang.
- **F9 — Bagikan hasil.** Tombol terpisah yang mengirim komentar sebagai pengguna, sebagai balasan ke komentar tersemat, dengan pratinjau teksnya.
- **F10 — Devvit Journeys.** Sesuai peta di bagian 8.
- **F11 — Lapor masalah.** Tautan ke modmail subreddit dari menu game.
- **F12 — Post harian otomatis** dan menu moderator untuk membuat post secara manual.

### 5.2 Sebaiknya ada
- **F13 — Papan buatan pemain.** Pemain menaruh biji di lubang dan memilih jumlah ambilan. Server menolak papan yang tidak layak dan menghitung skor sempurnanya. Papan diterbitkan sebagai post Reddit atas nama pembuatnya dan bisa dimainkan siapa saja.
- **F14 — Papan pilihan warga** setiap Minggu (bagian 4).
- **F15 — Jalur sempurna kemarin** sebagai putar ulang biji demi biji.
- **F16 — Lumbung desa.** Semua biji yang dikumpulkan pemain dijumlahkan. Di ambang tertentu terbuka tema baru untuk semua orang: biji kerang, biji asam, kelereng.

### 5.3 Kalau sempat
- **F17 — Flair streak**, hanya dipasang kalau pemain menekan tombolnya sendiri.
- **F18 — Suara** ketukan biji yang dibuat dengan WebAudio, dengan tombol bisu.
- **F19 — Arsip 7 hari** untuk mengejar papan yang terlewat, tanpa mengubah streak.

### 5.4 Tidak masuk
- Wallet, blockchain, token, atau penyebutan BOT Chain.
- Main dua pemain dan lawan komputer.
- Pembayaran, panggilan ke server luar, dan LLM. Ketiganya butuh persetujuan review, sedangkan lomba melarang mengajukan publishing.
- Tautan ke situs atau app lain.
- Teks bebas dari pemain di dalam app.

## 6. Layar

| Layar | Isi |
|---|---|
| Awal (kartu di feed) | F7 |
| Main | Papan, sisa ambilan, skor berjalan dan target skor sempurna, tombol Tebar |
| Hasil | F4, lalu tombol Bagikan, Jelajah lagi, dan Papan warga |
| Papan warga | Daftar papan buatan pemain dan tombol Buat papan |
| Buat papan | Papan kosong, tambah dan kurang biji per lubang, jumlah ambilan, nama dari daftar kata, pratinjau tingkat sulit |
| Menu | Cara main singkat, tema, bisu, lapor masalah |

Di ponsel papan berdiri tegak, seperti tampilan Dakon di 375 px. Semua layar harus muat tanpa menggulir.

## 7. Integrasi Reddit

| Hal | Cara |
|---|---|
| Post harian | Dibuat app lewat jadwal harian; dijaga supaya tidak dobel |
| Komentar tersemat | Dibuat app di tiap post harian: tempat membalas dengan hasil |
| Bagikan hasil | Komentar atas nama pengguna, hanya lewat tombol, dengan pratinjau dan keterangan bahwa nama pengguna terlihat |
| Papan buatan pemain | Post atas nama pembuatnya, ditandai sebagai konten buatan pengguna. Upvote, komentar, lapor, dan hapus memakai fitur Reddit |
| Papan pilihan warga | App membaca jumlah upvote. Tidak ada imbalan untuk memberi upvote |
| Flair | Hanya atas pilihan pemain |
| Subscribe | Ajakan di kartu hasil, tombol terpisah, tidak pernah jadi syarat |

Belum pasti: Devvit Rules menyebut konten dari app yang belum disetujui diposting dari akun app. Kalau begitu perilakunya saat lomba, komentar hasil dan post papan akan muncul atas nama app. Kodenya tetap ditulis untuk "sebagai pengguna", dan ini dicek saat playtest pertama.

## 8. Peta Devvit Journeys

| Event | Kapan | Data |
|---|---|---|
| `App.Ready` | Papan selesai dimuat dan bisa diketuk | — |
| `Journey.Start` | Pemain menekan Main | — |
| `Journey.Progress` | Setiap tebaran selesai | `progress` = ambilan terpakai dibagi total; `action: "sow"` |
| `Journey.Interaction` | Buka cara main, mulai jelajah, buka bagikan, buka pembuat papan, ganti tema | `action` saja |
| `Journey.End` | Server selesai menilai sesi | `complete: true`, `game: { win: skor sempurna, score }` |
| `Journey.End` | Pemain keluar di tengah sesi | `complete: false` |

- Event dikirim setelah aksi selesai (ketukan dilepas), bukan saat layar tampil.
- Tidak ada data pribadi di `action` atau `actionDetails`.
- `Journey.End` dikirim dari server bersama skor yang sudah dinilai.
- Dokumentasinya menyebut event dari app yang belum disetujui akan dibuang. Instrumentasi tetap dipasang dan petanya ditulis di README, karena juri menyebutnya secara khusus.

## 9. Rancangan teknis

**Struktur** (template React resmi Devvit Web):
```
tebar/
├── devvit.json          izin, jadwal, trigger, menu
├── README.md            untuk orang awam, wajib menurut Devvit Rules
├── src/
│   ├── shared/          mesin aturan, mode teka-teki, pemecah, pembuat papan, tipe API
│   ├── client/          React: papan SVG, animasi, layar
│   └── server/          endpoint /api/*, Redis, Reddit API, telemetry
└── tests/               uji mesin, pemecah, dan pembuat papan
```

**Dipakai ulang dari Dakon:** `engine/rules.ts` tanpa perubahan pada logika tebar, komponen papan SVG, urutan kejadian untuk animasi, dan pemutar ulang.

**Baru:**
- Mode teka-teki: menjalankan urutan ambilan dan menghitung skor.
- Pemecah: mencoba semua jalur untuk mendapat skor sempurna dan sebarannya.
- Pembuat papan harian: deterministik dari tanggal, dengan saringan tingkat sulit.

**Endpoint utama** (semua diawali `/api/`):

| Endpoint | Fungsi |
|---|---|
| `GET /api/today` | Papan hari ini, jumlah ambilan, skor sempurna, status pemain |
| `POST /api/run` | Menerima urutan lubang, menilai, mencatat sesi pertama, mengembalikan hasil dan sebaran |
| `GET /api/leaderboard` | Peringkat harian dan mingguan |
| `POST /api/share` | Komentar hasil atas nama pengguna |
| `POST /api/boards` | Memeriksa dan menerbitkan papan buatan pemain |
| `GET /api/boards` | Daftar papan warga |

**Penyimpanan (Redis) dan masa simpan:**

| Data | Masa simpan |
|---|---|
| Skor per papan dan sebarannya | 30 hari |
| Profil pemain: nama, streak, hari terakhir | 30 hari sejak terakhir main |
| Peringkat mingguan | 30 hari |
| Papan buatan pemain | Selama post-nya ada; dihapus saat post dihapus |
| Lumbung desa | Angka total saja, tanpa data pemain |

**Batasan platform yang memengaruhi desain:**
- Client tidak bisa memanggil alamat luar. Font dan semua aset dibundel.
- `localStorage` hilang setiap app diperbarui. Skor dan streak disimpan di Redis.
- Satu permintaan paling lama 30 detik; tidak ada websocket. Game ini tidak membutuhkannya.
- Batas hari memakai UTC di server dan client.

## 10. Kepatuhan Devvit Rules

| Aturan | Cara dipenuhi |
|---|---|
| Tidak mempromosikan kripto, keuangan, judi | Tidak ada sama sekali di app, README, dan deskripsi |
| Tidak menautkan ke app atau platform lain | Tidak ada tautan keluar |
| Orisinal, bukan clone | Format teka-teki buatan sendiri di atas permainan tradisional; UI dan nama sendiri |
| Tidak memakai merek Reddit atau logo pihak lain | Nama, ikon, dan warna sendiri |
| Aksi atas nama pengguna harus eksplisit | Bagikan, terbitkan papan, flair, dan subscribe masing-masing punya tombol dan pratinjau sendiri |
| Skor generik dibalas ke komentar tersemat | F9 |
| Posting atau komentar bukan syarat main | Semua fitur main bisa dipakai tanpa itu |
| Batasi bentuk ekspresi pengguna | Papan hanya berisi jumlah biji; nama dari daftar kata |
| Pengguna bisa menghapus kontennya | Papan adalah post miliknya; data ikut terhapus lewat trigger hapus post |
| Data pengguna dihapus | Semua data pemain kedaluwarsa paling lama 30 hari; dihapus lebih cepat saat akun dihapus bila trigger-nya tersedia |
| Data seminimal mungkin | Hanya ID, nama pengguna, skor, streak |
| Ada jalur lapor | F11 |
| README untuk orang awam | Ringkasan, cara pasang, cara pakai semua fitur |
| Tidak untuk anak di bawah 13 | Tidak ada konten atau sasaran anak |

## 11. Kecocokan dengan kriteria juri

| Kriteria | Yang kita tawarkan |
|---|---|
| Delightful UX | Animasi tebar berantai, papan jati dan kuningan, tema biji, satu sesi di bawah 2 menit |
| Polish | Tiga layar inti, muat di viewport ponsel, belajar sambil main, kartu hasil tunggal, patuh aturan |
| Reddit-y | Papan buatan pemain sebagai post, pilihan warga lewat upvote, lumbung desa, hasil di komentar |
| Daily Content | Papan baru tiap hari dengan tingkat sulit yang naik, Minggu milik warga, jalur sempurna kemarin |

Yang dihindari sesuai catatan juri: tampilan generik, tema Reddit yang harfiah, tembok teks petunjuk, dan banyak layar akhir.

## 12. Pengujian

- **Mesin dan pemecah:** uji otomatis. Skor dari pemecah harus sama dengan hasil mencoba semua jalur; papan harian harus sama untuk tanggal yang sama.
- **Server:** uji penilaian, sesi pertama saja yang tercatat, urutan lubang yang tidak sah ditolak.
- **Tampilan:** saya jalankan client secara lokal dengan server tiruan dan memeriksanya di browser, desktop dan 375 px.
- **Di Reddit:** kamu yang menjalankan `devvit playtest` dan mengirim hasil atau screenshot, karena tool saya tidak bisa membuka Reddit.
- **Pemain sungguhan:** minimal 5 orang mencoba sebelum submit; ambang bintang dan tingkat sulit disetel dari hasilnya.

## 13. Tahapan

| Tahap | Isi | Sampai |
|---|---|---|
| M0 | PRD disetujui, nama diputuskan, akun siap | 14 Nov |
| M1 | Proyek Devvit dibuat; mesin, mode teka-teki, pemecah, pembuat papan beserta ujinya; game bisa dimainkan lokal | 18 Nov |
| M2 | Server: papan hari ini, penilaian, streak, peringkat; post harian; layar awal; kartu hasil; **playtest pertama di Reddit** | 22 Nov |
| M3 | Komentar tersemat, bagikan hasil, Journeys, lapor masalah, belajar sambil main, rapikan tampilan ponsel | 27 Nov |
| M4 | Papan buatan pemain, pilihan warga, jalur sempurna kemarin, lumbung desa dan tema | 3 Des |
| M5 | Uji dengan pemain, suara, README, video di bawah 1 menit, survei feedback, submit di Devpost | 7 Des |
| Cadangan | Perbaikan terakhir | 8 Des |

Sesuai cara kerja proyek sebelumnya, saya berhenti dan melapor di akhir M2, saat game pertama kali bisa dicoba di Reddit.

## 14. Pembagian kerja

| Saya | Kamu |
|---|---|
| Semua kode, uji otomatis, dan pemeriksaan tampilan lokal | Akun Reddit, akun developer di developers.reddit.com, daftar lomba di Devpost |
| README, deskripsi Devpost, naskah video | Membuat proyek dari template dan `devvit login` (butuh login di browser) |
| Menyetel tingkat sulit dari data uji | Membuat subreddit uji: publik, anggota di bawah 200 |
| | Menjalankan playtest di Reddit dan melaporkan hasilnya |
| | Merekam video dan menekan tombol submit |

## 15. Keputusan yang perlu darimu

1. **Nama.** Nama app di Devvit permanen dan harus unik.
   - **Tebar** (saran saya): "menebar" dalam bahasa Indonesia; pendek, khas, kemungkinan besar belum dipakai.
   - Sowdown: plesetan *sow* dan *showdown*, gaya nama game Reddit.
   - Dakon Daily: paling jelas asalnya, tapi sama dengan nama proyek on-chain.
   Cek dulu apakah nama subreddit dan nama app-nya masih kosong.
2. **Folder.** Saya pakai `tebar/` sebagai folder baru yang terpisah dari `dakon/`, supaya repo game Reddit tidak berisi kode contract.
3. **Dokumentasi yang masih saya butuhkan** sebagai file .md: halaman User Actions dan halaman konfigurasi `devvit.json`.

## 16. Risiko

| Risiko | Penanganan |
|---|---|
| Saya tidak bisa membuka Reddit atau dokumentasinya | Tipe SDK dibaca dari `node_modules`; kamu menyimpan halaman dokumentasi yang perlu; playtest lewat kamu |
| Aksi "sebagai pengguna" tidak jalan sebelum app disetujui | Dicek di playtest pertama; kalau jatuh ke akun app, alurnya tetap sama dan dijelaskan di README |
| Event Journeys dibuang karena app belum disetujui | Tetap dipasang; peta ditulis di README |
| Tebaran beranting sulit dibaca pemain baru | Angka biji kecil, penanda putaran pertama, belajar sambil main, mode jelajah |
| Papan warga dibanjiri papan asal-asalan | Saringan pemecah, satu papan per pemain per hari |
| Waktu 26 hari tidak cukup untuk semua | Bagian 5.1 selesai di M3; 5.2 dan 5.3 dipotong dari bawah bila perlu |
| 700+ pesaing | Fokus pada keempat kriteria tanpa titik lemah, dan kirim 2 hari sebelum batas |
