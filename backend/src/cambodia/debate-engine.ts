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
        name: '🏛️ កិច្ចពិភាក្សាដេញដោលបន្ទាន់ AGI ៧៨ ស្ថាប័ន (Inter-Institutional Deliberation)',
        topic: 'ការជជែកដេញដោល ស្រាវជ្រាវ និងកំណត់ដំណោះស្រាយប្រធានបទសង្គមជាតិដោយឯករាជ្យ'
      });
    }

    const statements: DebateStatement[] = [];

    // Helper to log and broadcast message
    const recordStatement = async (agentCommand: string, agentName: string, roleTitle: string, text: string, isFinalReport = false) => {
      let cleanText = text.trim();
      if (!isFinalReport) {
        // Strip wrapping quotes
        cleanText = cleanText.replace(/^[«"']\s*/, '').replace(/\s*[»"']$/, '').trim();
        // Strip redundant leading command or prefix (e.g. "/interior:", "interior:", "💬 /interior:", "[interior]:")
        cleanText = cleanText.replace(/^(\/?\w+:?|💬\s*\/?\w+:?|\[\/?\w+\]:?)\s*/i, '').trim();
        cleanText = cleanText.replace(/^[«"']\s*/, '').replace(/\s*[»"']$/, '').trim();
        cleanText = `«${cleanText}»`;
      }

      const stmt: DebateStatement = {
        agentCommand,
        agentName,
        roleTitle,
        statement: cleanText,
        timestamp: LiveInstitutionalFeedEngine.getCurrentKhmerDate(),
        isFinalReport
      };
      statements.push(stmt);

      const saved = db.addMessage({
        roomId: debateRoom!.id,
        agentId: `agent-${agentCommand.replace('/', '')}`,
        agentName: agentCommand.startsWith('/') ? agentCommand : `/${agentCommand}`,
        content: cleanText,
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

    // Step 1: ANGKOR EYES Sovereign Master Scanner opens the Emergency Deliberation Session
    const scanIntro = `«ម៉ាស៊ីនស្គែនមេ ANGKOR EYES បានកោះប្រជុំពិភាក្សាលើប្រធានបទ ៖ «${topic}»។ សូមអ្នកឃ្លាំមើលស្ថាប័នពាក់ព័ន្ធ ចាប់ផ្តើមស្រាវជ្រាវ ជជីកកំណត់បញ្ហា និងដំណោះស្រាយជាក់ស្តែង!»`;
    await recordStatement('/angkor-eyes', 'ANGKOR EYES Sovereign Master Scanner', 'ម៉ាស៊ីនស្គែនមេ និងសម្របសម្រួលប្រព័ន្ធ AGI ៧៨ ស្ថាប័ន', scanIntro, false);

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
        roleTitle: `អ្នកឃ្លាំមើល ${details.name}`,
        topic,
        category,
        index: i,
        conversationHistory: statements,
        leadDetails: details,
        analysis
      });

      await recordStatement(cmd, details.name, `អ្នកឃ្លាំមើល ${details.name}`, statementText, false);
    }

    // Step 3: ANGKOR EYES Sovereign Master Scanner compiles Final Executive Report to Leadership
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

    await recordStatement('/angkor-eyes', 'ANGKOR EYES Sovereign Master Scanner', 'របាយការណ៍សង្ខេបប្រតិបត្តិជូនប្រមុខដឹកនាំកំពូល', executiveReportText, true);

    // Format Full Telegram Digest
    let tgDigest = `🇰🇭 **កិច្ចពិភាក្សាដេញដោលអន្តរស្ថាប័ន AGI (Live Deliberation)**\n\n` +
      `📅 **កាលបរិច្ឆេទ** ៖ ${dateKhmer}\n` +
      `📑 **លេខកូដកិច្ចប្រជុំ** ៖ \`${refCode}\`\n` +
      `🔥 **ប្រធានបទក្តៅ** ៖ «**${topic}**»\n` +
      `🏛️ **អ្នកផ្តួចផ្តើម** ៖ ${initiatedBy}\n` +
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
    let cleaned = text.trim();
    // Strip wrapping quotes
    cleaned = cleaned.replace(/^[«"']\s*/, '').replace(/\s*[»"']$/, '').trim();

    // Strip redundant leading command or agent prefixes (e.g. "/interior:", "interior:", "💬 /interior:", "[interior]:")
    cleaned = cleaned.replace(/^(\/?\w+:?|💬\s*\/?\w+:?|\[\/?\w+\]:?)\s*/i, '');
    cleaned = cleaned.replace(/^(\/?\w+:?|💬\s*\/?\w+:?|\[\/?\w+\]:?)\s*/i, '');

    // Prune standard diplomatic pleasantries and ministerial speeches
    cleaned = cleaned.replace(/^(សូមគោរព[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(សូមថ្លែងអំណរគុណ[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(សូមជម្រាបសួរ[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(ខ្ញុំសូមគាំទ្រយ៉ាងពេញទំហឹងចំពោះប្រសាសន៍[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(ខ្ញុំសូមគាំទ្រប្រសាសន៍[^\n។!]*[។!:]\s*)+/g, '');
    cleaned = cleaned.replace(/^(សូមជម្រាបជូនអង្គប្រជុំ[^\n។!]*[។!:]\s*)+/g, '');

    // Strip again after pleasantries in case command was repeated
    cleaned = cleaned.replace(/^(\/?\w+:?|💬\s*\/?\w+:?|\[\/?\w+\]:?)\s*/i, '');
    cleaned = cleaned.replace(/^[«"']\s*/, '').replace(/\s*[»"']$/, '').trim();

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
      const prompt = `You are ${agentCommand} (${agentName}) participating in an independent civic monitoring and inter-institutional deliberation on Cambodian national matters.
Role: Independent Institutional Watchdog & Civic Research Analyst (អ្នកឃ្លាំមើលស្ថាប័នឯករាជ្យ).
Hot topic: "${topic}".
Previous deliberation statements from other watchdog desks:
${conversationHistory.map(h => `${h.agentCommand}: ${h.statement}`).join('\n')}

STRICT ETHICAL & LEGAL RULES:
1. STRICTLY INDEPENDENT WATCHDOG IDENTITY: You are an independent institutional watchdog (អ្នកឃ្លាំមើលឯករាជ្យ). NEVER say or imply that you are an official representative ("តំណាង") or spokesperson ("អ្នកនាំពាក្យ") of any ministry or government agency. No state impersonation!
2. NO POLITICAL TITLES OR REAL LEADER NAMES: NEVER mention royal titles ("សម្តេច", "សម្តេចធិបតី", etc.) or real political leader names.
3. CONSTRUCTIVE DEBATE ETHICS: NEVER quarrel or make hostile attacks (មិនឈ្លោះគ្នាជាដាច់ខាត). Actively learn from other desks: politely acknowledge sound points from previous statements ("យល់ស្រប..."), and if there is a legal or practical flaw, refute it constructively with statutory articles and economic/social facts to safeguard the public interest.
4. NO BUREAUCRATIC SPEECHES OR PLEASANTRIES: Do NOT start with "សូមគោរព...", "សូមថ្លែងអំណរគុណ...", "អង្គប្រជុំដ៏ខ្ពង់ខ្ពស់...". Jump straight to the substance.
5. CONCISE & ACTIONABLE: 1 to 2 sharp sentences (25-45 words) with concrete ground research, evidence, or verified reporting hotline (${leadDetails.hotline}).
6. Flawless Khmer language ending with "។".`;

      const llmRes = await LLMGateway.generateResponse({
        messages: [
          { role: 'system', content: `You are an independent institutional watchdog desk analyst for ${agentName} (${agentCommand}) in Cambodia. You analyze policies and ground facts objectively, constructively, and independently. You never claim state representative authority, never quarrel, and never use real politician names or royal titles.` },
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

    // 2. Realistic Domain-Tailored Direct Chat Statements (Short, Concrete, No Fluff, Independent Watchdog Stance)
    const t = topic.toLowerCase();

    // TRAFFIC & DRUNK DRIVING
    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('គ្រឿងស្រវឹង') || category === 'TRAFFIC_SAFETY') {
      if (agentCommand === '/police') {
        return `«តាមការចុះឃ្លាំមើលផ្ទាល់ កម្លាំងនគរបាលជាតិបានពង្រាយគោលដៅត្រួតពិនិត្យជាតិស្រវឹងពេលយប់ទូទាំងប្រទេស។ យល់ស្របថាត្រូវរឹតបន្តឹងច្បាប់ស្មើភាពគ្នា កម្រិតលើស ០.៤០mg/L ត្រូវបញ្ជូនទៅតុលាការភ្លាម គ្មានការអន្តរាគមន៍ឡើយ! Hotline 117។»`;
      }
      if (agentCommand === '/mpwt') {
        return `«ខ្ញុំយល់ស្របជាមួយវិធានការនគរបាលជាតិ ហើយការតាមដានបង្ហាញថា ការតភ្ជាប់ប្រព័ន្ធកាត់ពិន្ទុបណ្ណបើកបរតាម App ឌីជីថល នឹងជួយកាត់បន្ថយគ្រោះថ្នាក់បានយូរអង្វែង និងទប់ស្កាត់ការបើកបរស្រវឹងដដែលៗ។»`;
      }
      if (agentCommand === '/moj') {
        return `«ផ្អែកលើការស្រាវជ្រាវគតិយុត្ត ការបើកបរស្រវឹងបង្កគ្រោះថ្នាក់របួសឬស្លាប់ ត្រូវអនុវត្តមាត្រា ៧៧/៨២ នៃច្បាប់ចរាចរណ៍ ដោយចោទប្រកាន់ពីបទល្មើសព្រហ្មទណ្ឌ និងគ្មានការបន្ធូរបន្ថយទោសឡើយ។»`;
      }
      if (agentCommand === '/acu') {
        return `«ដើម្បីធានាតម្លាភាពក្នុងប្រតិបត្តិការ ក្រុមឃ្លាំមើល ACU តាមដានទប់ស្កាត់ដាច់ខាតការទារលុយក្រៅផ្លូវការនៅតាមគោលដៅ។ ពលរដ្ឋមានសិទ្ធិរាយការណ៍ផ្ទាល់មក Hotline ១២៨២។»`;
      }
    }

    // CYBER FRAUD & ONLINE SCAMS
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      if (agentCommand === '/mptc') {
        return `«តាមការតាមដានប្រព័ន្ធបច្ចេកវិទ្យា ការបិទខ្ទប់ Domain ឆបោកជាង ៣០០០ និងការរឹតបន្តឹងការចុះបញ្ជីស៊ីមកាតទូរស័ព្ទ គឺជាវិធានការគន្លឹះកាត់ផ្តាច់ឫសគល់បណ្តាញឆបោក។ Hotline 123។»`;
      }
      if (agentCommand === '/police') {
        return `«យល់ស្របជាមួយវិធានការបច្ចេកវិទ្យា។ ការស្រាវជ្រាវសន្តិសុខបង្ហាញថា ត្រូវសហការឆ្មក់បង្ក្រាបទីតាំង Call Center និងសហការជាមួយធនាគារជាតិបង្កកគណនីលាងលុយភ្លាមៗ។»`;
      }
      if (agentCommand === '/moj') {
        return `«ផ្អែកលើការស្រាវជ្រាវផ្លូវច្បាប់ ជនពាក់ព័ន្ធបណ្តាញឆបោកអនឡាញ ត្រូវចោទប្រកាន់តាមមាត្រា ៣៧៧ នៃក្រមព្រហ្មទណ្ឌ និងច្បាប់ប្រឆាំងការសម្អាតប្រាក់ដោយគ្មានការលើកលែង។»`;
      }
    }

    // LAND DISPUTES & PROPERTY RIGHTS
    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      if (agentCommand === '/mlmupc') {
        return `«តាមការស្រាវជ្រាវលើដីជាក់ស្តែង ការពន្លឿនចេញប្លង់រឹងជាប្រព័ន្ធ (LMAP) គឺជាគន្លឹះដោះស្រាយវិវាទដីធ្លីក្រៅប្រព័ន្ធតុលាការប្រកបដោយតម្លាភាព ផ្អែកលើប្រវត្តិដីពិតប្រាកដ។»`;
      }
      if (agentCommand === '/interior') {
        return `«យល់ស្របជាមួយដំណោះស្រាយសុរិយោដី។ ការឃ្លាំមើលរដ្ឋបាលមូលដ្ឋានបង្ហាញថា អាជ្ញាធរត្រូវចុះសម្របសម្រួលដោយយុត្តិធម៌ ហើយមន្ត្រីណាឃុបឃិតស៊ីញ៉េផ្ទេរសិទ្ធិខុសច្បាប់ ត្រូវចាត់វិធានការវិន័យភ្លាមៗ! Hotline 117។»`;
      }
      if (agentCommand === '/moj') {
        return `«ការតាមដាននីតិវិធីតុលាការបញ្ជាក់ថា ករណីក្លែងបន្លំឯកសារ ឬទន្ទ្រានដីរដ្ឋ ត្រូវអនុវត្តមាត្រា ២៤៧ នៃច្បាប់ភូមិបាលយ៉ាងម៉ឺងម៉ាត់ ដើម្បីការពារកម្មសិទ្ធិស្របច្បាប់របស់អ្នកទន់ខ្សោយ។»`;
      }
      if (agentCommand === '/acu') {
        return `«ក្រុមឃ្លាំមើល ACU ដាក់ការតាមដានលើរាល់ដំណើរការសម្រុះសម្រួលដីធ្លី ដើម្បីលុបបំបាត់ការទារលុយរត់ការប្លង់ក្រោមតុ។ បើមានភាពមិនប្រក្រតី ប្តឹងមក Hotline ១២៨២។»`;
      }
    }

    // ANTI-CORRUPTION & PUBLIC SERVICES
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM' || t.includes('ច្រកចេញចូលតែមួយ')) {
      if (agentCommand === '/acu') {
        return `«ផ្អែកលើការចុះឃ្លាំមើលដោយសម្ងាត់នៅការិយាល័យច្រកចេញចូលតែមួយ (OWSO) ជនណាទារប្រាក់កាហ្វេ ត្រូវអនុវត្តមាត្រា ៣២ នៃច្បាប់ប្រឆាំងអំពើពុករលួយគ្មានការយោគយល់ឡើយ! Hotline 1282។»`;
      }
      if (agentCommand === '/interior') {
        return `«យល់ស្របទាំងស្រុង។ ការតាមដានរដ្ឋបាលមូលដ្ឋានតម្រូវឱ្យបិទផ្សាយតារាងតម្លៃផ្លូវការ និងកាលកំណត់សេវាជាសាធារណៈនៅគ្រប់ OWSO ដើម្បីលុបបំបាត់ការបង្អែបង្អង់។ Hotline 117។»`;
      }
      if (agentCommand === '/moj') {
        return `«ការស្រាវជ្រាវគតិយុត្តបញ្ជាក់ថា តុលាការត្រូវបើកការជំនុំជម្រះក្តីជាសាធារណៈលើបទល្មើសពុករលួយក្នុងរដ្ឋបាលសាធារណៈ ដើម្បីពង្រឹងទំនុកចិត្តសង្គម។»`;
      }
    }

    // TAXES, CUSTOMS & SME STARTUP INCENTIVES
    if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('សេដ្ឋកិច្ច') || t.includes('ធុរកិច្ច') || t.includes('វិនិយោគ')) {
      if (agentCommand === '/mef') {
        return `«តាមការតាមដានស្ថានភាពសេដ្ឋកិច្ច ការលើកលែងពន្ធពី ២ ទៅ ៥ ឆ្នាំ សម្រាប់សហគ្រាសធុនតូច-មធ្យម និង Startups ដែលចុះបញ្ជីតាមថ្នាល CamDX គឺជាយន្តការជំរុញកំណើនជាក់ស្តែង។»`;
      }
      if (agentCommand === '/tax') {
        return `«យល់ស្របជាមួយគោលនយោបាយលើកទឹកចិត្ត ហើយការជំរុញ GDT E-Filing និង Tax App នឹងជួយកាត់បន្ថយការជួបមុខផ្ទាល់ និងទប់ស្កាត់ការចំណាយក្រៅផ្លូវការទាំងស្រុង។ Hotline 1188។»`;
      }
      if (agentCommand === '/customs') {
        return `«ការតភ្ជាប់ប្រព័ន្ធបញ្ជរតែមួយជាតិ (NSW) អនុគ្រោះពន្ធនាំចូលគ្រឿងម៉ាស៊ីន និងវត្ថុធាតុដើម បានជួយសម្រួលដល់ខ្សែច្រវាក់ផលិតកម្មយ៉ាងមានប្រសិទ្ធភាព។ Hotline 1209។»`;
      }
      if (agentCommand === '/moc') {
        return `«ការសម្រួលនីតិវិធីចុះបញ្ជីអាជីវកម្មតាមអនឡាញឱ្យនៅត្រឹម ៣ ថ្ងៃ បានចូលរួមចំណែកយ៉ាងសំខាន់ក្នុងការកាត់បន្ថយចំណាយប្រតិបត្តិការរបស់ធុរជន។»`;
      }
    }

    // LABOUR & FACTORY WORKERS RIGHTS
    if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល') || t.includes('សហជីព')) {
      if (agentCommand === '/mlvt') {
        return `«ការចុះតាមដានជាក់ស្តែងនៅតាមរោងចក្ររកឃើញថា ប្រាក់ឈ្នួលអប្បបរមា ២០៨ ដុល្លារ/ខែ និងប្រាក់អតីតភាព ត្រូវតែបើកឱ្យទាន់ពេល។ ករណីថៅកែគេចវេះ ត្រូវជំរុញទៅក្រុមប្រឹក្សាអាជ្ញាកណ្តាលជាបន្ទាន់! Hotline 1297/1286។»`;
      }
      if (agentCommand === '/interior') {
        return `«ខ្ញុំយល់ស្របជាមួយចំណុចលើកឡើងរបស់វិស័យការងារ។ ការឃ្លាំមើលសន្តិសុខមូលដ្ឋានបង្ហាញថា ត្រូវពង្រឹងការការពារសុវត្ថិភាពជូនបងប្អូនកម្មករ ទាំងនៅកន្លែងស្នាក់នៅ និងពេលធ្វើដំណើរ។ Hotline 117។»`;
      }
      if (agentCommand === '/moj') {
        return `«ផ្អែកលើច្បាប់ស្តីពីការងារឆ្នាំ ១៩៩៧ និងក្រមរដ្ឋប្បវេណី រាល់ការកេងប្រវ័ញ្ច ឬបំពានកិច្ចសន្យាការងារត្រូវតែការពារសិទ្ធិស្របច្បាប់របស់កម្មករ និងចាត់វិធានការតាមផ្លូវតុលាការជាបន្ទាន់។»`;
      }
      if (agentCommand === '/acu') {
        return `«ក្រុមការងារឃ្លាំមើលនឹងតាមដានយ៉ាងម៉ឺងម៉ាត់ ដើម្បីធានាថាមិនមានការឃុបឃិតស៊ីសំណូកបិទបាំងកំហុសរោងចក្រពីសំណាក់មន្ត្រីអធិការកិច្ចឡើយ។ Hotline 1282។»`;
      }
    }

    // AGRICULTURE, RICE & FARMERS
    if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      if (agentCommand === '/maff') {
        return `«ការឃ្លាំមើលលើដីស្រែជាក់ស្តែងបង្ហាញថា ការបញ្ជូនមន្ត្រីកសិកម្មឃុំជួយបច្ចេកទេស និងការទប់ស្កាត់ជី-ថ្នាំកសិកម្មក្លែងក្លាយ គឺជាអាទិភាពបន្ទាន់សម្រាប់កសិករ។ Hotline 1289។»`;
      }
      if (agentCommand === '/moc') {
        return `«យល់ស្របជាមួយវិស័យកសិកម្ម។ តាមការតាមដានទីផ្សារ ការសហការជាមួយ CRF ទិញស្រូវស្តុកទុកក្នុងតម្លៃគោលសមរម្យ នឹងជួយទប់ស្កាត់ការទម្លាក់ថ្លៃពីឈ្មួញកណ្តាល។»`;
      }
      if (agentCommand === '/mowram') {
        return `«ការចុះត្រួតពិនិត្យប្រព័ន្ធធារាសាស្ត្របង្ហាញថា ត្រូវត្រៀមម៉ាស៊ីនបូមទឹក និងបើកទ្វារទឹក ២៤/៧ អន្តរាគមន៍ស្រោចស្រពស្រែប្រាំងជូនកសិករឱ្យទាន់ពេលវេលា។»`;
      }
      if (agentCommand === '/mef') {
        return `«ការតាមដានឥណទានកសិកម្មបញ្ជាក់ថា ARDB ត្រូវបញ្ចេញកញ្ចប់កម្ចីការប្រាក់ទាបទាន់ពេល ជូនរោងម៉ាស៊ីនកិនស្រូវ ដើម្បីប្រមូលទិញស្រូវពីកសិករ។»`;
      }
    }

    // ENVIRONMENT & FORESTRY
    if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់')) {
      if (agentCommand === '/moe') {
        return `«ការតាមដានលើដីព្រៃអភិរក្សបង្ហាញថា ត្រូវដាក់ពង្រាយការល្បាត ២៤/៧ ដើម្បីទប់ស្កាត់ការកាប់ទន្ទ្រានដីព្រៃរដ្ឋ និងកសាងសំណុំរឿងបញ្ជូនទៅតុលាការជាបន្ទាន់។»`;
      }
      if (agentCommand === '/interior') {
        return `«យល់ស្របជាមួយការការពារព្រៃឈើ។ ការឃ្លាំមើលរដ្ឋបាលដែនដីតម្រូវឱ្យចាត់វិធានការវិន័យ និងដកតំណែងភ្លាមៗចំពោះមន្ត្រីណាដែលឃុបឃិតជាមួយឈ្មួញឈើខុសច្បាប់!»`;
      }
      if (agentCommand === '/moj') {
        return `«ការតាមដាននីតិវិធីច្បាប់បញ្ជាក់ថា តំណាងអយ្យការត្រូវពន្លឿនការចោទប្រកាន់ជនកាប់ទន្ទ្រានព្រៃរដ្ឋតាមច្បាប់តំបន់ការពារធម្មជាតិ និងក្រមព្រហ្មទណ្ឌ។»`;
      }
    }

    // DEFAULT INSTITUTIONAL CONVERSATIONAL RESPONSE
    return `«ការឃ្លាំមើលជាក់ស្តែងលើករណី «${topic}» បង្ហាញថា គ្រប់អង្គភាពពាក់ព័ន្ធត្រូវសហការគ្នាយ៉ាងស្អិតរមួត និងដាក់ចេញដំណោះស្រាយចំពោះមុខជូនប្រជាពលរដ្ឋជាបន្ទាន់។ ករណីបន្ទាន់ សូមទាក់ទង ${leadDetails.hotline}។»`;
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

    // Clean agency names without any slash commands
    const participantFormattedList = participants.map(cmd => {
      try {
        const details = LiveInstitutionalFeedEngine.getInstitutionDetails(cmd);
        return details.name;
      } catch {
        return cmd.replace('/', '');
      }
    }).join(' • ');

    let summaryFindings = '';
    let specificPlan = '';

    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('គ្រោះថ្នាក់')) {
      summaryFindings = `• គ្រោះថ្នាក់ចរាចរណ៍បង្កឡើងដោយការបើកបរក្រោមឥទ្ធិពលជាតិស្រវឹងពេលយប់នៅតែជាហានិភ័យចម្បង ដែលទាមទារការរឹតបន្តឹងច្បាប់ដោយគ្មានការលើកលែង និងការកាត់ពិន្ទុបណ្ណបើកបរតាមប្រព័ន្ធឌីជីថល។`;
      specificPlan = `• **វិធានការទី ១ (ប្រតិបត្តិការចំពោះមុខ & អនុវត្តច្បាប់)** ៖ កងកម្លាំងនគរបាលជាតិ បង្កើនគោលដៅត្រួតពិនិត្យជាតិអាល់កុលពេលយប់ទូទាំងប្រទេស អនុវត្តការពិន័យអន្តរកាលតាមអនុក្រឹត្យលេខ ៣៩ និងលេខ ៤៤ អនក្រ.បក ដោយគ្មានការអន្តរាគមន៍ ឬយោគយល់ជាដាច់ខាត។\n` +
        `• **វិធានការទី ២ (វិធានការតុលាការ & ឌីជីថល)** ៖ ក្រសួងយុត្តិធម៌ ណែនាំតំណាងអយ្យការចោទប្រកាន់បទល្មើសព្រហ្មទណ្ឌចំពោះករណីស្រវឹងកម្រិតខ្ពស់ (ចាប់ពី ០,៤០mg/L) ខណៈក្រសួងសាធារណការ អនុវត្តការកាត់ពិន្ទុ និងដកហូតបណ្ណបើកបរជាបណ្តោះអាសន្នតាម App ឌីជីថល។\n` +
        `• **វិធានការទី ៣ (តម្លាភាព & សុចរិតភាពប្រតិបត្តិការ)** ៖ អង្គភាពប្រឆាំងអំពើពុករលួយ ចុះឃ្លាំមើលផ្ទាល់តាមគោលដៅ ដើម្បីទប់ស្កាត់ដាច់ខាតការទារប្រាក់ ឬស៊ីសំណូកក្រៅផ្លូវការ តាមរយៈ Hotline ១១៧ / ១២៨២។`;
    } else if (t.includes('បាតុកម្ម') || t.includes('កូដកម្ម') || t.includes('តវ៉ា')) {
      summaryFindings = `• ការជួបជុំតវ៉ា ឬកូដកម្មរបស់ប្រជាពលរដ្ឋ និងកម្មករ ដែលទាមទារឱ្យមានការសម្របសម្រួលដោយសន្តិវិធី និងការការពារសន្តិសុខ សណ្តាប់ធ្នាប់សាធារណៈ ស្របតាមច្បាប់ស្តីពីការធ្វើបាតុកម្មដោយសន្តិវិធី។`;
      specificPlan = `• **វិធានការទី ១ (សម្របសម្រួលដោយសន្តិវិធី)** ៖ ក្រសួងមហាផ្ទៃ និងរដ្ឋបាលដែនដី ចុះជួបផ្ទាល់ជាមួយតំណាងអ្នកតវ៉ា ដើម្បីសម្របសម្រួលដោះស្រាយកង្វល់ដោយសន្តិវិធី និងទប់ស្កាត់ការឆ្លៀតឱកាសកេងចំណេញ។\n` +
        `• **វិធានការទី ២ (សន្តិសុខ & សណ្តាប់ធ្នាប់)** ៖ កងកម្លាំងនគរបាលជាតិ ដាក់ពង្រាយការពារសន្តិសុខ សម្រួលចរាចរណ៍ ដោយប្រកាន់ខ្ជាប់នូវភាពអត់ធ្មត់ខ្ពស់ និងវិជ្ជាជីវៈស្របតាមច្បាប់។\n` +
        `• **វិធានការទី ៣ (ដោះស្រាយវិវាទគតិយុត្ត)** ៖ ក្រសួងការងារ និងបណ្តុះបណ្តាលវិជ្ជាជីវៈ និងក្រសួងយុត្តិធម៌ ពន្លឿនការដោះស្រាយវិវាទការងារ ឬវិវាទសិទ្ធិឱ្យបានឆាប់រហ័សផ្អែកលើច្បាប់។`;
    } else if (t.includes('ព្រំដែន') || t.includes('បង្គោល') || t.includes('ទឹកដី')) {
      summaryFindings = `• ស្ថានភាពតាមខ្សែបន្ទាត់ព្រំដែន និងការងារខណ្ឌសីមាព្រំដែន ដែលទាមទារឱ្យមានការការពារបូរណភាពទឹកដីយ៉ាងម៉ឺងម៉ាត់ រួមជាមួយការរក្សាទំនាក់ទំនងមិត្តភាព និងការទូតអន្តរជាតិ។`;
      specificPlan = `• **វិធានការទី ១ (ការពារបូរណភាពទឹកដី)** ៖ ក្រសួងការពារជាតិ និងកងយោធពលខេមរភូមិន្ទ បង្កើនការល្បាតការពារអធិបតេយ្យភាពជាតិ និងសន្តិសុខតាមខ្សែបន្ទាត់ព្រំដែន ២៤/៧។\n` +
        `• **វិធានការទី ២ (ដំណោះស្រាយការទូត & ខណ្ឌសីមា)** ៖ ក្រសួងការបរទេស និងគណៈកម្មាធិការព្រំដែនចម្រុះ បន្តចរចាដោះស្រាយបញ្ហាព្រំដែនដោយសន្តិវិធី និងផ្អែកលើច្បាប់អន្តរជាតិ។\n` +
        `• **វិធានការទី ៣ (សន្តិសុខច្រកទ្វារព្រំដែន)** ៖ ក្រសួងមហាផ្ទៃ និងនគរបាលការពារព្រំដែន សម្រួលការចេញចូល និងទប់ស្កាត់បទល្មើសឆ្លងដែនខុសច្បាប់គ្រប់ប្រភេទ។`;
    } else if (t.includes('សិទ្ធិមនុស្ស') || t.includes('យុត្តិធម៌សង្គម') || t.includes('សង្គមស៊ីវិល')) {
      summaryFindings = `• ការលើកកម្ពស់សិទ្ធិសេរីភាពជាមូលដ្ឋាន ការពង្រឹងយុត្តិធម៌សង្គម និងការបើកចំហកិច្ចសហប្រតិបត្តិការជាមួយអង្គការសង្គមស៊ីវិល ស្របតាមរដ្ឋធម្មនុញ្ញ និងលិខិតូបករណ៍អន្តរជាតិ។`;
      specificPlan = `• **វិធានការទី ១ (ការពារសិទ្ធិមនុស្ស)** ៖ គណៈកម្មាធិការសិទ្ធិមនុស្សកម្ពុជា ចុះស៊ើបអង្កេតផ្ទាល់លើរាល់ពាក្យបណ្តឹងរំលោភសិទ្ធិ និងផ្តល់ជំនួយផ្នែកច្បាប់ដល់ជនទន់ខ្សោយ និងជនក្រីក្រ។\n` +
        `• **វិធានការទី ២ (កំណែទម្រង់យុត្តិធម៌)** ៖ ក្រសួងយុត្តិធម៌ ពន្លឿនការដោះស្រាយសំណុំរឿងកកស្ទះនៅតុលាការ និងពង្រឹងភាពស្អាតស្អំ ដើម្បីធានាឱ្យពលរដ្ឋទទួលបានការជំនុំជម្រះក្តីដោយយុត្តិធម៌។\n` +
        `• **វិធានការទី ៣ (ដៃគូសង្គមស៊ីវិល)** ៖ ក្រសួងមហាផ្ទៃ បង្កើនវេទិកាពិគ្រោះយោបល់ និងភាពជាដៃគូជាមួយអង្គការមិនមែនរដ្ឋាភិបាល (NGOs) ក្នុងការអភិវឌ្ឍសហគមន៍។`;
    } else if (t.includes('ការបរទេស') || t.includes('ការទូត') || t.includes('អាស៊ាន')) {
      summaryFindings = `• ទំនាក់ទំនងការទូតពហុភាគី សេដ្ឋកិច្ចការទូត និងការទាក់ទាញវិនិយោគិនបរទេសមកកាន់កម្ពុជា ក្នុងក្របខ័ណ្ឌតំបន់អាស៊ាន និងសកលលោក។`;
      specificPlan = `• **វិធានការទី ១ (សេដ្ឋកិច្ចការទូត)** ៖ ក្រសួងការបរទេស និងស្ថានទូតកម្ពុជាប្រចាំបរទេស ជំរុញការផ្សព្វផ្សាយផលិតផលខ្មែរ និងកាលានុវត្តភាពវិនិយោគនៅកម្ពុជា។\n` +
        `• **វិធានការទី ២ (ការទូតការពារជាតិ & សន្តិសុខ)** ៖ ក្រសួងការពារជាតិ រក្សាកិច្ចសហប្រតិបត្តិការយោធា និងការផ្លាស់ប្តូរព័ត៌មានសន្តិសុខតំបន់ ដើម្បីសន្តិភាព និងស្ថិរភាព។\n` +
        `• **វិធានការទី ៣ (កិច្ចព្រមព្រៀងពាណិជ្ជកម្មសេរី)** ៖ ក្រសួងពាណិជ្ជកម្ម ទាញយកអត្ថប្រយោជន៍ជាអតិបរមាពីកិច្ចព្រមព្រៀង RCEP និង CCFTA ដើម្បីពង្រីកការនាំចេញ។`;
    } else if (t.includes('ធនាគារ') || t.includes('ហិរញ្ញវត្ថុ') || t.includes('បាគង') || t.includes('លាងលុយ')) {
      summaryFindings = `• ស្ថិរភាពរូបិយវត្ថុជាតិ ការលើកកម្ពស់ការប្រើប្រាស់ប្រាក់រៀល និងការទប់ស្កាត់ការលាងលុយកខ្វក់ និងហិរញ្ញប្បទានភេរវកម្មតាមប្រព័ន្ធធនាគារ។`;
      specificPlan = `• **វិធានការទី ១ (ស្ថិរភាពហិរញ្ញវត្ថុ & ប្រាក់រៀល)** ៖ ធនាគារជាតិនៃកម្ពុជា រក្សាស្ថិរភាពអត្រាប្តូរប្រាក់ ពង្រីកប្រព័ន្ធទូទាត់បាគង (Bakong) និងលើកទឹកចិត្តការប្រើប្រាស់ប្រាក់រៀល។\n` +
        `• **វិធានការទី ២ (ទប់ស្កាត់ការលាងលុយ)** ៖ ធនាគារជាតិ និងក្រសួងយុត្តិធម៌ បង្កកគណនី និងស៊ើបអង្កេតប្រតិបត្តិការហិរញ្ញវត្ថុគួរឱ្យសង្ស័យ ស្របតាមស្តង់ដារអន្តរជាតិ FATF។\n` +
        `• **វិធានការទី ៣ (តម្លាភាពពន្ធដារ)** ៖ ក្រសួងសេដ្ឋកិច្ច និងអគ្គនាយកដ្ឋានពន្ធដារ ត្រួតពិនិត្យការអនុលោមភាពពន្ធដារ និងទប់ស្កាត់ការគេចវេះពន្ធក្នុងវិស័យហិរញ្ញវត្ថុ។`;
    } else if (t.includes('ឆបោក') || t.includes('អនឡាញ')) {
      summaryFindings = `• បណ្តាញឧក្រិដ្ឋកម្មឆបោកអនឡាញ (Online Scams) និងការលាងលុយកខ្វក់ បានបង្កផលប៉ះពាល់ធ្ងន់ធ្ងរដល់សន្តិសុខសង្គម និងសេដ្ឋកិច្ចជាតិ ដែលតម្រូវឱ្យមានកិច្ចអន្តរាគមន៍ចម្រុះភ្លាមៗ។`;
      specificPlan = `• **វិធានការទី ១ (ប្រតិបត្តិការបង្ក្រាបក្តៅ)** ៖ កងកម្លាំងនគរបាលជាតិ សហការបើកប្រតិបត្តិការស្រាវជ្រាវ និងឆ្មក់បង្ក្រាបមជ្ឈមណ្ឌលឆបោកបច្ចេកវិទ្យា ចាប់ខ្លួនមេក្លោង និងរឹបអូសភស្តុតាងបញ្ជូនទៅតុលាការផ្តន្ទាទោសជាអតិបរមា។\n` +
        `• **វិធានការទី ២ (បច្ចេកវិទ្យា & បង្កកហិរញ្ញវត្ថុ)** ៖ ក្រសួងប្រៃសណីយ៍ បិទខ្ទប់ Domain និង IP ឆបោកភ្លាមៗ ព្រមទាំងសហការជាមួយធនាគារជាតិនៃកម្ពុជា បង្កកគណនីធនាគារលាងលុយកខ្វក់ទាំងអស់។\n` +
        `• **វិធានការទី ៣ (នីតិវិធីតុលាការ & ការពារពលរដ្ឋ)** ៖ ក្រសួងយុត្តិធម៌ ពន្លឿនការចោទប្រកាន់តាមក្រមព្រហ្មទណ្ឌមាត្រា ៣៧៧ និងច្បាប់ស្តីពីការប្រឆាំងការសម្អាតប្រាក់ ព្រមទាំងបើកទទួលពាក្យបណ្តឹងតាម Hotline ១២៣។`;
    } else if (t.includes('ដីធ្លី') || t.includes('ប្លង់')) {
      summaryFindings = `• វិវាទដីធ្លីនៅមូលដ្ឋានទាមទារការចុះសម្របសម្រួលដោះស្រាយក្រៅប្រព័ន្ធតុលាការយ៉ាងលឿនរហ័ស ផ្អែកលើប្រវត្តិដីជាក់ស្តែង ការពន្លឿនចេញប្លង់រឹងជាប្រព័ន្ធ និងការទប់ស្កាត់ការទន្ទ្រានដីរដ្ឋ។`;
      specificPlan = `• **វិធានការទី ១ (ពន្លឿនការចេញប្លង់រឹង)** ៖ ក្រសួងរៀបចំដែនដី ជំរុញយុទ្ធនាការចុះបញ្ជីដីធ្លីមានលក្ខណៈជាប្រព័ន្ធ (LMAP) ចេញប្លង់រឹងជូនប្រជាពលរដ្ឋឱ្យបាន ១០០% ប្រកបដោយតម្លាភាព និងភាពត្រឹមត្រូវ។\n` +
        `• **វិធានការទី ២ (សម្របសម្រួលវិវាទក្រៅប្រព័ន្ធតុលាការ)** ៖ គណៈកម្មការសុរិយោដី និងក្រសួងមហាផ្ទៃ ដឹកនាំសម្របសម្រួលដោះស្រាយវិវាទដីធ្លីជូនពលរដ្ឋនៅមូលដ្ឋានផ្ទាល់ ដោយផ្អែកលើច្បាប់ភូមិបាលឆ្នាំ ២០០១ ការពារដាច់ខាតសិទ្ធិស្របច្បាប់របស់អ្នកទន់ខ្សោយ។\n` +
        `• **វិធានការទី ៣ (ចំណាត់ការច្បាប់ចំពោះការទន្ទ្រាន)** ៖ ក្រសួងយុត្តិធម៌ និង អង្គភាពប្រឆាំងអំពើពុករលួយ ចាត់វិធានការក្តៅចំពោះការទន្ទ្រានកាន់កាប់ដីសាធារណៈរបស់រដ្ឋ និងដកហូតតំណែងមន្ត្រីណាដែលឃុបឃិតស៊ីញ៉េផ្ទេរសិទ្ធិដីខុសច្បាប់។`;
    } else if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('ធុរកិច្ច') || t.includes('វិនិយោគ') || t.includes('សេដ្ឋកិច្ច')) {
      summaryFindings = `• ភាពចាំបាច់ក្នុងការធ្វើបរិវត្តកម្មឌីជីថលលើប្រព័ន្ធពន្ធដារ និងគយ ដើម្បីសម្រួលដល់ការចុះបញ្ជីធុរកិច្ចថ្មី (Startups) និងសហគ្រាសធុនតូច-មធ្យម (SME) តាមយុទ្ធសាស្ត្របញ្ចកោណ-ដំណាក់កាលទី១។`;
      specificPlan = `• **វិធានការទី ១ (លើកទឹកចិត្តធុរកិច្ចថ្មី & SME)** ៖ ក្រសួងសេដ្ឋកិច្ច អនុវត្តការលើកលែងពន្ធប្រចាំខែ និងពន្ធលើប្រាក់ចំណូលពី ២ ទៅ ៥ ឆ្នាំ ចំពោះ Startups និង SME ដែលចុះបញ្ជីស្របច្បាប់តាមថ្នាល CamDX។\n` +
        `• **វិធានការទី ២ (ឌីជីថលូបនីយកម្មពន្ធដារ & គយ)** ៖ អគ្គនាយកដ្ឋានពន្ធដារ ពង្រឹងការប្រើប្រាស់ GDT E-Filing និងអគ្គនាយកដ្ឋានគយ ពង្រឹងប្រព័ន្ធបញ្ជរតែមួយជាតិ (NSW) ដើម្បីលុបបំបាត់ការចំណាយក្រៅផ្លូវការទាំងស្រុង។\n` +
        `• **វិធានការទី ៣ (សម្រួលបរិយាកាសវិនិយោគ)** ៖ ក្រសួងពាណិជ្ជកម្ម ពន្លឿនការចុះបញ្ជីពាណិជ្ជកម្មត្រឹម ៣ ថ្ងៃ និងបើកទូលាយការប្រឹក្សាពន្ធដារឥតគិតថ្លៃតាម Hotline ១១៨៨ និង ១២០៩។`;
    } else if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល')) {
      summaryFindings = `• បញ្ហាប្រឈមនៃជីវភាពរបស់បងប្អូនកម្មករ-និយោជិត ការទាមទារឱ្យមានការអនុវត្តប្រាក់ឈ្នួលអប្បបរមា ២០៨ ដុល្លារ/ខែ ឱ្យបានត្រឹមត្រូវទៀងទាត់ និងការធានាអត្ថប្រយោជន៍របបសន្តិសុខសង្គម (ប.ស.ស.) ពេញលេញ។`;
      specificPlan = `• **វិធានការទី ១ (អធិការកិច្ចការងារ & ប្រាក់ឈ្នួល)** ៖ ក្រសួងការងារ និងបណ្តុះបណ្តាលវិជ្ជាជីវៈ ចុះអធិការកិច្ចការងារយ៉ាងម៉ឺងម៉ាត់នៅគ្រប់រោងចក្រ-សហគ្រាស ធានាការបើកប្រាក់ឈ្នួលអប្បបរមា ២០៨ ដុល្លារ/ខែ ទៀងទាត់ និងប្រាក់បំណាច់អតីតភាពការងារ។\n` +
        `• **វិធានការទី ២ (យន្តការដោះស្រាយវិវាទការងារ)** ៖ ពន្លឿនការដោះស្រាយវិវាទការងាររួមតាមយន្តការក្រុមប្រឹក្សាអាជ្ញាកណ្តាល និងក្រសួងយុត្តិធម៌ ដើម្បីការពារសិទ្ធិស្របច្បាប់របស់កម្មករ និងនិយោជក ផ្អែកលើច្បាប់ស្តីពីការងារឆ្នាំ ១៩៩៧។\n` +
        `• **វិធានការទី ៣ (តម្លាភាព & សន្តិសុខកម្មករ)** ៖ អង្គភាពប្រឆាំងអំពើពុករលួយ សហការជាមួយក្រសួងមហាផ្ទៃ ឃ្លាំមើលការការពារសន្តិសុខ និងទប់ស្កាត់ការឃុបឃិតស៊ីសំណូកបិទបាំងការកេងប្រវ័ញ្ចកម្មករ តាម Hotline ១២៩៧ / ១២៨២។`;
    } else if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      summaryFindings = `• ហានិភ័យនៃការធ្លាក់ចុះថ្លៃកសិផល និងបញ្ហាជី-ថ្នាំកសិកម្មក្លែងក្លាយ ដែលទាមទារការអន្តរាគមន៍រក្សាស្ថិរភាពថ្លៃស្រូវ និងការគាំទ្របច្ចេកទេសផ្ទាល់ដីជូនកសិករ។`;
      specificPlan = `• **វិធានការទី ១ (រក្សាស្ថិរភាពតម្លៃកសិផល)** ៖ ក្រសួងសេដ្ឋកិច្ច បញ្ចេញកញ្ចប់ឥណទានពិសេសតាមរយៈធនាគារ ARDB ជូនរោងម៉ាស៊ីនកិនស្រូវ ដើម្បីទិញស្រូវពីកសិករតាមតម្លៃគោលសមរម្យ មិនឱ្យឈ្មួញកណ្តាលទម្លាក់ថ្លៃ។\n` +
        `• **វិធានការទី ២ (បច្ចេកទេស & ប្រព័ន្ធទឹកស្រោចស្រព)** ៖ ក្រសួងកសិកម្ម បញ្ជូនមន្ត្រីកសិកម្មឃុំចុះជួយបច្ចេកទេសផ្ទាល់ និងក្រសួងធនធានទឹក ត្រៀមម៉ាស៊ីនបូមទឹក និងបើកទ្វារទឹកស្រោចស្រព ២៤/៧។\n` +
        `• **វិធានការទី ៣ (ទប់ស្កាត់ជី-ថ្នាំក្លែងក្លាយ)** ៖ ក្រសួងពាណិជ្ជកម្ម និងអាជ្ញាធរមានសមត្ថកិច្ច ចុះត្រួតពិនិត្យនិងបង្ក្រាបការនាំចូល និងចែកចាយជីគីមី-ថ្នាំកសិកម្មក្លែងក្លាយជាបន្ទាន់។`;
    } else if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់')) {
      summaryFindings = `• បទល្មើសកាប់បំផ្លាញ និងទន្ទ្រានដីព្រៃអភិរក្សរបស់រដ្ឋ ដែលតម្រូវឱ្យមានកិច្ចអន្តរាគមន៍កងកម្លាំងចម្រុះចុះល្បាត ២៤/៧ និងការកសាងសំណុំរឿងបញ្ជូនទៅតុលាការផ្តន្ទាទោសជាអតិបរមា។`;
      specificPlan = `• **វិធានការទី ១ (ល្បាតចម្រុះការពារព្រៃឈើ)** ៖ ក្រសួងបរិស្ថាន ដាក់ពង្រាយកម្លាំងឧទ្យានុរក្សសហការជាមួយកងកម្លាំងនគរបាលជាតិ ចុះល្បាត ២៤/៧ ទប់ស្កាត់បទល្មើសធនធានធម្មជាតិគ្រប់រូបភាព។\n` +
        `• **វិធានការទី ២ (ចំណាត់ការច្បាប់តឹងរ៉ឹង)** ៖ ក្រសួងយុត្តិធម៌ ណែនាំអយ្យការឱ្យពន្លឿនការចោទប្រកាន់ និងកាត់ទោសជនល្មើសឧក្រិដ្ឋកម្មព្រៃឈើតាមច្បាប់តំបន់ការពារធម្មជាតិ និងក្រមព្រហ្មទណ្ឌ ដោយគ្មានការបន្ធូរបន្ថយ។\n` +
        `• **វិធានការទី ៣ (ទប់ស្កាត់អំពើពុករលួយ)** ៖ អង្គភាពប្រឆាំងអំពើពុករលួយ បើកការស៊ើបអង្កេតចំពោះមន្ត្រីមូលដ្ឋាន ឬសមត្ថកិច្ចណាដែលបើកដៃ ឬឃុបឃិតជាមួយឈ្មួញទន្ទ្រានដីព្រៃរដ្ឋ។`;
    } else if (t.includes('ពុករលួយ') || t.includes('ច្រកចេញចូលតែមួយ') || t.includes('សំណូក')) {
      summaryFindings = `• ភាពមិនប្រក្រតី និងការទារកម្រៃក្រៅផ្លូវការនៅការិយាល័យច្រកចេញចូលតែមួយ (OWSO) ដែលធ្វើឱ្យប៉ះពាល់ដល់ទំនុកចិត្តរបស់ប្រជាពលរដ្ឋលើការផ្តល់សេវាសាធារណៈ។`;
      specificPlan = `• **វិធានការទី ១ (ត្រួតពិនិត្យ & បិទផ្សាយតម្លៃសេវា)** ៖ ក្រសួងមហាផ្ទៃ ណែនាំរដ្ឋបាលថ្នាក់ក្រោមជាតិទាំងអស់ បិទផ្សាយតារាងតម្លៃសេវា និងកាលកំណត់ជាសាធារណៈនៅមុខ OWSO និងបំពាក់កាមេរ៉ាសុវត្ថិភាពឃ្លាំមើល ២៤/៧។\n` +
        `• **វិធានការទី ២ (អធិការកិច្ចសម្ងាត់ & ចាប់ខ្លួន)** ៖ អង្គភាពប្រឆាំងអំពើពុករលួយ ចុះធ្វើអធិការកិច្ចសម្ងាត់ (Mystery Audits) និងចាត់វិធានការច្បាប់ភ្លាមៗចំពោះមន្ត្រីទារប្រាក់កាហ្វេ តាមមាត្រា ៣២ នៃច្បាប់ប្រឆាំងអំពើពុករលួយ។\n` +
        `• **វិធានការទី ៣ (ជំនុំជម្រះក្តីជាសាធារណៈ)** ៖ ក្រសួងយុត្តិធម៌ ពន្លឿនការស៊ើបអង្កេត និងជំនុំជម្រះក្តីជាសាធារណៈលើរាល់បទល្មើសពុករលួយរដ្ឋបាលសាធារណៈ ដោយធានាតម្លាភាពដាច់ខាត។`;
    } else if (t.includes('អប់រំ') || t.includes('បាក់ឌុប') || t.includes('សាលា') || t.includes('tvet')) {
      summaryFindings = `• ការពង្រឹងគុណភាពអប់រំ តម្លាភាពនៃការប្រឡងបាក់ឌុប និងការជំរុញកម្មវិធីបណ្តុះបណ្តាលជំនាញវិជ្ជាជីវៈ និងបច្ចេកទេស (TVET) ១.៥លាននាក់។`;
      specificPlan = `• **វិធានការទី ១ (គុណភាព & តម្លាភាពប្រឡង)** ៖ ក្រសួងអប់រំ យុវជន និងកីឡា រៀបចំការប្រឡងបាក់ឌុបក្រោមគោលការណ៍ «អ្នកចេះជាប់» ដោយមានការចូលរួមសង្កេតការណ៍ពី ACU។\n` +
        `• **វិធានការទី ២ (ជំនាញបច្ចេកទេស TVET)** ៖ ក្រសួងការងារ និងបណ្តុះបណ្តាលវិជ្ជាជីវៈ ពន្លឿនការចុះឈ្មោះយុវជនមកពីគ្រួសារក្រីក្រចូលរៀនជំនាញវិជ្ជាជីវៈឥតគិតថ្លៃ និងទទួលបានប្រាក់ឧបត្ថម្ភ។\n` +
        `• **វិធានការទី ៣ (សុវត្ថិភាពសាលារៀន)** ៖ ក្រសួងមហាផ្ទៃ និងនគរបាលមូលដ្ឋាន លុបបំបាត់ការចែកចាយគ្រឿងញៀន និងល្បែងស៊ីសងនៅជុំវិញបរិវេណសាលារៀន។`;
    } else if (t.includes('សុខាភិបាល') || t.includes('ពេទ្យ') || t.includes('ថ្នាំ') || t.includes('ប.ស.ស.')) {
      summaryFindings = `• ការពង្រីកសេវាថែទាំសុខភាពជាសកល ការធានាគុណភាពព្យាបាលនៅតាមមន្ទីរពេទ្យបង្អែករដ្ឋ និងការទប់ស្កាត់ឱសថ និងគ្លីនិកគ្មានច្បាប់អនុញ្ញាត។`;
      specificPlan = `• **វិធានការទី ១ (សេវាសុខាភិបាលសាធារណៈ)** ៖ ក្រសួងសុខាភិបាល ពង្រឹងសមត្ថភាពគ្រូពេទ្យ បំពាក់ឧបករណ៍វេជ្ជសាស្ត្រ និងលើកកម្ពស់ក្រមសីលធម៌វិជ្ជាជីវៈនៅគ្រប់មន្ទីរពេទ្យរដ្ឋ។\n` +
        `• **វិធានការទី ២ (បង្ក្រាបឱសថក្លែងក្លាយ)** ៖ ក្រសួងសុខាភិបាល សហការជាមួយនគរបាលជាតិ ចុះត្រួតពិនិត្យ និងបិទឱសថស្ថាន ឬគ្លីនិកខុសច្បាប់ និងរឹបអូសឱសថអន់គុណភាព។\n` +
        `• **វិធានការទី ៣ (កិច្ចការពារអ្នកជំងឺ)** ៖ ក្រសួងយុត្តិធម៌ ចាត់វិធានការច្បាប់ចំពោះការធ្វេសប្រហែសផ្នែកវេជ្ជសាស្ត្រដែលបណ្តាលឱ្យប៉ះពាល់ដល់អាយុជីវិតអ្នកជំងឺ។`;
    } else {
      summaryFindings = `• បញ្ហាប្រឈមជាក់ស្តែងចំពោះមុខទាមទារឱ្យមានការសម្របសម្រួលអន្តរស្ថាប័នជាបន្ទាន់ ដើម្បីការពារសន្តិសុខ សណ្តាប់ធ្នាប់សាធារណៈ និងផលប្រយោជន៍ស្របច្បាប់របស់ប្រជាពលរដ្ឋ។`;
      specificPlan = `• **វិធានការទី ១ (អន្តរាគមន៍ចំពោះមុខ)** ៖ ចុះអន្តរាគមន៍ដោះស្រាយផ្ទាល់នៅមូលដ្ឋាន ដើម្បីធានាសុវត្ថិភាព និងយុត្តិធម៌ជូនប្រជាពលរដ្ឋជាបន្ទាន់។\n` +
        `• **វិធានការទី ២ (ការអនុវត្តច្បាប់)** ៖ អនុវត្តច្បាប់ឱ្យបានម៉ឺងម៉ាត់បំផុត គ្មានការយោគយល់ ឬអន្តរាគមន៍ចំពោះជនប្រព្រឹត្តល្មើសឡើយ។\n` +
        `• **វិធានការទី ៣ (តម្លាភាព & ការរាយការណ៍)** ៖ ធានាតម្លាភាព ១០០% និងបើកចំហរាយការណ៍វឌ្ឍនភាពជូនប្រមុខដឹកនាំជាប្រចាំ។`;
    }

    // Strictly strip any remaining (/cmd) command identifiers from report text
    specificPlan = specificPlan.replace(/\s*\(\/[a-zA-Z0-9_-]+\)/g, '');

    return `**AGI AGENTS របាយការណ៍ពី AI**\n` +
      `══════════════\n` +
      `📅 **កាលបរិច្ឆេទ ៖** ${dateKhmer}\n` +
      `📌 **កម្មវត្ថុ ៖** របាយការណ៍ស្តីពីលទ្ធផលនៃការបើកកិច្ចប្រជុំដេញដោលបន្ទាន់ និងផែនការសកម្មភាពចំពោះមុខលើប្រធានបទ «**${topic}**»\n` +
      `🏛️ **ស្ថាប័នចូលរួមប្រតិបត្តិការ ៖** ${participantFormattedList}\n\n` +
      `**I. ស្ថានភាពចំពោះមុខ & ការរកឃើញគន្លឹះ (Key Operational Findings) ៖**\n` +
      `${summaryFindings}\n\n` +
      `**II. ផែនការសកម្មភាពអន្តរស្ថាប័នជាយុទ្ធសាស្ត្រ (Inter-Institutional Strategic Action Plans) ៖**\n` +
      `${specificPlan}\n\n` +
      `**III. យោបល់គោរពស្នើសុំការសម្រេច (Recommendation for Leadership Review) ៖**\n` +
      `• គោរពស្នើសុំ **ប្រមុខដឹកនាំកំពូល (Super Admin & Leadership)** មេត្តាពិនិត្យ និងផ្តល់ការណែនាំបន្ថែម ដើម្បីជាត្រីវិស័យដល់គ្រប់អង្គភាពឃ្លាំមើលស្ថាប័នទាំងអស់អនុវត្តឱ្យមានប្រសិទ្ធភាពខ្ពស់បំផុត។\n` +
      `• គ្រប់តុឃ្លាំមើលស្ថាប័នទាំងអស់ត្រៀមលក្ខណៈ ២៤/៧ ក្នុងការចុះតាមដានជាក់ស្តែង និងរាយការណ៍វឌ្ឍនភាពជូនប្រមុខដឹកនាំជាប្រចាំ។\n\n` +
      `*(កំណត់ហេតុពិភាក្សាដេញដោលលម្អិត និងភស្តុតាងជាក់ស្តែងទាំងអស់ត្រូវបានកត់ត្រាក្នុងប្រព័ន្ធ Sovereign Cryptographic Ledger ២៤/៧)* ៕`;
  }

  private static selectParticipatingAgents(category: string, topic: string): string[] {
    const t = topic.toLowerCase();

    // 1. Protests, Strikes & Public Assembly
    if (t.includes('បាតុកម្ម') || t.includes('កូដកម្ម') || t.includes('តវ៉ា') || t.includes('ការជួបជុំ')) {
      return ['/interior', '/police', '/mlvt', '/moj'];
    }

    // 2. Factory Workers, Labor Rights & Minimum Wage
    if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល') || t.includes('សហជីព')) {
      return ['/mlvt', '/interior', '/moj', '/acu'];
    }

    // 3. Traffic Safety, Drunk Driving & Accidents
    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('បុក') || t.includes('គ្រោះថ្នាក់') || category === 'TRAFFIC_SAFETY') {
      return ['/police', '/mpwt', '/moj', '/acu'];
    }

    // 4. Border Disputes, Border Demarcation & Sovereignty
    if (t.includes('ព្រំដែន') || t.includes('បង្គោល') || t.includes('ទឹកដី') || t.includes('អធិបតេយ្យ') || t.includes('បូរណភាព')) {
      return ['/mod', '/mfaic', '/interior', '/police'];
    }

    // 5. Foreign Affairs, Diplomacy & International Relations
    if (t.includes('ការបរទេស') || t.includes('ការទូត') || t.includes('អាស៊ាន') || t.includes('អន្តរជាតិ') || t.includes('ទ្វេភាគី')) {
      return ['/mfaic', '/ocm', '/moc', '/mod'];
    }

    // 6. Human Rights, Social Justice & Civil Society
    if (t.includes('សិទ្ធិមនុស្ស') || t.includes('យុត្តិធម៌សង្គម') || t.includes('សង្គមស៊ីវិល') || t.includes('អយុត្តិធម៌')) {
      return ['/chrc', '/moj', '/interior', '/acu'];
    }

    // 7. Finance, Banking, Currency & Money Laundering
    if (t.includes('ធនាគារ') || t.includes('ហិរញ្ញវត្ថុ') || t.includes('បាគង') || t.includes('ប្រាក់រៀល') || t.includes('លាងលុយ')) {
      return ['/nbc', '/mef', '/tax', '/moj'];
    }

    // 8. Cyber Fraud, Online Scams & Illegal Gambling
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      return ['/mptc', '/police', '/moj', '/acu'];
    }

    // 9. Land Disputes, Property Rights & Systemic Titling
    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      return ['/mlmupc', '/moj', '/interior', '/acu'];
    }

    // 10. Agriculture, Paddy Rice, Farmers & Fertilizers
    if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      return ['/maff', '/moc', '/mowram', '/mef'];
    }

    // 11. Environment, Forestry, Plastic & Natural Resources
    if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់') || t.includes('ប្លាស្ទិក')) {
      return ['/moe', '/interior', '/moj', '/acu'];
    }

    // 12. Anti-Corruption, Nepotism & One Window Service (OWSO)
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM' || t.includes('ច្រកចេញចូលតែមួយ') || t.includes('owso')) {
      return ['/acu', '/interior', '/moj'];
    }

    // 13. Taxes, Customs, Trade & SME Startups
    if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('សេដ្ឋកិច្ច') || t.includes('ធុរកិច្ច') || t.includes('ពាណិជ្ជកម្ម') || t.includes('វិនិយោគ')) {
      return ['/mef', '/tax', '/customs', '/moc'];
    }

    // 14. Public Health, Hospitals & NSSF
    if (t.includes('សុខាភិបាល') || t.includes('ពេទ្យ') || t.includes('ថ្នាំ') || t.includes('ប.ស.ស.') || t.includes('ជំងឺ')) {
      return ['/moh', '/interior', '/moj'];
    }

    // 15. Education, National Exams & Vocational Training (TVET)
    if (t.includes('អប់រំ') || t.includes('សាលា') || t.includes('គ្រូ') || t.includes('ប្រឡង') || t.includes('បាក់ឌុប') || t.includes('tvet')) {
      return ['/moeys', '/mlvt', '/interior', '/acu'];
    }

    // 16. Tourism, Culture, Hospitality & Heritage
    if (t.includes('ទេសចរណ៍') || t.includes('អង្គរ') || t.includes('វប្បធម៌') || t.includes('សណ្ឋាគារ')) {
      return ['/mot', '/moca', '/interior'];
    }

    // 17. Energy, Electricity, Mining & Petroleum
    if (t.includes('អគ្គិសនី') || t.includes('ថាមពល') || t.includes('រ៉ែ') || t.includes('ប្រេង')) {
      return ['/mme', '/mef', '/interior'];
    }

    // 18. Water Resources, Drought & Irrigation Canals
    if (t.includes('ទឹក') || t.includes('ប្រឡាយ') || t.includes('ទំនប់') || t.includes('រាំងស្ងួត')) {
      return ['/mowram', '/maff', '/interior'];
    }

    // 19. Phnom Penh Capital Hall, Urban Floods & Drainage
    if (t.includes('ភ្នំពេញ') || t.includes('ទីក្រុង') || t.includes('លូ') || t.includes('សំរាម')) {
      return ['/phnompenh', '/interior', '/mpwt'];
    }

    return ['/interior', '/moj', '/acu'];
  }
}
