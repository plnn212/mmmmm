// Global veri değişkenleri
let fundPerformanceData = [];
let investorCardsData = [];

// Tarih formatlama (TEFAS formatı: DD.MM.YYYY)
function formatDateForTEFAS(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// TEFAS API'den veri çek
async function fetchTEFASData() {
    try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Hafta öncesi, ay öncesi, yıl öncesi tarihleri hesapla
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        
        const startDate = formatDateForTEFAS(yesterday);
        const endDate = formatDateForTEFAS(today);
        
        // API isteği için form data
        const formData = new URLSearchParams();
        formData.append('fontip', 'YAT');
        formData.append('sfontur', '');
        formData.append('fonkod', '');
        formData.append('fongrup', '');
        formData.append('bastarih', startDate);
        formData.append('bittarih', endDate);
        formData.append('fonturkod', '');
        formData.append('fonunvantip', '');
        formData.append('kurucukod', '');
        
        const response = await fetch('https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            throw new Error('API isteği başarısız');
        }
        
        const data = await response.text();
        return parseTEFASData(data, weekAgo, monthAgo, yearAgo);
    } catch (error) {
        console.error('TEFAS API hatası:', error);
        // Hata durumunda mock verileri kullan
        return getMockData();
    }
}

// TEFAS verisini parse et
function parseTEFASData(htmlData, weekAgo, monthAgo, yearAgo) {
    try {
        // JSON formatında mı kontrol et
        let data;
        try {
            data = JSON.parse(htmlData);
            // JSON ise direkt kullan
            if (Array.isArray(data)) {
                return data.map(item => ({
                    code: item.FONKOD || item.fonKod || '',
                    name: item.FONUNVAN || item.fonUnvan || '',
                    category: mapCategory(item.FONTUR || item.fonTur || ''),
                    daily: parseFloat(item.GUNLUK || item.gunluk || 0),
                    weekly: parseFloat(item.HAFTALIK || item.haftalik || 0),
                    monthly: parseFloat(item.AYLIK || item.aylik || 0),
                    yearly: parseFloat(item.YILLIK || item.yillik || 0),
                    totalValue: parseFloat(item.TOPLAM || item.toplam || 0),
                    risk: item.RISK || item.risk || 'Orta'
                }));
            }
        } catch (e) {
            // JSON değilse HTML olarak parse et
        }
        
        // HTML parser kullanarak tabloyu parse et
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlData, 'text/html');
        const table = doc.querySelector('table');
        
        if (!table) {
            // Tablo yoksa, belki JSON içinde data var
            console.warn('Tablo bulunamadı, HTML parse edilemedi');
            return [];
        }
        
        const rows = table.querySelectorAll('tbody tr');
        const funds = [];
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;
            
            try {
                const code = cells[0]?.textContent?.trim() || '';
                const name = cells[1]?.textContent?.trim() || '';
                const category = mapCategory(cells[2]?.textContent?.trim() || '');
                const daily = parseFloat((cells[3]?.textContent || '0').replace(',', '.').replace('%', '')) || 0;
                const weekly = parseFloat((cells[4]?.textContent || '0').replace(',', '.').replace('%', '')) || 0;
                const monthly = parseFloat((cells[5]?.textContent || '0').replace(',', '.').replace('%', '')) || 0;
                const yearly = parseFloat((cells[6]?.textContent || '0').replace(',', '.').replace('%', '')) || 0;
                const totalValueText = cells[7]?.textContent || '0';
                const totalValue = parseFloat(totalValueText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                const risk = cells[8]?.textContent?.trim() || 'Orta';
                
                if (code && name) {
                    funds.push({
                        code,
                        name,
                        category,
                        daily: daily || 0,
                        weekly: weekly || 0,
                        monthly: monthly || 0,
                        yearly: yearly || 0,
                        totalValue: totalValue || 0,
                        risk: risk || 'Orta'
                    });
                }
            } catch (e) {
                console.warn('Satır parse edilemedi:', e);
            }
        });
        
        return funds;
    } catch (error) {
        console.error('Parse hatası:', error);
        return [];
    }
}

// Kategori mapping
function mapCategory(categoryText) {
    const categoryMap = {
        'Hisse Senedi': 'hisse-senedi',
        'Karma': 'karma',
        'Borçlanma Araçları': 'borçlanma',
        'Tahvil ve Bono': 'borçlanma',
        'Para Piyasası': 'para-piyasası',
        'Altın': 'kıymetli-madenler',
        'Kıymetli Madenler': 'kıymetli-madenler',
        'Fon Sepeti': 'fon-sepet',
        'Serbest': 'serbest',
        'Değişken': 'değişken',
        'Katılım': 'katılım'
    };
    
    for (const [key, value] of Object.entries(categoryMap)) {
        if (categoryText.includes(key)) {
            return value;
        }
    }
    return 'değişken';
}

// Yatırımcı verilerini TEFAS API'den çek
async function fetchInvestorData() {
    try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const startDate = formatDateForTEFAS(yesterday);
        const endDate = formatDateForTEFAS(today);
        
        console.log('TEFAS API çağrısı yapılıyor...', { startDate, endDate });
        
        // API isteği için form data
        const formData = new URLSearchParams();
        formData.append('fontip', 'YAT');
        formData.append('sfontur', '');
        formData.append('fonkod', '');
        formData.append('fongrup', '');
        formData.append('bastarih', startDate);
        formData.append('bittarih', endDate);
        formData.append('fonturkod', '');
        formData.append('fonunvantip', '');
        formData.append('kurucukod', '');
        
        console.log('API isteği gönderiliyor:', formData.toString());
        
        const response = await fetch('https://www.tefas.gov.tr/api/DB/BindHistoryInfo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: formData.toString(),
            mode: 'cors'
        });
        
        console.log('API response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`API isteği başarısız: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.text();
        console.log('API response data (ilk 500 karakter):', data.substring(0, 500));
        console.log('API response data uzunluğu:', data.length);
        
        const parsedData = parseInvestorData(data);
        console.log('Parse edilen yatırımcı verisi:', parsedData);
        
        return parsedData;
    } catch (error) {
        console.error('Yatırımcı verisi API hatası:', error);
        console.error('Hata detayı:', error.message);
        // Hata durumunda mock verileri kullan
        console.log('Mock veriler kullanılıyor');
        return getMockInvestorData();
    }
}

// Yatırımcı verilerini parse et
function parseInvestorData(htmlData) {
    try {
        if (!htmlData || htmlData.trim().length === 0) {
            console.warn('Boş response alındı');
            return getMockInvestorData();
        }
        
        let data;
        let investors = [];
        
        // JSON formatında mı kontrol et
        try {
            data = JSON.parse(htmlData);
            console.log('JSON formatında veri alındı, ilk eleman:', data[0]);
            
            if (Array.isArray(data) && data.length > 0) {
                // Tüm olası alan isimlerini kontrol et
                investors = data
                    .map((item, index) => {
                        // Farklı olası alan isimlerini dene
                        const currentInvestors = parseInt(
                            item.YATIRIMCI_SAYISI || 
                            item.yatirimciSayisi || 
                            item.YATIRIMCI || 
                            item.yatirimci ||
                            item.MEV_YATIRIMCI ||
                            item.mevYatirimci ||
                            item.SAYI ||
                            item.sayi ||
                            0
                        );
                        
                        const previousInvestors = parseInt(
                            item.ONCEKI_YATIRIMCI || 
                            item.oncekiYatirimci || 
                            item.ONCEKI_SAYI || 
                            item.oncekiSayi ||
                            item.ONCEKI_YATIRIMCI_SAYISI ||
                            item.oncekiYatirimciSayisi ||
                            0
                        );
                        
                        const change = currentInvestors - previousInvestors;
                        const changePercent = previousInvestors > 0 ? (change / previousInvestors) * 100 : 0;
                        
                        return {
                            code: item.FONKOD || item.fonKod || item.KOD || item.kod || '',
                            name: item.FONUNVAN || item.fonUnvan || item.UNVAN || item.unvan || '',
                            currentInvestors: currentInvestors,
                            previousInvestors: previousInvestors,
                            change: change,
                            changePercent: changePercent
                        };
                    })
                    .filter(item => item.code && item.name && item.currentInvestors > 0)
                    .sort((a, b) => b.change - a.change)
                    .slice(0, 10);
                
                console.log('JSON\'dan parse edilen yatırımcı sayısı:', investors.length);
            } else if (data && typeof data === 'object') {
                // Tek bir obje ise, içindeki array'i bul
                const dataArray = Object.values(data).find(val => Array.isArray(val));
                if (dataArray) {
                    console.log('Nested array bulundu');
                    // Aynı işlemi yap
                }
            }
        } catch (e) {
            console.log('JSON parse edilemedi, HTML olarak denenecek:', e.message);
            
            // JSON değilse HTML olarak parse et
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlData, 'text/html');
            const table = doc.querySelector('table');
            
            if (table) {
                console.log('HTML tablosu bulundu');
                const rows = table.querySelectorAll('tbody tr');
                console.log('Tablo satır sayısı:', rows.length);
                const investorList = [];
                
                rows.forEach((row, rowIndex) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) return;
                    
                    try {
                        // Farklı kolon düzenlerini dene
                        const code = cells[0]?.textContent?.trim() || '';
                        const name = cells[1]?.textContent?.trim() || '';
                        
                        // Yatırımcı sayısı farklı kolonlarda olabilir
                        let currentInvestorsText = '';
                        let previousInvestorsText = '';
                        
                        // Kolon sayısına göre farklı yaklaşımlar dene
                        if (cells.length >= 4) {
                            currentInvestorsText = cells[2]?.textContent || '0';
                            previousInvestorsText = cells[3]?.textContent || '0';
                        } else if (cells.length >= 3) {
                            currentInvestorsText = cells[2]?.textContent || '0';
                            previousInvestorsText = '0';
                        }
                        
                        const currentInvestors = parseInt(currentInvestorsText.replace(/[^\d]/g, '')) || 0;
                        const previousInvestors = parseInt(previousInvestorsText.replace(/[^\d]/g, '')) || 0;
                        const change = currentInvestors - previousInvestors;
                        const changePercent = previousInvestors > 0 ? (change / previousInvestors) * 100 : 0;
                        
                        if (code && name && currentInvestors > 0) {
                            investorList.push({
                                code,
                                name,
                                currentInvestors,
                                previousInvestors,
                                change,
                                changePercent
                            });
                        }
                    } catch (err) {
                        console.warn('Yatırımcı satırı parse edilemedi (satır', rowIndex, '):', err);
                    }
                });
                
                console.log('HTML\'den parse edilen yatırımcı sayısı:', investorList.length);
                
                // Yatırımcı değişimine göre sırala ve en fazla artan 10 fonu al
                investors = investorList
                    .sort((a, b) => b.change - a.change)
                    .slice(0, 10);
            } else {
                console.warn('HTML tablosu bulunamadı');
            }
        }
        
        if (investors.length > 0) {
            console.log('Başarıyla parse edilen yatırımcı verisi:', investors.length, 'fon');
            return investors;
        } else {
            console.warn('Parse edilen veri yok, mock veriler kullanılacak');
            return getMockInvestorData();
        }
    } catch (error) {
        console.error('Yatırımcı verisi parse hatası:', error);
        return getMockInvestorData();
    }
}

// Mock yatırımcı verileri
function getMockInvestorData() {
    return [
        { code: 'DEN', name: 'Denizbank Para Piyasası Fonu', currentInvestors: 32145, previousInvestors: 29573, change: 2571, changePercent: 8.70 },
        { code: 'ISB', name: 'İş Bankası Devlet Tahvili ve Bono Fonu', currentInvestors: 25678, previousInvestors: 23623, change: 2054, changePercent: 8.70 },
        { code: 'VKF', name: 'Vakıfbank Kısa Vadeli Tahvil Fonu', currentInvestors: 21456, previousInvestors: 19739, change: 1716, changePercent: 8.70 },
        { code: 'YKB', name: 'Yapı Kredi Bankası Dengeli Karma Fon', currentInvestors: 18765, previousInvestors: 17263, change: 1501, changePercent: 8.70 },
        { code: 'AKB', name: 'Akbank Teknoloji Sektör Fonu', currentInvestors: 16543, previousInvestors: 15234, change: 1309, changePercent: 8.59 },
        { code: 'GAR', name: 'Garanti Yatırım Değişken Fon', currentInvestors: 15432, previousInvestors: 14218, change: 1214, changePercent: 8.54 },
        { code: 'ZIR', name: 'Ziraat Yatırım Katılım Fonu', currentInvestors: 14321, previousInvestors: 13205, change: 1116, changePercent: 8.46 },
        { code: 'ALT', name: 'Altın ve Kıymetli Madenler Fonu', currentInvestors: 13210, previousInvestors: 12198, change: 1012, changePercent: 8.30 },
        { code: 'SER', name: 'Serbest Yatırım Fonu', currentInvestors: 12098, previousInvestors: 11187, change: 911, changePercent: 8.14 },
        { code: 'FON', name: 'Fon Sepeti Yatırım Fonu', currentInvestors: 10987, previousInvestors: 10176, change: 811, changePercent: 7.97 }
    ];
}

// Mock veriler (fallback)
function getMockData() {
    return [
    { code: 'AKB', name: 'Akbank Teknoloji Sektör Fonu', category: 'hisse-senedi', daily: 3.45, weekly: 8.23, monthly: 15.67, yearly: 42.89, totalValue: 2456789123, risk: 'Yüksek' },
    { code: 'GAR', name: 'Garanti Yatırım Değişken Fon', category: 'değişken', daily: 2.89, weekly: 7.12, monthly: 14.23, yearly: 38.45, totalValue: 1890234567, risk: 'Yüksek' },
    { code: 'ISB', name: 'İş Bankası Devlet Tahvili ve Bono Fonu', category: 'borçlanma', daily: 1.95, weekly: 4.56, monthly: 8.90, yearly: 22.34, totalValue: 3200000000, risk: 'Düşük' },
    { code: 'YKB', name: 'Yapı Kredi Bankası Dengeli Karma Fon', category: 'karma', daily: 2.34, weekly: 6.78, monthly: 12.45, yearly: 35.67, totalValue: 1567890123, risk: 'Orta' },
    { code: 'DEN', name: 'Denizbank Para Piyasası Fonu', category: 'para-piyasası', daily: 0.89, weekly: 2.34, monthly: 5.67, yearly: 18.90, totalValue: 4500000000, risk: 'Düşük' },
    { code: 'VKF', name: 'Vakıfbank Kısa Vadeli Tahvil Fonu', category: 'borçlanma', daily: 1.56, weekly: 3.89, monthly: 7.23, yearly: 19.45, totalValue: 2100000000, risk: 'Düşük' },
    { code: 'ZIR', name: 'Ziraat Yatırım Katılım Fonu', category: 'katılım', daily: 1.78, weekly: 5.12, monthly: 10.34, yearly: 28.56, totalValue: 1234567890, risk: 'Orta' },
    { code: 'ALT', name: 'Altın ve Kıymetli Madenler Fonu', category: 'kıymetli-madenler', daily: 1.34, weekly: 4.56, monthly: 9.78, yearly: 25.67, totalValue: 987654321, risk: 'Yüksek' },
    { code: 'FON', name: 'Fon Sepeti Yatırım Fonu', category: 'fon-sepet', daily: 0.67, weekly: 2.12, monthly: 4.56, yearly: 15.78, totalValue: 765432109, risk: 'Orta' },
    { code: 'SER', name: 'Serbest Yatırım Fonu', category: 'serbest', daily: 2.12, weekly: 6.45, monthly: 13.89, yearly: 40.12, totalValue: 1123456789, risk: 'Yüksek' },
    { code: 'TEK', name: 'Teknoloji Sektör Fonu', category: 'hisse-senedi', daily: -0.23, weekly: 1.45, monthly: 8.90, yearly: 32.45, totalValue: 1987654321, risk: 'Yüksek' },
    { code: 'KAR', name: 'Karma Yatırım Fonu', category: 'karma', daily: -0.56, weekly: 0.89, monthly: 5.67, yearly: 24.78, totalValue: 1456789012, risk: 'Orta' },
    { code: 'BOR', name: 'Borçlanma Araçları Fonu', category: 'borçlanma', daily: -0.78, weekly: -0.12, monthly: 3.45, yearly: 16.89, totalValue: 2345678901, risk: 'Düşük' },
    { code: 'DEG', name: 'Değişken Yatırım Fonu', category: 'değişken', daily: -1.12, weekly: -1.45, monthly: 2.34, yearly: 18.90, totalValue: 1678901234, risk: 'Yüksek' },
    { code: 'PAR', name: 'Para Piyasası Fonu', category: 'para-piyasası', daily: -0.45, weekly: 0.67, monthly: 4.12, yearly: 14.56, totalValue: 3456789012, risk: 'Düşük' }
    ];
}


// Küresel finans haberleri
const financialNews = [
    {
        title: 'Fed Faiz Kararı Beklentileri Piyasaları Etkiliyor',
        content: 'ABD Merkez Bankası\'nın (Fed) önümüzdeki toplantısında faiz oranları konusundaki kararı, küresel finansal piyasaları etkilemeye devam ediyor. Analistler, enflasyon verilerine göre politika değişikliği bekliyor.',
        date: '2024-01-15'
    },
    {
        title: 'Avrupa Borsaları Yükselişte',
        content: 'Avrupa borsaları, güçlü kurumsal karlılık raporları ve olumlu ekonomik verilerle birlikte haftayı yükselişle kapattı. DAX ve FTSE 100 endeksleri önemli kazanımlar elde etti.',
        date: '2024-01-14'
    },
    {
        title: 'Altın Fiyatları Yeni Rekor Kırdı',
        content: 'Küresel belirsizlikler ve düşük faiz ortamı altın fiyatlarını yukarı taşıdı. Ons altın fiyatı son 3 ayın en yüksek seviyesine ulaştı.',
        date: '2024-01-13'
    },
    {
        title: 'Kripto Para Piyasası Volatilite Gösteriyor',
        content: 'Bitcoin ve diğer kripto paralar, düzenleyici gelişmeler ve kurumsal yatırımcı ilgisiyle birlikte yüksek volatilite yaşıyor. Piyasa uzmanları dikkatli olunması gerektiğini belirtiyor.',
        date: '2024-01-12'
    },
    {
        title: 'Asya Pasifik Borsaları Karışık',
        content: 'Çin ve Japonya borsaları karışık seyrederken, Güney Kore ve Avustralya borsaları güçlü performans sergiledi. Bölgesel ekonomik veriler piyasaları etkiliyor.',
        date: '2024-01-11'
    },
    {
        title: 'Petrol Fiyatları Yükselişte',
        content: 'Ortadoğu\'daki jeopolitik gelişmeler ve arz endişeleri petrol fiyatlarını yukarı taşıdı. Brent petrol varil başına 85 doların üzerine çıktı.',
        date: '2024-01-10'
    }
];

// Kategori isimleri mapping
const categoryNames = {
    'borçlanma': 'Tahvil ve Bono Fonları',
    'değişken': 'Değişken',
    'karma': 'Karma Fonlar',
    'fon-sepet': 'Fon Sepeti',
    'hisse-senedi': 'Hisse Senedi Fonları',
    'katılım': 'Katılım',
    'kıymetli-madenler': 'Altın ve Kıymetli Madenler',
    'para-piyasası': 'Para Piyasası Fonları',
    'serbest': 'Serbest Fonlar'
};

// Kategori sayıları
function getCategoryCounts() {
    const counts = {};
    fundPerformanceData.forEach(fund => {
        counts[fund.category] = (counts[fund.category] || 0) + 1;
    });
    return counts;
}

// Durum değişkenleri
let currentSort = 'daily'; // 'daily', 'weekly', 'monthly', 'yearly'
let sortAscending = false; // false = yüksekten düşüğe, true = düşükten yükseğe
let currentFilter = 'all';
let searchQuery = '';

// Yatırımcı kartlarını render et
function renderInvestorCards() {
    const container = document.getElementById('investor-cards');
    container.innerHTML = investorCardsData.map(card => `
        <div class="investor-card">
            <span class="trend-icon">📈</span>
            <h3>${card.name}</h3>
            <div class="code">${card.code}</div>
            <div class="label">Mevcut Yatırımcı: ${card.currentInvestors.toLocaleString('tr-TR')}</div>
            <div class="label" style="margin-top: 10px;">Önceki Dönem: ${card.previousInvestors.toLocaleString('tr-TR')}</div>
            <div class="change positive">
                Değişim: +${card.change.toLocaleString('tr-TR')} (+${card.changePercent.toFixed(2)}%)
            </div>
        </div>
    `).join('');
}

// Kategori filtrelerini render et
function renderCategoryFilters() {
    const container = document.getElementById('category-filters');
    const counts = getCategoryCounts();
    const totalCount = fundPerformanceData.length;
    
    const filters = [
        { value: 'all', label: 'Tümü', count: totalCount },
        { value: 'hisse-senedi', label: 'Hisse Senedi Fonları', count: counts['hisse-senedi'] || 0 },
        { value: 'karma', label: 'Karma Fonlar', count: counts['karma'] || 0 },
        { value: 'borçlanma', label: 'Tahvil ve Bono Fonları', count: counts['borçlanma'] || 0 },
        { value: 'kıymetli-madenler', label: 'Altın ve Kıymetli Madenler', count: counts['kıymetli-madenler'] || 0 },
        { value: 'para-piyasası', label: 'Para Piyasası Fonları', count: counts['para-piyasası'] || 0 },
        { value: 'serbest', label: 'Serbest Fonlar', count: counts['serbest'] || 0 }
    ];
    
    container.innerHTML = filters.map(filter => `
        <button class="category-btn ${currentFilter === filter.value ? 'active' : ''}" 
                data-category="${filter.value}">
            ${filter.label} ${filter.count}
        </button>
    `).join('');
    
    // Event listener'ları ekle
    container.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.category;
            renderCategoryFilters();
            renderPerformanceTable();
        });
    });
}

// Fon performans tablosunu doldur
function renderPerformanceTable() {
    const tbody = document.getElementById('performance-tbody');
    
    // Verileri filtrele
    let filtered = fundPerformanceData.filter(fund => {
        const matchesCategory = currentFilter === 'all' || fund.category === currentFilter;
        const matchesSearch = searchQuery === '' || 
            fund.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            fund.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });
    
    // Sıralama
    filtered.sort((a, b) => {
        let aValue, bValue;
        switch(currentSort) {
            case 'daily': aValue = a.daily; bValue = b.daily; break;
            case 'weekly': aValue = a.weekly; bValue = b.weekly; break;
            case 'monthly': aValue = a.monthly; bValue = b.monthly; break;
            case 'yearly': aValue = a.yearly; bValue = b.yearly; break;
            default: aValue = a.daily; bValue = b.daily;
        }
        
        if (sortAscending) {
            return aValue - bValue;
        } else {
            return bValue - aValue;
        }
    });
    
    // Tabloyu doldur
    tbody.innerHTML = filtered.map(fund => {
        const riskClass = fund.risk === 'Yüksek' ? 'risk-high' : 
                         fund.risk === 'Orta' ? 'risk-medium' : 'risk-low';
        
        return `
        <tr>
            <td><input type="checkbox" class="row-checkbox"></td>
            <td>
                <div class="fund-code">${fund.code}</div>
                <div class="fund-name">${fund.name}</div>
            </td>
            <td>${categoryNames[fund.category]}</td>
            <td class="${fund.daily > 0 ? 'positive' : fund.daily < 0 ? 'negative' : ''}">
                ${fund.daily > 0 ? '+' : ''}${fund.daily.toFixed(2)}%
            </td>
            <td class="${fund.weekly > 0 ? 'positive' : fund.weekly < 0 ? 'negative' : ''}">
                ${fund.weekly > 0 ? '+' : ''}${fund.weekly.toFixed(2)}%
            </td>
            <td class="${fund.monthly > 0 ? 'positive' : fund.monthly < 0 ? 'negative' : ''}">
                ${fund.monthly > 0 ? '+' : ''}${fund.monthly.toFixed(2)}%
            </td>
            <td class="${fund.yearly > 0 ? 'positive' : fund.yearly < 0 ? 'negative' : ''}">
                ${fund.yearly > 0 ? '+' : ''}${fund.yearly.toFixed(2)}%
            </td>
            <td>₺${formatNumber(fund.totalValue)}</td>
            <td class="${riskClass}">${fund.risk}</td>
            <td class="actions-cell">
                <span class="action-icon" title="İzleme listesine ekle">🔖</span>
                <span class="action-icon" title="Daha fazla">⋮</span>
            </td>
        </tr>
    `}).join('');
}

// Haberleri göster
function renderNews() {
    const container = document.getElementById('news-container');
    container.innerHTML = financialNews.map(news => `
        <div class="news-item">
            <h3>${news.title}</h3>
            <p>${news.content}</p>
            <div class="news-date">${formatDate(news.date)}</div>
        </div>
    `).join('');
}

// Sayı formatlama (TL için)
function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Tarih formatlama
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('tr-TR', options);
}

// Verileri yükle ve sayfayı render et
async function loadData() {
    try {
        // Fon performans verileri için mock verileri kullan
        fundPerformanceData = getMockData();
        console.log('Fon performans verileri (mock) yüklendi');
        
        // Yatırımcı verilerini API'den çek
        investorCardsData = await fetchInvestorData();
        if (investorCardsData && investorCardsData.length > 0) {
            console.log('TEFAS API\'den yatırımcı verisi yüklendi:', investorCardsData.length, 'fon');
        } else {
            console.log('Yatırımcı verileri (mock) kullanılıyor');
        }
        
        // Sayfayı render et
        renderInvestorCards();
        renderCategoryFilters();
        renderPerformanceTable();
        renderNews();
    } catch (error) {
        console.error('Veri yükleme hatası:', error);
        // Hata durumunda mock verileri kullan
        fundPerformanceData = getMockData();
        investorCardsData = getMockInvestorData();
        renderInvestorCards();
        renderCategoryFilters();
        renderPerformanceTable();
        renderNews();
    }
}

// Event listener'lar
document.addEventListener('DOMContentLoaded', () => {
    // Verileri yükle ve render et
    loadData();
    
    // Select all checkbox
    document.getElementById('select-all').addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
    
    // Sıralama butonu
    document.getElementById('sort-toggle').addEventListener('click', () => {
        sortAscending = !sortAscending;
        const btn = document.getElementById('sort-toggle');
        btn.querySelector('span:first-child').textContent = 
            sortAscending ? 'Günlük Getiri (Artan)' : 'Günlük Getiri (Azalan)';
        renderPerformanceTable();
    });
    
    // Arama inputu
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderPerformanceTable();
    });
    
    // Download butonu
    document.querySelector('.download-btn').addEventListener('click', () => {
        alert('İndirme özelliği yakında eklenecek!');
    });
});
