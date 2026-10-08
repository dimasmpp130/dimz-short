(() => {
  const STORAGE_KEY = "dimz_language";
  const languages = [
    ["auto", "🌐 Auto"], ["id", "🇮🇩 Bahasa Indonesia"], ["en", "🇬🇧 English"],
    ["es", "🇪🇸 Español"], ["fr", "🇫🇷 Français"], ["de", "🇩🇪 Deutsch"],
    ["pt", "🇵🇹 Português"], ["it", "🇮🇹 Italiano"], ["ja", "🇯🇵 日本語"],
    ["ko", "🇰🇷 한국어"], ["zh", "🇨🇳 中文"], ["ru", "🇷🇺 Русский"],
    ["ar", "🇸🇦 العربية"], ["hi", "🇮🇳 हिन्दी"], ["tr", "🇹🇷 Türkçe"],
    ["vi", "🇻🇳 Tiếng Việt"]
  ];

  const dict = {
    id: {},
    en: {
      "Buat Shortlink":"Create Shortlink","Buat Link":"Create Link","Batal Edit":"Cancel Edit","Link Saya":"My Links","Salin":"Copy","Dijeda":"Paused","Aktif":"Active","Kedaluwarsa":"Expired","Berpassword":"Password protected","Buat QR":"Generate QR","Bagikan":"Share","Pemeriksaan Keamanan":"Security Check","Lanjutkan":"Continue","Dashboard":"Dashboard","Refresh":"Refresh","Keluar":"Logout","Masuk Admin":"Admin Login","Password Admin":"Admin Password","TOTAL SHORTLINK":"TOTAL SHORTLINK","TOTAL KLIK":"TOTAL CLICKS","PENGUNJUNG UNIK":"UNIQUE VISITORS","MANUSIA / BOT":"HUMAN / BOT","Semua status":"All statuses","Terbaru":"Newest","Terlama":"Oldest","Klik terbanyak":"Most clicks","Analytics Shortlink":"Shortlink Analytics","Edit Shortlink":"Edit Shortlink","Simpan":"Save","Batal":"Cancel","Hapus password":"Remove password","QR Admin":"Admin QR","URL Tujuan":"Destination URL","Alias Custom":"Custom Alias","Password":"Password","Tidak kedaluwarsa":"Never expires","1 hari":"1 day","7 hari":"7 days","30 hari":"30 days","Tanggal khusus":"Custom date","Cari alias atau URL...":"Search alias or URL...","Cari alias atau URL tujuan...":"Search alias or destination URL...","Tidak ada shortlink yang cocok.":"No matching shortlinks found.","Kesehatan: belum dicek":"Health: not checked","Kembali ke Beranda":"Back to Home","Link berhasil dibuat":"Link created successfully","QR akan dibuat dengan logo di tengah.":"QR will be generated with the logo in the center.","Analytics Link":"Link Analytics","Buat QR terlebih dahulu.":"Generate the QR first.","Pilih Gambar":"Choose Image","Galeri":"Gallery","Sumber logo":"Logo source","URL gambar":"Image URL","Pilih gambar dari galeri":"Choose an image from gallery","Belum ada gambar dipilih.":"No image selected.","Buat QR":"Generate QR","Simple URL Shortener":"Simple URL Shortener","Simple URL shortener":"Simple URL shortener","Shorten your link.":"Shorten your link.","Panel admin untuk memantau link, keamanan, dan analytics.":"Admin panel for links, security, and analytics.","Pantau shortlink, analytics, keamanan, dan QR dari satu panel.":"Monitor shortlinks, analytics, security, and QR from one panel.","Disimpan di perangkat ini dan tidak dikirim ke server.":"Stored on this device and not sent to the server.","Tidak ada":"None","Pilih logo dari URL atau Galeri. Hanya file gambar yang dapat dipilih.":"Choose a logo from a URL or Gallery. Only image files are allowed.","Default expiry":"Default expiry","Ukuran QR":"QR size","Logo QR":"QR logo","Simpan":"Save","Batal":"Cancel","Edit":"Edit","Hapus":"Delete","Resume":"Resume","Pause":"Pause","Health":"Health","Analytics":"Analytics","Share":"Share","Masukkan password":"Enter password","Detik":"seconds","Verifikasi Keamanan":"Security Verification","Mohon verifikasi CAPTCHA sebelum membuat shortlink baru.":"Please complete the CAPTCHA before creating a new shortlink.","Create Link":"Create Link"
    },
    es: {"Buat Shortlink":"Crear shortlink","Buat Link":"Crear enlace","Batal Edit":"Cancelar edición","Link Saya":"Mis enlaces","Salin":"Copiar","Dijeda":"Pausado","Aktif":"Activo","Kedaluwarsa":"Caducado","Berpassword":"Protegido con contraseña","Buat QR":"Generar QR","Bagikan":"Compartir","Pemeriksaan Keamanan":"Comprobación de seguridad","Lanjutkan":"Continuar","Dashboard":"Panel","Refresh":"Actualizar","Keluar":"Cerrar sesión","Masuk Admin":"Acceso de administrador","Password Admin":"Contraseña de administrador","Semua status":"Todos los estados","Terbaru":"Más recientes","Terlama":"Más antiguos","Klik terbanyak":"Más clics","Analytics Shortlink":"Analítica del shortlink","Edit Shortlink":"Editar shortlink","Simpan":"Guardar","Batal":"Cancelar","URL Tujuan":"URL de destino","Alias Custom":"Alias personalizado","Password":"Contraseña","Tidak kedaluwarsa":"Sin caducidad","1 hari":"1 día","7 hari":"7 días","30 hari":"30 días","Tanggal khusus":"Fecha personalizada","Cari alias atau URL...":"Buscar alias o URL...","Tidak ada shortlink yang cocok.":"No se encontraron shortlinks.","Kembali ke Beranda":"Volver al inicio","Link berhasil dibuat":"Enlace creado correctamente","Analytics Link":"Analítica del enlace","Pilih Gambar":"Elegir imagen","Galeri":"Galería","Sumber logo":"Fuente del logo","URL gambar":"URL de imagen","Belum ada gambar dipilih.":"No se ha seleccionado ninguna imagen.","Simple URL Shortener":"Acortador de URL sencillo","Dashboard":"Panel","Edit":"Editar","Hapus":"Eliminar","Health":"Estado","Analytics":"Analítica","Share":"Compartir","Masukkan password":"Introducir contraseña"},
    fr: {"Buat Shortlink":"Créer un shortlink","Buat Link":"Créer le lien","Batal Edit":"Annuler la modification","Link Saya":"Mes liens","Salin":"Copier","Dijeda":"En pause","Aktif":"Actif","Kedaluwarsa":"Expiré","Berpassword":"Protégé par mot de passe","Buat QR":"Générer QR","Bagikan":"Partager","Pemeriksaan Keamanan":"Contrôle de sécurité","Lanjutkan":"Continuer","Dashboard":"Tableau de bord","Refresh":"Actualiser","Keluar":"Déconnexion","Masuk Admin":"Connexion admin","Password Admin":"Mot de passe admin","Semua status":"Tous les statuts","Terbaru":"Plus récents","Terlama":"Plus anciens","Klik terbanyak":"Plus de clics","Analytics Shortlink":"Analytics du shortlink","Edit Shortlink":"Modifier le shortlink","Simpan":"Enregistrer","Batal":"Annuler","URL Tujuan":"URL de destination","Alias Custom":"Alias personnalisé","Password":"Mot de passe","Tidak kedaluwarsa":"Sans expiration","1 hari":"1 jour","7 hari":"7 jours","30 hari":"30 jours","Tanggal khusus":"Date personnalisée","Cari alias atau URL...":"Rechercher un alias ou une URL...","Tidak ada shortlink yang cocok.":"Aucun shortlink correspondant.","Kembali ke Beranda":"Retour à l’accueil","Link berhasil dibuat":"Lien créé avec succès","Analytics Link":"Analytics du lien","Pilih Gambar":"Choisir une image","Galeri":"Galerie","Sumber logo":"Source du logo","URL gambar":"URL de l’image","Belum ada gambar dipilih.":"Aucune image sélectionnée.","Edit":"Modifier","Hapus":"Supprimer","Health":"État","Analytics":"Analytics","Share":"Partager","Masukkan password":"Saisir le mot de passe"},
    de: {"Buat Shortlink":"Shortlink erstellen","Buat Link":"Link erstellen","Batal Edit":"Bearbeitung abbrechen","Link Saya":"Meine Links","Salin":"Kopieren","Dijeda":"Pausiert","Aktif":"Aktiv","Kedaluwarsa":"Abgelaufen","Berpassword":"Passwortgeschützt","Buat QR":"QR erstellen","Bagikan":"Teilen","Pemeriksaan Keamanan":"Sicherheitsprüfung","Lanjutkan":"Weiter","Dashboard":"Dashboard","Refresh":"Aktualisieren","Keluar":"Abmelden","Masuk Admin":"Admin-Anmeldung","Password Admin":"Admin-Passwort","Semua status":"Alle Status","Terbaru":"Neueste","Terlama":"Älteste","Klik terbanyak":"Meiste Klicks","Analytics Shortlink":"Shortlink-Analyse","Edit Shortlink":"Shortlink bearbeiten","Simpan":"Speichern","Batal":"Abbrechen","URL Tujuan":"Ziel-URL","Alias Custom":"Benutzerdefiniertes Alias","Password":"Passwort","Tidak kedaluwarsa":"Kein Ablauf","1 hari":"1 Tag","7 hari":"7 Tage","30 hari":"30 Tage","Tanggal khusus":"Benutzerdefiniertes Datum","Cari alias atau URL...":"Alias oder URL suchen...","Tidak ada shortlink yang cocok.":"Keine passenden Shortlinks gefunden.","Kembali ke Beranda":"Zur Startseite","Link berhasil dibuat":"Link erfolgreich erstellt","Analytics Link":"Link-Analyse","Pilih Gambar":"Bild auswählen","Galeri":"Galerie","Sumber logo":"Logoquelle","URL gambar":"Bild-URL","Belum ada gambar dipilih.":"Kein Bild ausgewählt.","Edit":"Bearbeiten","Hapus":"Löschen","Health":"Status","Analytics":"Analyse","Share":"Teilen","Masukkan password":"Passwort eingeben"},
    pt: {"Buat Shortlink":"Criar shortlink","Buat Link":"Criar link","Batal Edit":"Cancelar edição","Link Saya":"Meus links","Salin":"Copiar","Dijeda":"Pausado","Aktif":"Ativo","Kedaluwarsa":"Expirado","Berpassword":"Protegido por senha","Buat QR":"Gerar QR","Bagikan":"Compartilhar","Pemeriksaan Keamanan":"Verificação de segurança","Lanjutkan":"Continuar","Dashboard":"Painel","Refresh":"Atualizar","Keluar":"Sair","Masuk Admin":"Login do administrador","Password Admin":"Senha do administrador","Semua status":"Todos os status","Terbaru":"Mais recentes","Terlama":"Mais antigos","Klik terbanyak":"Mais cliques","Analytics Shortlink":"Analytics do shortlink","Edit Shortlink":"Editar shortlink","Simpan":"Salvar","Batal":"Cancelar","URL Tujuan":"URL de destino","Alias Custom":"Alias personalizado","Password":"Senha","Tidak kedaluwarsa":"Sem expiração","1 hari":"1 dia","7 hari":"7 dias","30 hari":"30 dias","Tanggal khusus":"Data personalizada","Cari alias atau URL...":"Pesquisar alias ou URL...","Tidak ada shortlink yang cocok.":"Nenhum shortlink encontrado.","Kembali ke Beranda":"Voltar ao início","Link berhasil dibuat":"Link criado com sucesso","Analytics Link":"Analytics do link","Pilih Gambar":"Escolher imagem","Galeri":"Galeria","Sumber logo":"Fonte do logo","URL gambar":"URL da imagem","Belum ada gambar dipilih.":"Nenhuma imagem selecionada.","Edit":"Editar","Hapus":"Excluir","Health":"Status","Analytics":"Analytics","Share":"Compartilhar","Masukkan password":"Digite a senha"},
    it: {"Buat Shortlink":"Crea shortlink","Buat Link":"Crea link","Batal Edit":"Annulla modifica","Link Saya":"I miei link","Salin":"Copia","Dijeda":"In pausa","Aktif":"Attivo","Kedaluwarsa":"Scaduto","Berpassword":"Protetto da password","Buat QR":"Genera QR","Bagikan":"Condividi","Pemeriksaan Keamanan":"Controllo di sicurezza","Lanjutkan":"Continua","Dashboard":"Dashboard","Refresh":"Aggiorna","Keluar":"Esci","Masuk Admin":"Accesso admin","Password Admin":"Password admin","Semua status":"Tutti gli stati","Terbaru":"Più recenti","Terlama":"Più vecchi","Klik terbanyak":"Più clic","Analytics Shortlink":"Analytics shortlink","Edit Shortlink":"Modifica shortlink","Simpan":"Salva","Batal":"Annulla","URL Tujuan":"URL di destinazione","Alias Custom":"Alias personalizzato","Password":"Password","Tidak kedaluwarsa":"Senza scadenza","1 hari":"1 giorno","7 hari":"7 giorni","30 hari":"30 giorni","Tanggal khusus":"Data personalizzata","Cari alias atau URL...":"Cerca alias o URL...","Tidak ada shortlink yang cocok.":"Nessun shortlink trovato.","Kembali ke Beranda":"Torna alla home","Link berhasil dibuat":"Link creato con successo","Analytics Link":"Analytics del link","Pilih Gambar":"Scegli immagine","Galeri":"Galleria","Sumber logo":"Sorgente logo","URL gambar":"URL immagine","Belum ada gambar dipilih.":"Nessuna immagine selezionata.","Edit":"Modifica","Hapus":"Elimina","Health":"Stato","Analytics":"Analytics","Share":"Condividi","Masukkan password":"Inserisci password"},
    ja: {"Buat Shortlink":"短縮リンクを作成","Buat Link":"リンクを作成","Batal Edit":"編集をキャンセル","Link Saya":"マイリンク","Salin":"コピー","Dijeda":"一時停止","Aktif":"有効","Kedaluwarsa":"期限切れ","Berpassword":"パスワード保護","Buat QR":"QRを生成","Bagikan":"共有","Pemeriksaan Keamanan":"セキュリティチェック","Lanjutkan":"続行","Dashboard":"ダッシュボード","Refresh":"更新","Keluar":"ログアウト","Masuk Admin":"管理者ログイン","Password Admin":"管理者パスワード","Semua status":"すべてのステータス","Terbaru":"新しい順","Terlama":"古い順","Klik terbanyak":"クリック数順","Analytics Shortlink":"短縮リンク分析","Edit Shortlink":"短縮リンクを編集","Simpan":"保存","Batal":"キャンセル","URL Tujuan":"移動先URL","Alias Custom":"カスタムエイリアス","Password":"パスワード","Tidak kedaluwarsa":"期限なし","1 hari":"1日","7 hari":"7日","30 hari":"30日","Tanggal khusus":"カスタム日付","Cari alias atau URL...":"エイリアスまたはURLを検索...","Tidak ada shortlink yang cocok.":"一致する短縮リンクはありません。","Kembali ke Beranda":"ホームに戻る","Link berhasil dibuat":"リンクを作成しました","Analytics Link":"リンク分析","Pilih Gambar":"画像を選択","Galeri":"ギャラリー","Sumber logo":"ロゴのソース","URL gambar":"画像URL","Belum ada gambar dipilih.":"画像が選択されていません。","Edit":"編集","Hapus":"削除","Health":"状態","Analytics":"分析","Share":"共有","Masukkan password":"パスワードを入力"},
    ko: {"Buat Shortlink":"단축 링크 만들기","Buat Link":"링크 만들기","Batal Edit":"편집 취소","Link Saya":"내 링크","Salin":"복사","Dijeda":"일시중지","Aktif":"활성","Kedaluwarsa":"만료됨","Berpassword":"비밀번호 보호","Buat QR":"QR 생성","Bagikan":"공유","Pemeriksaan Keamanan":"보안 확인","Lanjutkan":"계속","Dashboard":"대시보드","Refresh":"새로고침","Keluar":"로그아웃","Masuk Admin":"관리자 로그인","Password Admin":"관리자 비밀번호","Semua status":"모든 상태","Terbaru":"최신순","Terlama":"오래된 순","Klik terbanyak":"클릭 수순","Analytics Shortlink":"단축 링크 분석","Edit Shortlink":"단축 링크 편집","Simpan":"저장","Batal":"취소","URL Tujuan":"대상 URL","Alias Custom":"사용자 지정 별칭","Password":"비밀번호","Tidak kedaluwarsa":"만료 없음","1 hari":"1일","7 hari":"7일","30 hari":"30일","Tanggal khusus":"사용자 지정 날짜","Cari alias atau URL...":"별칭 또는 URL 검색...","Tidak ada shortlink yang cocok.":"일치하는 단축 링크가 없습니다.","Kembali ke Beranda":"홈으로","Link berhasil dibuat":"링크가 생성되었습니다","Analytics Link":"링크 분석","Pilih Gambar":"이미지 선택","Galeri":"갤러리","Sumber logo":"로고 소스","URL gambar":"이미지 URL","Belum ada gambar dipilih.":"선택된 이미지 없음","Edit":"편집","Hapus":"삭제","Health":"상태","Analytics":"분석","Share":"공유","Masukkan password":"비밀번호 입력"},
    zh: {"Buat Shortlink":"创建短链接","Buat Link":"创建链接","Batal Edit":"取消编辑","Link Saya":"我的链接","Salin":"复制","Dijeda":"已暂停","Aktif":"启用","Kedaluwarsa":"已过期","Berpassword":"密码保护","Buat QR":"生成二维码","Bagikan":"分享","Pemeriksaan Keamanan":"安全检查","Lanjutkan":"继续","Dashboard":"控制面板","Refresh":"刷新","Keluar":"退出","Masuk Admin":"管理员登录","Password Admin":"管理员密码","Semua status":"所有状态","Terbaru":"最新","Terlama":"最旧","Klik terbanyak":"点击最多","Analytics Shortlink":"短链接分析","Edit Shortlink":"编辑短链接","Simpan":"保存","Batal":"取消","URL Tujuan":"目标 URL","Alias Custom":"自定义别名","Password":"密码","Tidak kedaluwarsa":"永不过期","1 hari":"1 天","7 hari":"7 天","30 hari":"30 天","Tanggal khusus":"自定义日期","Cari alias atau URL...":"搜索别名或 URL...","Tidak ada shortlink yang cocok.":"没有匹配的短链接。","Kembali ke Beranda":"返回首页","Link berhasil dibuat":"链接创建成功","Analytics Link":"链接分析","Pilih Gambar":"选择图片","Galeri":"图库","Sumber logo":"Logo 来源","URL gambar":"图片 URL","Belum ada gambar dipilih.":"未选择图片","Edit":"编辑","Hapus":"删除","Health":"状态","Analytics":"分析","Share":"分享","Masukkan password":"输入密码"},
    ru: {"Buat Shortlink":"Создать короткую ссылку","Buat Link":"Создать ссылку","Batal Edit":"Отменить редактирование","Link Saya":"Мои ссылки","Salin":"Копировать","Dijeda":"Приостановлено","Aktif":"Активно","Kedaluwarsa":"Истекло","Berpassword":"Защищено паролем","Buat QR":"Создать QR","Bagikan":"Поделиться","Pemeriksaan Keamanan":"Проверка безопасности","Lanjutkan":"Продолжить","Dashboard":"Панель управления","Refresh":"Обновить","Keluar":"Выйти","Masuk Admin":"Вход администратора","Password Admin":"Пароль администратора","Semua status":"Все статусы","Terbaru":"Новые","Terlama":"Старые","Klik terbanyak":"Больше кликов","Analytics Shortlink":"Аналитика shortlink","Edit Shortlink":"Изменить shortlink","Simpan":"Сохранить","Batal":"Отмена","URL Tujuan":"Целевой URL","Alias Custom":"Пользовательский псевдоним","Password":"Пароль","Tidak kedaluwarsa":"Без срока","1 hari":"1 день","7 hari":"7 дней","30 hari":"30 дней","Tanggal khusus":"Своя дата","Cari alias atau URL...":"Поиск псевдонима или URL...","Tidak ada shortlink yang cocok.":"Подходящих ссылок нет.","Kembali ke Beranda":"На главную","Link berhasil dibuat":"Ссылка создана","Analytics Link":"Аналитика ссылки","Pilih Gambar":"Выбрать изображение","Galeri":"Галерея","Sumber logo":"Источник логотипа","URL gambar":"URL изображения","Belum ada gambar dipilih.":"Изображение не выбрано","Edit":"Изменить","Hapus":"Удалить","Health":"Состояние","Analytics":"Аналитика","Share":"Поделиться","Masukkan password":"Введите пароль"},
    ar: {"Buat Shortlink":"إنشاء رابط مختصر","Buat Link":"إنشاء رابط","Batal Edit":"إلغاء التعديل","Link Saya":"روابطي","Salin":"نسخ","Dijeda":"متوقف مؤقتًا","Aktif":"نشط","Kedaluwarsa":"منتهي","Berpassword":"محمي بكلمة مرور","Buat QR":"إنشاء QR","Bagikan":"مشاركة","Pemeriksaan Keamanan":"فحص الأمان","Lanjutkan":"متابعة","Dashboard":"لوحة التحكم","Refresh":"تحديث","Keluar":"تسجيل الخروج","Masuk Admin":"دخول المسؤول","Password Admin":"كلمة مرور المسؤول","Semua status":"كل الحالات","Terbaru":"الأحدث","Terlama":"الأقدم","Klik terbanyak":"الأكثر نقرًا","Analytics Shortlink":"تحليلات الرابط المختصر","Edit Shortlink":"تعديل الرابط المختصر","Simpan":"حفظ","Batal":"إلغاء","URL Tujuan":"عنوان URL الهدف","Alias Custom":"اسم مستعار مخصص","Password":"كلمة المرور","Tidak kedaluwarsa":"بدون انتهاء","1 hari":"يوم واحد","7 hari":"7 أيام","30 hari":"30 يومًا","Tanggal khusus":"تاريخ مخصص","Cari alias atau URL...":"ابحث عن الاسم المستعار أو الرابط...","Tidak ada shortlink yang cocok.":"لا توجد روابط مختصرة مطابقة.","Kembali ke Beranda":"العودة للرئيسية","Link berhasil dibuat":"تم إنشاء الرابط بنجاح","Analytics Link":"تحليلات الرابط","Pilih Gambar":"اختيار صورة","Galeri":"المعرض","Sumber logo":"مصدر الشعار","URL gambar":"رابط الصورة","Belum ada gambar dipilih.":"لم يتم اختيار صورة","Edit":"تعديل","Hapus":"حذف","Health":"الحالة","Analytics":"التحليلات","Share":"مشاركة","Masukkan password":"أدخل كلمة المرور"},
    hi: {"Buat Shortlink":"शॉर्टलिंक बनाएं","Buat Link":"लिंक बनाएं","Batal Edit":"संपादन रद्द करें","Link Saya":"मेरे लिंक","Salin":"कॉपी करें","Dijeda":"रुका हुआ","Aktif":"सक्रिय","Kedaluwarsa":"समाप्त","Berpassword":"पासवर्ड सुरक्षित","Buat QR":"QR बनाएं","Bagikan":"साझा करें","Pemeriksaan Keamanan":"सुरक्षा जांच","Lanjutkan":"जारी रखें","Dashboard":"डैशबोर्ड","Refresh":"रीफ्रेश","Keluar":"लॉग आउट","Masuk Admin":"एडमिन लॉगिन","Password Admin":"एडमिन पासवर्ड","Semua status":"सभी स्थिति","Terbaru":"नवीनतम","Terlama":"पुराने","Klik terbanyak":"सबसे अधिक क्लिक","Analytics Shortlink":"शॉर्टलिंक एनालिटिक्स","Edit Shortlink":"शॉर्टलिंक संपादित करें","Simpan":"सहेजें","Batal":"रद्द करें","URL Tujuan":"गंतव्य URL","Alias Custom":"कस्टम उपनाम","Password":"पासवर्ड","Tidak kedaluwarsa":"समाप्ति नहीं","1 hari":"1 दिन","7 hari":"7 दिन","30 hari":"30 दिन","Tanggal khusus":"कस्टम तारीख","Cari alias atau URL...":"उपनाम या URL खोजें...","Tidak ada shortlink yang cocok.":"कोई मिलान शॉर्टलिंक नहीं मिला।","Kembali ke Beranda":"होम पर वापस जाएं","Link berhasil dibuat":"लिंक सफलतापूर्वक बनाया गया","Analytics Link":"लिंक एनालिटिक्स","Pilih Gambar":"छवि चुनें","Galeri":"गैलरी","Sumber logo":"लोगो स्रोत","URL gambar":"छवि URL","Belum ada gambar dipilih.":"कोई छवि नहीं चुनी गई","Edit":"संपादित करें","Hapus":"हटाएं","Health":"स्थिति","Analytics":"एनालिटिक्स","Share":"साझा करें","Masukkan password":"पासवर्ड दर्ज करें"},
    tr: {"Buat Shortlink":"Kısa bağlantı oluştur","Buat Link":"Bağlantı oluştur","Batal Edit":"Düzenlemeyi iptal et","Link Saya":"Bağlantılarım","Salin":"Kopyala","Dijeda":"Duraklatıldı","Aktif":"Aktif","Kedaluwarsa":"Süresi doldu","Berpassword":"Şifre korumalı","Buat QR":"QR oluştur","Bagikan":"Paylaş","Pemeriksaan Keamanan":"Güvenlik kontrolü","Lanjutkan":"Devam et","Dashboard":"Kontrol paneli","Refresh":"Yenile","Keluar":"Çıkış","Masuk Admin":"Yönetici girişi","Password Admin":"Yönetici şifresi","Semua status":"Tüm durumlar","Terbaru":"En yeni","Terlama":"En eski","Klik terbanyak":"En çok tıklanan","Analytics Shortlink":"Kısa bağlantı analizi","Edit Shortlink":"Kısa bağlantıyı düzenle","Simpan":"Kaydet","Batal":"İptal","URL Tujuan":"Hedef URL","Alias Custom":"Özel takma ad","Password":"Şifre","Tidak kedaluwarsa":"Süresiz","1 hari":"1 gün","7 hari":"7 gün","30 hari":"30 gün","Tanggal khusus":"Özel tarih","Cari alias atau URL...":"Takma ad veya URL ara...","Tidak ada shortlink yang cocok.":"Eşleşen kısa bağlantı yok.","Kembali ke Beranda":"Ana sayfaya dön","Link berhasil dibuat":"Bağlantı başarıyla oluşturuldu","Analytics Link":"Bağlantı analizi","Pilih Gambar":"Resim seç","Galeri":"Galeri","Sumber logo":"Logo kaynağı","URL gambar":"Resim URL'si","Belum ada gambar dipilih.":"Resim seçilmedi","Edit":"Düzenle","Hapus":"Sil","Health":"Durum","Analytics":"Analiz","Share":"Paylaş","Masukkan password":"Şifre girin"},
    vi: {"Buat Shortlink":"Tạo liên kết rút gọn","Buat Link":"Tạo liên kết","Batal Edit":"Hủy chỉnh sửa","Link Saya":"Liên kết của tôi","Salin":"Sao chép","Dijeda":"Đã tạm dừng","Aktif":"Đang hoạt động","Kedaluwarsa":"Đã hết hạn","Berpassword":"Được bảo vệ bằng mật khẩu","Buat QR":"Tạo QR","Bagikan":"Chia sẻ","Pemeriksaan Keamanan":"Kiểm tra bảo mật","Lanjutkan":"Tiếp tục","Dashboard":"Bảng điều khiển","Refresh":"Làm mới","Keluar":"Đăng xuất","Masuk Admin":"Đăng nhập quản trị","Password Admin":"Mật khẩu quản trị","Semua status":"Tất cả trạng thái","Terbaru":"Mới nhất","Terlama":"Cũ nhất","Klik terbanyak":"Nhiều lượt nhấp nhất","Analytics Shortlink":"Phân tích liên kết","Edit Shortlink":"Chỉnh sửa liên kết","Simpan":"Lưu","Batal":"Hủy","URL Tujuan":"URL đích","Alias Custom":"Tên tùy chỉnh","Password":"Mật khẩu","Tidak kedaluwarsa":"Không hết hạn","1 hari":"1 ngày","7 hari":"7 ngày","30 hari":"30 ngày","Tanggal khusus":"Ngày tùy chỉnh","Cari alias atau URL...":"Tìm alias hoặc URL...","Tidak ada shortlink yang cocok.":"Không có liên kết phù hợp.","Kembali ke Beranda":"Về trang chủ","Link berhasil dibuat":"Tạo liên kết thành công","Analytics Link":"Phân tích liên kết","Pilih Gambar":"Chọn ảnh","Galeri":"Thư viện","Sumber logo":"Nguồn logo","URL gambar":"URL hình ảnh","Belum ada gambar dipilih.":"Chưa chọn ảnh","Edit":"Sửa","Hapus":"Xóa","Health":"Trạng thái","Analytics":"Phân tích","Share":"Chia sẻ","Masukkan password":"Nhập mật khẩu"}
  };

  const english = dict.en;
  const normalize = (value) => String(value || "").trim().toLowerCase().split("-")[0];
  const detect = () => normalize(navigator.language || "en");
  const saved = localStorage.getItem(STORAGE_KEY) || "auto";
  let current = saved === "auto" ? detect() : normalize(saved);
  if (!dict[current] && current !== "id") current = "en";

  function t(key, fallback = key) {
    const table = dict[current] || {};
    return table[key] ?? english[key] ?? fallback;
  }

  const common = {
    "Tujuan":"Destination","Pemeriksaan URL: selesai":"URL check complete","Link siap digunakan.":"Link is ready to use.","Pemeriksaan URL":"URL check","selesai":"complete","Link siap":"Link ready","QR siap dibuat dengan logo DIMZ.":"QR is ready to be generated with the DIMZ logo.","Tekan Generate QR.":"Press Generate QR.","Tidak ada aktivitas.":"No activity yet.","klik":"clicks","pengunjung unik":"unique visitors","manusia":"humans","bot":"bots","Memeriksa...":"Checking...","Kesehatan: dapat dijangkau":"Health: reachable","Kesehatan: bermasalah":"Health: unavailable","Gagal memuat daftar link.":"Failed to load links.","Shortlink berhasil diperbarui.":"Shortlink updated successfully.","Gagal menyimpan shortlink.":"Failed to save shortlink.","Link berhasil disalin.":"Link copied successfully.","Gagal menyalin link.":"Failed to copy link.","Shortlink berhasil dibuat.":"Shortlink created successfully.","Link dilanjutkan.":"Link resumed.","Link dijeda.":"Link paused.","Gagal mengubah status link.":"Failed to change link status.","Shortlink berhasil dihapus.":"Shortlink deleted successfully.","Gagal menghapus shortlink.":"Failed to delete shortlink.","Gagal mengubah status.":"Failed to change status.","Gagal mereset statistik.":"Failed to reset statistics.","Statistik direset.":"Statistics reset.","Gagal memuat dashboard.":"Failed to load dashboard.","Login gagal.":"Login failed.","Gagal menyimpan.":"Failed to save.","Gagal menghapus.":"Failed to delete.","QR gagal dibuat.":"Failed to generate QR.","QR gagal dibuat. Coba lagi.":"Failed to generate QR. Try again.","QR tidak berhasil dibuat.":"QR could not be generated.","QR tidak tersedia.":"QR is not available.","Shortlink belum tersedia.":"Shortlink is not available yet.","Gagal memuat CAPTCHA.":"Failed to load CAPTCHA.","Gagal memuat verifikasi.":"Failed to load verification.","Verifikasi Keamanan":"Security Verification","Verifikasi CAPTCHA diperlukan untuk melanjutkan.":"CAPTCHA verification is required to continue.","CAPTCHA berhasil diverifikasi.":"CAPTCHA verified successfully.","CAPTCHA kedaluwarsa. Silakan ulangi.":"CAPTCHA expired. Please try again.","CAPTCHA gagal dimuat. Silakan refresh halaman.":"CAPTCHA failed to load. Please refresh the page.","Masukkan password terlebih dahulu.":"Enter the password first.","Selesaikan CAPTCHA terlebih dahulu.":"Complete the CAPTCHA first.","Menyiapkan...":"Preparing...","Menyiapkan Tujuan...":"Preparing destination...","Terjadi kesalahan":"Something went wrong","Gagal membuka tujuan.":"Failed to open destination.","Gagal memuat shortlink.":"Failed to load shortlink.","Menyimpan...":"Saving...","Membuat...":"Creating...","Pemeriksaan Keamanan":"Security Check","Selesaikan CAPTCHA untuk membuka link.":"Complete the CAPTCHA to open the link.","Selesaikan CAPTCHA dan masukkan password untuk membuka link.":"Complete the CAPTCHA and enter the password to open the link.","Password verification gagal.":"Password verification failed.","Verifikasi keamanan berhasil. Mohon tunggu, sedang menyiapkan tujuan...":"Security verification succeeded. Please wait while the destination is prepared.","Masukkan password":"Enter password","Silahkan Tekan Tombol Diatas.":"Please press the button above.","Mohon verifikasi CAPTCHA sebelum membuat shortlink baru.":"Please complete the CAPTCHA before creating a new shortlink.","Buat shortlink sederhana dengan keamanan otomatis, QR berlogo, dan analytics.":"Create simple shortlinks with automatic security, logo QR, and analytics.","Tempel URL → buat link → salin.":"Paste URL → create link → copy.","Alias harus 4–32 karakter dan hanya boleh menggunakan A-Z, a-z, 0-9, _ atau -.":"Alias must be 4–32 characters and may only use A-Z, a-z, 0-9, _ or -.","URL tujuan harus berupa alamat http/https yang valid.":"Destination URL must be a valid http/https address.","Pilih tanggal kedaluwarsa.":"Choose an expiration date.","Tanggal kedaluwarsa harus berada di masa depan.":"Expiration date must be in the future.","Tidak ada shortlink yang cocok.":"No matching shortlinks found.","Reset semua statistik untuk":"Reset all statistics for","Tindakan ini tidak dapat dibatalkan.":"This action cannot be undone.","Hapus shortlink":"Delete shortlink","Data link, klik, dan analytics akan ikut dihapus dan tidak dapat dipulihkan.":"The link, clicks, and analytics data will also be deleted and cannot be recovered.","Belum ada aktivitas.":"No activity yet.","Langsung":"Direct"
  };
  Object.assign(english, common);

  const textState = new WeakMap();
  const attrState = new WeakMap();
  const rtlLanguages = new Set(["ar", "he", "fa", "ur"]);

  function translateText(text) {
    const source = String(text);
    if (!source.trim() || current === "id") return source;
    const table = dict[current] || {};
    const keys = [...new Set([...Object.keys(table), ...Object.keys(english)])]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    let output = source;
    for (const key of keys) {
      const value = table[key] ?? english[key];
      if (value && value !== key && output.includes(key)) output = output.split(key).join(value);
    }
    return output;
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest("script,style,select#languageSwitcher")) return;
      const state = textState.get(node) || { source: node.nodeValue, rendered: node.nodeValue };
      const currentValue = node.nodeValue;
      if (currentValue !== state.rendered) state.source = currentValue;
      state.rendered = translateText(state.source);
      node.nodeValue = state.rendered;
      textState.set(node, state);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.id === "languageSwitcher") return;

    for (const child of [...node.childNodes]) translateNode(child);

    const state = attrState.get(node) || {};
    for (const attr of ["placeholder", "aria-label", "title", "alt"]) {
      if (!node.hasAttribute(attr)) continue;
      const value = node.getAttribute(attr) || "";
      const previous = state[attr];
      const source = previous && value === previous.rendered ? previous.source : value;
      const rendered = t(source, source);
      state[attr] = { source, rendered };
      if (rendered !== value) node.setAttribute(attr, rendered);
    }
    attrState.set(node, state);
  }

  function translateDocumentTitle() {
    const title = document.title || "";
    const state = document.documentElement.dataset.i18nTitle || title;
    document.documentElement.dataset.i18nTitle = state;
    document.title = translateText(state);
  }

  function apply() {
    document.documentElement.lang = current;
    document.documentElement.dir = rtlLanguages.has(current) ? "rtl" : "ltr";
    translateNode(document.body);
    translateDocumentTitle();
    const select = document.getElementById("languageSwitcher");
    if (select) select.value = localStorage.getItem(STORAGE_KEY) || "auto";
  }

  function resolveLanguage(lang) {
    const normalized = normalize(lang);
    if (normalized === "auto") return detect();
    return dict[normalized] || "en";
  }

  function addSwitcher() {
    if (document.getElementById("languageSwitcher")) return;
    const wrap = document.createElement("div");
    wrap.id = "languageSwitcherWrap";
    wrap.innerHTML = `<label for="languageSwitcher" class="dimz-language-label">🌐</label><select id="languageSwitcher" aria-label="Language"></select>`;
    const select = wrap.querySelector("select");
    for (const [code, label] of languages) {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = saved;
    select.addEventListener("change", () => {
      localStorage.setItem(STORAGE_KEY, select.value);
      current = resolveLanguage(select.value);
      apply();
      setTimeout(apply, 0);
    });
    Object.assign(wrap.style, {position:"fixed",top:"12px",right:"12px",zIndex:"99999",display:"flex",alignItems:"center",gap:"6px",padding:"6px 8px",borderRadius:"10px",background:"rgba(255,255,255,.94)",boxShadow:"0 4px 18px rgba(0,0,0,.12)",fontSize:"13px"});
    Object.assign(select.style, {border:"0",outline:"0",background:"transparent",fontSize:"13px",maxWidth:"155px"});
    document.body.appendChild(wrap);
  }

  window.I18N = {
    t,
    apply,
    setLanguage: (lang) => {
      const normalized = normalize(lang);
      localStorage.setItem(STORAGE_KEY, normalized);
      current = resolveLanguage(normalized);
      apply();
    }
  };

  window.addEventListener("DOMContentLoaded", () => { addSwitcher(); apply(); });
  if (document.readyState !== "loading") { addSwitcher(); apply(); }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) translateNode(node);
      } else if (record.type === "characterData") {
        translateNode(record.target);
      }
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });

})();
