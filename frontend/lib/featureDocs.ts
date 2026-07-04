// Tek kaynak: her feature'ın hem /docs listesinde hem de docx üretiminde
// kullanılan bilgisi burada tutulur. Yeni bir feature dokümante etmek için
// aşağıdaki FEATURE_DOCS objesine yeni bir key eklemek yeterli — hem
// frontend/app/docs/page.tsx hem de frontend/app/api/docs/generate/route.ts
// bu dosyadan okur, ayrıca güncelleme yapmaya gerek yok.

export interface Endpoint {
  method: string;
  path: string;
  desc: string;
}

export interface FileRef {
  path: string;
  desc: string;
}

export interface FeatureDoc {
  icon: string; // /docs listesinde gösterilen emoji
  title: string; // docx başlığı
  subtitle: string; // docx alt başlığı
  listDesc: string; // /docs listesinde gösterilen kısa açıklama
  overview: string;
  howItWorks: string[];
  tech: [string, string][];
  endpoints?: Endpoint[];
  files?: FileRef[];
  highlights: string[];
}

export const FEATURE_DOCS: Record<string, FeatureDoc> = {
  'repo-saglik-skoru': {
    icon: '🏥',
    title: 'Repo Sağlık Skoru',
    subtitle: "GitHub repo'sunun genel durumunu 0–100 arası puanla değerlendirir.",
    listDesc: '0–100 arası ağırlıklı puan motoru',
    overview: "Repo Sağlık Skoru, bir GitHub reposunun aktivite, bakım kalitesi ve topluluk katılımını analiz eden bileşik bir metriktir. Commit sıklığı, issue yanıt hızı, PR birleştirme süresi ve katkıda bulunan çeşitliliği gibi faktörler ağırlıklı olarak hesaplanır.",
    howItWorks: [
      'Kullanıcı bir repo girer veya takip listesinden seçer.',
      'Backend, GitHub REST API aracılığıyla son 90 günlük commitler, açık/kapalı issue\'lar, PR\'lar ve katkıda bulunanları çeker.',
      'HealthScoreEngine her metriği ağırlıklı puan sistemine göre hesaplar.',
      'Sonuç 0–100 arası bir skor, kategori bazlı kırılım ve iyileştirme önerileriyle döndürülür.',
      'Skor veritabanına anlık görüntü (snapshot) olarak kaydedilir; geçmiş trend grafiği oluşturulabilir.',
    ],
    tech: [
      ['Backend', 'FastAPI (Python), SQLAlchemy async, PostgreSQL (Supabase)'],
      ['GitHub Entegrasyonu', 'GitHub REST API v3 — commits, issues, pulls, contributors endpoint\'leri'],
      ['Algoritma', 'Ağırlıklı puan motoru: backend/app/services/health_score.py'],
      ['Veritabanı', 'RepoSnapshot modeli — her analizde yeni kayıt'],
      ['Frontend', 'Next.js 14 App Router, Recharts (trend grafiği), Tailwind CSS v4'],
      ['Cache', 'Son analiz tarihi kontrolü — 24 saatten eskiyse yenile'],
    ],
    endpoints: [
      { method: 'POST', path: '/api/repos/analyze?owner={owner}&name={name}', desc: 'Repo\'yu analiz eder, skor hesaplar, snapshot kaydeder.' },
      { method: 'GET', path: '/api/repos/{owner}/{name}', desc: 'Kayıtlı repo ve son snapshot\'ı döndürür.' },
      { method: 'GET', path: '/api/repos/{owner}/{name}/history', desc: 'Son 10 snapshot\'ı döndürür (trend grafiği için).' },
    ],
    files: [
      { path: 'backend/app/services/health_score.py', desc: 'Puan hesaplama motoru' },
      { path: 'backend/app/services/github.py', desc: 'GitHub API istemcisi' },
      { path: 'backend/app/models/repo.py', desc: 'Repo ve RepoSnapshot modelleri' },
      { path: 'frontend/app/repo/[owner]/[name]/page.tsx', desc: 'Repo detay sayfası' },
    ],
    highlights: [
      'Commit sıklığı, PR hızı, issue yanıt süresi ve katkıda bulunan çeşitliliği tek skor altında birleşir.',
      'Her analiz snapshot olarak saklanır; zaman içindeki değişim grafikle gösterilir.',
      'Öneriler (recommendations) skoru artırmak için aksiyona yönelik maddeler sunar.',
      'Paylaşılabilir skor kartı ve SVG badge üretimi desteklenir.',
    ],
  },
  'feature-gap-analizi': {
    icon: '🔍',
    title: 'Feature Gap Analizi',
    subtitle: 'Benzer projeleri karşılaştırarak eksik özellikleri tespit eder.',
    listDesc: 'Benzer projelerle karşılaştırma, eksik özellik tespiti',
    overview: 'Feature Gap Analizi, kullanıcının reposunu aynı domain\'deki popüler projelerle karşılaştırır. Benzer repoların README, dosya yapısı ve konfigürasyonlarını inceleyen Claude AI, "orada var, sende yok" önerilerini öncelik ve efor etiketleriyle listeler.',
    howItWorks: [
      'Kullanıcı analiz edilecek repoyu seçer.',
      'Backend, repo\'nun topics, dil ve açıklamasına göre GitHub Search API ile benzer repoları bulur.',
      'Bulunan ilk 4 reponun README\'leri ve kullanıcının repo yapısı çekilir.',
      'Tüm bu içerik Claude Haiku\'ya gönderilir; "eksik feature" tespiti istenir.',
      'AI yanıtı JSON olarak parse edilerek öncelik (high/medium/low) ve efor (small/medium/large) etiketleriyle döndürülür.',
      'Kullanıcı her öneriyi "Kaydet" butonu ile özellik listesine ekleyebilir.',
    ],
    tech: [
      ['Backend', 'FastAPI (Python)'],
      ['AI Modeli', 'Claude Haiku (claude-haiku-4-5-20251001), max_tokens: 4096'],
      ['GitHub Entegrasyonu', 'GitHub Search API, README raw içeriği, dosya ağacı'],
      ['Frontend', 'Next.js 14, Tailwind CSS v4, Pagination bileşeni (5\'er öğe)'],
      ['Güvenli Parse', 'raw.find("{") + raw.rfind("}")'],
    ],
    endpoints: [
      { method: 'GET', path: '/api/repos/{owner}/{name}/feature-gap', desc: 'Benzer repoları bulur, AI analizi yapar, önerileri döndürür.' },
    ],
    files: [
      { path: 'backend/app/api/routes/repos.py', desc: 'feature-gap endpoint — get_feature_gap()' },
      { path: 'frontend/app/compare/page.tsx', desc: 'CompareTab bileşeni' },
    ],
    highlights: [
      'Gerçek GitHub projeleriyle karşılaştırma — yapay değil, canlı veri.',
      'Her öneri hangi projede görüldüğü bilgisiyle birlikte sunulur.',
      'Pagination ile büyük öneri listeleri sayfa sayfa gezilir.',
      'Öneriler kaydedilerek projenin özellik backlog\'una eklenir.',
    ],
  },
  'kendi-projeyi-analiz-et': {
    icon: '🤖',
    title: 'Kendi Projeyi Analiz Et',
    subtitle: "Kullanıcının kendi GitHub reposunu derinlemesine AI ile analiz eder.",
    listDesc: 'AI destekli kişiselleştirilmiş geliştirme önerileri',
    overview: "Bu özellik, kullanıcının kendi geliştirdiği projeyi commit geçmişi, kod yapısı ve açık issue'larıyla karşılaştırarak kişiselleştirilmiş geliştirme önerileri sunar. Proje aşaması (başlangıç/gelişme/olgunluk) otomatik belirlenir.",
    howItWorks: [
      "Kullanıcı 'Kendi Repolarım' veya 'Takip Listesi' sekmesinden bir repo seçer.",
      "Backend, repo'nun dosya ağacını, önemli konfigürasyon dosyalarını (package.json, pyproject.toml, Dockerfile vb.), README'yi çeker.",
      "Son 30 günün commit mesajları ve açık issue'lar da eklenerek bağlam oluşturulur.",
      "Tüm bağlam Claude Haiku'ya gönderilir; proje aşaması, özet ve kategorilendirilmiş öneriler istenir.",
      "Sonuç JSON olarak parse edilerek frontend'e iletilir; öneriler kayıt edilebilir.",
    ],
    tech: [
      ['Backend', 'FastAPI (Python)'],
      ['AI Modeli', 'Claude Haiku (claude-haiku-4-5-20251001), max_tokens: 4096'],
      ['GitHub Entegrasyonu', "Dosya ağacı, raw dosya içeriği, commits, issues endpoint'leri"],
      ['Kategori Sistemi', 'feature / refactor / devops / testing / docs / security'],
      ['Frontend', 'Next.js 14, Tailwind CSS v4, Pagination (5\'er öğe)'],
      ['Kullanıcı Repoları', 'UserRepo modeli — login\'de otomatik senkronize edilir'],
    ],
    endpoints: [
      { method: 'GET', path: '/api/repos/{owner}/{name}/project-analysis', desc: 'Derin proje analizi yapar, AI önerisi döndürür.' },
      { method: 'GET', path: '/api/users/my-repos', desc: "Kullanıcının kendi GitHub repolarını listeler." },
      { method: 'POST', path: '/api/users/sync-repos', desc: "GitHub'dan repoları zorla yeniler." },
    ],
    files: [
      { path: 'backend/app/api/routes/repos.py', desc: 'project-analysis endpoint' },
      { path: 'backend/app/models/user.py', desc: 'UserRepo modeli' },
      { path: 'frontend/app/compare/page.tsx', desc: 'AnalyzeTab bileşeni' },
    ],
    highlights: [
      'Commit geçmişine dayalı kişiselleştirilmiş öneriler — genel tavsiye değil.',
      'Proje aşaması otomatik tespit edilir: başlangıç, gelişme veya olgunluk.',
      'Öneriler 6 kategoriye ayrılır; her birinin önceliği ve eforu gösterilir.',
      'Yenile butonu ile GitHub\'dan güncel repolar çekilir (scope: repo).',
    ],
  },
  'danisman-advisor-chat': {
    icon: '💬',
    title: 'Danışman (Advisor Chat)',
    subtitle: 'Repo bağlamını bilen AI ile serbest ürün ve teknik danışmanlık.',
    listDesc: 'Repo bağlamını bilen AI ile serbest danışmanlık',
    overview: "Danışman özelliği, kullanıcının seçtiği repoyu önce otomatik olarak analiz eder, ardından bu analiz bulgularına dayanarak serbest konuşma modunda ürün ve teknik tavsiyeler verir.",
    howItWorks: [
      'Kullanıcı bir repo seçer.',
      "Frontend, GitHub API'den repo bilgilerini ve /project-analysis endpoint'inden derin analizi paralel çeker.",
      "Analiz sonucu session içi cache'e (useRef) alınır; commit SHA değişmediği sürece localStorage cache'den yüklenir.",
      'İlk mesaj olarak analiz özeti (proje aşaması + öne çıkan 3 öneri) otomatik gösterilir.',
      'Kullanıcı mesaj gönderince, tüm konuşma geçmişi ve analiz bağlamı backend\'e iletilir.',
      'Claude Haiku, projeyi analiz etmiş bir danışman rolünde yanıt üretir.',
    ],
    tech: [
      ['Backend', 'FastAPI (Python)'],
      ['AI Modeli', 'Claude Haiku (claude-haiku-4-5-20251001), max_tokens: 1024'],
      ['Session Cache', 'React useRef — aynı oturumda repo tekrar seçilince analiz yapılmaz'],
      ['Kalıcı Cache', "localStorage — commit SHA'ya göre geçerlilik; yeni commit = otomatik yenileme"],
      ['Frontend', 'Next.js 14, chat UI bileşeni, typing indicator, hızlı öneri butonları'],
      ['Bağlam', 'description, language, topics, project_stage, focus_areas, top_suggestions'],
    ],
    endpoints: [
      { method: 'POST', path: '/api/repos/{owner}/{name}/advisor-chat', desc: 'Konuşma geçmişi ve repo bağlamını alır, AI yanıtı döndürür.' },
      { method: 'GET', path: '/api/repos/{owner}/{name}/project-analysis', desc: 'Danışman başlatılırken bağlam için çağrılır.' },
    ],
    files: [
      { path: 'backend/app/api/routes/repos.py', desc: 'advisor-chat endpoint' },
      { path: 'frontend/app/compare/page.tsx', desc: 'AdvisorTab bileşeni' },
    ],
    highlights: [
      'Repo seçilince önce analiz yapılır; danışman projeyi bilerek konuşmaya başlar.',
      'Commit SHA tabanlı cache ile gereksiz API çağrısı önlenir.',
      'Sistem promptu "soru sorma, analiz bulgularından konuş" direktifini içerir.',
      'Hızlı öneri butonları (farklılaşma, önceliklendirme, büyüme) ilk mesajı kolaylaştırır.',
    ],
  },
  'ekip-analizi': {
    icon: '👥',
    title: 'Ekip Analizi',
    subtitle: 'Contributor aktivitesi, commit dağılımı ve PR metriklerini görselleştirir.',
    listDesc: 'Contributor aktivitesi, commit heatmap, PR metrikleri',
    overview: "Ekip Analizi sekmesi, bir reponun son 90 günlük contributor aktivitesini derinlemesine inceler. Commit dağılımı, çalışma saatleri, sıcak dosyalar ve PR metrikleri tek ekranda sunulur.",
    howItWorks: [
      "Kullanıcı repo detay sayfasında 'Ekip' sekmesini açar.",
      'Frontend, /contributors-analysis endpoint\'ini çağırır.',
      "Backend, son 90 günlük detaylı commitleri, contributor listesini ve PR'ları GitHub'dan çeker.",
      "Her commit'in saati ve günü hesaplanarak ısı haritası (heatmap) verisi oluşturulur.",
      "İlk 20 commit'in değiştirdiği dosyalar sayılarak 'hot spot' listesi çıkarılır.",
      'PR metrikleri (toplam, birleşen, açık, ortalama birleşme süresi) hesaplanır.',
    ],
    tech: [
      ['Backend', 'FastAPI (Python), GitHub REST API — commits (detailed), contributors, pulls'],
      ['Analiz', 'Saat/gün bazlı commit dağılımı, dosya değişim sayımı, PR süresi hesaplama'],
      ['Frontend', 'Next.js 14, Recharts (BarChart, commit heatmap), Tailwind CSS v4'],
      ['Performans', "Hot spot için yalnızca ilk 20 commit'in dosyaları çekilir (rate limit koruması)"],
    ],
    endpoints: [
      { method: 'GET', path: '/api/repos/{owner}/{name}/contributors-analysis', desc: 'Contributor, commit heatmap, hot spot ve PR metriklerini döndürür.' },
    ],
    files: [
      { path: 'backend/app/api/routes/repos.py', desc: 'contributors-analysis endpoint' },
      { path: 'frontend/app/repo/[owner]/[name]/page.tsx', desc: 'Ekip sekmesi bileşeni' },
    ],
    highlights: [
      'Contributor bazlı commit yüzdesi ve avatar gösterimi.',
      "Saatlik ve günlük commit dağılımı — ekibin ne zaman aktif olduğu görülür.",
      'En sık değiştirilen dosyalar (hot spots) teknik borç tespitinde kullanılabilir.',
      'PR birleştirme ortalama süresi ekip verimliliğinin göstergesi olarak sunulur.',
    ],
  },
  'kaydedilen-feature-onerileri': {
    icon: '📌',
    title: 'Kaydedilen Feature Önerileri',
    subtitle: "AI'nın ürettiği önerileri projeler bazında yönet ve takip et.",
    listDesc: 'Önerileri backlog olarak yönet, statü takibi',
    overview: "Kullanıcı, Feature Gap veya Proje Analizi'nden gelen önerileri 'Kaydet' butonu ile kaydedebilir. Beklemede, devam ediyor ve tamamlandı statüleriyle yönetilir.",
    howItWorks: [
      "Kullanıcı bir öneriyi kaydetmek için 'Kaydet' butonuna tıklar.",
      'Frontend, repo_full_name, title, description, priority, effort ve seen_in alanlarını backend\'e gönderir.',
      'SavedFeature modeline yeni kayıt eklenir; kullanıcıya özgü (user_id ile filtrelenir).',
      '/features/ endpoint\'inden çekilen öneriler repo detay sayfasında filtrelenerek gösterilir.',
      'Kullanıcı statü güncelleyebilir (PATCH) veya öneriyi silebilir (DELETE).',
    ],
    tech: [
      ['Backend', 'FastAPI (Python), SQLAlchemy async, PostgreSQL'],
      ['Model', 'SavedFeature — user_id (UUID), repo_full_name, title, priority, effort, status, seen_in (JSON)'],
      ['Statü Sistemi', 'pending / in_progress / done — renk kodlu gösterim'],
      ['Frontend', 'Next.js 14, repo detay sayfasında "Feature Önerileri" sekmesi'],
      ['Sayım', '/features/counts endpoint\'i bekleyen öneri sayısını döndürür (navbar badge)'],
    ],
    endpoints: [
      { method: 'POST', path: '/api/features/', desc: 'Yeni öneri kaydeder.' },
      { method: 'GET', path: '/api/features/', desc: "Kullanıcının tüm önerilerini listeler." },
      { method: 'PATCH', path: '/api/features/{id}', desc: 'Öneri statüsünü günceller.' },
      { method: 'DELETE', path: '/api/features/{id}', desc: 'Öneriyi siler.' },
      { method: 'GET', path: '/api/features/counts', desc: 'Bekleyen öneri sayısını döndürür.' },
    ],
    files: [
      { path: 'backend/app/api/routes/features.py', desc: "Feature CRUD endpoint'leri" },
      { path: 'backend/app/models/repo.py', desc: 'SavedFeature modeli' },
      { path: 'frontend/app/repo/[owner]/[name]/page.tsx', desc: 'Feature Önerileri sekmesi' },
    ],
    highlights: [
      'Pending / in-progress / done statüleri ile mini proje yönetimi.',
      'Repo detay sayfasında ilgili öneriler filtrelenerek gösterilir.',
      'Bekleyen öneriler sekme başlığında rozet (badge) ile belirtilir.',
      'seen_in alanı: öneri hangi projede görüldü bilgisini saklar.',
    ],
  },
  'bildirim-sistemi': {
    icon: '🔔',
    title: 'Bildirim Sistemi',
    subtitle: 'Takip edilen repolar için otomatik commit, skor düşüşü ve PR bildirimleri.',
    listDesc: 'Commit, skor düşüşü ve PR bildirimleri',
    overview: "Takip listesindeki repolar düzenli aralıklarla kontrol edilir. Yeni commit, skor düşüşü veya yeni PR tespit edildiğinde kullanıcıya bildirim oluşturulur. Navbar'daki zil ikonu okunmamış bildirimleri gösterir.",
    howItWorks: [
      "Celery Beat, belirli aralıklarla watchlist'teki repoları analiz eden görevi tetikler.",
      'Her repo için GitHub API\'den yeni aktivite kontrol edilir.',
      'Değişiklik tespit edilirse Notification modeline kayıt eklenir.',
      "Kullanıcı navbar'daki zil ikonuna tıklayarak bildirimleri görür ve okundu olarak işaretler.",
      "Frontend, sayfa açıldığında /notifications/check endpoint'ini çağırarak badge'i günceller.",
    ],
    tech: [
      ['Backend', 'FastAPI (Python), Celery (async task queue), Redis (broker)'],
      ['Zamanlama', 'Celery Beat — periyodik görev planlayıcı'],
      ['Model', 'Notification — user_id (UUID), repo_id, type (new_commit/score_drop/new_pr), is_read'],
      ['Frontend', "Next.js 14, navbar zil ikonu, okunmamış sayı badge'i"],
    ],
    endpoints: [
      { method: 'GET', path: '/api/notifications/', desc: "Kullanıcının bildirimlerini listeler." },
      { method: 'POST', path: '/api/notifications/mark-read', desc: 'Tüm bildirimleri okundu işaretler.' },
      { method: 'POST', path: '/api/notifications/check', desc: 'Yeni bildirim kontrolü tetikler.' },
    ],
    files: [
      { path: 'backend/app/api/routes/notifications.py', desc: "Bildirim endpoint'leri" },
      { path: 'backend/app/models/repo.py', desc: 'Notification modeli' },
      { path: 'frontend/components/AppShell.tsx', desc: 'Navbar zil bileşeni' },
    ],
    highlights: [
      '3 bildirim tipi: yeni commit, skor düşüşü, yeni PR.',
      'Celery Beat ile arka planda otomatik kontrol — kullanıcı sayfayı yenilemek zorunda kalmaz.',
      "Navbar'da okunmamış sayısı badge olarak gösterilir.",
      '"Hepsini okundu işaretle" butonu ile toplu temizleme.',
    ],
  },
  'organizasyon-yonetimi': {
    icon: '🏢',
    title: 'Organizasyon Yönetimi',
    subtitle: 'Takımlar oluştur, üye davet et ve ortak watchlist\'i yönet.',
    listDesc: 'Takım oluştur, üye davet et, ortak dashboard',
    overview: "Organizasyon özelliği, birden fazla geliştiricinin aynı workspace altında repo takip etmesini sağlar. Sahip üye davet edebilir, roller atayabilir (owner/admin/member) ve ortak bir watchlist oluşturabilir.",
    howItWorks: [
      'Kullanıcı yeni bir organizasyon oluşturur; benzersiz slug otomatik üretilir.',
      'Sahip, e-posta adresiyle üye davet eder; davet e-postası benzersiz token içerir.',
      'Davet linki tıklanarak organizasyona katılım gerçekleşir.',
      'Organizasyon üyeleri ortak dashboardda repo sağlık skorlarını izler.',
      'Roller: owner (tam yetki), admin (üye yönetimi), member (görüntüleme).',
    ],
    tech: [
      ['Backend', 'FastAPI (Python), SQLAlchemy async, PostgreSQL'],
      ['Modeller', 'Organization, OrganizationMember (UUID user_id), OrgInvite (token tabanlı)'],
      ['Güvenlik', 'JWT kimlik doğrulama, rol bazlı yetkilendirme'],
      ['Frontend', 'Next.js 14, /org sayfası, üye listesi, davet formu'],
    ],
    endpoints: [
      { method: 'POST', path: '/api/orgs/', desc: 'Yeni organizasyon oluşturur.' },
      { method: 'GET', path: '/api/orgs/', desc: "Kullanıcının organizasyonlarını listeler." },
      { method: 'POST', path: '/api/orgs/{slug}/invite', desc: 'E-posta ile üye davet eder.' },
      { method: 'GET', path: '/api/orgs/join/{token}', desc: 'Davet tokenı ile organizasyona katılır.' },
      { method: 'DELETE', path: '/api/orgs/{slug}/members/{userId}', desc: 'Üyeyi çıkarır.' },
      { method: 'PATCH', path: '/api/orgs/{slug}/members/{userId}/role', desc: 'Üye rolünü günceller.' },
    ],
    files: [
      { path: 'backend/app/api/routes/orgs.py', desc: "Organizasyon endpoint'leri" },
      { path: 'backend/app/models/user.py', desc: 'Organization, OrganizationMember, OrgInvite modelleri' },
      { path: 'frontend/app/org/', desc: 'Organizasyon sayfaları' },
    ],
    highlights: [
      'Token tabanlı e-posta daveti — link tıklanınca otomatik katılım.',
      'Üç rol seviyesi: owner, admin, member.',
      'Organizasyona özel repo takip listesi ve skor dashboardu.',
      'UUID tabanlı kullanıcı kimlikleri — güvenli ve ölçeklenebilir.',
    ],
  },
  'github-oauth': {
    icon: '🔐',
    title: 'GitHub OAuth ve Kimlik Doğrulama',
    subtitle: 'GitHub OAuth 2.0 ile güvenli giriş ve JWT token yönetimi.',
    listDesc: 'OAuth 2.0 akışı, JWT yönetimi, UUID kullanıcı kimlikleri',
    overview: "RepoMind, kullanıcı kimliğini doğrulamak için GitHub OAuth 2.0 akışını kullanır. Giriş yapıldığında kullanıcı bilgileri veritabanına kaydedilir, GitHub erişim tokeni saklanır ve kısa ömürlü JWT ile oturum yönetilir.",
    howItWorks: [
      "Kullanıcı 'GitHub ile Giriş Yap' butonuna tıklar.",
      "Backend, kullanıcıyı GitHub OAuth authorize sayfasına yönlendirir (scope: read:user, user:email, repo).",
      'Kullanıcı onay verince GitHub, backend callback URL\'ine code parametresiyle döner.',
      'Backend, code\'u access token ile değiştirir ve kullanıcı bilgilerini çeker.',
      'Kullanıcı veritabanında oluşturulur (UUID id) veya güncellenir; token saklanır.',
      "Login sonrası GitHub repoları senkronize edilir (1 saatte bir cache).",
      "JWT token üretilir ve frontend'e query param olarak iletilir; localStorage'a kaydedilir.",
    ],
    tech: [
      ['OAuth', 'GitHub OAuth 2.0 — scope: read:user, user:email, repo'],
      ['Backend', 'FastAPI, python-jwt, httpx (async HTTP)'],
      ['Token', 'JWT — HS256 algoritması, yapılandırılabilir süre'],
      ['Kullanıcı ID', 'UUID v4 — rastgele üretilir, integer sequence değil'],
      ['Frontend', "localStorage'da JWT saklama, Authorization: Bearer header"],
      ['Güvenlik', "GITHUB_CLIENT_SECRET .env'de saklanır, Git'e eklenmez"],
    ],
    endpoints: [
      { method: 'GET', path: '/api/auth/login', desc: 'GitHub OAuth akışını başlatır.' },
      { method: 'GET', path: '/api/auth/callback', desc: "GitHub'dan dönen code'u token'a çevirir, JWT üretir." },
    ],
    files: [
      { path: 'backend/app/api/routes/auth.py', desc: 'OAuth akışı ve repo senkronizasyonu' },
      { path: 'backend/app/core/auth.py', desc: 'JWT doğrulama middleware' },
      { path: 'backend/app/models/user.py', desc: 'User ve UserRepo modelleri' },
      { path: "frontend/app/auth/callback/page.tsx", desc: "Token'ı localStorage'a kaydeden sayfa" },
    ],
    highlights: [
      'repo OAuth scope\'u sayesinde private repolar da listelenir.',
      "Login başına en fazla 1 kez repo senkronizasyonu (1 saatlik cache).",
      'UUID tabanlı user ID — sıralı integer yerine güvenli rastgele kimlik.',
      'Yenile butonu ile manuel GitHub repo güncellemesi desteklenir.',
    ],
  },
  'paylasilabilir-skor-karti': {
    icon: '🏅',
    title: 'Paylaşılabilir Skor Kartı ve Badge',
    subtitle: "Repo sağlık skorunu herkese açık link ve SVG badge ile paylaş.",
    listDesc: 'Public link ve SVG badge üretimi',
    overview: "Her analiz edilen repo için herkese açık bir skor kartı sayfası ve README'ye eklenebilir SVG badge otomatik oluşturulur. Kimlik doğrulama gerektirmez; doğrudan paylaşılabilir.",
    howItWorks: [
      "Analiz tamamlandıktan sonra /score/{owner}/{name} URL'i aktif hale gelir.",
      "Skor kartı sayfası, son snapshot'taki tüm metrikleri gösterir.",
      'Badge endpoint\'i, skora göre renk kodlu (yeşil/sarı/kırmızı) SVG döndürür.',
      "Kullanıcı README'sine ekleyebileceği Markdown badge kodunu kopyalar.",
    ],
    tech: [
      ['Backend', 'FastAPI — public endpoint (kimlik doğrulama yok)'],
      ['Badge', 'SVG üretimi — saf Python string formatlaması, harici kütüphane yok'],
      ['Frontend', 'Next.js 14, /score/[owner]/[name] public sayfası'],
      ['Cache', 'Cache-Control: no-cache — her istekte taze skor'],
    ],
    endpoints: [
      { method: 'GET', path: '/api/repos/{owner}/{name}/scorecard', desc: 'Public skor kartı verisi.' },
      { method: 'GET', path: '/api/repos/{owner}/{name}/badge', desc: 'SVG badge döndürür (README için).' },
    ],
    files: [
      { path: 'backend/app/api/routes/repos.py', desc: 'scorecard ve badge endpoint\'leri' },
      { path: 'frontend/app/score/[owner]/[name]/page.tsx', desc: 'Public skor kartı sayfası' },
    ],
    highlights: [
      'Login gerektirmez — herkes görüntüleyebilir.',
      'Badge rengi skora göre otomatik değişir: yeşil (80+), sarı (60–79), kırmızı (< 60).',
      "README'ye tek satır Markdown ile eklenebilir.",
      "Skor 0–100 arası normalize edilmiş değer, anlık güncel snapshot'tan alınır.",
    ],
  },
};
