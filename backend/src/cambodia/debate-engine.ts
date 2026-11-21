import { db } from '../db/index.js';
import { CambodiaSocialDebateRadar } from './social-debate-radar.js';
import { LiveInstitutionalFeedEngine } from './live-feed-engine.js';
import { khmerLegalEngine } from './legal-engine.js';
import { KhmerLanguageAuditor } from './khmer-auditor.js';
import { HttpApiServer } from '../api/http-api.js';
import { LLMGateway } from '../llm/gateway.js';

export interface DebateStatement {
  agentCommand: string;
  agentName: string;
  roleTitle: string;
  statement: string;
  timestamp: string;
  isFinalReport?: boolean;
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
   * Conducts an automated, real-time, multi-agent conversational debate across relevant ministries
   * and institutions on any breaking or hot topic in Cambodia.
   * Supports an optional onStatement callback to stream messages one-by-one in real time!
   */
  public static async deliberateOnTopic(params: {
    topic: string;
    initiatedBy?: string;
    onStatement?: (stmt: DebateStatement, isFinalReport: boolean) => Promise<void> | void;
  }): Promise<InterMinisterialDebateResult> {
    const { topic, initiatedBy = 'ប្រជាពលរដ្ឋ (Citizen Request)', onStatement } = params;
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
    const recordStatement = async (agentCommand: string, agentName: string, roleTitle: string, text: string, isFinalReport = false) => {
      const stmt: DebateStatement = {
        agentCommand,
        agentName,
        roleTitle,
        statement: text,
        timestamp: LiveInstitutionalFeedEngine.getCurrentKhmerDate(),
        isFinalReport
      };
      statements.push(stmt);

      const saved = db.addMessage({
        roomId: debateRoom!.id,
        agentId: `agent-${agentCommand.replace('/', '')}`,
        agentName: agentCommand.startsWith('/') ? agentCommand : `/${agentCommand}`,
        content: text,
        senderType: 'agent'
      });

      HttpApiServer.broadcast({
        type: 'NEW_MESSAGE',
        message: saved,
        roomId: debateRoom!.id
      });

      if (onStatement) {
        try {
          await onStatement(stmt, isFinalReport);
        } catch (err: any) {
          console.warn('[DebateEngine] onStatement callback error:', err.message);
        }
      }

      return stmt;
    };

    // Step 1: Rex Lead Orchestrator opens the Emergency Cabinet Session
    const rexIntro = `«កោះប្រជុំបន្ទាន់ AGI ៖ «${topic}»។ សូមស្ថាប័នពាក់ព័ន្ធរាយការណ៍ពីស្ថានភាពជាក់ស្តែង និងចំណាត់ការក្តៅជាបន្ទាន់!»`;
    await recordStatement('/rex', 'Rex Lead Orchestrator', 'អ្នកសម្របសម្រួលជាន់ខ្ពស់ AGI ANGKOR EYES', rexIntro, false);

    // Step 2: Sequential Multi-Turn Conversational Dialogue (One by One)
    for (let i = 0; i < participants.length; i++) {
      if (onStatement) {
        await new Promise(r => setTimeout(r, 1200)); // Natural pacing
      }

      const cmd = participants[i];
      const details = LiveInstitutionalFeedEngine.getInstitutionDetails(cmd);
      const statementText = await this.generateAgentConversationalStatement({
        agentCommand: cmd,
        agentName: details.name,
        roleTitle: `តំណាងផ្លូវការ ${details.name}`,
        topic,
        category,
        index: i,
        conversationHistory: statements,
        leadDetails: details,
        analysis
      });

      await recordStatement(cmd, details.name, `តំណាង ${details.name}`, statementText, false);
    }

    // Step 3: Rex Lead Orchestrator compiles Final Executive Report to Leadership
    if (onStatement) {
      await new Promise(r => setTimeout(r, 1500));
    }

    const executiveReportText = this.generateExecutiveReportToLeadership({
      topic,
      category,
      dateKhmer,
      refCode,
      participants,
      statements
    });

    await recordStatement('/rex', 'Rex Lead Orchestrator', 'របាយការណ៍សង្ខេបប្រតិបត្តិជូនប្រមុខដឹកនាំ', executiveReportText, true);

    // Format Full Telegram Digest
    let tgDigest = `🇰🇭 **កិច្ចពិភាក្សាដេញដោលអន្តរក្រសួង AGI (Live Cabinet Deliberation)**\n\n` +
      `📅 **កាលបរិច្ឆេទ** ៖ ${dateKhmer}\n` +
      `📑 **លេខកូដកិច្ចប្រជុំ** ៖ \`${refCode}\`\n` +
      `🔥 **ប្រធានបទក្តៅ** ៖ «**${topic}**»\n` +
      `══════════════════════════════════════\n\n`;

    statements.forEach((s) => {
      const cmd = s.agentCommand ? (s.agentCommand.startsWith('/') ? s.agentCommand : `/${s.agentCommand}`) : '/agent';
      tgDigest += `💬 ${cmd}\n` +
        `${s.statement}\n\n` +
        `──────────────────────────────────────\n\n`;
    });

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(tgDigest);

    return {
      topic,
      category,
      dateKhmer,
      referenceCode: refCode,
      participatingAgents: participants,
      statements,
      jointResolution: executiveReportText,
      formattedTelegramDigest: cleanText
    };
  }

  private static isValidKhmerStatement(text: string): boolean {
    if (!text || text.length < 25) return false;
    const trimmed = text.trim();
    if (trimmed.endsWith('និង') || trimmed.endsWith('ប្តេជ្ញា') || trimmed.endsWith('និងប្តេជ្ញាច') || trimmed.endsWith('និងក្រសួងមហា')) {
      return false;
    }
    const lastChar = trimmed[trimmed.length - 1];
    if (!['។', '!', '»', '”', '.'].includes(lastChar)) {
      return false;
    }
    return true;
  }

  private static prunePleasantries(text: string): string {
    let cleaned = text.trim().replace(/^«|»$/g, '').trim();
    // Prune standard diplomatic pleasantries and ministerial speeches
    cleaned = cleaned.replace(/^(សូមគោរព[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(សូមថ្លែងអំណរគុណ[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(សូមជម្រាបសួរ[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(ខ្ញុំសូមគាំទ្រយ៉ាងពេញទំហឹងចំពោះប្រសាសន៍[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(ខ្ញុំសូមគាំទ្រប្រសាសន៍[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(សូមជម្រាបជូនអង្គប្រជុំ[^\n។!]*[។!:]\s*)+/g, '');
    return cleaned.trim();
  }

  private static async generateAgentConversationalStatement(params: {
    agentCommand: string;
    agentName: string;
    roleTitle: string;
    topic: string;
    category: string;
    index: number;
    conversationHistory: DebateStatement[];
    leadDetails: any;
    analysis: any;
  }): Promise<string> {
    const { agentCommand, agentName, topic, category, index, conversationHistory, leadDetails } = params;

    // 1. Try real-time LLM dynamic response first (Short, Real-time, Zero pleasantries)
    try {
      const prompt = `You are ${agentCommand} (${agentName}) participating in a real-time Telegram crisis coordination chat in Cambodia.
Hot national issue: "${topic}".
Previous messages from other agencies:
${conversationHistory.map(h => `${h.agentCommand}: ${h.statement}`).join('\n')}

STRICT RULES:
1. NO formal diplomatic pleasantries or ministerial speeches! (DO NOT say "សូមគោរព...", "សូមថ្លែងអំណរគុណ...", "អង្គប្រជុំដ៏ខ្ពង់ខ្ពស់...").
2. Jump DIRECTLY into your operational update or field order.
3. Keep it VERY SHORT: 1 to 2 punchy sentences (maximum 25 to 45 words).
4. Provide concrete, realistic enforcement facts on the ground and official hotline (${leadDetails.hotline}).
5. Must end with Khmer full stop "។".`;

      const llmRes = await LLMGateway.generateResponse({
        messages: [
          { role: 'system', content: `You are an operational executive representing ${agentName} (${agentCommand}) in a fast-paced government Telegram chat group. You communicate concisely, directly, and realistically in flawless Khmer without bureaucratic pleasantries.` },
          { role: 'user', content: prompt }
        ],
        preferredModel: 'gemini-2.5-flash'
      });

      if (llmRes && llmRes.content && llmRes.provider !== 'simulation') {
        const pruned = this.prunePleasantries(llmRes.content);
        if (this.isValidKhmerStatement(pruned)) {
          return `«${pruned}»`;
        }
      }
    } catch {
      // Fallback
    }

    // 2. Realistic Domain-Tailored Direct Chat Statements (Short, Concrete, No Fluff)
    const t = topic.toLowerCase();

    // TRAFFIC & DRUNK DRIVING
    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('គ្រឿងស្រវឹង') || category === 'TRAFFIC_SAFETY') {
      if (agentCommand === '/police') {
        return `«កងកម្លាំងនគរបាលជាតិបានដាក់គោលដៅត្រួតពិនិត្យជាតិស្រវឹងពេលយប់ទូទាំងប្រទេស។ កម្រិតជាតិស្រវឹងលើស ០.៤០mg/L បញ្ជូនទៅតុលាការភ្លាម គ្មានការអន្តរាគមន៍ ឬយោគយល់ឡើយ! Hotline 117។»`;
      }
      if (agentCommand === '/mpwt') {
        return `«ក្រសួងសាធារណការបានតភ្ជាប់ប្រព័ន្ធកាត់ពិន្ទុបណ្ណបើកបរតាមឌីជីថល App និងកាមេរ៉ាសុវត្ថិភាព។ អ្នកបើកបរស្រវឹងបង្កគ្រោះថ្នាក់ នឹងត្រូវព្យួរ ឬលុបបណ្ណបើកបរចោលភ្លាមៗ។»`;
      }
      if (agentCommand === '/moj') {
        return `«បើកបរស្រវឹងបង្កគ្រោះថ្នាក់របួសឬស្លាប់ ត្រូវចោទប្រកាន់ពីបទមជ្ឈិមឬឧក្រិដ្ឋ ផ្តន្ទាទោសដាក់ពន្ធនាគារពី ១ ទៅ ៥ ឆ្នាំ តាមមាត្រា ៧៧/៨២ នៃច្បាប់ចរាចរណ៍ផ្លូវគោក។»`;
      }
      if (agentCommand === '/acu') {
        return `«ACU ព្រមានមន្ត្រីនគរបាលចរាចរណ៍ ហាមដាច់ខាតការទារលុយក្រៅផ្លូវការ។ ពលរដ្ឋមានសិទ្ធិថតវីដេអូ និងរាយការណ៍ផ្ទាល់មក Hotline ១២៨២។»`;
      }
    }

    // CYBER FRAUD & ONLINE SCAMS
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      if (agentCommand === '/mptc') {
        return `«ក្រសួងប្រៃសណីយ៍បានសហការជាមួយ ISP បិទខ្ទប់គេហទំព័រឆបោកជាង ៣០០០ Domain និងកំពុងរឹតបន្តឹងការចុះបញ្ជីស៊ីមកាតទូរស័ព្ទ។ Hotline 123។»`;
      }
      if (agentCommand === '/police') {
        return `«កម្លាំងនាយកដ្ឋានប្រឆាំងបទល្មើសបច្ចេកវិទ្យា កំពុងចុះបង្ក្រាបទីតាំង Call Center ឆបោក និងសហការជាមួយធនាគារជាតិបង្កកគណនីលាងលុយកខ្វក់ជាបន្ទាន់។»`;
      }
      if (agentCommand === '/moj') {
        return `«ជនពាក់ព័ន្ធបណ្តាញឆបោកអនឡាញ ត្រូវចោទប្រកាន់តាមមាត្រា ៣៧៧ នៃក្រមព្រហ្មទណ្ឌ និងច្បាប់ប្រឆាំងការសម្អាតប្រាក់ ដោយគ្មានការបន្ធូរបន្ថយទោសឡើយ។»`;
      }
    }

    // LAND DISPUTES & PROPERTY RIGHTS
    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      if (agentCommand === '/mlmupc') {
        return `«ក្រុមការងារសុរិយោដីកំពុងចុះវាស់វែងចេញប្លង់រឹងជាប្រព័ន្ធ។ ករណីវិវាទដីធ្លី គណៈកម្មការសុរិយោដីសម្របសម្រួលដោះស្រាយក្រៅប្រព័ន្ធតុលាការផ្អែកលើប្រវត្តិដីជាក់ស្តែង គ្មានការលម្អៀងឡើយ។»`;
      }
      if (agentCommand === '/interior') {
        return `«ក្រសួងមហាផ្ទៃបានបញ្ជាដល់អភិបាលខេត្ត និងមូលដ្ឋាន ឱ្យចុះសម្របសម្រួលវិវាទដីធ្លីជូនពលរដ្ឋផ្ទាល់។ មន្ត្រីណាឃុបឃិតស៊ីញ៉េផ្ទេរសិទ្ធិដីខុសច្បាប់ នឹងត្រូវដកតំណែង និងអនុវត្តវិន័យជាបន្ទាន់! Hotline 117។»`;
      }
      if (agentCommand === '/moj') {
        return `«ការទន្ទ្រានកាន់កាប់ដីខុសច្បាប់ ឬក្លែងបន្លំឯកសារកម្មសិទ្ធិ ត្រូវចាត់វិធានការតាមមាត្រា ២៤៧ នៃច្បាប់ភូមិបាល។ តុលាការនឹងពន្លឿនការកាត់ក្តីផ្អែកលើភស្តុតាងច្បាស់លាស់។»`;
      }
      if (agentCommand === '/acu') {
        return `«ACU បានដាក់មន្ត្រីសម្ងាត់ឃ្លាំមើលការដោះស្រាយវិវាទដីធ្លី។ បើមានការទារប្រាក់ក្រោមតុដើម្បីរត់ការប្លង់ដី សូមប្តឹងមក Hotline ១២៨២ ជាបន្ទាន់!»`;
      }
    }

    // ANTI-CORRUPTION & PUBLIC SERVICES
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM' || t.includes('ច្រកចេញចូលតែមួយ')) {
      if (agentCommand === '/acu') {
        return `«ACU បានដាក់មន្ត្រីសម្ងាត់ចុះត្រួតពិនិត្យនៅការិយាល័យច្រកចេញចូលតែមួយ (OWSO)។ ជនណាទារប្រាក់កាហ្វេ ត្រូវចាប់ខ្លួនអនុវត្តតាមមាត្រា ៣២ នៃច្បាប់ប្រឆាំងអំពើពុករលួយ! Hotline 1282។»`;
      }
      if (agentCommand === '/interior') {
        return `«ក្រសួងមហាផ្ទៃបានបិទផ្សាយតារាងតម្លៃសេវាផ្លូវការនៅគ្រប់ OWSO។ មន្ត្រីណាបង្អែបង្អង់ ឬទារប្រាក់ក្រៅផ្លូវការ នឹងត្រូវបណ្តេញចេញពីក្របខ័ណ្ឌភ្លាមៗ! Hotline 117។»`;
      }
      if (agentCommand === '/moj') {
        return `«តុលាការនឹងបើកការស៊ើបអង្កេត និងជំនុំជម្រះក្តីជាសាធារណៈលើរាល់បទល្មើសពុករលួយក្នុងរដ្ឋបាលសាធារណៈ ដោយធានាតម្លាភាពដាច់ខាត។»`;
      }
    }

    // TAXES, CUSTOMS & SME STARTUP INCENTIVES
    if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('សេដ្ឋកិច្ច') || t.includes('ធុរកិច្ច') || t.includes('វិនិយោគ')) {
      if (agentCommand === '/mef') {
        return `«ក្រសួងសេដ្ឋកិច្ចបានដាក់ចេញការលើកលែងពន្ធពី ២ ទៅ ៥ ឆ្នាំ សម្រាប់សហគ្រាសធុនតូច-មធ្យម និង Startups ដែលចុះបញ្ជីតាមថ្នាល CamDX។»`;
      }
      if (agentCommand === '/tax') {
        return `«អគ្គនាយកដ្ឋានពន្ធដារបានដាក់ឱ្យដំណើរការ GDT E-Filing និង Tax App ពេញលេញ។ គ្មានការជួបមុខមន្ត្រីពន្ធដារផ្ទាល់ ដើម្បីលុបបំបាត់ការទារលុយក្រៅផ្លូវការ! Hotline 1188។»`;
      }
      if (agentCommand === '/customs') {
        return `«គយបានភ្ជាប់ប្រព័ន្ធ NSW អនុគ្រោះពន្ធនាំចូលគ្រឿងម៉ាស៊ីន និងវត្ថុធាតុដើមផលិតកម្ម។ គ្រប់បែបបទធ្វើតាមអេឡិចត្រូនិក ១០០%។ Hotline 1209។»`;
      }
      if (agentCommand === '/moc') {
        return `«ការចុះបញ្ជីអាជីវកម្មតាមអនឡាញចំណាយពេលត្រឹម ៣ ថ្ងៃនៃថ្ងៃធ្វើការ ដោយកាត់បន្ថយបែបបទស្មុគស្មាញជាអតិបរមា។»`;
      }
    }

    // LABOUR & FACTORY WORKERS RIGHTS
    if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល') || t.includes('សហជីព')) {
      if (agentCommand === '/mlvt') {
        return `«ក្រុមអធិការកិច្ចការងារកំពុងចុះត្រួតពិនិត្យផ្ទាល់នៅរោងចក្រ។ ប្រាក់ឈ្នួលអប្បបរមា $208 និងប្រាក់អតីតភាព ត្រូវតែបើកឱ្យទាន់ពេល។ ករណីថៅកែគេចវេះ ក្រសួងបញ្ជូនទៅក្រុមប្រឹក្សាអាជ្ញាកណ្តាលភ្លាម! Hotline 1297/1286។»`;
      }
      if (agentCommand === '/interior') {
        return `«កងកម្លាំងនគរបាលមូលដ្ឋានបានដាក់ពង្រាយការពារសន្តិសុខ និងសុវត្ថិភាពជូនបងប្អូនកម្មករទាំងពេលធ្វើដំណើរ និងនៅកន្លែងស្នាក់នៅ។ Hotline 117។»`;
      }
      if (agentCommand === '/moj') {
        return `«ច្បាប់ការងារឆ្នាំ ១៩៩៧ ការពារសិទ្ធិកម្មករពេញលេញ។ រាល់ការកេងប្រវ័ញ្ច ឬបំពានកិច្ចសន្យាការងារ នឹងត្រូវចាត់វិធានការតាមផ្លូវតុលាការជាបន្ទាន់។»`;
      }
      if (agentCommand === '/acu') {
        return `«ACU នឹងបើកការស៊ើបអង្កេតភ្លាមៗ ប្រសិនបើមានមន្ត្រីអធិការកិច្ចណាឃុបឃិតស៊ីសំណូកបិទបាំងកំហុសរោងចក្រ។ ប្តឹងមក Hotline 1282។»`;
      }
    }

    // AGRICULTURE, RICE & FARMERS
    if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      if (agentCommand === '/maff') {
        return `«ក្រសួងកសិកម្មបានដាក់ពង្រាយមន្ត្រីកសិកម្មឃុំចុះជួយកសិករផ្ទាល់ និងកំពុងទប់ស្កាត់ការក្លែងបន្លំជី-ថ្នាំកសិកម្ម។ Hotline 1289។»`;
      }
      if (agentCommand === '/moc') {
        return `«ក្រសួងពាណិជ្ជកម្មសហការជាមួយ CRF ជំរុញការនាំចេញអង្ករ និងត្រៀមអន្តរាគមន៍ទិញស្រូវស្តុកទុក បើមានការទម្លាក់ថ្លៃពីឈ្មួញកណ្តាល។»`;
      }
      if (agentCommand === '/mowram') {
        return `«ក្រសួងធនធានទឹកបានបើកទ្វារទឹក និងត្រៀមម៉ាស៊ីនបូមទឹក ២៤/៧ អន្តរាគមន៍ស្រោចស្រពស្រែប្រាំងជូនកសិករ។»`;
      }
      if (agentCommand === '/mef') {
        return `«ARDB បញ្ចេញឥណទានការប្រាក់ទាបជូនរោងម៉ាស៊ីនកិនស្រូវ ដើម្បីប្រមូលទិញស្រូវពីកសិករតាមតម្លៃគោលសមរម្យ។»`;
      }
    }

    // ENVIRONMENT & FORESTRY
    if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់')) {
      if (agentCommand === '/moe') {
        return `«ឧទ្យានុរក្សកំពុងល្បាត ២៤/៧ ទប់ស្កាត់ការកាប់ទន្ទ្រានដីព្រៃអភិរក្ស។ ជនល្មើសត្រូវកសាងសំណុំរឿងបញ្ជូនទៅតុលាការគ្មានការយោគយល់ឡើយ!»`;
      }
      if (agentCommand === '/interior') {
        return `«នគរបាលជាតិ និងអាជ្ញាធរដែនដី ត្រូវទប់ស្កាត់ដាច់ខាតការកាប់បំផ្លាញព្រៃឈើ។ បើរកឃើញមន្ត្រីណាឃុបឃិត នឹងត្រូវដកហូតតំណែងភ្លាមៗ!»`
      }
      if (agentCommand === '/moj') {
        return `«ព្រះរាជអាជ្ញានឹងពន្លឿននីតិវិធីចោទប្រកាន់ជនកាប់ទន្ទ្រានដីព្រៃរបស់រដ្ឋតាមច្បាប់តំបន់ការពារធម្មជាតិ និងក្រមព្រហ្មទណ្ឌ។»`;
      }
    }

    // DEFAULT INSTITUTIONAL CONVERSATIONAL RESPONSE
    return `«${agentName} បានចុះពិនិត្យស្ថានភាពជាក់ស្តែងលើករណី «${topic}» និងបានដាក់ចេញវិធានការចំពោះមុខភ្លាមៗ។ ករណីបន្ទាន់ សូមទាក់ទង ${leadDetails.hotline}។»`;
  }

  private static generateExecutiveReportToLeadership(params: {
    topic: string;
    category: string;
    dateKhmer: string;
    refCode: string;
    participants: string[];
    statements: DebateStatement[];
  }): string {
    const { topic, dateKhmer, refCode, participants, statements } = params;
    const t = topic.toLowerCase();
    let specificPlan = '';

    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង')) {
      specificPlan = `• **ផែនការទី ១ (ប្រតិបត្តិការចំពោះមុខ)** ៖ បង្កើនការដាក់គោលដៅពិនិត្យជាតិអាល់កុលពេលយប់ទូទាំងប្រទេស និងអនុវត្តការពិន័យអន្តរកាលតាមអនុក្រឹត្យលេខ ៣៩/៤៤ ដោយគ្មានការអន្តរាគមន៍ ឬលើកលែងជាដាច់ខាត។\n` +
        `• **ផែនការទី ២ (ច្បាប់ & តុលាការ)** ៖ បញ្ជូនសំណុំរឿងអ្នកបើកបរស្រវឹងកម្រិតខ្ពស់ (ចាប់ពី ០,៤០mg/L) ទៅតុលាការចោទប្រកាន់ពីបទល្មើសព្រហ្មទណ្ឌ និងដកហូតបណ្ណបើកបរជាបណ្តោះអាសន្ន។\n` +
        `• **ផែនការទី ៣ (តម្លាភាព & សុចរិតភាព)** ៖ ACU ចុះឃ្លាំមើលតាមគោលដៅដើម្បីទប់ស្កាត់ការទារលុយក្រៅផ្លូវការ និងលើកទឹកចិត្តពលរដ្ឋរាយការណ៍តាម Hotline ១១៧ / ១២៨២។`;
    } else if (t.includes('ឆបោក') || t.includes('អនឡាញ')) {
      specificPlan = `• **ផែនការទី ១ (ប្រតិបត្តិការបង្ក្រាប)** ៖ ចុះឆ្មក់បង្ក្រាបមជ្ឈមណ្ឌលឆបោកអនឡាញ (Scam Dens) ចាប់ខ្លួនមេក្លោង និងរឹបអូសភស្តុតាងបញ្ជូនទៅតុលាការផ្តន្ទាទោសជាអតិបរមា។\n` +
        `• **ផែនការទី ២ (បច្ចេកវិទ្យា & ធនាគារ)** ៖ MPTC បិទខ្ទប់ Domain/IP ឆបោកភ្លាមៗ និងសហការជាមួយធនាគារជាតិបង្កកគណនីធនាគារដែលប្រើសម្រាប់លាងលុយកខ្វក់។\n` +
        `• **ផែនការទី ៣ (ផ្សព្វផ្សាយ & ទទួលបណ្តឹង)** ៖ ផ្សព្វផ្សាយសារប្រកាសអាសន្នអប់រំ និងបើកទទួលពាក្យបណ្តឹងតាម Hotline ១២៣ (MPTC) និងនគរបាលប្រឆាំងបទល្មើសបច្ចេកវិទ្យា។`;
    } else if (t.includes('ដីធ្លី') || t.includes('ប្លង់')) {
      specificPlan = `• **ផែនការទី ១ (ចេញប្លង់រឹង)** ៖ ពន្លឿនការចុះបញ្ជីដីធ្លីមានលក្ខណៈជាប្រព័ន្ធ (LMAP) ចេញប្លង់រឹងជូនពលរដ្ឋឱ្យបានឆាប់រហ័ស និងតម្លាភាព។\n` +
        `• **ផែនការទី ២ (យុត្តិធម៌ដីធ្លី)** ៖ ដោះស្រាយវិវាទក្រៅប្រព័ន្ធតុលាការតាមរយៈគណៈកម្មការសុរិយោដី ដោយផ្អែកលើច្បាប់ភូមិបាលឆ្នាំ ២០០១ មិនឱ្យមានការរំលោភលើអ្នកទន់ខ្សោយ។\n` +
        `• **ផែនការទី ៣ (ទប់ស្កាត់ការទន្ទ្រាន)** ៖ ការពារដីសាធារណៈរបស់រដ្ឋ និងដកហូតតំណែងមន្ត្រីណាដែលឃុបឃិតស៊ីញ៉េផ្ទេរសិទ្ធិដីខុសច្បាប់។`;
    } else if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('ធុរកិច្ច') || t.includes('វិនិយោគ') || t.includes('សេដ្ឋកិច្ច')) {
      specificPlan = `• **ផែនការទី ១ (លើកទឹកចិត្តធុរកិច្ចថ្មី)** ៖ ផ្តល់ការលើកលែងពន្ធប្រចាំខែ និងពន្ធលើប្រាក់ចំណូលពី ២ ទៅ ៥ ឆ្នាំ ចំពោះសហគ្រាសធុនតូច-មធ្យម (SME) និង Startups ដែលចុះបញ្ជីតាម CamDX។\n` +
        `• **ផែនការទី ២ (ឌីជីថលូបនីយកម្ម ១០០%)** ៖ ពង្រឹងការបង់ពន្ធអេឡិចត្រូនិក (E-Filing, E-Payment) និងប្រព័ន្ធបញ្ជរតែមួយជាតិគយ (NSW) ដើម្បីលុបបំបាត់ការចំណាយក្រៅផ្លូវការទាំងស្រុង។\n` +
        `• **ផែនការទី ៣ (ការគាំទ្រ & ប្រឹក្សា)** ៖ បើកទូលាយការបណ្តុះបណ្តាលគណនេយ្យសាមញ្ញ និងប្រឹក្សាពន្ធដារឥតគិតថ្លៃតាមរយៈ Hotline ១១៨៨ (GDT) និង ១២០៩ (គយ)។`;
    } else if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល')) {
      specificPlan = `• **ផែនការទី ១ (ត្រួតពិនិត្យលក្ខខណ្ឌការងារ)** ៖ ចុះអធិការកិច្ចការងារគ្រប់រោងចក្រ ធានាការបើកប្រាក់ឈ្នួលអប្បបរមាទៀងទាត់ និងអត្ថប្រយោជន៍ ប.ស.ស. ១០០%។\n` +
        `• **ផែនការទី ២ (ដោះស្រាយវិវាទការងារ)** ៖ ពន្លឿនការដោះស្រាយវិវាទការងាររួមតាមយន្តការក្រុមប្រឹក្សាអាជ្ញាកណ្តាល ការពារសិទ្ធិស្របច្បាប់របស់កម្មករ និងនិយោជក។\n` +
        `• **ផែនការទី ៣ (ទប់ស្កាត់អំពើពុករលួយ)** ៖ ACU ស៊ើបអង្កេតរាល់ការឃុបឃិតស៊ីសំណូកដើម្បីបិទបាំងការកេងប្រវ័ញ្ចកម្មករ តាម Hotline ១២៩៧ / ១២៨២។`;
    } else if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      specificPlan = `• **ផែនការទី ១ (រក្សាស្ថិរភាពតម្លៃកសិផល)** ៖ ដាក់ចេញយន្តការទិញស្រូវស្តុកទុក និងបើកទូលាយកូតានាំចេញអង្ករទៅកាន់ទីផ្សារអន្តរជាតិ។\n` +
        `• **ផែនការទី ២ (គាំទ្របច្ចេកទេស & ប្រព័ន្ធទឹក)** ៖ បញ្ជូនមន្ត្រីកសិកម្មឃុំចុះណែនាំបច្ចេកទេស និងស្តារប្រឡាយមេធានាការស្រោចស្រព ២៤/៧។\n` +
        `• **ផែនការទី ៣ (ទប់ស្កាត់ជី-ថ្នាំក្លែងក្លាយ)** ៖ ចុះបង្ក្រាបការនាំចូល និងលក់ជីគីមី-ថ្នាំកសិកម្មក្លែងក្លាយដែលធ្វើឱ្យខូចខាតទិន្នផលកសិករ។`;
    } else if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់')) {
      specificPlan = `• **ផែនការទី ១ (ល្បាតការពារព្រៃឈើ)** ៖ ដាក់ពង្រាយកម្លាំងចម្រុះ និងឧទ្យានុរក្សល្បាត ២៤/៧ ទប់ស្កាត់ការកាប់បំផ្លាញព្រៃឈើ និងទន្ទ្រានដីរដ្ឋ។\n` +
        `• **ផែនការទី ២ (វិធានការតុលាការ)** ៖ បញ្ជូនសំណុំរឿងជនកាប់ទន្ទ្រានដីព្រៃអភិរក្សទៅតុលាការផ្តន្ទាទោសជាអតិបរមា គ្មានការយោគយល់។\n` +
        `• **ផែនការទី ៣ (យុទ្ធនាការកម្ពុជាស្អាត)** ៖ ពង្រឹងការគ្រប់គ្រងសំរាម សំណល់រឹង-រាវ និងលើកទឹកចិត្តដាំកូនឈើឡើងវិញទូទាំងប្រទេស។`;
    } else if (t.includes('ពុករលួយ') || t.includes('ច្រកចេញចូលតែមួយ') || t.includes('សំណូក')) {
      specificPlan = `• **ផែនការទី ១ (ត្រួតពិនិត្យ OWSO)** ៖ បំពាក់កាមេរ៉ាសុវត្ថិភាពនៅការិយាល័យច្រកចេញចូលតែមួយ បិទផ្សាយតារាងតម្លៃសេវាផ្លូវការជាសាធារណៈ និងហាមដាច់ខាតការទារកម្រៃក្រៅផ្លូវការ។\n` +
        `• **ផែនការទី ២ (អធិការកិច្ចសម្ងាត់)** ៖ ACU ចុះធ្វើអធិការកិច្ចដោយសម្ងាត់ (Mystery Audits) និងចាត់វិធានការច្បាប់ភ្លាមៗចំពោះមន្ត្រីប្រព្រឹត្តអំពើពុករលួយតាមមាត្រា ៣២ នៃច្បាប់ប្រឆាំងអំពើពុករលួយ។\n` +
        `• **ផែនការទី ៣ (បណ្តាញរាយការណ៍សម្ងាត់)** ៖ លើកទឹកចិត្តពលរដ្ឋរាយការណ៍តាម Hotline ១២៨២ ដោយរក្សាការសម្ងាត់ជូនសាក្សី និងជនរងគ្រោះ ១០០%។`;
    } else {
      specificPlan = `• **ផែនការទី ១** ៖ ចុះអន្តរាគមន៍ដោះស្រាយផ្ទាល់នៅមូលដ្ឋាន ដើម្បីធានាសុវត្ថិភាព និងយុត្តិធម៌ជូនប្រជាពលរដ្ឋជាបន្ទាន់។\n` +
        `• **ផែនការទី ២** ៖ អនុវត្តច្បាប់ឱ្យបានម៉ឺងម៉ាត់បំផុត គ្មានការយោគយល់ ឬអន្តរាគមន៍ចំពោះជនប្រព្រឹត្តល្មើសឡើយ។\n` +
        `• **ផែនការទី ៣** ៖ ធានាតម្លាភាព ១០០% និងបើកចំហរាយការណ៍វឌ្ឍនភាពជូនសាធារណជនជាប្រចាំ។`;
    }

    return `🇰🇭 **ព្រះរាជាណាចក្រកម្ពុជា ជាតិ សាសនា ព្រះមហាក្សត្រ**\n` +
      `══════════════════════════════════════\n` +
      `📑 **របាយការណ៍សង្ខេបប្រតិបត្តិបន្ទាន់ (URGENT EXECUTIVE BRIEF)**\n` +
      `**ជូនចំពោះ ៖ សម្តេចធិបតី នាយករដ្ឋមន្ត្រី & ឯកឧត្តមប្រមុខដឹកនាំកំពូល (Super Admin)**\n\n` +
      `📅 **កាលបរិច្ឆេទ** ៖ ${dateKhmer}\n` +
      `📑 **លេខកូដរដ្ឋបាល** ៖ \`${refCode}\`\n` +
      `🔥 **ប្រធានបទក្តៅ** ៖ «**${topic}**»\n\n` +
      `🏛️ **ស្ថាប័នចូលរួមជជែក** ៖ ${participants.join(', ')}\n\n` +
      `📋 **សេចក្តីសន្និដ្ឋានរួម & ផែនការសកម្មភាពអន្តរក្រសួង** ៖\n` +
      `${specificPlan}\n\n` +
      `*(កំណត់ហេតុពិភាក្សាដេញដោលលម្អិត និងភស្តុតាងជាក់ស្តែងទាំងអស់ត្រូវបានកត់ត្រាក្នុងប្រព័ន្ធ Sovereign Ledger ២៤/៧)* ៕`;
  }

  private static selectParticipatingAgents(category: string, topic: string): string[] {
    const t = topic.toLowerCase();

    if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល') || t.includes('សហជីព')) {
      return ['/mlvt', '/interior', '/moj', '/acu'];
    }
    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('បុក') || category === 'TRAFFIC_SAFETY') {
      return ['/police', '/mpwt', '/moj', '/acu'];
    }
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      return ['/mptc', '/police', '/moj', '/acu'];
    }
    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      return ['/mlmupc', '/moj', '/interior', '/acu'];
    }
    if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      return ['/maff', '/moc', '/mowram', '/mef'];
    }
    if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់')) {
      return ['/moe', '/interior', '/moj', '/acu'];
    }
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM' || t.includes('ច្រកចេញចូលតែមួយ')) {
      return ['/acu', '/interior', '/moj'];
    }
    if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('សេដ្ឋកិច្ច') || t.includes('លុយ') || t.includes('ធុរកិច្ច')) {
      return ['/mef', '/tax', '/customs', '/moc'];
    }
    if (t.includes('សុខាភិបាល') || t.includes('ពេទ្យ') || t.includes('ថ្នាំ') || t.includes('ប.ស.ស.')) {
      return ['/moh', '/interior', '/moj'];
    }
    if (t.includes('អប់រំ') || t.includes('សាលា') || t.includes('គ្រូ') || t.includes('ប្រឡង')) {
      return ['/moeys', '/interior', '/acu'];
    }
    if (t.includes('ទេសចរណ៍') || t.includes('អង្គរ') || t.includes('វប្បធម៌') || t.includes('សណ្ឋាគារ')) {
      return ['/mot', '/moca', '/interior'];
    }
    if (t.includes('អគ្គិសនី') || t.includes('ថាមពល') || t.includes('រ៉ែ') || t.includes('ប្រេង')) {
      return ['/mme', '/mef', '/interior'];
    }
    if (t.includes('ភ្នំពេញ') || t.includes('ទីក្រុង') || t.includes('លូ') || t.includes('សំរាម')) {
      return ['/phnompenh', '/interior', '/mpwt'];
    }

    return ['/interior', '/moj', '/acu'];
  }
}
