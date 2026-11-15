# Progres — Adu Layangan

Catatan status proyek agar bisa dilanjutkan kapan saja tanpa membaca ulang percakapan.
Terakhir diperbarui: **14 November 2026**.

Batas kirim lomba: **Rabu 9 Desember 2026, 09.00 WIB**. Rencana lengkap di [PRD.md](PRD.md). Konsep sebelumnya (Tebar) ada di [archive/](archive/).

## Status sekarang

**M1 (prototipe) selesai 14 Nov, lalu fisikanya direview dan diperbaiki dan suasananya digambar ulang di hari yang sama. Masih menunggu gerbang: kamu mencoba terbangnya.** Game bisa dimainkan dari awal sampai kartu hasil di browser lokal. Belum ada penyimpanan skor di server.

| Tahap | Isi | Sampai | Status |
|---|---|---|---|
| M0 | PRD disetujui | 15 Nov | Selesai 14 Nov |
| M1 | Prototipe: terbang, benang, potong, 3 jagoan AI, main lokal | 18 Nov | **Selesai 14 Nov — menunggu gerbang** |
| M2 | Langit harian, 3 gulungan, penilaian ulang di server, rekaman, Raja Langit; playtest di Reddit | 23 Nov | Belum |
| M3 | Terbang pertama, bagikan hasil, desain layangan, koleksi, Journeys, lapor | 29 Nov | Belum |
| M4 | Rintangan, suara, ponsel, isi rekaman awal, uji pemain | 4 Des | Belum (gambar kampung dan animasi sudah dikerjakan lebih awal) |
| M5 | README, Devpost, video, submit | 7 Des | Belum |

## Gerbang M1: yang perlu kamu coba

Pilih salah satu:

- **Di Reddit, lewat ponsel (paling mirip aslinya).** Dari folder `tebar/` jalankan `npm run dev`, lalu buka r/TebarGame di aplikasi Reddit. Post yang sudah ada akan menampilkan versi baru. Untuk sementara masih memakai app `tebar-game`; keputusan app dan subreddit baru menyusul.
- **Di browser komputer.** Jalankan `npm run dev:local`, lalu buka <http://localhost:5180/game.html>. Tahan klik mouse atau tombol Spasi untuk menarik.

Mainkan 3–5 ronde, lalu jawab:
1. Apakah "tahan untuk melesat, lepas untuk berputar" bisa kamu kuasai setelah 1–2 ronde?
2. Apakah memotong benang lawan terasa memuaskan?
3. Terlalu sulit, terlalu mudah, atau pas? Terutama: apakah bilah benang terasa habis terlalu cepat?
4. Apa yang paling membingungkan?

Kalau terbangnya tidak terasa seru, kita setel angka atau ubah kontrol sebelum membangun yang lain.

## Review fisika (14 Nov)

Tujuh kecacatan ditemukan dan diperbaiki. Semuanya tetap deterministik (hanya tambah, kurang, kali, bagi, akar, dan tabel sinus sendiri), jadi server tetap bisa memutar ulang ronde.

| # | Kecacatan | Perbaikan |
|---|---|---|
| 1 | Benang dihitung sebagai garis lurus, tapi digambar melengkung dari titik yang berbeda. Percikan tidak jatuh di benang yang terlihat. | Satu bentuk benang untuk hitungan dan gambar (`line.ts`): melendut karena beratnya, menggembung searah angin, hampir lurus saat ditarik. Ujungnya persis di tangan penerbang dan di layangan. |
| 2 | Yang memotong adalah "siapa yang menahan tombol", dengan kecepatan layangan, bukan kecepatan benang di titik silang. Benang yang bersilang tapi diam tetap bisa saling memotong. | Kikisan sebanding dengan kecepatan gesek kedua benang di titik silang. Benang yang lebih cepat di titik itu mengikis yang lebih lambat. Gerak searah benang dihitung penuh; gerak menyapu dihitung sesuai jaraknya dari tangan (dekat tangan hampir tidak bergerak). Dua benang kendur hampir tidak saling menekan. |
| 3 | Benang "sembuh" sendiri 1 poin per tick saat tidak digesek. | Dihapus. Benang yang terkikis tetap terkikis sampai ronde selesai. |
| 4 | Angin sama kuat di semua ketinggian, dan hembusannya satu gelombang yang terlalu rapi. | Angin 0,5× di dekat atap sampai 1,25× di puncak langit; hembusan ditambah getaran yang lebih cepat (`wind.ts`). |
| 5 | Menukik dan menanjak sama cepat. | Menukik 16% lebih cepat, menanjak 16% lebih lambat. |
| 6 | Udara hangat dari atap menyala dan mati mendadak di satu garis, sehingga layangan kendur bergetar di garis itu. Layangan yang ditahan menukik ke atap menggerus benangnya terus-menerus. | Daya angkat naik perlahan dari nol (y 380) sampai penuh di atap. Menyenggol atap membuat layangan terpental dengan hidung berbalik ke atas: satu senggolan, satu kali terkikis. |
| 7 | Layangan putus jatuh lurus sambil berputar seperti kipas. | Jatuh melayang seperti daun: berayun kiri-kanan, paling cepat turun di tengah ayunan, terbawa angin. |

Dibiarkan dengan sengaja (bukan kecacatan, tapi penyederhanaan): layangan berputar terus saat diulur (ini kontrolnya), tepi kiri-kanan langit adalah dinding tak terlihat, benang tidak tersangkut di atap atau pohon, sesama jagoan tidak saling memotong, dan tegangan benang tidak dihitung sebagai gaya (hanya "kencang" atau "kendur").

Karena benang tidak lagi sembuh, angkanya disetel ulang: benang pemain 300 (dulu 200), benang jagoan 140 (dulu 100), senggolan atap 30.

## Revisi dari uji coba pertamamu (14 Nov)

| Permintaan | Yang dikerjakan |
|---|---|
| Dua bilah di atas tidak jelas fungsinya | Diberi tulisan dan angka: **TIME** (sisa detik) dan **STRING** (sisa benang dalam persen), di atas pelat gelap supaya terbaca di langit terang. |
| Saat layangan kita putus, jangan langsung muncul kartu hasil | Muncul lembar kecil di bawah: **Watch the others** atau **See result**. Selama itu langit tetap hidup: para jagoan lanjut saling adu (`watch` di `match.ts`, berjalan di salinan ronde sehingga skor tidak tersentuh). Saat menonton ada tombol **See result**; kalau tinggal satu layangan selama 5 detik atau waktu habis, hasil muncul sendiri. |
| Suasana bisa dipilih | Empat pilihan di layar siap: Morning, Noon, Dusk, Night (`arena/mood.ts`). Hanya tampilan; angin, lawan, dan skor sama. Pilihan disimpan di perangkat. |
| Efek angin | Garis hembusan yang lebih jelas dan melengkung saat kencang, daun beterbangan, pohon kelapa dan daun pisang bergoyang, jemuran dan bendera ikut condong. Semuanya mengikuti angin simulasi (lemah di bawah, kencang di atas). |

**Kustom layangan dan nama (14 Nov, PRD F12 dikerjakan lebih awal):**
- Di layar siap ada baris **YOU** dengan layangan dan namamu, plus tombol **Customize** yang membuka lembar **Your kite**.
- Pilihan: **nama** dari dua daftar kata (sapaan seperti Bang, Mas, Neng, Uni, dan julukan seperti Elang, Petir, Cilok, Bakwan) dengan tombol dadu untuk nama acak; **bentuk** (Fighter, Diamond, Stingray); **motif** (Flag, Split, Stripes, Eyes, Moon, Star, batik Kawung, batik Parang); **warna** badan dan motif dari 12 warna. Pratinjau besar bergoyang dengan ekornya.
- Nama tidak bisa diketik bebas: aturan Devvit meminta isi buatan pemain dibatasi ke "kamus yang sudah ditentukan dan aman". Server hanya menerima id dari daftar yang sama (`src/shared/kite.ts`).
- Disimpan di akun Reddit lewat `GET/POST /api/profile` (Redis `profile:{userId}`, hilang 30 hari setelah simpanan terakhir), dengan salinan di perangkat. Pemain yang belum login tetap bisa memilih; tersimpan di perangkat saja.
- Pemain baru mendapat layangan dan nama awal yang selalu sama untuk akunnya.
- Di langit: layanganmu memakai desainmu, namamu tampil di label oranye di bawah layangan (selalu di atas label lain), baju penerbangmu sewarna layangan, dan serpihan saat putus berwarna layanganmu. Para jagoan juga mendapat bentuk dan motif sendiri, dan daftar jagoan serta kartu hasil kini menampilkan gambar layangan mereka.

Ditunda atas permintaanmu: **main lawan orang sungguhan**.

## Di Reddit sekarang (14 Nov)

- **Versi 0.0.3 terpasang di r/TebarGame (14 Nov):** koin, toko kosmetik, penilaian ronde di server, animasi pergantian waktu, dan README terbaru sebagai deskripsi app. Sebelum dipasang, subreddit sedang memakai versi playtest 0.0.1.125.
- **Teks subreddit masih tentang Tebar.** Teks pengganti (judul, deskripsi, sidebar, teks post, dan deskripsi singkat app) ada di [SUBREDDIT.md](SUBREDDIT.md); harus ditempel sendiri di pengaturan Reddit.
- Sebelumnya: **versi 0.0.2 terpasang di r/TebarGame** (diunggah dari folder ini dengan `npx devvit upload --bump patch` lalu `npx devvit install r/TebarGame`, login CLI sebagai u/bagusardin_). Tidak lewat GitHub: Devvit mengunggah langsung dari komputer.
- Siapa pun yang membuka post app ini di r/TebarGame memainkan versi yang terpasang. App yang belum dirilis hanya boleh dipasang di subreddit uji dengan kurang dari 200 subscriber.
- Belum diperiksa di Reddit oleh saya (alat saya tidak bisa membuka reddit.com). Kalau belum ada post hari ini, pakai menu subreddit **Post today's sky**.
- Peringatan dari CLI: Node 22.18 dianggap usang, disarankan Node 24. Tidak menghalangi unggahan.

## Pergantian waktu (14 Nov)

Matahari dan bulan sekarang mengikuti jam (`skyArc` di `arena/backdrop.ts`): pagi = matahari setengah terbit di balik masjid, siang = tinggi di kanan atas, sore = setengah terbenam di atap kanan, malam = bulan purnama. Saat pilihan diganti, jam berputar lewat jalan terpendek dalam 0,9–2,2 detik: matahari naik atau turun di jalurnya, bulan terbit atau terbenam, warna langit, bukit, dan kampung berbaur dari satu waktu ke waktu berikutnya. Matahari rendah besar, jingga, dan bersinar; matahari tinggi kecil dan putih.

## Koin dan toko kosmetik (14 Nov, dibuat; PRD 3.5 dan F19)

Kamu memilih **koin untuk kosmetik saja**. Yang sudah jadi:
- **Server menilai setiap ronde** (`POST /api/round`): client mengirim urutan ketukan, server memutar ulang ronde di langit hari itu dan menghitung skor serta koinnya sendiri. Ini juga inti F4 (penilaian di server) dari M2. Skor terbaik tiap pemain per hari disimpan di `board:{day}` untuk papan peringkat nanti.
- **Mendapat koin:** modal awal 100; 10 per layangan yang dipotong; 15 kalau bertahan sampai waktu habis; 25 kalau langit bersih; 20 untuk gulungan pertama hari itu; streak +5 per hari (maks. 25). Hanya **3 gulungan pertama tiap hari** yang memberi koin; sesudahnya latihan.
- **Toko** di dalam lembar *Your kite*, sekarang dengan tab **Kite · Colour · Tail & string**. Barang berbayar punya label harga; bisa dicoba dulu, lalu tombol **Buy**. Kalau koin kurang, tertulis berapa lagi yang dibutuhkan. Menutup lembar mengembalikan barang yang hanya dicoba.
- **Barang (11):** motif Mendung 60, Truntum 60, Scales 80, Rainbow 120; ekor Twin 50, Tassels 70, Lanterns 140; benang Gold 80, Neon 100, Rainbow 140. Semua pilihan lama tetap gratis.
- **Layar:** saldo koin dan sisa "coin flights" di layar siap; saldo di lembar *Your kite*; koin yang didapat beserta rinciannya di kartu hasil ("+20 coins · First flight today +20").
- **Pengaman:** server menolak ronde dari hari lain atau ketukan rusak, menolak menyimpan layangan dengan barang yang belum dibeli, tidak menjual barang gratis, dan dua pembelian bersamaan tidak bisa memakai koin yang sama. Pemain yang belum login tetap mendapat skor tapi tidak mendapat koin.
- Dompet dan barang milik pemain dihapus 30 hari setelah terakhir berubah (aturan data pemain).

Sudah di Reddit sejak versi 0.0.3 (14 Nov), tapi belum saya lihat langsung di Reddit.

## Yang sudah jadi

### Simulasi (`src/shared/sim/`)
- `trig.ts` — sinus dan kosinus dari tabel buatan sendiri (sudut = bilangan bulat 1/1024 putaran), supaya hasil sama di semua perangkat.
- `wind.ts` — angin per tick dan per ketinggian.
- `line.ts` — bentuk benang dan pencarian titik sentuh dua benang.
- `match.ts` — satu ronde per tick (60 tick per detik, 60 detik): terbang, benang, kikisan, atap, layangan putus. `replay(sky, taps)` memutar ulang ronde dari urutan ketukan; ini yang nanti dipakai server untuk menilai.
- `ai.ts` — jagoan memakai kontrol yang sama dengan pemain. Urutan duel: Nekat menyerang sejak detik 4, Gesit sejak detik 15, Kalem sejak detik 30. Setelah tiap serangan, jagoan mundur 1,5 detik. Gesit dan Kalem bertahan dengan menarik saat benangnya bergesekan.
- `sky.ts` — langit harian dari nomor hari: angin, hembusan, tiga jagoan (nama, warna, atap, gaya).

### Angka dari simulasi 300 hari (setelah perbaikan fisika)
| Cara main | Bertahan (median) | Memotong (rata-rata) | Langit bersih |
|---|---|---|---|
| Diam saja | 28 dtk | 0 | 0% |
| Menahan terus | 19 dtk | 0 | 0% |
| Asal ketuk | 18 dtk | 1,9 | 24% |
| Asal ketuk cepat | 27 dtk | 2,1 | 29% |
| Bot yang meniru jagoan | 13 dtk | 1,4 | 31% |

Ini angka bot, bukan manusia. Bot asal ketuk sering menukik ke atap; manusia akan belajar menghindarinya.

### Tampilan (`src/client/arena/`)
- `backdrop.ts` — langit senja berlapis, bintang pertama, bulan sabit, matahari dengan berkas sinar, gunung berapi, bukit, kampung di kejauhan (masjid, menara, tiang listrik, pohon kelapa, lampu jendela), kabut sore. Lalu yang bergerak: awan yang diterangi dari bawah, kawanan burung, layangan orang lain di kejauhan, dan garis-garis angin yang menunjukkan arah dan kekuatan angin di tiap ketinggian.
- `kampung.ts` — atap genteng tempat penerbang berdiri, dinding dengan jendela berlampu, toren air, antena, jemuran dan bendera yang mengikuti angin, kucing, daun pisang, kabel listrik. Penerbang memakai baju sewarna layangannya, memegang benang dan gulungan, dan condong ke belakang saat menarik.
- `kites.ts` — layangan dengan rangka bambu dan motif berbeda (pemain: merah putih), ekor pita yang terseret mengikuti gerak dan angin, kertas yang berkibar saat kendur, benang yang memerah lalu putus-putus saat terkikis, kilau gelasan di benang pemain, percikan yang besarnya mengikuti kecepatan gesek.
- `draw.ts` + `Arena.tsx` — saat benang putus: gambar berhenti sekejap, layar bergetar dan berkilat, serpihan kertas beterbangan, potongan benang jatuh lemas ke atap, layangan melayang turun, dan kartu hasil baru muncul sekitar 1,5 detik kemudian. Layangan yang nyangkut tergeletak di atap.
- `game.tsx`, `splash.tsx` — layar siap, petunjuk, kartu hasil, kartu feed (tidak berubah selain satu kalimat cara main).

### Server
- Dikurangi sementara ke post harian saja (`core/posts.ts`, `app.ts`). Judul post: "Adu Layangan · Day N · tanggal". Penilaian, rekaman, dan peringkat masuk di M2.

### Pemeriksaan
- 49 uji lulus. Tambahan untuk koin: pemain baru mendapat modal sekali; skor server sama dengan yang dilihat client; hanya 3 ronde pertama per hari yang memberi koin; streak bertambah dan putus; ronde dari hari lain dan ketukan rusak ditolak; pengunjung tanpa login tidak mendapat koin; barang dibeli sekali dan saldo tidak pernah minus; dua pembelian bersamaan; layangan hanya bisa disimpan dengan barang yang dimiliki; daftar toko hanya berisi tampilan; profil lama tanpa ekor dan benang tetap terbaca.
- `npm run typecheck`, `npm run lint`, `npm run build` lulus.
- Dipotret dengan Chrome tanpa layar pada 390 × 760, 390 × 520 (kartu feed), dan 1280 × 720: layar siap, ronde dengan ketukan tiruan (dua layangan terpotong, lalu nyangkut di detik 20), kartu hasil, dan kartu feed yang main sendiri.

## Keputusan yang masih terbuka
- **Lawan orang sungguhan (ditunda 14 Nov).** Saran: lawan rekaman dulu (terbang pemain lain diputar ulang di langitmu, sudah ada di PRD M2), room langsung belakangan kalau waktu cukup. Reddit menyediakan saluran real-time (`connectRealtime` di klien, `realtime.send` di server), tapi jedanya belum diukur dan juri biasanya main sendirian.
- **App dan subreddit baru** (saran: app `adu-layangan`, subreddit r/AduLayangan) atau tetap `tebar-game` / r/TebarGame. Dibutuhkan sebelum playtest M2.

## Hal yang diketahui dan belum ditangani
- **Rasa terbang dan keseimbangan belum diuji manusia.** Angka disetel dengan bot. Yang paling perlu dirasakan: memotong satu jagoan dengan adu tarik menghabiskan kira-kira sepertiga benang sendiri.
- **Belum dicoba di ponsel sungguhan.** Gambar sekarang lebih berat (awan, ekor, serpihan); lapisan yang diam sudah digambar sekali saja, tapi kelancarannya di ponsel lama belum diukur.
- **Kartu feed terus menggambar animasi.** Mungkin perlu dibatasi frame-nya kalau berat di ponsel.
- **Belum ada suara, rintangan, atau desain layangan.** Dijadwalkan di M3–M4.
- **Repo git** ada (dibuat CLI Devvit) tapi belum ada commit.
- **File dokumentasi Devvit masih di `dakon/`.** Sebaiknya dipindah ke `tebar/docs/`.
