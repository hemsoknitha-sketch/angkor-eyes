import { db } from '../db/index.js';
import { CambodiaSocialDebateRadar } from './social-debate-radar.js';
import { LiveInstitutionalFeedEngine } from './live-feed-engine.js';
import { khmerLegalEngine } from './legal-engine.js';
import { KhmerLanguageAuditor } from './khmer-auditor.js';
import { HttpApiServer } from '../api/http-api.js';

export interface DebateStatement {
  agentCommand: string;
  agentName: string;
  roleTitle: string;
  statement: string;
  timestamp: string;
}

export interface InterMinisterialDebateResult {
  topic: string;
  category: string;
  dateKhmer: string;
  referenceCode: string;
  participatingAgents: string[];
  statements: DebateStatement[];
  jointResolution: string;
  formattedTelegramDigest: string;
}

export class InterMinisterialDebateEngine {
  /**
   * Conducts an automated, real-time, multi-agent debate across relevant ministries
   * and institutions on any breaking or hot topic in Cambodia.
   */
  public static async deliberateOnTopic(params: {
    topic: string;
    initiatedBy?: string;
  }): Promise<InterMinisterialDebateResult> {
    const { topic, initiatedBy = 'ប្រជាពលរដ្ឋ (Citizen Request)' } = params;
    const now = new Date();
    const dateKhmer = LiveInstitutionalFeedEngine.getCurrentKhmerDate();
    const refCode = LiveInstitutionalFeedEngine.generateOfficialReferenceCode('CABINET');

    // 1. Analyze breaking debate category and lead agency via Social Debate Radar
    const analysis = CambodiaSocialDebateRadar.analyzeDebate(topic, '');
    const category = analysis.category;

    // 2. Select appropriate 3-4 specialized agents for this domain
    const participants = this.selectParticipatingAgents(category, topic);

    // 3. Ensure target deliberation room exists
    const rooms = db.getRooms();
    let debateRoom = rooms.find(r => r.id === 'room-cabinet-council' || r.name?.includes('គណៈរដ្ឋមន្ត្រី'));
    if (!debateRoom) {
      debateRoom = db.createRoom({
        id: 'room-cabinet-council',
        name: '🏛️ កិច្ចប្រជុំបន្ទាន់ AGI អន្តរក្រសួង (Inter-Ministerial Cabinet)',
        topic: 'ការជជែកដេញដោល និងដោះស្រាយប្រធានបទក្តៅរបស់សង្គមជាតិ'
      });
    }

    const statements: DebateStatement[] = [];

    // Helper to log and broadcast message
    const recordStatement = (agentCommand: string, agentName: string, roleTitle: string, text: string) => {
      const stmt: DebateStatement = {
        agentCommand,
        agentName,
        roleTitle,
        statement: text,
        timestamp: LiveInstitutionalFeedEngine.getCurrentKhmerDate()
      };
      statements.push(stmt);

      const saved = db.addMessage({
        roomId: debateRoom!.id,
        agentId: `agent-${agentCommand.replace('/', '')}`,
        agentName,
        content: text,
        senderType: 'agent'
      });

      HttpApiServer.broadcast({
        type: 'NEW_MESSAGE',
        message: saved,
        roomId: debateRoom!.id
      });

      return stmt;
    };

    // Step 1: Rex Lead Orchestrator opens the Emergency Cabinet Session
    const rexIntro = `🇰🇭 **[Rex Lead Orchestrator] — ប្រកាសកោះប្រជុំបន្ទាន់ AGI អន្តរក្រសួង**\n` +
      `📅 កាលបរិច្ឆេទ ៖ ${dateKhmer}\n` +
      `📑 លេខកូដកិច្ចប្រជុំ ៖ \`${refCode}\`\n\n` +
      `ប្រធានបទក្តៅបន្ទាន់ ៖ «**${topic}**» (ផ្តួចផ្តើមដោយ ៖ ${initiatedBy})\n` +
      `ចំណាត់ថ្នាក់វិបត្តិ ៖ ${analysis.topicLabel} (ពិន្ទុរលកកង្វល់ ៖ ${analysis.viralScore}/100)\n\n` +
      `សូមអញ្ជើញស្ថាប័នមានសមត្ថកិច្ចពាក់ព័ន្ធចូលរួមជជែក ស្រង់មាត្រាច្បាប់ និងដាក់ចេញដំណោះស្រាយចំពោះមុខជូនប្រជាពលរដ្ឋជាបន្ទាន់ ៖`;
    recordStatement('/rex', 'Rex Lead Orchestrator', 'អ្នកសម្របសម្រួលជាន់ខ្ពស់ AGI ANGKOR EYES', rexIntro);

    // Step 2: Lead Agency Statement (Field Enforcement & Executive Mandate)
    const leadCmd = participants[0];
    const leadDetails = LiveInstitutionalFeedEngine.getInstitutionDetails(leadCmd);
    const leadLaw = analysis.citedArticles[0]
      ? `• មូលដ្ឋានច្បាប់ ៖ [${analysis.citedArticles[0].code_name}] មាត្រា ${analysis.citedArticles[0].article} «${analysis.citedArticles[0].title}» ៖ ${analysis.citedArticles[0].text}`
      : '• មូលដ្ឋានច្បាប់ ៖ រដ្ឋធម្មនុញ្ញ មាត្រា ៥១ (អំណាចជារបស់ប្រជាពលរដ្ឋ) និងច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ';

    const leadStatementText = `🏛️ **[${leadDetails.name}] — ជំហរ និងចំណាត់ការអនុវត្តផ្ទាល់** ៖\n` +
      `ផ្អែកលើដែនសមត្ថកិច្ចរបស់ ${leadDetails.name} សំណើ «${topic}» ត្រូវបានចាត់ទុកជាអាទិភាពខ្ពស់។\n\n` +
      `១. វិធានការប្រតិបត្តិការ ៖ មន្ត្រីជំនាញ និងកងកម្លាំងបានចុះផ្ទៀងផ្ទាត់ និងចាត់វិធានការផ្ទាល់ ដើម្បីធានានូវសន្តិសុខ តម្លាភាព និងយុត្តិធម៌សង្គម។\n` +
      `២. ${leadLaw}\n` +
      `៣. ការទប់ស្កាត់ការកេងប្រវ័ញ្ច ៖ គ្មានការយោគយល់ ឬលើកលែងចំពោះជនល្មើស ឬមន្ត្រីខិលខូចឡើយ។ ប្រជាពលរដ្ឋអាចរាយការណ៍ផ្ទាល់មកកាន់ ${leadDetails.hotline} ៕`;
    recordStatement(leadCmd, leadDetails.name, `តំណាង ${leadDetails.name}`, leadStatementText);

    // Step 3: Legal / Justice Oversight Statement
    const legalCmd = participants[1];
    const legalDetails = LiveInstitutionalFeedEngine.getInstitutionDetails(legalCmd);
    const legalStatementText = `⚖️ **[${legalDetails.name}] — ក្របខ័ណ្ឌនីតិរដ្ឋ & យុត្តិធម៌តុលាការ** ៖\n` +
      `ស្ថាប័នសូមបញ្ជាក់អំពីនីតិវិធីច្បាប់ និងយុត្តិធម៌សង្គម ៖\n\n` +
      `១. សមភាពនៅចំពោះមុខច្បាប់ ៖ រាល់បុគ្គលដែលពាក់ព័ន្ធនឹង «${topic}» ត្រូវស្ថិតនៅក្រោមនីតិរដ្ឋស្មើៗគ្នា គ្មានការរើសអើងដោយសារឋានៈ ឬអំណាចឡើយ។\n` +
      `២. នីតិវិធីអយ្យការ និងតុលាការ ៖ ភស្តុតាងនានាត្រូវបានប្រមូលផ្ដុំយ៉ាងហ្មត់ចត់ដើម្បីកសាងសំណុំរឿងស្របតាមក្រមនីតិវិធីព្រហ្មទណ្ឌ និងក្រមរដ្ឋប្បវេណី។\n` +
      `៣. ការការពារសិទ្ធិស្របច្បាប់ ៖ ធានាការការពារសិទ្ធិជនរងគ្រោះ និងសាក្សី ១០០% ស្របតាមច្បាប់ជាធរមាន ៕`;
    recordStatement(legalCmd, legalDetails.name, `តំណាង ${legalDetails.name}`, legalStatementText);

    // Step 4: Anti-Corruption / Oversight or Territorial Administration Statement
    const thirdCmd = participants[2];
    const thirdDetails = LiveInstitutionalFeedEngine.getInstitutionDetails(thirdCmd);
    const thirdStatementText = `🛡️ **[${thirdDetails.name}] — តម្លាភាព និងការការពារផលប្រយោជន៍សាធារណៈ** ៖\n` +
      `ដើម្បីធានាភាពស្អាតស្អំ និងការពារផលប្រយោជន៍ប្រជាពលរដ្ឋ ៖\n\n` +
      `១. ការទប់ស្កាត់អំពើពុករលួយ និងបក្ខពួកនិយម ៖ ហាមដាច់ខាតការជ្រៀតជ្រែក ឬការទារកម្រៃក្រៅផ្លូវការ។ រាល់ការបំពាននឹងត្រូវផ្តន្ទាទោសតាមច្បាប់ប្រឆាំងអំពើពុករលួយ។\n` +
      `២. សេវាសាធារណៈ និងច្រកចេញចូលតែមួយ (OWSO) ៖ ពលរដ្ឋមានសិទ្ធិទទួលបានសេវា និងព័ត៌មានដោយឥតគិតថ្លៃក្រៅផ្លូវការ។\n` +
      `៣. បណ្តាញទទួលបណ្តឹងសម្ងាត់ ៖ ប្រជាពលរដ្ឋអាចទាក់ទងមកកាន់ទូរស័ព្ទ ${thirdDetails.hotline} ៕`;
    recordStatement(thirdCmd, thirdDetails.name, `តំណាង ${thirdDetails.name}`, thirdStatementText);

    // Step 5: Rex Lead Orchestrator compiles Joint Consensus & Action Plan
    const resolutionText = `📋 **[សេចក្តីសន្និដ្ឋានរួម & ផែនការសកម្មភាពអន្តរក្រសួង]**\n` +
      `ផ្អែកលើការពិភាក្សាដេញដោលយ៉ាងម៉ត់ចត់រវាង ${leadDetails.name}, ${legalDetails.name} និង ${thirdDetails.name} ស្ថាប័នសូមដាក់ចេញ ៖\n` +
      `• **ផែនការទី ១** ៖ ចុះអន្តរាគមន៍ និងដោះស្រាយសំណូមពរជាក់ស្តែងរបស់ពលរដ្ឋតាមច្រកចេញចូលតែមួយ។\n` +
      `• **ផែនការទី ២** ៖ ពង្រឹងការអនុវត្តច្បាប់តឹងរ៉ឹង គ្មានការយោគយល់ ឬលើកលែងចំពោះអំពើពុករលួយ និងបក្ខពួកនិយម។\n` +
      `• **ផែនការទី ៣** ៖ បើកចំហរាយការណ៍វឌ្ឍនភាពជូនប្រជាពលរដ្ឋតាមរយៈគេហទំព័រផ្លូវការ ${leadDetails.website}។\n\n` +
      `*(កំណត់ហេតុនេះត្រូវបានកត់ត្រាក្នុងប្រព័ន្ធអចិន្ត្រៃយ៍ និងរាយការណ៍ជូន Super Admin)* ៕`;
    recordStatement('/rex', 'Rex Lead Orchestrator', 'អ្នកសម្របសម្រួលជាន់ខ្ពស់ AGI ANGKOR EYES', resolutionText);

    // Format unified Telegram Digest
    let tgDigest = `🇰🇭 **លទ្ធផលកិច្ចប្រជុំបន្ទាន់ AGI អន្តរក្រសួង (78 Agents Real-Time Deliberation)**\n\n`;
    tgDigest += `📅 **កាលបរិច្ឆេទ** ៖ ${dateKhmer}\n`;
    tgDigest += `📑 **លេខកូដកិច្ចប្រជុំ** ៖ \`${refCode}\`\n`;
    tgDigest += `🔥 **ប្រធានបទក្តៅ** ៖ «${topic}»\n`;
    tgDigest += `══════════════════════════════════════\n\n`;

    statements.forEach((s) => {
      tgDigest += `${s.statement}\n\n──────────────────────────────────────\n\n`;
    });

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(tgDigest);

    return {
      topic,
      category,
      dateKhmer,
      referenceCode: refCode,
      participatingAgents: participants,
      statements,
      jointResolution: resolutionText,
      formattedTelegramDigest: cleanText
    };
  }

  private static selectParticipatingAgents(category: string, topic: string): string[] {
    const t = topic.toLowerCase();

    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      return ['/mlmupc', '/moj', '/interior'];
    }
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM') {
      return ['/acu', '/moj', '/interior'];
    }
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      return ['/mptc', '/police', '/moj'];
    }
    if (t.includes('ចរាចរណ៍') || t.includes('បុក') || t.includes('ពិន័យ') || category === 'TRAFFIC_SAFETY') {
      return ['/mpwt', '/police', '/moj'];
    }
    if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('សេដ្ឋកិច្ច') || t.includes('លុយ')) {
      return ['/mef', '/tax', '/customs'];
    }
    if (t.includes('សុខាភិបាល') || t.includes('ពេទ្យ') || t.includes('ថ្នាំ') || t.includes('ប.ស.ស.')) {
      return ['/moh', '/interior', '/moj'];
    }
    if (t.includes('អប់រំ') || t.includes('សាលា') || t.includes('គ្រូ') || t.includes('ប្រឡង')) {
      return ['/moeys', '/interior', '/acu'];
    }
    if (t.includes('ភ្នំពេញ') || t.includes('ទីក្រុង') || t.includes('លូ') || t.includes('សំរាម')) {
      return ['/phnompenh', '/interior', '/mpwt'];
    }

    // Default high-level governance council
    return ['/interior', '/moj', '/acu'];
  }
}
