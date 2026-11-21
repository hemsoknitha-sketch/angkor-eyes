import { db } from '../db/index.js';
import { CambodiaSocialDebateRadar } from './social-debate-radar.js';
import { LiveInstitutionalFeedEngine } from './live-feed-engine.js';
import { khmerLegalEngine } from './legal-engine.js';
import { KhmerLanguageAuditor } from './khmer-auditor.js';
import { HttpApiServer } from '../api/http-api.js';
import { LLMGateway } from '../llm/gateway.js';
import { DailyMasterReportEngine } from './daily-master-report-engine.js';

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
  private static readonly ALL_INSTITUTIONAL_AGENTS: string[] = [
    // Supreme Institutions (5)
    '/senate', '/nac', '/ocm', '/primeminister', '/ccc',
    // Line Ministries (28)
    '/interior', '/mod', '/mfaic', '/mef', '/maff', '/mrd', '/moc', '/misti', '/mme', '/mop',
    '/moeys', '/mosvy', '/mlmupc', '/moe', '/mowram', '/information', '/moj', '/mi', '/mptc',
    '/moh', '/mpwt', '/mcfa', '/mot', '/mocar', '/mowa', '/mlvt', '/mcs', '/ssca',
    // Special Authorities & Departments (11)
    '/police', '/immigration', '/gdi', '/tax', '/customs', '/nbc', '/cdc', '/acu', '/nssf', '/grk', '/chrc',
    // Key Capitals, Provinces & Municipalities (26)
    '/phnompenh', '/police_phnompenh', '/kandal', '/takeo', '/kampot', '/kep', '/preahsihanouk',
    '/kohkong', '/siemreap', '/battambang', '/kampongcham', '/kampongspeu', '/kampongchhnang',
    '/kampongthom', '/kratie', '/tboungkhmum', '/banteaymeanchey', '/pailin', '/pursat',
    '/preahvihear', '/preyveng', '/mondulkiri', '/ratanakiri', '/stungtreng', '/svayrieng', '/oddarmeanchey',
    // Municipal Desks (5)
    '/krong_takhmau', '/krong_siemreap', '/krong_poipet', '/krong_bavet', '/khan_daunpenh'
  ];

  /**
   * Conducts an automated, real-time, multi-agent conversational debate across 50+ watchdog desks
   * on any breaking or hot topic in Cambodia with direct cross-agent replies.
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

    // 2. Select over 50+ specialized agents for this domain (52 agents)
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
    const scanIntro = `«ម៉ាស៊ីនស្គែនមេ ANGKOR EYES បានកោះប្រជុំពិភាក្សាលើប្រធានបទ ៖ «${topic}»។ សូមអ្នកឃ្លាំមើលស្ថាប័នពាក់ព័ន្ធទាំង ៥០+ ចាប់ផ្តើមស្រាវជ្រាវ ជជីកកំណត់បញ្ហា និងដំណោះស្រាយជាក់ស្តែង!»`;
    await recordStatement('/angkor-eyes', 'ANGKOR EYES Sovereign Master Scanner', 'ម៉ាស៊ីនស្គែនមេ និងសម្របសម្រួលប្រព័ន្ធ AGI ៧៨ ស្ថាប័ន', scanIntro, false);

    // Step 2: Sequential Multi-Turn Conversational Dialogue across 50+ Watchdog Desks
    for (let i = 0; i < participants.length; i++) {
      if (onStatement) {
        await new Promise(r => setTimeout(r, 200)); // Natural fluid pacing
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

    // Step 3: Record this high-level deliberation into Daily Master Report Ledger
    // Per user directive: No single-topic report cards; master report is sent daily at 5:00 PM!
    DailyMasterReportEngine.recordDebateSession({
      topic,
      category,
      initiatedBy,
      participatingAgentsCount: participants.length
    });

    const sessionCloseText = `«ម៉ាស៊ីនស្គែនមេ ANGKOR EYES បានកត់ត្រារាល់ធាតុចូល ភស្តុតាង និងដំណោះស្រាយពីអ្នកឃ្លាំមើលទាំង ៥០+ ស្ថាប័នចូលក្នុងសៀវភៅកំណត់ហេតុប្រចាំថ្ងៃរួចរាល់ ដើម្បីចងក្រងជារបាយការណ៍សរុបផ្លូវការផ្ញើជូនប្រមុខដឹកនាំកំពូលនៅម៉ោង ៥:០០ ល្ងាច ៕»`;
    await recordStatement('/angkor-eyes', 'ANGKOR EYES Sovereign Master Scanner', 'កំណត់ត្រា និងការបូកសរុបកិច្ចពិភាក្សាដេញដោល', sessionCloseText, false);

    // Format Full Telegram Digest
    let tgDigest = `🇰🇭 **កិច្ចពិភាក្សាដេញដោលអន្តរស្ថាប័ន AGI (Live Deliberation — ៥០+ ស្ថាប័ន)**\n\n` +
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
      jointResolution: sessionCloseText,
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

    // Strip ALL repetitive hotline numbers or contact phone spam as commanded by user
    cleaned = cleaned.replace(/\s*(Hotline|ទូរស័ព្ទទាន់ហេតុការណ៍|រាយការណ៍តាមរយៈ|ទាក់ទង)\s*[:៖]?\s*[\d\s\/\-—|]+/gi, '').trim();

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

    // Identify previous speaker to directly address and reply to
    const prevStatement = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1] : null;
    const prevCmd = prevStatement?.agentCommand || '/angkor-eyes';

    // 1. Try real-time LLM dynamic response first (Direct Cross-Agent Reply, Zero Hotlines)
    try {
      const prompt = `You are ${agentCommand} (${agentName}) participating in an independent civic monitoring deliberation in Cambodia.
Role: Independent Institutional Watchdog & Research Analyst (អ្នកឃ្លាំមើលស្ថាប័នឯករាជ្យ).
Hot topic: "${topic}".
Previous speaker was: ${prevCmd} (${prevStatement?.agentName || 'Master Scanner'}) who stated: "${prevStatement?.statement || ''}".

CRITICAL INSTRUCTIONS:
1. DIRECT REPLY: Explicitly anchor your response to the topic AND directly reply to or build upon ${prevCmd} (e.g. "ឆ្លើយតបទៅនឹង ${prevCmd}...", "យល់ស្របជាមួយ ${prevCmd} ប៉ុន្តែ...").
2. HIGH-VALUE OFFICIAL SUBSTANCE: Speak strictly within your institutional expertise and geographic jurisdiction (${leadDetails.mandate}). Provide concrete facts, laws, engineering or administrative steps.
3. STRICT PROHIBITION ON COPY-PASTE & CANNED FLUFF: NEVER copy-paste generic statements, and NEVER mention topics unrelated to "${topic}".
4. STRICT PROHIBITION ON HOTLINES & PHONE NUMBERS: DO NOT include any phone numbers or hotlines (e.g. NO "Hotline 1282", NO "Hotline 117")!
5. INDEPENDENT IDENTITY: Never claim to be a government spokesperson or representative ("មិនមែនតំណាង"). No real politician names or royal titles.
6. CONCISE: 1 to 2 sharp, professional sentences in flawless Khmer, ending with "។".`;

      const llmRes = await LLMGateway.generateResponse({
        messages: [
          { role: 'system', content: `You are an independent institutional watchdog desk analyst for ${agentName} (${agentCommand}) in Cambodia. You analyze policies and ground facts objectively, constructively, and independently. You directly reply to prior agents by their slash command without copying generic text, and you never output phone numbers or hotlines.` },
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

    // 2. High-Precision Domain-Specific Contextual Fallback (Anchored to prevCmd, Zero Hotlines)
    const t = topic.toLowerCase();

    // A. FUNAN TECHO CANAL & WATERWAY LOGISTICS (គម្រោងព្រែកជីកហ្វូណនតេជោ / ផ្លូវទឹក / គម្រោងប្រវត្តិសាស្ត្រ)
    if (t.includes('ហ្វូណន') || t.includes('ព្រែកជីក') || t.includes('ផ្លូវទឹក') || t.includes('នាវាចរណ៍')) {
      if (agentCommand === '/mpwt') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} គម្រោងព្រែកជីកហ្វូណនតេជោប្រវែង ១៨០ គ.ម ត្រូវបានសិក្សាលម្អិតតាមបទដ្ឋានបច្ចេកទេសអន្តរជាតិ ដើម្បីធានាប្រសិទ្ធភាពនាវាចរណ៍ និងកាត់បន្ថយថ្លៃដើមដឹកជញ្ជូនជាតិប្រមាណ ៣០%។»`;
      }
      if (agentCommand === '/mowram') {
        return `«បន្តពីការលើកឡើងរបស់ ${prevCmd} ក្រសួងធនធានទឹកបានវិភាគរបបជលសាស្ត្រយ៉ាងហ្មត់ចត់ ដោយព្រែកជីកនេះប្រើប្រាស់ទឹកត្រឹម ០.០៥% នៃរបបទឹកទន្លេមេគង្គ មិនបង្កឱ្យប្រែប្រួលលំហូរទឹក ឬប៉ះពាល់ដល់ទន្លេសាបឡើយ។»`;
      }
      if (agentCommand === '/moe') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ លើទិដ្ឋភាពបរិស្ថាន ការវាយតម្លៃផលប៉ះពាល់ (EIA) បានបញ្ជាក់ច្បាស់ថា គម្រោងនេះនឹងជួយកាត់បន្ថយការបំភាយឧស្ម័នកាបូនពីវិស័យដឹកជញ្ជូន និងផ្តល់ប្រភពទឹកស្រោចស្រពតាមគន្លងផ្លូវទឹក។»`;
      }
      if (agentCommand === '/kandal') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} សម្រាប់ភូមិសាស្ត្រខេត្តកណ្តាលដែលជាចំណុចក្បាលព្រែកជីក ព្រែកតាកែវ រដ្ឋបាលខេត្តបានកំណត់ព្រំដី និងត្រៀមយន្តការដោះស្រាយផលប៉ះពាល់ជូនពលរដ្ឋដោយផ្អែកលើច្បាប់ និងយុត្តិធម៌សង្គម។»`;
      }
      if (agentCommand === '/takeo') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ គន្លងព្រែកជីកកាត់ខេត្តតាកែវនឹងផ្តល់ប្រភពទឹកដ៏មានតម្លៃសម្រាប់ស្រែប្រាំងក្នុងស្រុកអង្គរបុរី និងទ្រាំង ព្រមទាំងបង្កើតច្រករបៀងសេដ្ឋកិច្ចថ្មីសម្រាប់កសិករ។»`;
      }
      if (agentCommand === '/kampot') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} រដ្ឋបាលខេត្តកំពតបានត្រៀមភ្ជាប់ហេដ្ឋារចនាសម្ព័ន្ធកំពង់ផែពហុបំណង ដើម្បីទទួលចរាចរណ៍កប៉ាល់ដឹកទំនិញពីព្រែកជីកឆ្ពោះទៅកាន់សមុទ្រអន្តរជាតិ។»`;
      }
      if (agentCommand === '/kep') {
        return `«បន្តពីការលើកឡើងរបស់ ${prevCmd} ច្រកចេញសមុទ្រនៅខេត្តកែបត្រូវបានបំពាក់ប្រព័ន្ធទ្វារទឹកទប់ជាតិប្រៃ និងការពារប្រព័ន្ធអេកូឡូស៊ីព្រៃកោងកាងយ៉ាងម៉ត់ចត់។»`;
      }
      if (agentCommand === '/mfaic') {
        return `«ផ្អែកលើការលើកឡើងរបស់ ${prevCmd} កម្ពុជាបានអនុវត្តកាតព្វកិច្ចជូនដំណឹងស្របតាមកិច្ចព្រមព្រៀងមេគង្គឆ្នាំ ១៩៩៥ យ៉ាងពេញលេញ និងប្រកាន់ជំហរច្បាស់លាស់ក្នុងការការពារអធិបតេយ្យភាពជាតិ។»`;
      }
      if (agentCommand === '/mod') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ កងយោធពលខេមរភូមិន្ទប្តេជ្ញាការពារដាច់ខាតបូរណភាពទឹកដី សន្តិសុខផ្លូវទឹក និងអធិបតេយ្យជាតិនៅតាមខ្សែបន្ទាត់ព្រែកជីកប្រវត្តិសាស្ត្រនេះ។»`;
      }
      if (agentCommand === '/mlmupc') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ក្រុមការងារសុរិយោដីកំពុងផ្ទៀងផ្ទាត់ក្បាលដីតាមនិយាមកា GPS ដើម្បីធានាការដោះស្រាយសំណងផលប៉ះពាល់ជូនប្រជាពលរដ្ឋប្រកបដោយតម្លាភាព ១០០%។»`;
      }
      if (agentCommand === '/acu') {
        return `«ក្រុមឃ្លាំមើល ACU ដាក់ការតាមដានយ៉ាងម៉ឺងម៉ាត់លើគ្រប់ដំណាក់កាលលទ្ធកម្ម និងការបើកផ្តល់សំណង ដើម្បីធានាថាមិនមានការកិបកេង ឬអំពើពុករលួយឡើយ។»`;
      }
      if (agentCommand === '/mot') {
        return `«បន្តពី ${prevCmd} គម្រោងនេះនឹងបើកច្រកទេសចរណ៍ផ្លូវទឹកថ្មី ជំរុញទេសចរណ៍ធម្មជាតិ និងលើកកម្ពស់ជីវភាពសហគមន៍តាមបណ្តោយខេត្តទាំងបួន។»`;
      }
      if (agentCommand === '/mme') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ក្រសួងរ៉ែ និងថាមពលបានរៀបចំបណ្តាញផ្គត់ផ្គង់អគ្គិសនីសម្រាប់ស្ថានីយបូមទឹក និងប្រព័ន្ធទ្វារទឹកស្វ័យប្រវត្តិតាមបណ្តោយព្រែកជីក។»`;
      }
      if (agentCommand === '/mptc') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ ក្រសួងប្រៃសណីយ៍នឹងដាក់ពង្រាយបណ្តាញខ្សែកាបអុបទិក និងប្រព័ន្ធ IoT តាមដានចរាចរណ៍នាវា និងកម្ពស់ទឹកតាមប្រព័ន្ធឌីជីថលឆ្លាតវៃ។»`;
      }
      if (agentCommand === '/mlvt') {
        return `«បន្តពីការលើកឡើងរបស់ ${prevCmd} វិស័យការងារបានត្រៀមកម្លាំងពលកម្មជំនាញ និងវិស្វករខ្មែររាប់ពាន់នាក់ ដើម្បីបម្រើការងារសាងសង់ និងប្រតិបត្តិការផ្លូវទឹកនេះ។»`;
      }
      if (agentCommand === '/phnompenh') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} រដ្ឋបាលរាជធានីភ្នំពេញបានរៀបចំផែនការតភ្ជាប់បណ្តាញផ្លូវទឹកចេញពីកំពង់ផែស្វយ័តភ្នំពេញ ឆ្ពោះទៅក្បាលព្រែកជីក ដើម្បីសម្រួលចរាចរណ៍កុងតឺន័រ។»`;
      }
    }

    // B. TRAFFIC & DRUNK DRIVING (ចរាចរណ៍ / ស្រវឹង / កាត់ពិន្ទុ)
    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('គ្រឿងស្រវឹង') || category === 'TRAFFIC_SAFETY') {
      if (agentCommand === '/police') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} កម្លាំងនគរបាលជាតិបានពង្រាយគោលដៅត្រួតពិនិត្យជាតិស្រវឹងពេលយប់ទូទាំងប្រទេស ដោយអនុវត្តច្បាប់ស្មើភាពគ្នា កម្រិតលើស ០.៤០mg/L ត្រូវបញ្ជូនទៅតុលាការភ្លាម។»`;
      }
      if (agentCommand === '/mpwt') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ ការតភ្ជាប់ប្រព័ន្ធកាត់ពិន្ទុបណ្ណបើកបរតាម App ឌីជីថល និងកាមេរ៉ាសុវត្ថិភាព នឹងជួយកាត់បន្ថយគ្រោះថ្នាក់បានយូរអង្វែង និងទប់ស្កាត់ការបើកបរស្រវឹងដដែលៗ។»`;
      }
      if (agentCommand === '/moj') {
        return `«បន្តពីការលើកឡើងរបស់ ${prevCmd} ករណីបើកបរស្រវឹងបង្កគ្រោះថ្នាក់របួសឬស្លាប់ ត្រូវអនុវត្តមាត្រា ៧៧/៨២ នៃច្បាប់ចរាចរណ៍ ដោយចោទប្រកាន់ពីបទល្មើសព្រហ្មទណ្ឌ និងគ្មានការបន្ធូរបន្ថយទោសឡើយ។»`;
      }
      if (agentCommand === '/acu') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ក្រុមឃ្លាំមើល ACU តាមដានទប់ស្កាត់ដាច់ខាតការទារលុយក្រៅផ្លូវការនៅតាមគោលដៅត្រួតពិនិត្យ ដើម្បីធានាសុចរិតភាពប្រតិបត្តិការ។»`;
      }
    }

    // C. FACTORY WORKERS & LABOR RIGHTS (កម្មករ / និយោជិត / ការងារ / រោងចក្រ / ប្រាក់ឈ្នួល)
    if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល')) {
      if (agentCommand === '/mlvt') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ក្រុមអធិការកិច្ចការងារចុះត្រួតពិនិត្យផ្ទាល់នៅរោងចក្រ ដើម្បីធានាការបើកប្រាក់ឈ្នួលអប្បបរមា ២០៨ ដុល្លារ/ខែ និងប្រាក់អតីតភាពឱ្យបានទៀងទាត់។»`;
      }
      if (agentCommand === '/nssf') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ ប.ស.ស. កំពុងពង្រីកការគ្របដណ្តប់របបថែទាំសុខភាព និងធានារ៉ាប់រងគ្រោះថ្នាក់ការងារជូនកម្មករទាំងក្នុងនិងក្រៅប្រព័ន្ធពេញលេញ។»`;
      }
      if (agentCommand === '/interior') {
        return `«បន្តពី ${prevCmd} អាជ្ញាធរដែនដី និងនគរបាលមូលដ្ឋានបានពង្រឹងការការពារសន្តិសុខ និងសុវត្ថិភាពជូនបងប្អូនកម្មករ ទាំងនៅកន្លែងស្នាក់នៅ និងពេលធ្វើដំណើរ។»`;
      }
      if (agentCommand === '/moj') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} យោងច្បាប់ស្តីពីការងារឆ្នាំ ១៩៩៧ រាល់ការកេងប្រវ័ញ្ច ឬបំពានកិច្ចសន្យាការងារ ត្រូវបញ្ជូនទៅក្រុមប្រឹក្សាអាជ្ញាកណ្តាល និងតុលាការជាបន្ទាន់។»`;
      }
    }

    // D. LAND DISPUTES & PROPERTY RIGHTS (ដីធ្លី / ប្លង់រឹង / LMAP / សុរិយោដី)
    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      if (agentCommand === '/mlmupc') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ការពន្លឿនចេញប្លង់រឹងជាប្រព័ន្ធ (LMAP) គឺជាគន្លឹះដោះស្រាយវិវាទដីធ្លីក្រៅប្រព័ន្ធតុលាការប្រកបដោយតម្លាភាព ផ្អែកលើប្រវត្តិដីពិតប្រាកដ។»`;
      }
      if (agentCommand === '/interior') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ អាជ្ញាធរដែនដីត្រូវចុះសម្របសម្រួលដោយយុត្តិធម៌ ហើយមន្ត្រីណាឃុបឃិតស៊ីញ៉េផ្ទេរសិទ្ធិដីខុសច្បាប់ ត្រូវចាត់វិធានការវិន័យភ្លាមៗ។»`;
      }
      if (agentCommand === '/moj') {
        return `«បន្តពីការលើកឡើងរបស់ ${prevCmd} ករណីក្លែងបន្លំឯកសារ ឬទន្ទ្រានដីរដ្ឋ ត្រូវអនុវត្តមាត្រា ២៤៧ នៃច្បាប់ភូមិបាលយ៉ាងម៉ឺងម៉ាត់ ដើម្បីការពារកម្មសិទ្ធិស្របច្បាប់របស់អ្នកទន់ខ្សោយ។»`;
      }
      if (agentCommand === '/acu') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ក្រុមឃ្លាំមើល ACU ដាក់ការតាមដានលើរាល់ដំណើរការសម្រុះសម្រួលដីធ្លី ដើម្បីលុបបំបាត់ការទារលុយរត់ការប្លង់ក្រោមតុទាំងស្រុង។»`;
      }
    }

    // E. CYBER FRAUD & ONLINE SCAMS (ឆបោក / Call Center / អនឡាញ)
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      if (agentCommand === '/mptc') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ការបិទខ្ទប់ Domain ឆបោកជាង ៣០០០ និងការរឹតបន្តឹងការចុះបញ្ជីស៊ីមកាតទូរស័ព្ទ គឺជាវិធានការគន្លឹះកាត់ផ្តាច់ឫសគល់បណ្តាញឆបោក។»`;
      }
      if (agentCommand === '/police') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ កម្លាំងនាយកដ្ឋានប្រឆាំងបទល្មើសបច្ចេកវិទ្យាកំពុងចុះឆ្មក់បង្ក្រាបទីតាំង Call Center និងសហការជាមួយធនាគារជាតិបង្កកគណនីលាងលុយភ្លាមៗ។»`;
      }
      if (agentCommand === '/moj') {
        return `«បន្តពីការលើកឡើងរបស់ ${prevCmd} ជនពាក់ព័ន្ធបណ្តាញឆបោកអនឡាញ ត្រូវចោទប្រកាន់តាមមាត្រា ៣៧៧ នៃក្រមព្រហ្មទណ្ឌ និងច្បាប់ប្រឆាំងការសម្អាតប្រាក់ដោយគ្មានការលើកលែង។»`;
      }
    }

    // F. ANTI-CORRUPTION & OWSO (ពុករលួយ / OWSO / ច្រកចេញចូលតែមួយ)
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM' || t.includes('ច្រកចេញចូលតែមួយ')) {
      if (agentCommand === '/acu') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ក្រុមឃ្លាំមើល ACU ចុះធ្វើអធិការកិច្ចសម្ងាត់នៅការិយាល័យច្រកចេញចូលតែមួយ (OWSO) ជនណាទារប្រាក់កាហ្វេ ត្រូវអនុវត្តមាត្រា ៣២ នៃច្បាប់ប្រឆាំងអំពើពុករលួយ។»`;
      }
      if (agentCommand === '/interior') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ រដ្ឋបាលមូលដ្ឋានតម្រូវឱ្យបិទផ្សាយតារាងតម្លៃផ្លូវការ និងកាលកំណត់សេវាជាសាធារណៈនៅគ្រប់ OWSO ដើម្បីលុបបំបាត់ការបង្អែបង្អង់។»`;
      }
      if (agentCommand === '/moj') {
        return `«បន្តពី ${prevCmd} តុលាការនឹងបើកការជំនុំជម្រះក្តីជាសាធារណៈលើបទល្មើសពុករលួយក្នុងរដ្ឋបាលសាធារណៈ ដើម្បីពង្រឹងទំនុកចិត្តសង្គម។»`;
      }
    }

    // G. AGRICULTURE, PADDY RICE & FERTILIZERS (កសិកម្ម / ស្រូវ / ជី / ថ្លៃស្រូវ)
    if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      if (agentCommand === '/maff') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ការបញ្ជូនមន្ត្រីកសិកម្មឃុំជួយបច្ចេកទេសផ្ទាល់ និងការទប់ស្កាត់ជី-ថ្នាំកសិកម្មក្លែងក្លាយ គឺជាអាទិភាពបន្ទាន់សម្រាប់កសិករ។»`;
      }
      if (agentCommand === '/moc') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ ក្រសួងពាណិជ្ជកម្មសហការជាមួយ CRF ទិញស្រូវស្តុកទុកក្នុងតម្លៃគោលសមរម្យ ដើម្បីទប់ស្កាត់ការទម្លាក់ថ្លៃពីឈ្មួញកណ្តាល។»`;
      }
      if (agentCommand === '/mowram') {
        return `«បន្តពីការលើកឡើងរបស់ ${prevCmd} ក្រសួងធនធានទឹកបានបើកទ្វារទឹក និងត្រៀមម៉ាស៊ីនបូមទឹក ២៤/៧ អន្តរាគមន៍ស្រោចស្រពស្រែប្រាំងជូនកសិករ។»`;
      }
      if (agentCommand === '/mef') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} ARDB បានបញ្ចេញកញ្ចប់កម្ចីការប្រាក់ទាបទាន់ពេល ជូនរោងម៉ាស៊ីនកិនស្រូវ ដើម្បីប្រមូលទិញស្រូវពីកសិករ។»`;
      }
    }

    // H. ENVIRONMENT & FORESTRY (បរិស្ថាន / ព្រៃ / ធម្មជាតិ)
    if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់')) {
      if (agentCommand === '/moe') {
        return `«ឆ្លើយតបទៅនឹង ${prevCmd} កម្លាំងឧទ្យានុរក្សកំពុងល្បាត ២៤/៧ ទប់ស្កាត់ការកាប់ទន្ទ្រានដីព្រៃអភិរក្ស និងកសាងសំណុំរឿងបញ្ជូនទៅតុលាការជាបន្ទាន់។»`;
      }
      if (agentCommand === '/interior') {
        return `«យល់ស្របជាមួយ ${prevCmd}។ អាជ្ញាធរដែនដីត្រូវចាត់វិធានការវិន័យ និងដកតំណែងភ្លាមៗចំពោះមន្ត្រីណាដែលឃុបឃិតជាមួយឈ្មួញឈើខុសច្បាប់។»`;
      }
      if (agentCommand === '/moj') {
        return `«បន្តពី ${prevCmd} តំណាងអយ្យការត្រូវពន្លឿនការចោទប្រកាន់ជនកាប់ទន្ទ្រានព្រៃរដ្ឋតាមច្បាប់តំបន់ការពារធម្មជាតិ និងក្រមព្រហ្មទណ្ឌ។»`;
      }
    }

    // I. DYNAMIC CONTEXTUAL CROSS-AGENT ANCHOR (Zero Hotlines, Pure Substance)
    return `«ឆ្លើយតបទៅនឹងការលើកឡើងរបស់ ${prevCmd} អ្នកឃ្លាំមើល ${agentName} សូមគូសបញ្ជាក់ថា លើករណី «${topic}» ចាំបាច់ត្រូវពង្រឹងកិច្ចសហការអន្តរស្ថាប័នឱ្យបានម៉ឺងម៉ាត់ និងដោះស្រាយផលប៉ះពាល់ជូនប្រជាពលរដ្ឋដោយផ្អែកលើច្បាប់រដ្ឋ និងតម្លាភាពសង្គម ៕»`;
  }

  public static selectParticipatingAgents(category: string, topic: string): string[] {
    const t = topic.toLowerCase();
    let coreAgents: string[] = [];

    // 1. Funan Techo Canal & Waterway Logistics
    if (t.includes('ហ្វូណន') || t.includes('ព្រែកជីក') || t.includes('ផ្លូវទឹក') || t.includes('នាវាចរណ៍')) {
      coreAgents = [
        '/mpwt', '/mowram', '/moe', '/maff', '/mef', '/mfaic', '/mod', '/interior', '/mlmupc',
        '/kandal', '/takeo', '/kampot', '/kep', '/phnompenh', '/preahsihanouk', '/customs',
        '/tax', '/mot', '/mme', '/mptc', '/police', '/acu', '/moj', '/chrc', '/mlvt', '/moh',
        '/nbc', '/cdc', '/ssca', '/nac', '/senate', '/ocm'
      ];
    }
    // 2. Traffic Safety & Drunk Driving
    else if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('បុក') || t.includes('គ្រោះថ្នាក់') || category === 'TRAFFIC_SAFETY') {
      coreAgents = [
        '/police', '/mpwt', '/moj', '/acu', '/interior', '/moh', '/phnompenh', '/police_phnompenh',
        '/kandal', '/siemreap', '/preahsihanouk', '/battambang', '/kampot', '/takeo', '/nssf',
        '/mlvt', '/mptc', '/information'
      ];
    }
    // 3. Factory Workers & Labor Rights
    else if (t.includes('កម្មករ') || t.includes('និយោជិត') || t.includes('ការងារ') || t.includes('រោងចក្រ') || t.includes('ប្រាក់ឈ្នួល') || t.includes('សហជីព')) {
      coreAgents = [
        '/mlvt', '/nssf', '/interior', '/moj', '/acu', '/mef', '/moc', '/phnompenh', '/kandal',
        '/kampongspeu', '/takeo', '/svayrieng', '/krong_bavet', '/banteaymeanchey', '/krong_poipet',
        '/chrc', '/cdc'
      ];
    }
    // 4. Land Disputes & Systemic Titling
    else if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      coreAgents = [
        '/mlmupc', '/moj', '/interior', '/acu', '/maff', '/moe', '/chrc', '/kandal', '/phnompenh',
        '/siemreap', '/preahsihanouk', '/battambang', '/kampongthom', '/pursat', '/kohkong', '/kampot'
      ];
    }
    // 5. Cyber Fraud & Online Scams
    else if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      coreAgents = [
        '/mptc', '/police', '/moj', '/acu', '/nbc', '/immigration', '/preahsihanouk',
        '/banteaymeanchey', '/krong_poipet', '/svayrieng', '/krong_bavet', '/phnompenh', '/mfaic', '/interior'
      ];
    }
    // 6. Anti-Corruption & OWSO
    else if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM' || t.includes('ច្រកចេញចូលតែមួយ') || t.includes('owso')) {
      coreAgents = [
        '/acu', '/interior', '/moj', '/mcs', '/tax', '/customs', '/phnompenh', '/kandal',
        '/siemreap', '/preahsihanouk', '/battambang', '/khan_daunpenh', '/krong_takhmau'
      ];
    }
    // 7. Agriculture, Paddy Rice & Fertilizers
    else if (t.includes('កសិកម្ម') || t.includes('ស្រូវ') || t.includes('កសិករ') || t.includes('ជី') || t.includes('កសិផល')) {
      coreAgents = [
        '/maff', '/moc', '/mowram', '/mef', '/mrd', '/battambang', '/takeo', '/preyveng',
        '/kampongcham', '/kandal', '/pursat', '/tboungkhmum', '/svayrieng', '/cdc', '/nbc'
      ];
    }
    // 8. Environment & Forestry
    else if (t.includes('បរិស្ថាន') || t.includes('ព្រៃ') || t.includes('ធម្មជាតិ') || t.includes('កាកសំណល់') || t.includes('ប្លាស្ទិក')) {
      coreAgents = [
        '/moe', '/interior', '/police', '/moj', '/acu', '/maff', '/kohkong', '/mondulkiri',
        '/ratanakiri', '/preahvihear', '/pursat', '/kampot', '/siemreap', '/chrc'
      ];
    }
    // 9. Taxes, Customs & SME Startups
    else if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('camdx') || t.includes('e-filing') || t.includes('nsw') || t.includes('startups')) {
      coreAgents = [
        '/mef', '/tax', '/customs', '/moc', '/nbc', '/cdc', '/misti', '/mptc', '/phnompenh',
        '/preahsihanouk', '/krong_poipet', '/krong_bavet'
      ];
    }
    // 10. Border Disputes & Sovereignty
    else if (t.includes('ព្រំដែន') || t.includes('បង្គោល') || t.includes('ទឹកដី') || t.includes('អធិបតេយ្យ')) {
      coreAgents = [
        '/mod', '/mfaic', '/interior', '/police', '/banteaymeanchey', '/oddarmeanchey',
        '/preahvihear', '/svayrieng', '/takeo', '/kohkong', '/kratie', '/stungtreng', '/mondulkiri', '/ratanakiri'
      ];
    }
    // Default core
    else {
      coreAgents = ['/interior', '/moj', '/acu', '/police', '/mef', '/mpwt', '/mlvt', '/maff', '/moe'];
    }

    // Merge with ALL_INSTITUTIONAL_AGENTS to guarantee over 50+ participating agents (exactly 52 agents)
    const unique = Array.from(new Set([...coreAgents, ...this.ALL_INSTITUTIONAL_AGENTS]));
    return unique.slice(0, 52);
  }
}
