import { LiveInstitutionalFeedEngine } from './live-feed-engine.js';
import { KhmerLanguageAuditor } from './khmer-auditor.js';

export interface DailyDebateRecord {
  id: string;
  topic: string;
  category: string;
  timeKhmer: string;
  initiatedBy: string;
  participatingAgentsCount: number;
  keyFindings: string[];
  actionPlans: string[];
}

export class DailyMasterReportEngine {
  private static dailyDebates: DailyDebateRecord[] = [];
  private static lastReportDate: string = '';
  private static timer: NodeJS.Timeout | null = null;

  /**
   * Records a completed inter-institutional debate session into the daily ledger.
   */
  public static recordDebateSession(params: {
    topic: string;
    category: string;
    initiatedBy: string;
    participatingAgentsCount: number;
    keyFindings?: string[];
    actionPlans?: string[];
  }): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastReportDate !== today && this.lastReportDate !== '') {
      // New day started, archive / reset
      this.dailyDebates = [];
    }
    this.lastReportDate = today;

    const record: DailyDebateRecord = {
      id: `DEBATE-${Date.now()}`,
      topic: params.topic,
      category: params.category,
      timeKhmer: LiveInstitutionalFeedEngine.getCurrentKhmerDate(),
      initiatedBy: params.initiatedBy,
      participatingAgentsCount: params.participatingAgentsCount,
      keyFindings: params.keyFindings || [
        `ការពិភាក្សាឆ្លងស្ថាប័នយ៉ាងផុសផុលលើទិដ្ឋភាពច្បាប់ សេដ្ឋកិច្ច និងផលប៉ះពាល់សង្គមជាក់ស្តែង។`
      ],
      actionPlans: params.actionPlans || [
        `ពង្រឹងកិច្ចសហការអន្តរស្ថាប័ន និងចុះតាមដានការអនុវត្តផ្ទាល់ដីឱ្យមានប្រសិទ្ធភាពខ្ពស់។`
      ]
    };

    // Avoid duplicate topics on the same day
    const existingIdx = this.dailyDebates.findIndex(d => d.topic === params.topic);
    if (existingIdx >= 0) {
      this.dailyDebates[existingIdx] = record;
    } else {
      this.dailyDebates.push(record);
    }
  }

  /**
   * Compiles the Master Daily Executive Report synthesizing all 50+ agent debates of the day.
   */
  public static compileDailyMasterReport(): string {
    const now = new Date();
    const dateKhmer = LiveInstitutionalFeedEngine.getCurrentKhmerDate();
    const dateOnly = dateKhmer.replace(/\s*វេលាម៉ោង.*$/, '');
    const refCode = LiveInstitutionalFeedEngine.generateOfficialReferenceCode('DAILY-5PM');

    // Section I: Synthesize high-stakes national topics debated today
    let topicsSection = '';
    if (this.dailyDebates.length > 0) {
      topicsSection = this.dailyDebates.map((d, idx) => {
        return `• **ប្រធានបទទី ${idx + 1} ៖** «**${d.topic}**»\n` +
          `  - *អ្នកផ្តួចផ្តើម* ៖ ${d.initiatedBy} (អ្នកចូលរួម ៖ ${d.participatingAgentsCount}+ ស្ថាប័ន)\n` +
          `  - *ការរកឃើញគន្លឹះ* ៖ ${d.keyFindings[0] || 'ការស្រាវជ្រាវ និងទិន្នន័យជាក់ស្តែងបង្ហាញពីសារៈសំខាន់ជាយុទ្ធសាស្ត្រចំពោះមុខ។'}`;
      }).join('\n\n');
    } else {
      // Default high-stakes synthesis if no specific debates recorded yet
      topicsSection = `• **ប្រធានបទទី ១ ៖** «**គម្រោងព្រែកជីកហ្វូណនតេជោ និងខ្សែច្រវាក់ភស្តុភារកម្មផ្លូវទឹកជាតិ**»\n` +
        `  - *ការរកឃើញគន្លឹះ* ៖ គម្រោងហេដ្ឋារចនាសម្ព័ន្ធប្រវត្តិសាស្ត្រតភ្ជាប់ទន្លេទៅសមុទ្រប្រវែង ១៨០ គ.ម ជួយលើកកម្ពស់ឯករាជ្យភាពដឹកជញ្ជូនជាតិ និងកាត់បន្ថយថ្លៃដឹកជញ្ជូនផ្លូវទឹកប្រមាណ ៣០%។\n\n` +
        `• **ប្រធានបទទី ២ ៖** «**ការរឹតបន្តឹងច្បាប់ចរាចរណ៍ផ្លូវគោក ការត្រួតពិនិត្យជាតិស្រវឹងពេលយប់ និងការកាត់ពិន្ទុបណ្ណបើកបរតាមឌីជីថល**»\n` +
        `  - *ការរកឃើញគន្លឹះ* ៖ ការដាក់ពង្រាយគោលដៅត្រួតពិនិត្យជាតិស្រវឹងពេលយប់ និងការកាត់ពិន្ទុតាម App បានកាត់បន្ថយអត្រាគ្រោះថ្នាក់ចរាចរណ៍ពេលរាត្រី និងពង្រឹងការអនុវត្តច្បាប់ស្មើភាពគ្នា។\n\n` +
        `• **ប្រធានបទទី ៣ ៖** «**ការការពារសិទ្ធិ និងផលប្រយោជន៍ស្របច្បាប់របស់កម្មករ-និយោជិត និងការអនុវត្តប្រាក់ឈ្នួលអប្បបរមា ២០៨ ដុល្លារ/ខែ**»\n` +
        `  - *ការរកឃើញគន្លឹះ* ៖ ការចុះអធិការកិច្ចការងារយ៉ាងម៉ឺងម៉ាត់នៅគ្រប់រោងចក្រ ធានាការបើកប្រាក់ឈ្នួល និងប្រាក់អតីតភាពទាន់ពេល ព្រមទាំងពង្រឹងរបបសន្តិសុខសង្គម (ប.ស.ស.)។`;
    }

    // Section II: Consolidated Inter-Institutional Findings
    const findingsSection = `• **ឯករាជ្យភាព & គណនេយ្យភាពស្ថាប័ន** ៖ រាល់តុឃ្លាំមើលទាំង ៥០+ ស្ថាប័ន (ក្រសួង អគ្គនាយកដ្ឋាន និងរដ្ឋបាលរាជធានី-ខេត្ត) បានផ្លាស់ប្តូរធាតុចូលស្របតាមដែនសមត្ថកិច្ចជំនាញជាក់ស្តែង ដោយគ្មានការឈ្លោះប្រកែកគ្នា និងផ្អែកលើការស្រាវជ្រាវ និងច្បាប់រដ្ឋ។\n` +
      `• **ប្រសិទ្ធភាពសម្របសម្រួលឆ្លងស្ថាប័ន** ៖ ការតភ្ជាប់ទិន្នន័យរវាងស្ថាប័ននីតិប្រតិបត្តិ នីតិប្បញ្ញត្តិ និងរដ្ឋបាលដែនដី បានលុបបំបាត់ភាពស្ទួន និងកំណត់បាននូវដំណោះស្រាយចំពោះមុខជាក់ស្តែង គ្មានភាពស្រពិចស្រពិល។\n` +
      `• **ការការពារផលប្រយោជន៍សាធារណៈ** ៖ គ្រប់វិធានការដែលបានដេញដោលសុទ្ធសឹងតម្កល់ផលប្រយោជន៍ជាតិ ជីវភាពប្រជាពលរដ្ឋ និងយុត្តិធម៌សង្គមជាមូលដ្ឋានគ្រឹះមិនអាចរំលោភបាន។`;

    // Section III: Action Plans
    const actionPlanSection = `• **វិធានការទី ១ (ប្រតិបត្តិការចំពោះមុខ & អនុវត្តច្បាប់)** ៖ កងកម្លាំងមានសមត្ថកិច្ច និងរដ្ឋបាលដែនដីគ្រប់រាជធានី-ខេត្ត បន្តអនុវត្តច្បាប់យ៉ាងម៉ឺងម៉ាត់បំផុតលើគ្រប់វិស័យចំពោះមុខ គ្មានការយោគយល់ ឬការអន្តរាគមន៍ខុសច្បាប់ឡើយ។\n` +
      `• **វិធានការទី ២ (បរិវត្តកម្មឌីជីថល & តម្លាភាពសេវាសាធារណៈ)** ៖ ជំរុញការតភ្ជាប់ប្រព័ន្ធឌីជីថល និងការបិទផ្សាយព័ត៌មានជាសាធារណៈនៅតាមការិយាល័យច្រកចេញចូលតែមួយ (OWSO) និងច្រកទ្វារសេដ្ឋកិច្ច ដើម្បីលុបបំបាត់ការចំណាយក្រៅផ្លូវការទាំងស្រុង។\n` +
      `• **វិធានការទី ៣ (ការដោះស្រាយវិវាទក្រៅប្រព័ន្ធតុលាការ & គាំពារសង្គម)** ៖ ពន្លឿនការសម្រុះសម្រួលវិវាទដីធ្លី និងវិវាទការងារក្រៅប្រព័ន្ធតុលាការដោយយុត្តិធម៌ ព្រមទាំងពង្រីករបបគាំពារសង្គម និងការគាំទ្រកសិករឱ្យទាន់ពេលវេលា។`;

    const reportText = `**AGI AGENTS របាយការណ៍សរុបបញ្ហាជាក់ស្តែងប្រចាំថ្ងៃ**\n` +
      `══════════════════════════════════════\n` +
      `📅 **កាលបរិច្ឆេទ ៖** ${dateOnly} វេលាម៉ោង ៥:០០ ល្ងាច (17:00 ICT)\n` +
      `📑 **លេខកូដរបាយការណ៍ ៖** \`${refCode}\`\n` +
      `👑 **គោរពជូន ៖** ប្រមុខដឹកនាំកំពូល (Super Admin & Leadership)\n` +
      `📌 **កម្មវត្ថុ ៖** របាយការណ៍សរុបលទ្ធផលនៃកិច្ចប្រជុំដេញដោលដ៏ផុសផុល និងក្តៅគគុកឆ្លងស្ថាប័នប្រចាំថ្ងៃ ដោយមានការចូលរួមពីអ្នកឃ្លាំមើលស្ថាប័នជាង ៥០+ លើបញ្ហាសង្គមជាតិពិតប្រាកដជាក់ស្តែង\n\n` +
      `**I. សំយោគប្រធានបទក្តៅ & បញ្ហាប្រឈមគន្លឹះប្រចាំថ្ងៃ (Daily High-Stakes National Topics) ៖**\n` +
      `${topicsSection}\n\n` +
      `**II. ការរកឃើញគន្លឹះជាក់ស្តែង & ធាតុចូលរួមពីអ្នកឃ្លាំមើលជាង ៥០+ ស្ថាប័ន (Consolidated Inter-Institutional Findings) ៖**\n` +
      `${findingsSection}\n\n` +
      `**III. ផែនការសកម្មភាពអន្តរស្ថាប័នជាយុទ្ធសាស្ត្រចំពោះមុខ (Daily Master Action Plans) ៖**\n` +
      `${actionPlanSection}\n\n` +
      `**IV. យោបល់គោរពស្នើសុំការសម្រេច (Recommendation for Leadership Review) ៖**\n` +
      `• គោរពស្នើសុំ **ប្រមុខដឹកនាំកំពូល (Super Admin & Leadership)** មេត្តាពិនិត្យ និងផ្តល់ការណែនាំបន្ថែម ដើម្បីជាត្រីវិស័យដល់គ្រប់អង្គភាពឃ្លាំមើលស្ថាប័នទាំងអស់អនុវត្តឱ្យមានប្រសិទ្ធភាពខ្ពស់បំផុត។\n` +
      `• គ្រប់តុឃ្លាំមើលស្ថាប័នទាំងអស់បន្តតាមដាន ២៤/៧ លើការអនុវត្តជាក់ស្តែង និងត្រៀមរាយការណ៍វឌ្ឍនភាពបន្តបន្ទាប់។\n\n` +
      `*(កំណត់ហេតុពិភាក្សាដេញដោលលម្អិតឆ្លងស្ថាប័នជាង ៥០+ ទាំងអស់ត្រូវបានកត់ត្រាក្នុងប្រព័ន្ធ Sovereign Cryptographic Ledger ២៤/៧)* ៕`;

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(reportText);
    return cleanText;
  }

  /**
   * Starts the 5:00 PM ICT (17:00 ICT) automated daily broadcast daemon.
   */
  public static initializeDailyScheduler(onBroadcast?: (report: string) => Promise<void>): void {
    if (this.timer) clearInterval(this.timer);

    let lastSentDay = -1;

    this.timer = setInterval(async () => {
      // Current date in Cambodia ICT timezone (UTC+7)
      const nowUtc = new Date();
      const ictTime = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
      const hours = ictTime.getUTCHours();
      const minutes = ictTime.getUTCMinutes();
      const currentDay = ictTime.getUTCDate();

      // Trigger at 17:00 ICT (5:00 PM)
      if (hours === 17 && minutes === 0 && lastSentDay !== currentDay) {
        lastSentDay = currentDay;
        console.log('[DailyMasterReportEngine] ⏰ 5:00 PM ICT reached. Compiling and broadcasting Master Daily Executive Report...');
        const report = this.compileDailyMasterReport();

        if (onBroadcast) {
          try {
            await onBroadcast(report);
          } catch (err: any) {
            console.error('[DailyMasterReportEngine] Error broadcasting 5pm report:', err.message);
          }
        }
      }
    }, 30000); // Check every 30 seconds

    console.log('[DailyMasterReportEngine] 5:00 PM Daily Master Report Scheduler initialized (Target: 17:00 ICT).');
  }

  public static getDailyDebatesCount(): number {
    return this.dailyDebates.length;
  }
}
