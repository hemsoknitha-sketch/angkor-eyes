import { LiveInstitutionalFeedEngine } from './live-feed-engine.js';
import { InterMinisterialDebateEngine, type InterMinisterialDebateResult, type DebateStatement } from './debate-engine.js';
import { TelegramBotEngine } from '../bot/telegram-bot.js';
import { InlineKeyboard } from 'grammy';

export class AutonomousNewsRadarEngine {
  private static processedTopics: Set<string> = new Set();
  private static timer: NodeJS.Timeout | null = null;
  private static isScanning: boolean = false;
  private static isEnabled: boolean = true;
  private static intervalMinutes: number = 3;
  private static lastTopic: string = '';
  private static lastDebatedAt: string = '';
  private static liveChatSubscribers: Set<number> = new Set();

  public static domainTopics: Array<{ topic: string; initiatorCommand: string; initiatorDesc: string }> = [
    // 1. Labour, Factory Workers & Wages
    {
      topic: 'ការការពារសិទ្ធិ និងផលប្រយោជន៍ស្របច្បាប់របស់កម្មករ-និយោជិតតាមរោងចក្រ និងការអនុវត្តប្រាក់ឈ្នួលអប្បបរមា ២០៨ ដុល្លារ/ខែ',
      initiatorCommand: '/mlvt',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យការងារ និងបណ្តុះបណ្តាលវិជ្ជាជីវៈ'
    },
    // 2. Traffic Safety & Drunk Driving
    {
      topic: 'ការរឹតបន្តឹងច្បាប់ចរាចរណ៍ផ្លូវគោក ការត្រួតពិនិត្យជាតិស្រវឹងពេលយប់ និងការកាត់ពិន្ទុបណ្ណបើកបរតាមឌីជីថល',
      initiatorCommand: '/mpwt',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យសាធារណការ និងសុវត្ថិភាពចរាចរណ៍'
    },
    // 3. Land Disputes & Systemic Titling
    {
      topic: 'នីតិវិធីចុះបញ្ជីក្បាលដីមានលក្ខណៈជាប្រព័ន្ធ (LMAP) និងការដោះស្រាយវិវាទដីធ្លីក្រៅប្រព័ន្ធតុលាការ',
      initiatorCommand: '/mlmupc',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យរៀបចំដែនដី និងកម្មសិទ្ធិដីធ្លី'
    },
    // 4. Cyber Fraud & Money Laundering
    {
      topic: 'វិធានការទប់ស្កាត់ការឆបោកតាមប្រព័ន្ធអនឡាញ ល្បែងស៊ីសងខុសច្បាប់ និងការបង្កកគណនីលាងលុយកខ្វក់',
      initiatorCommand: '/mptc',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យបច្ចេកវិទ្យា និងទូរគមនាគមន៍'
    },
    // 5. Anti-Corruption & OWSO
    {
      topic: 'ការទប់ស្កាត់អំពើពុករលួយ និងការទារកម្រៃក្រៅផ្លូវការនៅការិយាល័យច្រកចេញចូលតែមួយ (OWSO)',
      initiatorCommand: '/acu',
      initiatorDesc: 'តុឃ្លាំមើលការប្រឆាំងអំពើពុករលួយ'
    },
    // 6. Protests, Strikes & Public Assembly
    {
      topic: 'យន្តការសម្របសម្រួលដោះស្រាយកង្វល់ និងការការពារសន្តិសុខសណ្តាប់ធ្នាប់ក្នុងករណីមានការជួបជុំតវ៉ា ឬកូដកម្មដោយសន្តិវិធី',
      initiatorCommand: '/interior',
      initiatorDesc: 'តុឃ្លាំមើលសន្តិសុខផ្ទៃក្នុង និងរដ្ឋបាលដែនដី'
    },
    // 7. Border Demarcation & Sovereignty
    {
      topic: 'ការបង្កើនការល្បាតការពារអធិបតេយ្យភាពទឹកដីតាមខ្សែបន្ទាត់ព្រំដែន និងការជំរុញការងារខណ្ឌសីមាព្រំដែន',
      initiatorCommand: '/mod',
      initiatorDesc: 'តុឃ្លាំមើលកិច្ចការពារជាតិ និងបូរណភាពទឹកដី'
    },
    // 8. Human Rights, Civil Society & Social Justice
    {
      topic: 'ការលើកកម្ពស់សិទ្ធិមនុស្ស យុត្តិធម៌សង្គម ការពន្លឿនការជំនុំជម្រះក្តីនៅតុលាការ និងភាពជាដៃគូជាមួយអង្គការសង្គមស៊ីវិល',
      initiatorCommand: '/chrc',
      initiatorDesc: 'តុឃ្លាំមើលសិទ្ធិមនុស្ស និងយុត្តិធម៌សង្គម'
    },
    // 9. Finance, Banking & Bakong Currency
    {
      topic: 'ការរក្សាស្ថិរភាពរូបិយវត្ថុជាតិ ការលើកកម្ពស់ការប្រើប្រាស់ប្រាក់រៀល និងការពង្រីកប្រព័ន្ធទូទាត់បាគង (Bakong)',
      initiatorCommand: '/nbc',
      initiatorDesc: 'តុឃ្លាំមើលស្ថិរភាពរូបិយវត្ថុ និងប្រព័ន្ធធនាគារ'
    },
    // 10. Foreign Affairs & International Diplomacy
    {
      topic: 'យុទ្ធសាស្ត្រការទូតសេដ្ឋកិច្ច ការពង្រឹងកិច្ចសហប្រតិបត្តិការតំបន់អាស៊ាន និងការទាក់ទាញការវិនិយោគផ្ទាល់ពីបរទេស (FDI)',
      initiatorCommand: '/mfaic',
      initiatorDesc: 'តុឃ្លាំមើលកិច្ចការបរទេស និងសេដ្ឋកិច្ចការទូត'
    },
    // 11. Agriculture, Paddy Rice & Fertilizers
    {
      topic: 'វិធានការរក្សាស្ថិរភាពតម្លៃស្រូវ កសិផល និងការចុះបង្ក្រាបការនាំចូល និងចែកចាយជី-ថ្នាំកសិកម្មក្លែងក្លាយ',
      initiatorCommand: '/maff',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យកសិកម្ម រុក្ខាប្រមាញ់ និងនេសាទ'
    },
    // 12. Public Health, Hospitals & NSSF
    {
      topic: 'ការពង្រីករបបសន្តិសុខសង្គម (ប.ស.ស.) ជូនអ្នកប្រកបរបរក្រៅប្រព័ន្ធ និងការពង្រឹងគុណភាពសេវាព្យាបាលនៅមន្ទីរពេទ្យរដ្ឋ',
      initiatorCommand: '/moh',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យសុខាភិបាលសាធារណៈ'
    },
    // 13. Environment, Protected Forests & Plastic
    {
      topic: 'ការដាក់ពង្រាយកម្លាំងចម្រុះល្បាត ២៤/៧ ទប់ស្កាត់បទល្មើសកាប់បំផ្លាញព្រៃឈើ និងយុទ្ធនាការកាត់បន្ថយប្លាស្ទិក',
      initiatorCommand: '/moe',
      initiatorDesc: 'តុឃ្លាំមើលបរិស្ថាន និងធនធានធម្មជាតិ'
    },
    // 14. Taxes, Customs & SME Startups
    {
      topic: 'កំណែទម្រង់ប្រព័ន្ធពន្ធដារឌីជីថល (GDT E-Filing) និងការលើកទឹកចិត្តពន្ធដារដល់សហគ្រាសធុនតូច-មធ្យម (SME) និង Startups',
      initiatorCommand: '/tax',
      initiatorDesc: 'តុឃ្លាំមើលប្រព័ន្ធពន្ធដារ និងគយ'
    },
    // 15. Education, TVET & National Exams
    {
      topic: 'ការពង្រឹងគុណភាពអប់រំ តម្លាភាពនៃការប្រឡងបាក់ឌុប និងការជំរុញការបណ្តុះបណ្តាលជំនាញវិជ្ជាជីវៈ (TVET) ១.៥លាននាក់',
      initiatorCommand: '/moeys',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យអប់រំ យុវជន និងកីឡា'
    },
    // 16. Tourism & Angkor Heritage
    {
      topic: 'យុទ្ធសាស្ត្រស្តារវិស័យទេសចរណ៍ ការសម្រួលទិដ្ឋាការអេឡិចត្រូនិក និងការអភិរក្សរមណីយដ្ឋានប្រវត្តិសាស្ត្រអង្គរ',
      initiatorCommand: '/mot',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យទេសចរណ៍ និងបេតិកភណ្ឌវប្បធម៌'
    },
    // 17. Energy & Electricity Tariffs
    {
      topic: 'ការកាត់បន្ថយថ្លៃអគ្គិសនីបម្រើឱ្យវិស័យកសិកម្ម និងការជំរុញការប្រើប្រាស់ថាមពលកកើតឡើងវិញ (ពន្លឺព្រះអាទិត្យ)',
      initiatorCommand: '/mme',
      initiatorDesc: 'តុឃ្លាំមើលវិស័យរ៉ែ ថាមពល និងប្រេងកាត'
    },
    // 18. Water Resources & Drought Relief
    {
      topic: 'ការអភិវឌ្ឍប្រព័ន្ធស្រោចស្រព ប្រឡាយមេ ទំនប់អាងទឹក និងការត្រៀមកម្លាំងអន្តរាគមន៍គ្រោះរាំងស្ងួតជូនកសិករ',
      initiatorCommand: '/mowram',
      initiatorDesc: 'តុឃ្លាំមើលធនធានទឹក និងឧតុនិយម'
    },
    // 19. Phnom Penh Urban Drainage & Traffic Lights
    {
      topic: 'វិធានការដោះស្រាយការកកស្ទះចរាចរណ៍ ការបំពាក់ភ្លើងស្តុបឆ្លាតវៃ និងការស្តារប្រព័ន្ធលូរំដោះទឹកជំនន់ក្នុងរាជធានីភ្នំពេញ',
      initiatorCommand: '/phnompenh',
      initiatorDesc: 'តុឃ្លាំមើលរដ្ឋបាលរាជធានីភ្នំពេញ'
    },
    // 20. Drugs & Village Safety Policy
    {
      topic: 'យុទ្ធនាការបង្ក្រាបការជួញដូរគ្រឿងញៀន និងការពង្រឹងគោលនយោបាយភូមិ-ឃុំ-សង្កាត់មានសុវត្ថិភាពទូទាំងប្រទេស',
      initiatorCommand: '/police',
      initiatorDesc: 'តុឃ្លាំមើលសន្តិសុខសណ្តាប់ធ្នាប់សាធារណៈ'
    }
  ];

  private static fallbackTopics: string[] = AutonomousNewsRadarEngine.domainTopics.map(d => d.topic);

  /**
   * Initializes the 24/7 background radar daemon.
   */
  public static initialize(intervalMinutes: number = 3): void {
    this.intervalMinutes = intervalMinutes;
    this.startTimer();

    // First scan after 3 seconds to immediately populate live discussions
    setTimeout(() => {
      if (this.isEnabled) {
        this.scanAndDebate().catch((err) => {
          console.warn('[AutonomousNewsRadar] Initial scan warning:', err.message);
        });
      }
    }, 3000);
  }

  public static startTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isEnabled) {
        this.scanAndDebate().catch((err) => {
          console.warn('[AutonomousNewsRadar] Periodic scan warning:', err.message);
        });
      }
    }, this.intervalMinutes * 60 * 1000);
    console.log(`[AutonomousNewsRadar] 24/7 Auto-Debate Radar running (Interval: ${this.intervalMinutes}m, Active: ${this.isEnabled}).`);
  }

  public static enable(): void {
    this.isEnabled = true;
    this.startTimer();
  }

  public static disable(): void {
    this.isEnabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public static setIntervalMinutes(minutes: number): void {
    this.intervalMinutes = Math.max(1, minutes);
    this.startTimer();
  }

  public static getIntervalMinutes(): number {
    return this.intervalMinutes;
  }

  public static addSubscriber(chatId: number): void {
    this.liveChatSubscribers.add(chatId);
  }

  public static removeSubscriber(chatId: number): void {
    this.liveChatSubscribers.delete(chatId);
  }

  public static isSubscriber(chatId: number): boolean {
    return this.liveChatSubscribers.has(chatId);
  }

  public static getStatus() {
    return {
      isEnabled: this.isEnabled,
      intervalMinutes: this.intervalMinutes,
      processedCount: this.processedTopics.size,
      lastTopic: this.lastTopic,
      lastDebatedAt: this.lastDebatedAt,
      subscriberCount: this.liveChatSubscribers.size
    };
  }

  /**
   * Triggers an on-demand live multi-agent debate with optional live streaming callback.
   */
  public static async triggerLiveDebate(params?: {
    topic?: string;
    initiatedBy?: string;
    onStatement?: (stmt: DebateStatement, isFinalReport: boolean) => Promise<void> | void;
  }): Promise<InterMinisterialDebateResult> {
    let targetTopic = params?.topic;
    let initiatedBy = params?.initiatedBy;

    if (!targetTopic) {
      const info = await this.getNextHotTopicInfo();
      targetTopic = info.topic;
      if (!initiatedBy) {
        initiatedBy = info.initiatedBy;
      }
    }

    if (!initiatedBy) {
      initiatedBy = '/angkor-eyes (ម៉ាស៊ីនស្គែនមេ ២៤/៧)';
    }

    this.lastTopic = targetTopic;
    this.lastDebatedAt = LiveInstitutionalFeedEngine.getCurrentKhmerDate();
    this.processedTopics.add(targetTopic);

    return await InterMinisterialDebateEngine.deliberateOnTopic({
      topic: targetTopic,
      initiatedBy,
      onStatement: params?.onStatement
    });
  }

  /**
   * Returns both the next topic and the initiating agent desk.
   */
  public static async getNextHotTopicInfo(): Promise<{ topic: string; initiatedBy: string }> {
    // 1. Live Breaking Feeds (Google News / Government portals) -> Initiated by Master Scanner /angkor-eyes
    try {
      const articles = await LiveInstitutionalFeedEngine.fetchNationalFeeds();
      const breakingKeywords = [
        'បង្ក្រាប', 'ឆបោក', 'ដីធ្លី', 'ចរាចរណ៍', 'ពន្ធ', 'អន្តរាគមន៍', 'កិច្ចប្រជុំ', 'សន្តិសុខ',
        'តុលាការ', 'ពុករលួយ', 'គ្រោះថ្នាក់', 'ប្លង់', 'នគរបាល', 'កសិកម្ម', 'ស្រូវ', 'កម្មករ',
        'ព្រំដែន', 'សិទ្ធិមនុស្ស', 'បាតុកម្ម', 'កូដកម្ម', 'ហិរញ្ញវត្ថុ', 'ធនាគារ', 'អប់រំ', 'បរិស្ថាន'
      ];

      for (const a of articles) {
        const title = a.title.trim();
        const matchesKeyword = breakingKeywords.some(kw => title.includes(kw));
        if (matchesKeyword && !this.processedTopics.has(title)) {
          return {
            topic: title,
            initiatedBy: '/angkor-eyes (ម៉ាស៊ីនស្គែនមេ ២៤/៧)'
          };
        }
      }
    } catch {
      // Fallback if feed unreachable
    }

    // 2. Dynamic Real-time Situation Generator via LLMGateway -> Initiated by Master Scanner /angkor-eyes
    try {
      const { LLMGateway } = await import('../llm/gateway.js');
      const llmRes = await LLMGateway.generateResponse({
        messages: [
          { role: 'system', content: 'You are the National Situation Room Intelligence Director of Cambodia. Impeccable formal Khmer orthography.' },
          { role: 'user', content: 'Generate 1 single fresh, highly specific, breaking national topic currently being debated in Cambodia across society, law, economy, education, agriculture, traffic accidents, traffic law enforcement, protests, finance, trade, human rights, social justice, civil society, border disputes, or foreign affairs. Return ONLY the title in formal Khmer (10-25 words), without quotes or preamble.' }
        ],
        preferredModel: 'gemini-2.5-flash'
      });

      if (llmRes && llmRes.content && llmRes.provider !== 'simulation') {
        const freshTopic = llmRes.content.trim().replace(/^[«"']|[»"']$/g, '').trim();
        if (freshTopic.length > 15 && !this.processedTopics.has(freshTopic)) {
          return {
            topic: freshTopic,
            initiatedBy: '/angkor-eyes (ម៉ាស៊ីនស្គែនមេ ២៤/៧)'
          };
        }
      }
    } catch {
      // Offline fallback
    }

    // 3. Multi-sector rotating fallback topics initiated by specific 78 Watchdog Agent Desks
    for (const item of this.domainTopics) {
      if (!this.processedTopics.has(item.topic)) {
        return {
          topic: item.topic,
          initiatedBy: `${item.initiatorCommand} (${item.initiatorDesc})`
        };
      }
    }

    this.processedTopics.clear();
    const shuffled = [...this.domainTopics].sort(() => Math.random() - 0.5);
    const chosen = shuffled[0];
    return {
      topic: chosen.topic,
      initiatedBy: `${chosen.initiatorCommand} (${chosen.initiatorDesc})`
    };
  }

  /**
   * Selects the next hot or breaking topic from feeds or curated fallback topics.
   */
  public static async getNextHotTopic(): Promise<string> {
    const info = await this.getNextHotTopicInfo();
    return info.topic;
  }

  /**
   * Scans for fresh breaking national news and triggers an automated multi-agent debate.
   */
  public static async scanAndDebate(): Promise<InterMinisterialDebateResult | null> {
    if (!this.isEnabled) {
      return null;
    }

    if (this.isScanning) {
      console.log('[AutonomousNewsRadar] Scan already in progress, skipping cycle.');
      return null;
    }

    this.isScanning = true;
    try {
      const topicInfo = await this.getNextHotTopicInfo();
      const targetTopic = topicInfo.topic;
      const initiatedBy = topicInfo.initiatedBy;

      this.processedTopics.add(targetTopic);
      this.lastTopic = targetTopic;
      this.lastDebatedAt = LiveInstitutionalFeedEngine.getCurrentKhmerDate();

      console.log(`[AutonomousNewsRadar] 🔥 Auto-Debate cycle triggered by ${initiatedBy}: "${targetTopic}"`);

      // Convene inter-ministerial debate across 78 AGI agents with ONE-BY-ONE live streaming to Bot Chat & Mini Web!
      const result = await InterMinisterialDebateEngine.deliberateOnTopic({
        topic: targetTopic,
        initiatedBy,
        onStatement: async (stmt, isFinalReport) => {
          if (isFinalReport) {
            const webUrl = TelegramBotEngine.getLiveWebAppUrl();
            const kb = new InlineKeyboard();
            if (webUrl && webUrl.startsWith('https://')) {
              kb.webApp('🌐 បើក Sovereign Mini Web', webUrl).row();
            }
            kb.text('⚡ កោះប្រជុំបន្ទាប់ភ្លាមៗ', 'auto_debate:now')
              .row()
              .text('🔄 កំណត់ Auto Debate', 'auto_debate:status');

            await TelegramBotEngine.broadcastToUsers(stmt.statement, kb);
          } else {
            const cmd = stmt.agentCommand ? (stmt.agentCommand.startsWith('/') ? stmt.agentCommand : `/${stmt.agentCommand}`) : '/agent';
            let cleanStatement = stmt.statement.trim();
            cleanStatement = cleanStatement.replace(/^[«"']\s*/, '').replace(/\s*[»"']$/, '').trim();
            cleanStatement = cleanStatement.replace(/^(\/?[a-zA-Z0-9_-]+:?|\[\/?\w+\]:?)\s*/i, '').trim();
            const speakerText = `💬 ${cmd}\n«${cleanStatement}»`;
            await TelegramBotEngine.broadcastToUsers(speakerText);
          }
        }
      });

      console.log(`[AutonomousNewsRadar] ✅ Auto-Debate completed & streamed successfully.`);
      return result;
    } finally {
      this.isScanning = false;
    }
  }

  public static getProcessedCount(): number {
    return this.processedTopics.size;
  }
}
