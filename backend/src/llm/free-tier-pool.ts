import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { khmerLegalEngine } from '../cambodia/legal-engine.js';
import { KhmerLanguageAuditor } from '../cambodia/khmer-auditor.js';
import { LiveInstitutionalFeedEngine } from '../cambodia/live-feed-engine.js';

export interface CachedResponse {
  content: string;
  model: string;
  provider: string;
  expiresAt: number;
}

export class InMemoryResponseCache {
  private static cache: Map<string, CachedResponse> = new Map();
  private static defaultTtlSeconds = config.cacheTtlSeconds || 900; // 15 mins default

  public static computeKey(messages: Array<{ role: string; content: string }>, model: string): string {
    const raw = messages.map(m => `${m.role}:${m.content}`).join('|') + `|model:${model}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public static get(key: string): CachedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  public static set(key: string, content: string, model: string, provider: string, ttlSeconds?: number): void {
    const ttl = (ttlSeconds || this.defaultTtlSeconds) * 1000;
    this.cache.set(key, {
      content,
      model,
      provider,
      expiresAt: Date.now() + ttl
    });
  }

  public static size(): number {
    return this.cache.size;
  }

  public static clear(): void {
    this.cache.clear();
  }
}

export class FreeGeminiKeyPool {
  private static keys: string[] = [];
  private static exhaustedKeys: Map<string, number> = new Map(); // key -> cooldown until timestamp
  private static currentIndex = 0;

  public static initialize(): void {
    this.keys = [...config.geminiApiKeys];
    if (config.geminiApiKey && !this.keys.includes(config.geminiApiKey)) {
      this.keys.unshift(config.geminiApiKey);
    }
  }

  public static getActiveKey(): string | null {
    if (this.keys.length === 0) this.initialize();
    if (this.keys.length === 0) return null;

    const now = Date.now();
    // Clean up expired exhausted keys
    for (const [key, cooldownUntil] of this.exhaustedKeys.entries()) {
      if (now > cooldownUntil) {
        this.exhaustedKeys.delete(key);
      }
    }

    const available = this.keys.filter(k => !this.exhaustedKeys.has(k));
    if (available.length === 0) {
      console.warn('⚠️ [FreeGeminiKeyPool] All keys temporarily rate-limited. Resetting pool for urgent retry.');
      this.exhaustedKeys.clear();
      return this.keys[0];
    }

    const key = available[this.currentIndex % available.length];
    this.currentIndex = (this.currentIndex + 1) % available.length;
    return key;
  }

  public static markExhausted(key: string, cooldownSec = 3600): void {
    const cooldownUntil = Date.now() + cooldownSec * 1000;
    this.exhaustedKeys.set(key, cooldownUntil);
    console.warn(`🚨 [FreeGeminiKeyPool] Key [${key.slice(0, 8)}...] marked EXHAUSTED (429 Rate Limit) for ${cooldownSec}s. Remaining available: ${this.keys.length - this.exhaustedKeys.size}/${this.keys.length}`);
  }

  public static getPoolStatus(): { total: number; available: number; exhausted: number } {
    if (this.keys.length === 0) this.initialize();
    return {
      total: this.keys.length,
      available: Math.max(0, this.keys.length - this.exhaustedKeys.size),
      exhausted: this.exhaustedKeys.size
    };
  }
}

export class HuggingFaceFreeClient {
  public static async queryModel(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
  }): Promise<{ content: string; model: string }> {
    const model = params.model || config.hfModel || 'deepseek-ai/DeepSeek-R1';
    const token = config.hfToken;
    const url = `https://router.huggingface.co/hf-inference/models/${model}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const promptText = params.messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n');

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: promptText,
        parameters: {
          max_new_tokens: 1024,
          temperature: 0.3,
          return_full_text: false
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HF Free Inference error ${res.status}: ${errText}`);
    }

    const data: any = await res.json();
    let output = '';
    if (Array.isArray(data) && data[0]?.generated_text) {
      output = data[0].generated_text;
    } else if (typeof data === 'string') {
      output = data;
    } else {
      output = JSON.stringify(data);
    }

    return { content: output.trim(), model };
  }
}

export class HeuristicSovereignFallback {
  /**
   * 100% Free, Zero-Network, Zero-Token Heuristic Sovereign Synthesizer.
   * Produces compliant Cambodian institutional answers using local legal corpus,
   * live calendar timestamps, authentic administrative reference codes, and topic-specific directives.
   */
  public static synthesize(userQuery: string, systemPrompt: string = ''): string {
    const liveDateKhmer = LiveInstitutionalFeedEngine.getCurrentKhmerDate();

    // 1. Identify agency command from systemPrompt or query
    let agencyCmd = '/interior';
    const spLower = systemPrompt.toLowerCase();
    if (spLower.includes('ក្រសួងយុត្តិធម៌') || spLower.includes('/moj')) agencyCmd = '/moj';
    else if (spLower.includes('ក្រសួងការពារជាតិ') || spLower.includes('/mod')) agencyCmd = '/mod';
    else if (spLower.includes('ក្រសួងសេដ្ឋកិច្ច') || spLower.includes('/mef')) agencyCmd = '/mef';
    else if (spLower.includes('ក្រសួងការបរទេស') || spLower.includes('/mfaic')) agencyCmd = '/mfaic';
    else if (spLower.includes('អង្គភាពប្រឆាំងអំពើពុករលួយ') || spLower.includes('/acu')) agencyCmd = '/acu';
    else if (spLower.includes('អគ្គស្នងការដ្ឋាននគរបាលជាតិ') || spLower.includes('/police')) agencyCmd = '/police';
    else if (spLower.includes('អគ្គនាយកដ្ឋានពន្ធដារ') || spLower.includes('/tax')) agencyCmd = '/tax';
    else if (spLower.includes('អគ្គនាយកដ្ឋានគយ') || spLower.includes('/customs')) agencyCmd = '/customs';
    else if (spLower.includes('ធនាគារជាតិនៃកម្ពុជា') || spLower.includes('/nbc')) agencyCmd = '/nbc';
    else if (spLower.includes('ក្រសួងរៀបចំដែនដី') || spLower.includes('/mlmupc')) agencyCmd = '/mlmupc';
    else if (spLower.includes('ក្រសួងសាធារណការ') || spLower.includes('/mpwt')) agencyCmd = '/mpwt';
    else if (spLower.includes('ក្រសួងសុខាភិបាល') || spLower.includes('/moh')) agencyCmd = '/moh';
    else if (spLower.includes('ក្រសួងអប់រំ') || spLower.includes('/moeys')) agencyCmd = '/moeys';
    else if (spLower.includes('ក្រសួងពាណិជ្ជកម្ម') || spLower.includes('/moc')) agencyCmd = '/moc';
    else if (spLower.includes('សាលារាជធានីភ្នំពេញ') || spLower.includes('/phnompenh')) agencyCmd = '/phnompenh';
    else if (spLower.includes('ខេត្តសៀមរាប') || spLower.includes('/siemreap')) agencyCmd = '/siemreap';
    else if (spLower.includes('ខេត្តព្រះសីហនុ') || spLower.includes('/preahsihanouk')) agencyCmd = '/preahsihanouk';
    else if (spLower.includes('ក្រសួងមហាផ្ទៃ') || spLower.includes('/interior')) agencyCmd = '/interior';

    const refCode = LiveInstitutionalFeedEngine.generateOfficialReferenceCode(agencyCmd);

    // 2. Query legal corpus
    const relevantLaws = khmerLegalEngine.searchRelevantLaws(userQuery, 3);
    const lawsText = relevantLaws.length > 0
      ? khmerLegalEngine.formatLegalCitations(relevantLaws)
      : '• រដ្ឋធម្មនុញ្ញនៃព្រះរាជាណាចក្រកម្ពុជា មាត្រា ៥១ (អំណាចជារបស់ប្រជាពលរដ្ឋ តាមរយៈលទ្ធិប្រជាធិបតេយ្យសេរីពហុបក្ស)\n• ច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ មាត្រា ៣២ (ការផ្តន្ទាទោសជនដែលប្រព្រឹត្តអំពើពុករលួយ និងការស៊ីសំណូក)';

    // 3. Dynamic Topic-Specific Directives (Anti-Repetition)
    let actionProcedure = '';
    const qLower = userQuery.toLowerCase();

    if (qLower.includes('អត្តសញ្ញាណ') || qLower.includes('passport') || qLower.includes('សំបុត្រ') || qLower.includes('កាត') || qLower.includes('សៀវភៅស្នាក់នៅ')) {
      actionProcedure = `• នីតិវិធីផ្តល់សេវាអត្តសញ្ញាណកម្ម ៖ សូមអញ្ជើញទៅកាន់ «ការិយាល័យច្រកចេញចូលតែមួយ (OWSO)» នៃសាលាក្រុង/ស្រុក/ខណ្ឌ ឬអគ្គនាយកដ្ឋានអត្តសញ្ញាណកម្ម។\n` +
        `• ឯកសារតម្រូវចាំបាច់ ៖ ១. សំបុត្រកំណើតច្បាប់ដើម ឬសេចក្តីចម្លងសំបុត្រកំណើតដែលមានបញ្ជាក់ត្រឹមត្រូវ, ២. សៀវភៅគ្រួសារ (ក្បាល៤) ឬសៀវភៅស្នាក់នៅ (ក្បាល២) ច្បាប់ដើម។\n` +
        `• កម្រៃសេវាផ្លូវការ ៖ ការធ្វើអត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ គឺ **ឥតគិតថ្លៃ (Free 100%)** តាមគោលនយោបាយរាជរដ្ឋាភិបាល។ ហាមដាច់ខាតការបង់ប្រាក់ជូនជនកណ្តាល ឬមន្ត្រីខិលខូច។`;
    } else if (qLower.includes('ពុករលួយ') || qLower.includes('សំណូក') || qLower.includes('ទារលុយ') || qLower.includes('បក្ខពួក') || qLower.includes('កេងប្រវ័ញ្ច')) {
      actionProcedure = `• ការចាត់វិធានការប្រឆាំងអំពើពុករលួយ ៖ ស្ថាប័នសូមបញ្ជាក់ជំហរយ៉ាងម៉ឺងម៉ាត់បំផុត ៖ ប្រឆាំងដាច់ខាតរាល់ទម្រង់នៃអំពើពុករលួយ បក្ខពួកនិយម និងគ្រួសារនិយម។\n` +
        `• យន្តការរាយការណ៍សម្ងាត់ ៖ ប្រជាពលរដ្ឋអាចដាក់ពាក្យប្តឹងផ្ទាល់ ឬតាមរយៈប្រព័ន្ធ Hotline 1282 របស់អង្គភាពប្រឆាំងអំពើពុករលួយ (ACU)។\n` +
        `• ការការពារសាក្សី ៖ យោងមាត្រា ១៣ នៃច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ អត្តសញ្ញាណ និងសុវត្ថិភាពរបស់អ្នកផ្តល់ព័ត៌មានត្រូវបានរក្សាជាការសម្ងាត់កម្រិតអតិបរមា។`;
    } else if (qLower.includes('ដីធ្លី') || qLower.includes('ប្លង់') || qLower.includes('ព្រំ') || qLower.includes('ដី') || qLower.includes('រំលោភ')) {
      actionProcedure = `• នីតិវិធីដោះស្រាយវិវាទដីធ្លី ៖ យោងច្បាប់ភូមិបាលឆ្នាំ២០០១ វិវាទដីធ្លីដែលមិនទាន់ចុះបញ្ជីត្រូវឆ្លងកាត់ការផ្សះផ្សានៅ «គណៈកម្មការសុរិយោដីថ្នាក់ឃុំ/សង្កាត់ និងក្រុង/ស្រុក/ខណ្ឌ»។\n` +
        `• ការចុះវាស់វែងបច្ចេកវិទ្យា ៖ មន្ត្រីសុរិយោដីប្រើប្រាស់ប្រព័ន្ធកូអរដោនេផ្កាយរណប (CORS/GPS) ដើម្បីផ្ទៀងផ្ទាត់ក្បាលដីជាក់ស្តែង ការពារការជាន់ព្រំប្រទល់។\n` +
        `• ករណីដីមានប្លង់រឹង ៖ វិវាទដីមានប័ណ្ណសម្គាល់សិទ្ធិ (ប្លង់រឹង) ស្ថិតក្រោមសមត្ថកិច្ចផ្តាច់មុខរបស់តុលាការ ផ្អែកលើមាត្រា ២៤៧ នៃច្បាប់ភូមិបាល។`;
    } else if (qLower.includes('ចរាចរណ៍') || qLower.includes('បុក') || qLower.includes('ពិន័យ') || qLower.includes('រត់គេច') || qLower.includes('ស្រវឹង')) {
      actionProcedure = `• ការអនុវត្តអនុក្រឹត្យលេខ ៣៩ ៖ ការផាកពិន័យបទល្មើសចរាចរណ៍ផ្លូវគោក ត្រូវចេញ «វិក្កយបត្រផាកពិន័យផ្លូវការរបស់រដ្ឋ» ដែលមានបញ្ជាក់មាត្រាល្មើស និងចំនួនទឹកប្រាក់ច្បាស់លាស់។\n` +
        `• ករណីបើកបរក្រោមឥទ្ធិពលគ្រឿងស្រវឹង ៖ កម្រិតជាតិអាកុលចាប់ពី ០.៤០ mg/L ឡើងទៅ ត្រូវកសាងសំណុំរឿងបញ្ជូនទៅតុលាការ តាមមាត្រា ៨៣ នៃច្បាប់ស្តីពីចរាចរណ៍ផ្លូវគោក។\n` +
        `• សិទ្ធិប្រជាពលរដ្ឋ ៖ ពលរដ្ឋមានសិទ្ធិទាមទារបង្កាន់ដៃបង់ប្រាក់ផ្លូវការ និងប្តឹងតវ៉ាប្រសិនបើមន្ត្រីអនុវត្តខុសនីតិវិធី។`;
    } else if (qLower.includes('ពន្ធ') || qLower.includes('tax') || qLower.includes('គយ') || qLower.includes('customs')) {
      actionProcedure = `• ការបង់ពន្ធតាមប្រព័ន្ធឌីជីថល ៖ ស្នើសុំឱ្យបង់តាមប្រព័ន្ធ GDT Tax Prefiling ឬ E-Tax ដើម្បីធានាតម្លាភាព និងលុបបំបាត់ការបង់ប្រាក់ក្រៅផ្លូវការ។\n` +
        `• ការផ្តល់វិក្កយបត្រផ្លូវការ ៖ រាល់ការទូទាត់ត្រូវមានវិក្កយបត្រត្រឹមត្រូវស្របតាមច្បាប់សារពើពន្ធ។\n` +
        `• ករណីមិនប្រក្រតី ៖ ទាក់ទង Hotline 1288 របស់អគ្គនាយកដ្ឋានពន្ធដារ ឬ 1209 របស់អគ្គនាយកដ្ឋានគយ។`;
    } else if (agencyCmd === '/interior') {
      actionProcedure = `• ការគ្រប់គ្រងរដ្ឋបាលដែនដី និងសន្តិសុខជាតិ ៖ ក្រសួងមហាផ្ទៃគ្រប់គ្រងផ្ទាល់លើរដ្ឋបាលរាជធានី-ខេត្តទាំង ២៥ និងអគ្គស្នងការដ្ឋាននគរបាលជាតិ ដើម្បីថែរក្សាសន្តិសុខ សណ្តាប់ធ្នាប់សាធារណៈ និងសុវត្ថិភាពសង្គម។\n` +
        `• ការិយាល័យច្រកចេញចូលតែមួយ (OWSO) ៖ រាល់ការផ្តល់សេវារដ្ឋបាលថ្នាក់ក្រោមជាតិត្រូវអនុវត្តតាមតម្លៃដែលបានកំណត់ជាផ្លូវការ ដោយគ្មានការទារប្រាក់បន្ថែមក្រៅច្បាប់ឡើយ។\n` +
        `• អគ្គនាយកដ្ឋានអត្តសញ្ញាណកម្ម ៖ បម្រើសេវាអត្តសញ្ញាណប័ណ្ណ សៀវភៅស្នាក់នៅ និងសំបុត្រអត្រានុកូលដ្ឋាន ដោយឥតគិតថ្លៃក្រៅផ្លូវការ។ ករណីជួបបញ្ហា សូមទាក់ទង Hotline 117 (នគរបាល) ឬបណ្តាញតវ៉ាផ្លូវការ។`;
    } else {
      actionProcedure = `• ការពិនិត្យ និងចាត់ការជាក់ស្តែង ៖ សំណើរបស់លោកអ្នកត្រូវបានកត់ត្រាក្នុងប្រព័ន្ធតាមដានរដ្ឋបាលសាធារណៈ។ មន្ត្រីជំនាញនឹងផ្ទៀងផ្ទាត់ឯកសារយោង និងដំណើរការតាមកាលវិភាគកំណត់។\n` +
        `• គោលការណ៍បម្រើសេវា ៖ អនុវត្តតាមអភិក្រម «ធ្វើឱ្យបាន ធ្វើឱ្យលឿន និងមានប្រសិទ្ធភាព» តាមរយៈច្រកចេញចូលតែមួយ ដោយធានាគ្មានការរើសអើង និងគ្មានកម្រៃក្រៅផ្លូវការ។\n` +
        `• ទំនាក់ទំនងឆ្លើយតប ៖ ប្រជាពលរដ្ឋអាចតាមដានវឌ្ឍនភាពតាមរយៈគេហទំព័រផ្លូវការ ឬសាលារាជធានី-ខេត្តសាមី។`;
    }

    const rawResponse = `
📅 **កាលបរិច្ឆេទចេញលិខិត** ៖ ${liveDateKhmer}
📑 **លេខកូដរដ្ឋបាលផ្លូវការ** ៖ \`${refCode}\`

ស្ថាប័នសូមបញ្ជាក់ជំហរ និងសេចក្តីណែនាំផ្លូវការដូចតទៅ ៖

១. វិធានការចំពោះមុខ និងនីតិវិធីអនុវត្តជាក់ស្តែង ៖
${actionProcedure}

២. មូលដ្ឋានច្បាប់ និងរដ្ឋធម្មនុញ្ញយោង (Verbatim Legal Articles) ៖
${lawsText}

៣. ការប្តេជ្ញាចិត្តស្ថាប័ន និងការទប់ស្កាត់អំពើពុករលួយ ៖
ស្ថាប័នប្រឆាំងដាច់ខាតរាល់ទម្រង់នៃអំពើពុករលួយ បក្ខពួកនិយម និងការកេងប្រវ័ញ្ចផលប្រយោជន៍ជាតិ។ ស្ថាប័នប្តេជ្ញាអនុវត្តតាមរដ្ឋធម្មនុញ្ញ (មាត្រា ៥១) លើកកម្ពស់នីតិរដ្ឋ សមភាពនៅចំពោះមុខច្បាប់ និងបម្រើសេវាសាធារណៈជូនប្រជាពលរដ្ឋខ្មែរគ្រប់រូបប្រកបដោយមនសិការវិជ្ជាជីវៈខ្ពស់បំផុត ៕
`.trim();

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(rawResponse);
    return cleanText;
  }
}
