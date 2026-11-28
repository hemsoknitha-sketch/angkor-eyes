import { LiveInstitutionalFeedEngine } from './live-feed-engine.js';
import { InterMinisterialDebateEngine, type InterMinisterialDebateResult } from './debate-engine.js';
import { TelegramBotEngine } from '../bot/telegram-bot.js';
import { InlineKeyboard } from 'grammy';

export class AutonomousNewsRadarEngine {
  private static processedTopics: Set<string> = new Set();
  private static timer: NodeJS.Timeout | null = null;
  private static isScanning: boolean = false;

  private static fallbackTopics: string[] = [
    'វិធានការទប់ស្កាត់ការឆបោកតាមប្រព័ន្ធអនឡាញ និងល្បែងស៊ីសងខុសច្បាប់',
    'នីតិវិធីចុះបញ្ជីក្បាលដី និងការដោះស្រាយវិវាទដីធ្លីក្រៅប្រព័ន្ធតុលាការ',
    'ការរឹតបន្តឹងច្បាប់ចរាចរណ៍ផ្លូវគោក និងការត្រួតពិនិត្យជាតិស្រវឹងពេលយប់',
    'ការទប់ស្កាត់អំពើពុករលួយ និងការទារកម្រៃក្រៅផ្លូវការនៅច្រកចេញចូលតែមួយ (OWSO)',
    'កំណែទម្រង់ប្រព័ន្ធពន្ធដារឌីជីថល និងការលើកទឹកចិត្តសហគ្រាសធុនតូចនិងមធ្យម (SME)',
    'ការបង្ក្រាបការជួញដូរគ្រឿងញៀន និងការពង្រឹងសន្តិសុខភូមិ-ឃុំមានសុវត្ថិភាព',
    'ការការពារសិទ្ធិ និងផលប្រយោជន៍ស្របច្បាប់របស់កម្មករ-និយោជិតតាមរោងចក្រ'
  ];

  /**
   * Initializes the 24/7 background radar daemon.
   */
  public static initialize(intervalMinutes: number = 3): void {
    if (this.timer) clearInterval(this.timer);

    console.log(`[AutonomousNewsRadar] Initializing 24/7 National Breaking Issues Radar (Interval: ${intervalMinutes}m).`);

    // First scan after 3 seconds to immediately populate live discussions
    setTimeout(() => {
      this.scanAndDebate().catch((err) => {
        console.warn('[AutonomousNewsRadar] Initial scan warning:', err.message);
      });
    }, 3000);

    // Periodic interval (every 3 minutes)
    this.timer = setInterval(() => {
      this.scanAndDebate().catch((err) => {
        console.warn('[AutonomousNewsRadar] Periodic scan warning:', err.message);
      });
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Scans for fresh breaking national news and triggers an automated multi-agent debate.
   */
  public static async scanAndDebate(): Promise<InterMinisterialDebateResult | null> {
    if (this.isScanning) {
      console.log('[AutonomousNewsRadar] Scan already in progress, skipping cycle.');
      return null;
    }

    this.isScanning = true;
    try {
      console.log('[AutonomousNewsRadar] Fetching live institutional feeds...');
      const articles = await LiveInstitutionalFeedEngine.fetchNationalFeeds().catch(() => []);

      // Find breaking news articles
      const breakingKeywords = ['បង្ក្រាប', 'ឆបោក', 'ដីធ្លី', 'ចរាចរណ៍', 'ពន្ធ', 'អន្តរាគមន៍', 'កិច្ចប្រជុំ', 'សន្តិសុខ', 'តុលាការ', 'ពុករលួយ', 'គ្រោះថ្នាក់', 'ប្លង់', 'នគរបាល'];
      let targetTopic = '';

      for (const a of articles) {
        const title = a.title.trim();
        const matchesKeyword = breakingKeywords.some(kw => title.includes(kw));
        if (matchesKeyword && !this.processedTopics.has(title)) {
          targetTopic = title;
          this.processedTopics.add(title);
          break;
        }
      }

      // If no new breaking feed or offline, pick next fresh fallback topic
      if (!targetTopic) {
        for (const fb of this.fallbackTopics) {
          if (!this.processedTopics.has(fb)) {
            targetTopic = fb;
            this.processedTopics.add(fb);
            break;
          }
        }
      }

      // If all fallbacks used, reset set and pick first
      if (!targetTopic) {
        this.processedTopics.clear();
        targetTopic = this.fallbackTopics[0];
        this.processedTopics.add(targetTopic);
      }

      console.log(`[AutonomousNewsRadar] 🔥 Breaking topic selected: "${targetTopic}"`);

      // Convene inter-ministerial debate across 78 AGI agents
      const result = await InterMinisterialDebateEngine.deliberateOnTopic({
        topic: targetTopic,
        initiatedBy: '📡 រ៉ាដាព័ត៌មានជាតិស្វ័យប្រវត្តិ ២៤/៧ (Autonomous National Radar)'
      });

      // Construct Telegram Broadcast Notification with live Mini Web button
      const webUrl = process.env.WEB_APP_URL || process.env.MINI_APP_URL || '';
      const kb = new InlineKeyboard();
      if (webUrl && webUrl.startsWith('https://')) {
        kb.webApp('🌐 មើលការជជែក Live លើ Mini Web', webUrl).row();
      }
      kb.text('🔄 កោះប្រជុំប្រធានបទបន្ទាប់', 'debate:online_scams');

      const broadcastMsg = `📡 **[រ៉ាដាព័ត៌មានជាតិ ២៤/៧] — កិច្ចប្រជុំបន្ទាន់ AGI ៧៨ ស្ថាប័ន**\n\n` +
        `🔥 **ប្រធានបទក្តៅ** ៖ «${result.topic}»\n` +
        `📅 **កាលបរិច្ឆេទ** ៖ ${result.dateKhmer}\n` +
        `📑 **លេខកូដរដ្ឋបាល** ៖ \`${result.referenceCode}\`\n\n` +
        `🏛️ **ស្ថាប័នចូលរួមជជែក** ៖ ${result.participatingAgents.join(', ')}\n\n` +
        result.jointResolution;

      await TelegramBotEngine.broadcastToUsers(broadcastMsg, kb);
      console.log(`[AutonomousNewsRadar] ✅ Automated debate complete & broadcasted successfully.`);

      return result;
    } finally {
      this.isScanning = false;
    }
  }

  public static getProcessedCount(): number {
    return this.processedTopics.size;
  }
}
