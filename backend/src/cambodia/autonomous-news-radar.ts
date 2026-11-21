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
    if (!targetTopic) {
      targetTopic = await this.getNextHotTopic();
    }

    this.lastTopic = targetTopic;
    this.lastDebatedAt = LiveInstitutionalFeedEngine.getCurrentKhmerDate();
    this.processedTopics.add(targetTopic);

    return await InterMinisterialDebateEngine.deliberateOnTopic({
      topic: targetTopic,
      initiatedBy: params?.initiatedBy || '📡 រ៉ាដាព័ត៌មានជាតិ ២៤/៧ (Autonomous National Radar)',
      onStatement: params?.onStatement
    });
  }

  /**
   * Selects the next hot or breaking topic from feeds or curated fallback topics.
   */
  public static async getNextHotTopic(): Promise<string> {
    try {
      const articles = await LiveInstitutionalFeedEngine.fetchNationalFeeds();
      const breakingKeywords = ['បង្ក្រាប', 'ឆបោក', 'ដីធ្លី', 'ចរាចរណ៍', 'ពន្ធ', 'អន្តរាគមន៍', 'កិច្ចប្រជុំ', 'សន្តិសុខ', 'តុលាការ', 'ពុករលួយ', 'គ្រោះថ្នាក់', 'ប្លង់', 'នគរបាល'];

      for (const a of articles) {
        const title = a.title.trim();
        const matchesKeyword = breakingKeywords.some(kw => title.includes(kw));
        if (matchesKeyword && !this.processedTopics.has(title)) {
          return title;
        }
      }
    } catch {
      // Fallback if feed unreachable
    }

    for (const fb of this.fallbackTopics) {
      if (!this.processedTopics.has(fb)) {
        return fb;
      }
    }

    this.processedTopics.clear();
    return this.fallbackTopics[0];
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
      const targetTopic = await this.getNextHotTopic();
      this.processedTopics.add(targetTopic);
      this.lastTopic = targetTopic;
      this.lastDebatedAt = LiveInstitutionalFeedEngine.getCurrentKhmerDate();

      console.log(`[AutonomousNewsRadar] 🔥 Auto-Debate cycle triggered: "${targetTopic}"`);

      // Convene inter-ministerial debate across 78 AGI agents (streams to Mini Web automatically via WebSockets!)
      const result = await InterMinisterialDebateEngine.deliberateOnTopic({
        topic: targetTopic,
        initiatedBy: '📡 រ៉ាដាព័ត៌មានជាតិស្វ័យប្រវត្តិ ២៤/៧ (Autonomous National Radar)'
      });

      // Construct Telegram Broadcast Notification with live Mini Web button
      const webUrl = TelegramBotEngine.getLiveWebAppUrl();
      const kb = new InlineKeyboard();
      if (webUrl && webUrl.startsWith('https://')) {
        kb.webApp('🌐 មើលការជជែក Live លើ Mini Web', webUrl).row();
      }
      kb.text('⚡ កោះប្រជុំភ្លាមៗ', 'auto_debate:now')
        .row()
        .text('🔄 កំណត់ Auto Debate', 'auto_debate:status');

      const broadcastMsg = `📡 **[AUTO DEBATE ២៤/៧] — កិច្ចប្រជុំបន្ទាន់ AGI ៧៨ ស្ថាប័ន**\n\n` +
        `🔥 **ប្រធានបទក្តៅ** ៖ «${result.topic}»\n` +
        `📅 **កាលបរិច្ឆេទ** ៖ ${result.dateKhmer}\n` +
        `📑 **លេខកូដរដ្ឋបាល** ៖ \`${result.referenceCode}\`\n\n` +
        `🏛️ **ស្ថាប័នចូលរួមជជែក** ៖ ${result.participatingAgents.join(', ')}\n\n` +
        result.jointResolution;

      await TelegramBotEngine.broadcastToUsers(broadcastMsg, kb);
      console.log(`[AutonomousNewsRadar] ✅ Auto-Debate completed & broadcasted successfully.`);

      return result;
    } finally {
      this.isScanning = false;
    }
  }

  public static getProcessedCount(): number {
    return this.processedTopics.size;
  }
}
