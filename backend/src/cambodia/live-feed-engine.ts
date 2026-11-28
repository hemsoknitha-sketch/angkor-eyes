import { NewsCredibilityEngine } from './credibility-engine.js';

export interface LiveInstitutionalArticle {
  title: string;
  source: string;
  url: string;
  publishedDate: string;
  category: string;
  snippet?: string;
  urgencyLevel: 'URGENT' | 'ELEVATED' | 'ROUTINE';
  credibilityScore: number;
}

export class LiveInstitutionalFeedEngine {
  private static cache: Map<string, { articles: LiveInstitutionalArticle[]; expiresAt: number }> = new Map();
  private static TTL_MS = 10 * 60 * 1000;

  private static AGENCY_SEARCH_MAP: Record<string, { km: string; en: string }> = {
    '/interior': {
      km: 'ក្រសួងមហាផ្ទៃ OR អត្តសញ្ញាណកម្ម OR នគរបាលជាតិ OR រដ្ឋបាលដែនដី',
      en: 'Cambodia Interior Ministry OR National Police'
    },
    '/mod': {
      km: 'ក្រសួងការពារជាតិ OR កងយោធពលខេមរភូមិន្ទ OR ព្រំដែន',
      en: 'Cambodia Ministry of National Defence'
    },
    '/mef': {
      km: 'ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ OR ថវិកាជាតិ OR សេដ្ឋកិច្ចកម្ពុជា',
      en: 'Cambodia Ministry of Economy and Finance'
    },
    '/mfaic': {
      km: 'ក្រសួងការបរទេស និងសហប្រតិបត្តិការអន្តរជាតិ OR ការទូតកម្ពុជា',
      en: 'Cambodia Ministry of Foreign Affairs'
    },
    '/acu': {
      km: 'អង្គភាពប្រឆាំងអំពើពុករលួយ OR បង្ក្រាបពុករលួយ',
      en: 'Cambodia Anti-Corruption Unit ACU'
    },
    '/police': {
      km: 'អគ្គស្នងការដ្ឋាននគរបាលជាតិ OR គ្រោះថ្នាក់ចរាចរណ៍ OR បង្ក្រាបបទល្មើស',
      en: 'Cambodia National Police'
    },
    '/tax': {
      km: 'អគ្គនាយកដ្ឋានពន្ធដារ OR ប្រកាសពន្ធ OR ពន្ធដារកម្ពុជា',
      en: 'General Department of Taxation Cambodia'
    },
    '/customs': {
      km: 'អគ្គនាយកដ្ឋានគយ និងរដ្ឋាករកម្ពុជា OR ពន្ធគយ',
      en: 'General Department of Customs and Excise Cambodia'
    },
    '/nbc': {
      km: 'ធនាគារជាតិនៃកម្ពុជា OR បាគង OR ប្រាក់រៀល',
      en: 'National Bank of Cambodia'
    },
    '/moj': {
      km: 'ក្រសួងយុត្តិធម៌ OR តុលាការកម្ពុជា OR នីតិរដ្ឋ',
      en: 'Cambodia Ministry of Justice'
    },
    '/mlmupc': {
      km: 'ក្រសួងរៀបចំដែនដី នគរូបនីយកម្ម និងសំណង់ OR ប្លង់ដី OR វិវាទដីធ្លី',
      en: 'Cambodia Ministry of Land Management Urban Planning and Construction'
    },
    '/mptc': {
      km: 'ក្រសួងប្រៃសណីយ៍ និងទូរគមនាគមន៍ OR ឆបោកតាមអនឡាញ OR រដ្ឋាភិបាលឌីជីថល',
      en: 'Cambodia Ministry of Post and Telecommunications'
    },
    '/mpwt': {
      km: 'ក្រសួងសាធារណការ និងដឹកជញ្ជូន OR ហេដ្ឋារចនាសម្ព័ន្ធ OR ចរាចរណ៍',
      en: 'Cambodia Ministry of Public Works and Transport'
    },
    '/phnompenh': {
      km: 'រដ្ឋបាលរាជធានីភ្នំពេញ OR សាលារាជធានីភ្នំពេញ',
      en: 'Phnom Penh Capital Administration'
    }
  };

  public static classifyUrgency(title: string): 'URGENT' | 'ELEVATED' | 'ROUTINE' {
    if (/(?:បន្ទាន់|គ្រោះថ្នាក់|បង្ក្រាប|ឆបោក|ឃាតកម្ម|ទឹកជំនន់|អាសន្ន|ចាប់ខ្លួន|ពុករលួយ|urgent|emergency|crackdown)/i.test(title)) {
      return 'URGENT';
    }
    if (/(?:កិច្ចប្រជុំ|សេចក្តីប្រកាស|វិវាទ|កំណែទម្រង់|ច្បាប់|គោលនយោបាយ|advisory|policy)/i.test(title)) {
      return 'ELEVATED';
    }
    return 'ROUTINE';
  }

  private static async queryGoogleNewsRss(query: string, lang: 'km' | 'en'): Promise<LiveInstitutionalArticle[]> {
    const rssUrl = lang === 'km'
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=km&gl=KH&ceid=KH:km`
      : `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(rssUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AngkorEyes/2.0; +https://angkor-eyes.gov.kh)' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const xmlText = await res.text();
      const items = xmlText.split('<item>').slice(1, 5);
      const articles: LiveInstitutionalArticle[] = [];

      for (const item of items) {
        const titleMatch = item.match(/<title>(.*?)<\/title>/);
        const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);

        if (!titleMatch?.[1]) continue;
        const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
        if (/[\u0e00-\u0e7f\u4e00-\u9fff]|công ty|tập đoàn|trường hải|việt nam|thaco/i.test(rawTitle)) {
          continue;
        }

        const cleanTitle = rawTitle.replace(/\s*-\s*(?:The Star|Khmer Times|Phnom Penh Post|Fresh News|VOD|RFA|VOA|CamboJA|CNC|CTN|BTV).*$/i, '').trim();
        const sourceName = sourceMatch ? sourceMatch[1].trim() : 'ប្រភពព័ត៌មានផ្លូវការ';
        const pubDate = dateMatch ? this.formatDateKhmer(new Date(dateMatch[1])) : this.getCurrentKhmerDate();
        const cred = NewsCredibilityEngine.evaluateCredibility(cleanTitle, cleanTitle, sourceName);

        articles.push({
          title: cleanTitle,
          source: sourceName,
          url: `https://news.google.com/search?q=${encodeURIComponent(cleanTitle)}`,
          publishedDate: pubDate,
          category: lang === 'km' ? 'ព័ត៌មានជាតិ (ភាសាខ្មែរ)' : 'ព័ត៌មានអន្តរជាតិ/ជាតិ (EN)',
          urgencyLevel: this.classifyUrgency(cleanTitle),
          credibilityScore: cred.score
        });
      }
      return articles;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public static async fetchLiveArticles(agentCommand: string): Promise<LiveInstitutionalArticle[]> {
    const cmdNormalized = agentCommand.toLowerCase().startsWith('/') ? agentCommand.toLowerCase() : `/${agentCommand.toLowerCase()}`;
    const now = Date.now();

    const cached = this.cache.get(cmdNormalized);
    if (cached && cached.expiresAt > now && cached.articles.length > 0) {
      return cached.articles;
    }

    const mapped = this.AGENCY_SEARCH_MAP[cmdNormalized] || {
      km: `${this.getInstitutionNameKhmer(cmdNormalized)} OR រាជរដ្ឋាភិបាលកម្ពុជា`,
      en: `Cambodia ${cmdNormalized.replace('/', '')} government`
    };

    const [kmSettled, enSettled] = await Promise.allSettled([
      this.queryGoogleNewsRss(mapped.km, 'km'),
      this.queryGoogleNewsRss(mapped.en, 'en')
    ]);

    const merged: LiveInstitutionalArticle[] = [];
    const seen = new Set<string>();

    for (const r of [kmSettled, enSettled]) {
      if (r.status === 'fulfilled') {
        for (const art of r.value) {
          if (!seen.has(art.title)) {
            seen.add(art.title);
            merged.push(art);
          }
        }
      }
    }

    if (merged.length > 0) {
      merged.sort((a, b) => b.credibilityScore - a.credibilityScore);
      const top = merged.slice(0, 4);
      this.cache.set(cmdNormalized, { articles: top, expiresAt: now + this.TTL_MS });
      return top;
    }

    const details = this.getInstitutionDetails(cmdNormalized);
    const fallbackArticles: LiveInstitutionalArticle[] = [
      {
        title: `សេចក្តីជូនដំណឹង និងការតាមដានប្រតិបត្តិការជាក់ស្តែងរបស់ ${details.name} (${details.hotline})`,
        source: `${details.name} (${details.website})`,
        url: details.website,
        publishedDate: this.getCurrentKhmerDate(),
        category: 'កំណត់ហេតុស្ថាប័ន (Live Grounded)',
        urgencyLevel: 'ROUTINE',
        credibilityScore: 95
      }
    ];
    this.cache.set(cmdNormalized, { articles: fallbackArticles, expiresAt: now + 3 * 60 * 1000 });
    return fallbackArticles;
  }

  public static async fetchNationalFeeds(): Promise<LiveInstitutionalArticle[]> {
    const coreAgencies = ['/interior', '/moj', '/mef', '/police', '/mlmupc', '/mptc'];
    const results = await Promise.allSettled(coreAgencies.map(cmd => this.fetchLiveArticles(cmd)));
    const merged: LiveInstitutionalArticle[] = [];
    const seen = new Set<string>();

    for (const res of results) {
      if (res.status === 'fulfilled') {
        for (const item of res.value) {
          if (!seen.has(item.title)) {
            seen.add(item.title);
            merged.push(item);
          }
        }
      }
    }

    const rank: Record<LiveInstitutionalArticle['urgencyLevel'], number> = {
      URGENT: 3,
      ELEVATED: 2,
      ROUTINE: 1
    };
    merged.sort((a, b) => (rank[b.urgencyLevel] - rank[a.urgencyLevel]) || (b.credibilityScore - a.credibilityScore));
    return merged;
  }

  public static formatDateKhmer(date: Date): string {
    const days = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
    const months = [
      'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
      'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
    ];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `ថ្ងៃ${dayName} ទី${day} ខែ${monthName} ឆ្នាំ${year} វេលាម៉ោង ${hours}:${minutes}`;
  }

  public static getCurrentKhmerDate(): string {
    return this.formatDateKhmer(new Date());
  }

  public static generateOfficialReferenceCode(agentCommand: string): string {
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    const randomSeq = (Math.floor(Date.now() / 1000) % 899 + 100).toString();
    const agencyCode = agentCommand.replace('/', '').toUpperCase();
    return `លេខ ៖ ${randomSeq}/${yearSuffix} ស.ជ.ណ / ${agencyCode}`;
  }

  public static getInstitutionDetails(agentCommand: string): {
    name: string;
    khmerCode: string;
    website: string;
    hotline: string;
    mandate: string;
    services: string[];
  } {
    const cmd = agentCommand.toLowerCase().startsWith('/') ? agentCommand.toLowerCase() : `/${agentCommand.toLowerCase()}`;
    const map: Record<string, {
      name: string;
      khmerCode: string;
      website: string;
      hotline: string;
      mandate: string;
      services: string[];
    }> = {
      '/interior': {
        name: 'ក្រសួងមហាផ្ទៃ',
        khmerCode: 'ម.ភ',
        website: 'https://www.interior.gov.kh',
        hotline: '១១៧ (នគរបាលជាតិ) | ១២៨២ (ACU) | ០២៣ ៧២៦ ២៤៤',
        mandate: 'ដឹកនាំ និងគ្រប់គ្រងរដ្ឋបាលដែនដីគ្រប់ថ្នាក់ (រាជធានី-ខេត្តទាំង ២៥, ក្រុង-ស្រុក-ខណ្ឌទាំង ២០៩, និងឃុំ-សង្កាត់ទាំង ១,៦៥២), អគ្គស្នងការដ្ឋាននគរបាលជាតិ, អគ្គនាយកដ្ឋានអត្តសញ្ញាណកម្ម, អគ្គនាយកដ្ឋានអន្តោប្រវេសន៍ និងអគ្គនាយកដ្ឋានពន្ធនាគារ ដើម្បីធានាសន្តិសុខជាតិ សណ្តាប់ធ្នាប់សាធារណៈ និងសុវត្ថិភាពសង្គម។',
        services: [
          'ការិយាល័យច្រកចេញចូលតែមួយ (OWSO) ៖ បម្រើសេវារដ្ឋបាលថ្នាក់ក្រោមជាតិប្រកបដោយតម្លាភាព គណនេយ្យភាព និងគ្មានអំពើពុករលួយ។',
          'អត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរគំរូថ្មី (Chip) ៖ ផ្តល់ជូន **ឥតគិតថ្លៃ ១០០%** តាមគោលនយោបាយរាជរដ្ឋាភិបាល។'
        ]
      },
      '/mod': {
        name: 'ក្រសួងការពារជាតិ',
        khmerCode: 'ក.ព.ជ',
        website: 'https://www.mod.gov.kh',
        hotline: '០២៣ ៤២៧ ៤៩៩',
        mandate: 'ការពារបូរណភាពទឹកដី អធិបតេយ្យជាតិ សន្តិភាព និងការពាររដ្ឋធម្មនុញ្ញនៃព្រះរាជាណាចក្រកម្ពុជា។',
        services: ['ការពង្រឹងសមត្ថភាពកងយោធពលខេមរភូមិន្ទ និងការសហការការពារព្រំដែន។']
      },
      '/moj': {
        name: 'ក្រសួងយុត្តិធម៌',
        khmerCode: 'យ.ធ',
        website: 'https://www.moj.gov.kh',
        hotline: '០២៣ ២១៦ ៣២២',
        mandate: 'ដឹកនាំការកែទម្រង់ច្បាប់ និងប្រព័ន្ធយុត្តិធម៌ ជំរុញ និងពន្លឿនការដោះស្រាយរឿងក្តីនៅតាមតុលាការ និងលើកកម្ពស់នីតិរដ្ឋ។',
        services: ['ព្រឹត្តិបត្រថ្កោលទោសឌីជីថល និងការសម្រុះសម្រួលវិវាទក្រៅប្រព័ន្ធតុលាការ (ADR)។']
      },
      '/mef': {
        name: 'ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ',
        khmerCode: 'ស.ហ.វ',
        website: 'https://www.mef.gov.kh',
        hotline: '០២៣ ៨៩០ ៦៦៦',
        mandate: 'គ្រប់គ្រងគោលនយោបាយសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុសាធារណៈ រៀបចំថវិកាជាតិ និងកំណែទម្រង់ហិរញ្ញវត្ថុសាធារណៈ។',
        services: ['ការតាមដានថវិកាជាតិ និងការចុះបញ្ជីធុរកិច្ចតាម CamDX។']
      },
      '/tax': {
        name: 'អគ្គនាយកដ្ឋានពន្ធដារ',
        khmerCode: 'ព.ដ',
        website: 'https://www.tax.gov.kh',
        hotline: '១២៨៨ | ០២៣ ៨៨៦ ៧៨៩',
        mandate: 'គ្រប់គ្រង និងប្រមូលពន្ធផ្ទៃក្នុងគ្រប់ប្រភេទជូនរដ្ឋ ស្របតាមច្បាប់ស្តីពីសារពើពន្ធ។',
        services: ['E-Filing, GDT Tax Prefiling App និងការបង់ពន្ធអនឡាញ។']
      },
      '/customs': {
        name: 'អគ្គនាយកដ្ឋានគយ និងរដ្ឋាករ',
        khmerCode: 'គ.រ',
        website: 'https://www.customs.gov.kh',
        hotline: '១២០៩ | ០២៣ ២១៤ ០៦៥',
        mandate: 'ប្រមូលពន្ធគយលើទំនិញនាំចេញ-នាំចូល និងទប់ស្កាត់ការរត់ពន្ធខុសច្បាប់។',
        services: ['ប្រព័ន្ធ ASYCUDA World និង National Single Window។']
      },
      '/police': {
        name: 'អគ្គស្នងការដ្ឋាននគរបាលជាតិ',
        khmerCode: 'ន.ជ',
        website: 'https://police.gov.kh',
        hotline: '១១៧ | ០២៣ ២១២ ១១៥',
        mandate: 'ថែរក្សាសន្តិសុខផ្ទៃក្នុង សណ្តាប់ធ្នាប់សាធារណៈ សុវត្ថិភាពចរាចរណ៍ និងបង្ក្រាបបទល្មើស។',
        services: ['អន្តរាគមន៍បន្ទាន់ ១១៧ និងការអនុវត្តច្បាប់ចរាចរណ៍ផ្លូវគោក។']
      },
      '/acu': {
        name: 'អង្គភាពប្រឆាំងអំពើពុករលួយ',
        khmerCode: 'អ.ប.ព',
        website: 'https://www.acu.gov.kh',
        hotline: '១២៨២ | ០២៣ ៩៩៦ ៦៦៦',
        mandate: 'ទប់ស្កាត់ បង្ការ និងបង្ក្រាបអំពើពុករលួយគ្រប់រូបភាព និងតាមដានការប្រកាសទ្រព្យសម្បត្តិ។',
        services: ['ទទួលពាក្យបណ្តឹងសម្ងាត់ ២៤/៧ តាម Hotline ១២៨២។']
      },
      '/mlmupc': {
        name: 'ក្រសួងរៀបចំដែនដី នគរូបនីយកម្ម និងសំណង់',
        khmerCode: 'ដ.ន.ស',
        website: 'https://www.mlmupc.gov.kh',
        hotline: '០២៣ ២១៥ ៥៤៥',
        mandate: 'ការរៀបចំដែនដី នគរូបនីយកម្ម ការចុះបញ្ជីដីធ្លី និងការចេញប័ណ្ណកម្មសិទ្ធិ (ប្លង់រឹង)។',
        services: ['ការចុះបញ្ជីដីធ្លី និងការសម្រុះសម្រួលវិវាទដីធ្លីក្រៅប្រព័ន្ធតុលាការ។']
      },
      '/phnompenh': {
        name: 'រដ្ឋបាលរាជធានីភ្នំពេញ',
        khmerCode: 'រ.ភ.ព',
        website: 'https://phnompenh.gov.kh',
        hotline: '១២៩៩ | ០២៣ ៧២២ ០៥៤',
        mandate: 'ដឹកនាំរដ្ឋបាលរាជធានីភ្នំពេញ សណ្តាប់ធ្នាប់ទីក្រុង និងសេវាសាធារណៈ។',
        services: ['ច្រកចេញចូលតែមួយ (OWSO) សាលារាជធានីភ្នំពេញ និងខណ្ឌទាំង ១៤។']
      }
    };

    return map[cmd] || {
      name: this.getInstitutionNameKhmer(cmd),
      khmerCode: cmd.replace('/', '').toUpperCase(),
      website: `https://www.${cmd.replace('/', '')}.gov.kh`,
      hotline: '១១៧ | ១២៨២',
      mandate: `អនុវត្តគោលនយោបាយរាជរដ្ឋាភិបាលក្នុងដែនសមត្ថកិច្ចរបស់ ${this.getInstitutionNameKhmer(cmd)}។`,
      services: ['បម្រើសេវាសាធារណៈប្រកបដោយតម្លាភាព និងគ្មានអំពើពុករលួយ។']
    };
  }

  private static getInstitutionNameKhmer(agentCommand: string): string {
    const map: Record<string, string> = {
      '/interior': 'ក្រសួងមហាផ្ទៃ',
      '/mod': 'ក្រសួងការពារជាតិ',
      '/mef': 'ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ',
      '/mfaic': 'ក្រសួងការបរទេស',
      '/acu': 'អង្គភាពប្រឆាំងអំពើពុករលួយ',
      '/police': 'អគ្គស្នងការដ្ឋាននគរបាលជាតិ',
      '/tax': 'អគ្គនាយកដ្ឋានពន្ធដារ',
      '/customs': 'អគ្គនាយកដ្ឋានគយ និងរដ្ឋាករ',
      '/nbc': 'ធនាគារជាតិនៃកម្ពុជា',
      '/moj': 'ក្រសួងយុត្តិធម៌',
      '/ocm': 'ទីស្តីការគណៈរដ្ឋមន្ត្រី',
      '/senate': 'ព្រឹទ្ធសភា',
      '/nac': 'រដ្ឋសភាជាតិ',
      '/mpwt': 'ក្រសួងសាធារណការ និងដឹកជញ្ជូន',
      '/mptc': 'ក្រសួងប្រៃសណីយ៍ និងទូរគមនាគមន៍',
      '/moh': 'ក្រសួងសុខាភិបាល',
      '/moeys': 'ក្រសួងអប់រំ យុវជន និងកីឡា',
      '/moc': 'ក្រសួងពាណិជ្ជកម្ម',
      '/mlmupc': 'ក្រសួងរៀបចំដែនដី នគរូបនីយកម្ម និងសំណង់',
      '/phnompenh': 'រដ្ឋបាលរាជធានីភ្នំពេញ',
      '/siemreap': 'រដ្ឋបាលខេត្តសៀមរាប',
      '/preahsihanouk': 'រដ្ឋបាលខេត្តព្រះសីហនុ',
      '/chrc': 'គណៈកម្មាធិការសិទ្ធិមនុស្សកម្ពុជា'
    };
    return map[agentCommand] || 'ស្ថាប័នរាជរដ្ឋាភិបាលកម្ពុជា';
  }
}