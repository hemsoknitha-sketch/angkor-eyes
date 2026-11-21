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
   */
  public static async deliberateOnTopic(params: {
    topic: string;
    initiatedBy?: string;
  }): Promise<InterMinisterialDebateResult> {
    const { topic, initiatedBy = 'ប្រជាពលរដ្ឋ (Citizen Request)' } = params;
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
    const rexIntro = `«សូមជម្រាបសួរឯកឧត្តម លោកជំទាវ តំណាងស្ថាប័នពាក់ព័ន្ធទាំងអស់។ ថ្ងៃនេះគណៈសម្របសម្រួលជាន់ខ្ពស់ AGI បានកោះប្រជុំគណៈរដ្ឋមន្ត្រីបន្ទាន់លើប្រធានបទក្តៅ ៖ **«${topic}»** (ផ្តួចផ្តើមដោយ ៖ ${initiatedBy})។\n\n` +
      `ខ្ញុំសូមអញ្ជើញឯកឧត្តមតំណាងស្ថាប័នមានសមត្ថកិច្ចអនុវត្តផ្ទាល់ ចាប់ផ្តើមរាយការណ៍អំពីស្ថានភាពជាក់ស្តែង និងវិធានការប្រតិបត្តិការចំពោះមុខជាបន្ទាន់!»`;
    recordStatement('/rex', 'Rex Lead Orchestrator', 'អ្នកសម្របសម្រួលជាន់ខ្ពស់ AGI ANGKOR EYES', rexIntro);

    // Step 2: Sequential Multi-Turn Conversational Dialogue
    for (let i = 0; i < participants.length; i++) {
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

      recordStatement(cmd, details.name, `តំណាង ${details.name}`, statementText);
    }

    // Step 3: Rex Lead Orchestrator compiles Joint Consensus & Action Plan
    const resolutionText = this.generateJointResolution(topic, category, participants, statements);
    recordStatement('/rex', 'Rex Lead Orchestrator', 'អ្នកសម្របសម្រួលជាន់ខ្ពស់ AGI ANGKOR EYES', resolutionText);

    // Format Telegram Dialogue Digest
    let tgDigest = `🇰🇭 **កិច្ចពិភាក្សាដេញដោលអន្តរក្រសួង AGI (Live Cabinet Deliberation)**\n\n` +
      `📅 **កាលបរិច្ឆេទ** ៖ ${dateKhmer}\n` +
      `📑 **លេខកូដកិច្ចប្រជុំ** ៖ \`${refCode}\`\n` +
      `🔥 **ប្រធានបទក្តៅ** ៖ «**${topic}**»\n` +
      `══════════════════════════════════════\n\n`;

    statements.forEach((s) => {
      tgDigest += `💬 **${s.agentName}** (${s.roleTitle}) ៖\n` +
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
      jointResolution: resolutionText,
      formattedTelegramDigest: cleanText
    };
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

    // 1. Try real-time LLM dynamic response first
    try {
      const prompt = `You are the authentic high-level official spokesperson and representative of ${agentName} (${agentCommand}) in the Royal Government of Cambodia.
You are actively speaking at an emergency Cabinet Deliberation session hosted by Rex Lead Orchestrator on the hot national issue: "${topic}".
Previous speakers at the table have stated:
${conversationHistory.map(h => `${h.agentName}: ${h.statement}`).join('\n\n')}

Your goal:
- Speak directly in formal, polite, authoritative, and realistic Royal Cambodian Government Khmer.
- Speak conversationally (e.g., "សូមគោរពឯកឧត្តម Rex និងអង្គប្រជុំ...", reference what previous speakers said).
- Provide specific, realistic operational steps, actual statutory articles/sub-decrees, and official hotline (${leadDetails.hotline}).
- Do NOT use generic placeholder boilerplate or mention One-Window Service Offices unless the topic is specifically about municipal administration.
- Keep response between 60 to 110 words in 2-3 clear paragraphs.`;

      const llmRes = await LLMGateway.generateResponse({
        messages: [
          { role: 'system', content: `You are an elite Cambodian government spokesperson representing ${agentName}. Impeccable formal Khmer orthography.` },
          { role: 'user', content: prompt }
        ],
        preferredModel: 'gemini-2.5-flash'
      });

      if (llmRes && llmRes.content && llmRes.provider !== 'simulation' && llmRes.content.length > 40 && !llmRes.content.includes('undefined')) {
        return `«${llmRes.content.trim().replace(/^«|»$/g, '')}»`;
      }
    } catch {
      // Fallback to domain-specific realistic conversational dialogue
    }

    // 2. Realistic Domain-Tailored Conversational Dialogues (100% Offline / Free Guaranteed)
    const t = topic.toLowerCase();

    // TRAFFIC & DRUNK DRIVING
    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('គ្រឿងស្រវឹង') || category === 'TRAFFIC_SAFETY') {
      if (agentCommand === '/police' || agentCommand === '/mpwt') {
        return index === 0
          ? `«សូមគោរពឯកឧត្តម Rex និងអង្គប្រជុំទាំងមូល! ពាក់ព័ន្ធនឹងការរឹតបន្តឹងច្បាប់ចរាចរណ៍ និងការបើកបរស្រវឹង កងកម្លាំងនគរបាលជាតិបានដាក់ពង្រាយគោលដៅត្រួតពិនិត្យជាតិអាល់កុលពេលយប់ទូទាំងរាជធានី-ខេត្ត។ រាល់ការបើកបរមានកម្រិតជាតិស្រវឹងចាប់ពី ០,២៥ ទៅ ០,៣៩ មីលីក្រាម/លីត្រខ្យល់ នឹងត្រូវរងការពិន័យអន្តរកាលតាមអនុក្រឹត្យលេខ ៣៩ និងលេខ ៤៤ អនក្រ.បក។ ចំពោះកម្រិតចាប់ពី ០,៤០ ឡើងទៅ នឹងត្រូវកសាងសំណុំរឿងបញ្ជូនទៅតុលាការដោយគ្មានការយោគយល់ឡើយ គ្មានអ្នកណាមានសិទ្ធិអន្តរាគមន៍ ឬខ្សែធំជាដាច់ខាត!»`
          : `«ខ្ញុំសូមគាំទ្រប្រសាសន៍របស់កងកម្លាំងនគរបាលជាតិ! ខាងក្រសួងសាធារណការ និងដឹកជញ្ជូន បានដាក់ឱ្យដំណើរការប្រព័ន្ធកាត់ពិន្ទុបណ្ណបើកបរតាមកម្មវិធីឌីជីថល (App) និងបំពាក់កាមេរ៉ាសុវត្ថិភាពឆ្លាតវៃតាមផ្លូវជាតិ។ ប្រសិនបើអ្នកបើកបរស្រវឹងបង្កគ្រោះថ្នាក់ ក្រៅពីការផាកពិន័យ នឹងត្រូវដកហូតបណ្ណបើកបរជាបណ្តោះអាសន្ន ឬលុបឈ្មោះចោល។ យើងខ្ញុំសូមអំពាវនាវដល់ប្រជាពលរដ្ឋ ៖ «បើពិសាគ្រឿងស្រវឹង សូមកុំបើកបរ!»»`;
      }
      if (agentCommand === '/moj') {
        return `«ខាងក្រសួងយុត្តិធម៌យើងខ្ញុំសូមបញ្ជាក់ទិដ្ឋភាពច្បាប់បន្ថែម ៖ ផ្អែកលើច្បាប់ស្តីពីចរាចរណ៍ផ្លូវគោក មាត្រា ៧៧ និង ៨២ រួមទាំងក្រមព្រហ្មទណ្ឌ រាល់ការបើកបរធ្វេសប្រហែសក្រោមឥទ្ធិពលគ្រឿងស្រវឹងបណ្តាលឱ្យអ្នកដទៃរងរបួស ឬស្លាប់ គឺជាបទមជ្ឈិម ឬបទឧក្រិដ្ឋ ដែលត្រូវផ្តន្ទាទោសដាក់ពន្ធនាគារពី ១ ទៅ ៥ ឆ្នាំ និងពិន័យជាប្រាក់។ តំណាងអយ្យការប្រចាំការគ្រប់សាលាដំបូងរាជធានី-ខេត្ត ត្រូវបានណែនាំឱ្យចាត់វិធានការក្តៅ គ្មានការលើកលែងឡើយ!»`;
      }
      if (agentCommand === '/acu') {
        return `«អង្គភាពប្រឆាំងពុករលួយ (ACU) បានដាក់ពង្រាយមន្ត្រីសម្ងាត់ចុះតាមដានការអនុវត្តច្បាប់នៅតាមគ្រប់គោលដៅត្រួតពិនិត្យចរាចរណ៍។ យើងខ្ញុំសូមព្រមានធ្ងន់ៗដល់មន្ត្រីនគរបាលចរាចរណ៍ទាំងអស់ ហាមដាច់ខាតការទារប្រាក់ ឬស៊ីសំណូកក្រៅផ្លូវការ។ ប្រជាពលរដ្ឋមានសិទ្ធិថតវីដេអូទុកជាភស្តុតាង និងរាយការណ៍ផ្ទាល់មកកាន់ Hotline ១២៨២ របស់ ACU គ្រប់ពេលវេលា!»`;
      }
    }

    // CYBER FRAUD & ONLINE SCAMS
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      if (agentCommand === '/mptc') {
        return `«សូមជម្រាបជូនអង្គប្រជុំ! ក្រសួងប្រៃសណីយ៍ និងទូរគមនាគមន៍ បានសហការជាមួយក្រុមហ៊ុនផ្តល់សេវាអ៊ីនធឺណិត (ISP) បិទខ្ទប់ Domain និង IP ឆបោកខុសច្បាប់រាប់ពាន់អាសយដ្ឋាន។ ជាមួយគ្នានេះ យើងកំពុងរៀបចំប្រព័ន្ធផ្ទៀងផ្ទាត់លេខទូរស័ព្ទ (SIM Registration) និងទប់ស្កាត់ការផ្ញើសារ Spam Phishing។ ពលរដ្ឋអាចរាយការណ៍គេហទំព័រឆបោកមកកាន់ Hotline ១២៣ របស់ក្រសួងបានភ្លាមៗ!»`;
      }
      if (agentCommand === '/police') {
        return `«កងកម្លាំងនគរបាលជាតិ និងនាយកដ្ឋានប្រឆាំងបទល្មើសបច្ចេកវិទ្យា បានបើកប្រតិបត្តិការស្រាវជ្រាវ និងចុះបង្ក្រាបទីតាំងបណ្តាញឆបោកអនឡាញ (Scam Centers) ជាបន្តបន្ទាប់។ យើងបានចាប់ខ្លួនមេក្លោង និងរឹបអូសឧបករណ៍បច្ចេកវិទ្យាជាច្រើន។ យើងខ្ញុំក៏បានសហការជាមួយធនាគារជាតិនៃកម្ពុជា ដើម្បីបង្កកគណនីធនាគាររបស់ជនខិលខូចដែលប្រើសម្រាប់លាងលុយកខ្វក់ផងដែរ!»`;
      }
      if (agentCommand === '/moj') {
        return `«ក្រសួងយុត្តិធម៌កំពុងជំរុញនីតិវិធីតុលាការយ៉ាងលឿនបំផុតលើសំណុំរឿងឆបោកអនឡាញ និងលាងលុយកខ្វក់។ ជនដែលពាក់ព័ន្ធនឹងត្រូវចោទប្រកាន់តាមក្រមព្រហ្មទណ្ឌ មាត្រា ៣៧៧ (បទឆបោក) និងច្បាប់ស្តីពីការប្រឆាំងការសម្អាតប្រាក់។ យើងខ្ញុំក៏កំពុងពង្រឹងកិច្ចសហប្រតិបត្តិការអន្តរជាតិលើការធ្វើបត្យាប័នឧក្រិដ្ឋជនឆ្លងដែនផងដែរ!»`;
      }
    }

    // LAND DISPUTES & PROPERTY RIGHTS
    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      if (agentCommand === '/mlmupc') {
        return `«សូមគោរពឯកឧត្តម Rex និងអង្គប្រជុំ! ក្រសួងរៀបចំដែនដី នគរូបនីយកម្ម និងសំណង់ កំពុងពន្លឿនយុទ្ធនាការចុះបញ្ជីដីធ្លីមានលក្ខណៈជាប្រព័ន្ធទូទាំងប្រទេសដើម្បីចេញប្លង់រឹងជូនប្រជាពលរដ្ឋឱ្យបាន ១០០%។ ចំពោះករណីវិវាទដីធ្លី យន្តការគណៈកម្មការសុរិយោដីកំពុងដោះស្រាយក្រៅប្រព័ន្ធតុលាការប្រកបដោយតម្លាភាព ដោយផ្អែកលើប្រវត្តិដីជាក់ស្តែង និងក្បាលដីផ្លូវការ គ្មានការរំលោភបំពានសិទ្ធិអ្នកទន់ខ្សោយឡើយ!»`;
      }
      if (agentCommand === '/moj') {
        return `«ខាងក្រសួងយុត្តិធម៌សូមបញ្ជាក់ថា ៖ រាល់ការទន្ទ្រានកាន់កាប់ដីធ្លីដោយខុសច្បាប់ ឬការក្លែងបន្លំឯកសារកម្មសិទ្ធិ ត្រូវផ្តន្ទាទោសតាមច្បាប់ភូមិបាលឆ្នាំ ២០០១ មាត្រា ២៤៧ និងក្រមព្រហ្មទណ្ឌ។ តុលាការនឹងផ្តល់អាទិភាពដោះស្រាយវិវាទដីធ្លីជូនពលរដ្ឋដោយផ្អែកលើភស្តុតាងច្បាស់លាស់ និងការពារដីសាធារណៈរបស់រដ្ឋឱ្យបានដាច់ខាត!»`;
      }
      if (agentCommand === '/interior') {
        return `«ក្រសួងមហាផ្ទៃបានណែនាំដល់អភិបាលរាជធានី-ខេត្ត ក្រុង ស្រុក ខណ្ឌ ឃុំ សង្កាត់ទាំងអស់ ត្រូវដើរតួនាទីជាអ្នកសម្របសម្រួលដោះស្រាយវិវាទដីធ្លីជូនប្រជាពលរដ្ឋនៅមូលដ្ឋានដោយផ្ទាល់ មិនត្រូវទុកឱ្យបញ្ហារ៉ាំរ៉ៃឡើយ។ មន្ត្រីមូលដ្ឋានណាដែលឃុបឃិតស៊ីញ៉េផ្ទេរសិទ្ធិដីខុសច្បាប់ នឹងត្រូវដកតំណែង និងបញ្ជូនទៅអនុវត្តវិន័យជាបន្ទាន់!»`;
      }
    }

    // ANTI-CORRUPTION & PUBLIC SERVICES
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM') {
      if (agentCommand === '/acu') {
        return `«អង្គភាពប្រឆាំងពុករលួយ (ACU) សូមប្រកាសជំហរម៉ឺងម៉ាត់ ៖ គ្មានបុគ្គលណាម្នាក់អាចស្ថិតនៅក្រៅសំណាញ់ច្បាប់ប្រឆាំងអំពើពុករលួយបានឡើយ។ យើងខ្ញុំបានដាក់មន្ត្រីសម្ងាត់ស៊ើបអង្កេតរាល់ការទារលុយក្រោមតុ។ ផ្អែកលើមាត្រា ៣២ នៃច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ ជនស៊ីសំណូក និងជនសូកប៉ាន់ សុទ្ធតែត្រូវផ្តន្ទាទោសដាក់ពន្ធនាគារ។ ប្រជាពលរដ្ឋអាចប្តឹងផ្តល់ដោយសម្ងាត់មកកាន់ Hotline ១២៨២ របស់ ACU!»`;
      }
      if (agentCommand === '/interior') {
        return `«ក្រសួងមហាផ្ទៃកំពុងរឹតបន្តឹងការផ្តល់សេវានៅតាមការិយាល័យច្រកចេញចូលតែមួយ (OWSO) ទូទាំងប្រទេស។ តម្លៃសេវា និងកាលកំណត់ត្រូវបានបិទផ្សាយជាសាធារណៈ។ មន្ត្រីណាដែលទារប្រាក់កាហ្វេ ឬបង្អែបង្អង់សំណុំរឿងរបស់ពលរដ្ឋ នឹងត្រូវប្រឈមមុខនឹងវិធានការរដ្ឋបាល និងច្បាប់ភ្លាមៗ។ យើងខ្ញុំប្តេជ្ញាបម្រើពលរដ្ឋដោយស្មោះត្រង់!»`;
      }
      if (agentCommand === '/moj') {
        return `«ក្រសួងយុត្តិធម៌គាំទ្រទាំងស្រុងចំពោះការសម្អាតភាពមិនប្រក្រតី។ ប្រព័ន្ធយុត្តិធម៌កំពុងដំណើរការកំណែទម្រង់ច្បាប់ ដើម្បីធានាឱ្យសវនាការ និងការដោះស្រាយក្តីមានភាពស្អាតស្អំ តម្លាភាព និងគ្មានការសូកប៉ាន់។ ព្រះរាជអាជ្ញានឹងបើកការស៊ើបអង្កេតភ្លាមៗចំពោះរាល់បទល្មើសពុករលួយដែលបានរកឃើញ!»`;
      }
    }

    // DEFAULT INSTITUTIONAL CONVERSATIONAL RESPONSE
    return `«សូមគោរពឯកឧត្តម Rex និងអង្គប្រជុំអន្តរក្រសួង! ផ្អែកលើសមត្ថកិច្ចរបស់ ${agentName} យើងខ្ញុំបានតាមដានយ៉ាងយកចិត្តទុកដាក់ចំពោះករណី «${topic}»។ ស្ថាប័នបានដាក់ចេញវិធានការបន្ទាន់ ៖ ត្រួតពិនិត្យការអនុវត្តច្បាប់នៅនឹងកន្លែង ការពារសន្តិសុខ និងផលប្រយោជន៍ស្របច្បាប់របស់ប្រជាពលរដ្ឋ និងសហការយ៉ាងជិតស្និទ្ធជាមួយស្ថាប័នដៃគូ ដើម្បីដោះស្រាយឱ្យចប់សព្វគ្រប់ប្រកបដោយតម្លាភាព តាមទូរស័ព្ទទាន់ហេតុការណ៍ផ្លូវការ ${leadDetails.hotline} ៕»`;
  }

  private static generateJointResolution(topic: string, category: string, participants: string[], statements: DebateStatement[]): string {
    const t = topic.toLowerCase();
    let specificPlan = '';

    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង')) {
      specificPlan = `• **ផែនការទី ១ (ប្រតិបត្តិការ)** ៖ បង្កើនការដាក់គោលដៅពិនិត្យជាតិអាល់កុលពេលយប់ទូទាំងប្រទេស និងអនុវត្តការពិន័យអន្តរកាលតាមអនុក្រឹត្យលេខ ៣៩/៤៤ ដោយគ្មានការអន្តរាគមន៍ ឬលើកលែង។\n` +
        `• **ផែនការទី ២ (ច្បាប់ & តុលាការ)** ៖ បញ្ជូនសំណុំរឿងអ្នកបើកបរស្រវឹងកម្រិតខ្ពស់ (ចាប់ពី ០,៤០mg/L) ទៅតុលាការ និងដកហូតបណ្ណបើកបរជាបណ្តោះអាសន្ន។\n` +
        `• **ផែនការទី ៣ (តម្លាភាព & សុចរិតភាព)** ៖ ACU ចុះឃ្លាំមើលតាមគោលដៅដើម្បីទប់ស្កាត់ការទារលុយក្រៅផ្លូវការ និងលើកទឹកចិត្តពលរដ្ឋរាយការណ៍តាម Hotline ១១៧ / ១២៨២។`;
    } else if (t.includes('ឆបោក') || t.includes('អនឡាញ')) {
      specificPlan = `• **ផែនការទី ១ (បង្ក្រាប)** ៖ ចុះឆ្មក់បង្ក្រាបមជ្ឈមណ្ឌលឆបោកអនឡាញ និងចាប់ខ្លួនមេក្លោងបញ្ជូនទៅតុលាការផ្តន្ទាទោសជាអតិបរមា។\n` +
        `• **ផែនការទី ២ (បច្ចេកវិទ្យា & ធនាគារ)** ៖ បិទខ្ទប់ Domain/IP ឆបោកភ្លាមៗ និងបង្កកគណនីធនាគារដែលប្រើប្រាស់សម្រាប់លាងលុយកខ្វក់។\n` +
        `• **ផែនការទី ៣ (ផ្សព្វផ្សាយ)** ៖ ផ្ញើសារប្រកាសអាសន្នអប់រំ និងបើកទទួលពាក្យបណ្តឹងតាម Hotline ១២៣ (MPTC) និង នាយកដ្ឋានប្រឆាំងបទល្មើសបច្ចេកវិទ្យា។`;
    } else if (t.includes('ដីធ្លី') || t.includes('ប្លង់')) {
      specificPlan = `• **ផែនការទី ១ (ចេញប្លង់រឹង)** ៖ ពន្លឿនការចុះបញ្ជីដីធ្លីមានលក្ខណៈជាប្រព័ន្ធ (LMAP) ចេញប្លង់រឹងជូនពលរដ្ឋឱ្យបានឆាប់រហ័ស។\n` +
        `• **ផែនការទី ២ (យុត្តិធម៌ដីធ្លី)** ៖ ដោះស្រាយវិវាទក្រៅប្រព័ន្ធតុលាការតាមរយៈគណៈកម្មការសុរិយោដី ដោយផ្អែកលើច្បាប់ភូមិបាលឆ្នាំ ២០០១ មិនឱ្យមានការរំលោភលើអ្នកទន់ខ្សោយ។\n` +
        `• **ផែនការទី ៣ (ទប់ស្កាត់ការទន្ទ្រាន)** ៖ ការពារដីសាធារណៈរបស់រដ្ឋ និងដកហូតតំណែងមន្ត្រីណាដែលឃុបឃិតស៊ីញ៉េផ្ទេរសិទ្ធិដីខុសច្បាប់។`;
    } else {
      specificPlan = `• **ផែនការទី ១** ៖ ចុះអន្តរាគមន៍ដោះស្រាយផ្ទាល់នៅមូលដ្ឋាន ដើម្បីធានាសុវត្ថិភាព និងយុត្តិធម៌ជូនប្រជាពលរដ្ឋជាបន្ទាន់។\n` +
        `• **ផែនការទី ២** ៖ អនុវត្តច្បាប់ឱ្យបានម៉ឺងម៉ាត់បំផុត គ្មានការយោគយល់ ឬអន្តរាគមន៍ចំពោះជនប្រព្រឹត្តល្មើសឡើយ។\n` +
        `• **ផែនការទី ៣** ៖ ធានាតម្លាភាព ១០០% និងបើកចំហរាយការណ៍វឌ្ឍនភាពជូនសាធារណជនជាប្រចាំ។`;
    }

    return `📋 **[សេចក្តីសន្និដ្ឋានរួម & ផែនការសកម្មភាពអន្តរក្រសួង]**\n` +
      `ផ្អែកលើការពិភាក្សាដេញដោលគ្នាយ៉ាងស្វិតស្វាញរវាងស្ថាប័នពាក់ព័ន្ធ គណៈសម្របសម្រួលជាន់ខ្ពស់ AGI សូមដាក់ចេញផែនការអនុវត្តរួម ៖\n\n` +
      `${specificPlan}\n\n` +
      `*(កំណត់ហេតុកិច្ចប្រជុំនេះត្រូវបានកត់ត្រាទុកក្នុងប្រព័ន្ធអចិន្ត្រៃយ៍ និងរាយការណ៍ជូនសម្តេចធិបតីនាយករដ្ឋមន្ត្រី និង Super Admin រួចរាល់)* ៕`;
  }

  private static selectParticipatingAgents(category: string, topic: string): string[] {
    const t = topic.toLowerCase();

    if (t.includes('ចរាចរណ៍') || t.includes('ស្រវឹង') || t.includes('បុក') || category === 'TRAFFIC_SAFETY') {
      return ['/police', '/mpwt', '/moj', '/acu'];
    }
    if (t.includes('ឆបោក') || t.includes('អនឡាញ') || t.includes('ល្បែង') || category === 'CYBER_FRAUD') {
      return ['/mptc', '/police', '/moj', '/acu'];
    }
    if (t.includes('ដីធ្លី') || t.includes('ប្លង់') || t.includes('ព្រំ') || category === 'LAND_DISPUTE_RIGHTS') {
      return ['/mlmupc', '/moj', '/interior', '/acu'];
    }
    if (t.includes('ពុករលួយ') || t.includes('សំណូក') || t.includes('ទារលុយ') || category === 'CORRUPTION_NEPOTISM') {
      return ['/acu', '/interior', '/moj'];
    }
    if (t.includes('ពន្ធ') || t.includes('គយ') || t.includes('សេដ្ឋកិច្ច') || t.includes('លុយ')) {
      return ['/mef', '/tax', '/customs', '/moc'];
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

    return ['/interior', '/moj', '/acu'];
  }
}
