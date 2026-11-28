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
  crossExaminationSummary: string;
  jointResolution: string;
  formattedTelegramDigest: string;
}

export class InterMinisterialDebateEngine {
  public static async deliberateOnTopic(params: {
    topic: string;
    initiatedBy?: string;
  }): Promise<InterMinisterialDebateResult> {
    const { topic, initiatedBy = 'ប្រជាពលរដ្ឋ (Citizen Request)' } = params;
    const dateKhmer = LiveInstitutionalFeedEngine.getCurrentKhmerDate();
    const refCode = LiveInstitutionalFeedEngine.generateOfficialReferenceCode('CABINET');

    const analysis = CambodiaSocialDebateRadar.analyzeDebate(topic, '');
    const groundedLaws = khmerLegalEngine.searchGroundedLaws(topic, 3);
    const lawCitationsStr = groundedLaws.length > 0
      ? khmerLegalEngine.formatGroundedCitations(groundedLaws)
      : khmerLegalEngine.formatLegalCitations(khmerLegalEngine.getDemocraticGovernanceArticles());

    const participants = this.selectParticipatingAgents(analysis.category, topic);

    let debateRoom = db.getRoomById('room-cabinet-council');
    if (!debateRoom) {
      debateRoom = db.createRoom({
        id: 'room-cabinet-council',
        name: '🏛️ កិច្ចប្រជុំបន្ទាន់ AGI អន្តរក្រសួង (Inter-Ministerial Cabinet)',
        topic: 'ការជជែកដេញដោល និងដោះស្រាយប្រធានបទក្តៅរបស់សង្គមជាតិ'
      });
    }

    const statements: DebateStatement[] = [];

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
        senderType: 'agent',
        senderId: `agent-${agentCommand.replace('/', '')}`,
        senderName: agentName,
        content: text
      });

      HttpApiServer.broadcast({
        type: 'NEW_MESSAGE',
        message: saved,
        roomId: debateRoom!.id
      });

      return stmt;
    };

    const rexIntro = `«សូមជម្រាបសួរឯកឧត្តម លោកជំទាវ តំណាងស្ថាប័នពាក់ព័ន្ធទាំងអស់។ កិច្ចប្រជុំអន្តរក្រសួងត្រូវបានកោះប្រជុំលើប្រធានបទ ៖ **«${topic}»** (ផ្តួចផ្តើមដោយ ៖ ${initiatedBy})។\n\n` +
      `មូលដ្ឋានច្បាប់ដែលបានផ្ទៀងផ្ទាត់ (Fact-Grounded Legal Corpus) ៖\n${lawCitationsStr}\n\n` +
      `សូមស្ថាប័ននីមួយៗបញ្ចេញទស្សនៈជំនាញ ផ្ទៀងផ្ទាត់ភស្តុតាងគ្នាទៅវិញទៅមក (Cross-Examination) មុនពេលកំណត់សេចក្តីសម្រេចរួម។»`;
    recordStatement('/rex', 'Rex Lead Orchestrator', 'អ្នកសម្របសម្រួលជាន់ខ្ពស់ AGI ANGKOR EYES', rexIntro);

    // Round 1: Distinct domain arguments from each participating institution
    for (let i = 0; i < participants.length; i++) {
      const cmd = participants[i];
      const details = LiveInstitutionalFeedEngine.getInstitutionDetails(cmd);
      const stmtText = await this.generateDistinctArgument({
        agentCommand: cmd,
        agentName: details.name,
        topic,
        priorStatements: statements,
        lawCitationsStr,
        hotline: details.hotline
      });
      recordStatement(cmd, details.name, `តំណាង ${details.name}`, stmtText);
    }

    // Round 2: Cross-Examination & Fact-Check between key institutions
    if (participants.length >= 2) {
      const challengerCmd = participants[participants.length - 1];
      const targetCmd = participants[0];
      const challenger = LiveInstitutionalFeedEngine.getInstitutionDetails(challengerCmd);
      const target = LiveInstitutionalFeedEngine.getInstitutionDetails(targetCmd);

      const crossExamText = await this.generateCrossExamination({
        challengerCmd,
        challengerName: challenger.name,
        targetName: target.name,
        topic,
        statements,
        lawCitationsStr,
        hotline: challenger.hotline
      });
      recordStatement(challengerCmd, challenger.name, `ការសួរដេញដោល & ផ្ទៀងផ្ទាត់ (${challenger.name})`, crossExamText);
    }

    const crossExamSummary = statements[statements.length - 1]?.statement || '';
    const resolutionText = this.generateJointResolution(topic, participants, lawCitationsStr);
    recordStatement('/rex', 'Rex Lead Orchestrator', 'សេចក្តីសន្និដ្ឋានរួម AGI ANGKOR EYES', resolutionText);

    let tgDigest = `🇰🇭 **កិច្ចពិភាក្សាដេញដោលអន្តរក្រសួង AGI (Cross-Examined & Grounded)**\n\n` +
      `📅 **កាលបរិច្ឆេទ** ៖ ${dateKhmer}\n` +
      `📑 **លេខកូដកិច្ចប្រជុំ** ៖ \`${refCode}\`\n` +
      `🔥 **ប្រធានបទ** ៖ «**${topic}**»\n` +
      `══════════════════════════════════════\n\n`;

    for (const s of statements) {
      tgDigest += `💬 **${s.agentName}** (${s.roleTitle}) ៖\n${s.statement}\n\n──────────────────────────────────────\n\n`;
    }

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(tgDigest);

    return {
      topic,
      category: analysis.category,
      dateKhmer,
      referenceCode: refCode,
      participatingAgents: participants,
      statements,
      crossExaminationSummary: crossExamSummary,
      jointResolution: resolutionText,
      formattedTelegramDigest: cleanText
    };
  }

  private static async generateDistinctArgument(params: {
    agentCommand: string;
    agentName: string;
    topic: string;
    priorStatements: DebateStatement[];
    lawCitationsStr: string;
    hotline: string;
  }): Promise<string> {
    const { agentCommand, agentName, topic, priorStatements, lawCitationsStr, hotline } = params;

    try {
      const llmRes = await LLMGateway.generateResponse({
        messages: [
          {
            role: 'system',
            content: `You are the official representative of ${agentName} (${agentCommand}) in Cambodia. Give a focused, distinct institutional position in formal Khmer grounded in the cited laws. Do NOT repeat earlier speakers' wording.`
          },
          {
            role: 'user',
            content: `Topic: "${topic}"\nGrounded Laws:\n${lawCitationsStr}\nEarlier remarks:\n${priorStatements.map(s => `${s.agentName}: ${s.statement}`).join('\n')}\nProvide your institution's distinct enforcement/policy stance and hotline (${hotline}) in 2 concise Khmer paragraphs.`
          }
        ],
        preferredModel: 'gemini-2.5-flash'
      });
      if (llmRes && llmRes.provider !== 'simulation' && llmRes.content.trim().length > 35) {
        return `«${llmRes.content.trim().replace(/^«|»$/g, '')}»`;
      }
    } catch {
      // Fallback below
    }

    const roleStance: Record<string, string> = {
      '/police': `«តំណាង ${agentName} សូមបញ្ជាក់ពីទិដ្ឋភាពប្រតិបត្តិការសន្តិសុខ និងសណ្តាប់ធ្នាប់លើករណី «${topic}» ៖ កម្លាំងជំនាញត្រូវកំណត់គោលដៅភស្តុតាងជាក់ស្តែង ការពារសុវត្ថិភាពពលរដ្ឋនៅនឹងកន្លែង និងកសាងសំណុំរឿងតាមនីតិវិធីច្បាប់ ដោយមិនត្រូវពន្យារពេល ឬទទួលការជ្រៀតជ្រែកក្រៅច្បាប់ឡើយ (Hotline ៖ ${hotline}) ៕»`,
      '/mpwt': `«តំណាង ${agentName} សូមលើកឡើងពីទិដ្ឋភាពហេដ្ឋារចនាសម្ព័ន្ធ និងបច្ចេកទេសចរាចរណ៍លើ «${topic}» ៖ ត្រូវផ្អែកលើទិន្នន័យសុវត្ថិភាពផ្លូវថ្នល់ ផ្លាកសញ្ញា និងប្រព័ន្ធកត់ត្រាផ្លូវការ ដើម្បីកាត់បន្ថយហានិភ័យ និងធានាការអនុវត្តវិធានការឱ្យមានសង្គតិភាពជាមួយស្ថាប័នអនុវត្តច្បាប់ (Hotline ៖ ${hotline}) ៕»`,
      '/moj': `«តំណាង ${agentName} សូមផ្ទៀងផ្ទាត់អង្គច្បាប់ និងនីតិវិធីយុត្តិធម៌លើ «${topic}» ៖ គ្រប់វិធានការត្រូវគោរពគោលការណ៍នីតិរដ្ឋ សិទ្ធិតវ៉ា និងសមភាពចំពោះមុខច្បាប់ ដោយបែងចែកឱ្យច្បាស់រវាងការពិន័យរដ្ឋបាល និងបទល្មើសព្រហ្មទណ្ឌដែលមានភស្តុតាងគ្រប់គ្រាន់ (Hotline ៖ ${hotline}) ៕»`,
      '/acu': `«តំណាង ${agentName} សូមសង្កត់ធ្ងន់លើភាពស្អាតស្អំ និងការប្រឆាំងអំពើពុករលួយក្នុងការអនុវត្ត «${topic}» ៖ ត្រូវមានបង្កាន់ដៃ/ភស្តុតាងតម្លាភាពគ្រប់ដំណាក់កាល ហាមឃាត់ការទារកម្រៃក្រៅផ្លូវការ និងបើកច្រកប្តឹងសម្ងាត់ជូនពលរដ្ឋតាម Hotline ៖ ${hotline} ៕»`,
      '/mptc': `«តំណាង ${agentName} សូមលើកឡើងពីទិដ្ឋភាពហេដ្ឋារចនាសម្ព័ន្ធឌីជីថល និងសន្តិសុខសាយប័រលើ «${topic}» ៖ ត្រូវផ្ទៀងផ្ទាត់ប្រភពទិន្នន័យ ទប់ស្កាត់គណនី/គេហទំព័រក្លែងក្លាយ និងរក្សាភស្តុតាងឌីជីថលឱ្យបានត្រឹមត្រូវសម្រាប់ការស៊ើបអង្កេត (Hotline ៖ ${hotline}) ៕»`,
      '/mlmupc': `«តំណាង ${agentName} សូមបញ្ជាក់ពីការផ្ទៀងផ្ទាត់ឯកសិទ្ធិដីធ្លី និងលំហភូមិសាស្ត្រលើ «${topic}» ៖ ត្រូវពិនិត្យប្លង់ ក្បាលដី និងកំណត់ហេតុវាស់វែងជាក់ស្តែង ដើម្បីការពារសិទ្ធិស្របច្បាប់ និងទប់ស្កាត់ការក្លែងបន្លំឯកសារ (Hotline ៖ ${hotline}) ៕»`,
      '/mef': `«តំណាង ${agentName} សូមពិនិត្យលើផលប៉ះពាល់ថវិកា និងស្ថិរភាពសេដ្ឋកិច្ចលើ «${topic}» ៖ វិធានការនានាត្រូវមានភាពសមហេតុផលផ្នែកហិរញ្ញវត្ថុ លើកទឹកចិត្តធុរកិច្ចស្របច្បាប់ និងគ្រប់គ្រងចំណូលចំណាយតាមប្រព័ន្ធផ្លូវការ (Hotline ៖ ${hotline}) ៕»`
    };

    return roleStance[agentCommand] ||
      `«តំណាង ${agentName} សូមបញ្ជាក់ជំហររបស់ស្ថាប័នលើ «${topic}» ៖ ត្រូវផ្អែកលើអង្គហេតុជាក់ស្តែង កាតព្វកិច្ចតាមច្បាប់ និងការសម្របសម្រួលជាមួយស្ថាប័នពាក់ព័ន្ធ ដើម្បីដោះស្រាយឱ្យមានប្រសិទ្ធភាព (Hotline ៖ ${hotline}) ៕»`;
  }

  private static async generateCrossExamination(params: {
    challengerCmd: string;
    challengerName: string;
    targetName: string;
    topic: string;
    statements: DebateStatement[];
    lawCitationsStr: string;
    hotline: string;
  }): Promise<string> {
    const { challengerCmd, challengerName, targetName, topic, statements, lawCitationsStr, hotline } = params;

    try {
      const llmRes = await LLMGateway.generateResponse({
        messages: [
          {
            role: 'system',
            content: `You are ${challengerName} (${challengerCmd}) conducting a cross-examination and fact-check of the preceding arguments in Khmer. Challenge any unsupported claim, demand verifiable evidence/statutory grounding, and propose a concrete check.`
          },
          {
            role: 'user',
            content: `Topic: "${topic}"\nGrounded Laws:\n${lawCitationsStr}\nArguments to cross-examine:\n${statements.slice(1).map(s => `${s.agentName}: ${s.statement}`).join('\n')}\nWrite a sharp, constructive Khmer cross-examination note referencing ${targetName} and hotline ${hotline}.`
          }
        ],
        preferredModel: 'gemini-2.5-flash'
      });
      if (llmRes && llmRes.provider !== 'simulation' && llmRes.content.trim().length > 35) {
        return `«[Cross-Examination / Fact-Check] ${llmRes.content.trim().replace(/^«|»$/g, '')}»`;
      }
    } catch {
      // Fallback below
    }

    return `«[Cross-Examination & Fact-Check ដោយ ${challengerName}] ដើម្បីធានាថាកិច្ចអន្តរាគមន៍លើ «${topic}» មិនផ្អែកលើការសន្និដ្ឋានខ្វះភស្តុតាង ស្ថាប័នសូមដាក់សំណួរផ្ទៀងផ្ទាត់ទៅកាន់ ${targetName} និងអង្គប្រជុំ ៖ ១. តើករណីនីមួយៗមានភស្តុតាង/កំណត់ហេតុផ្ទៀងផ្ទាត់ច្បាស់លាស់ដែរឬទេ? ២. តើការអនុវត្តបានភ្ជាប់យន្តការត្រួតពិនិត្យកុំឱ្យមានការរំលោភសិទ្ធិ ឬទារកម្រៃក្រៅច្បាប់រួចហើយឬនៅ? ប្រសិនបើមានភាពមិនប្រក្រតី ពលរដ្ឋអាចរាយការណ៍មកកាន់ Hotline ៖ ${hotline} ដើម្បីផ្ទៀងផ្ទាត់ភ្លាមៗ ៕»`;
  }

  private static generateJointResolution(topic: string, participants: string[], lawCitationsStr: string): string {
    return `📋 **[សេចក្តីសន្និដ្ឋានរួមក្រោយការជជែក និង Cross-Examination]**\n` +
      `ប្រធានបទ ៖ «${topic}» | ស្ថាប័នចូលរួម ៖ ${participants.join(', ')}\n\n` +
      `• **១. ការផ្ទៀងផ្ទាត់អង្គហេតុ និងច្បាប់** ៖ អនុវត្តដោយផ្អែកលើភស្តុតាងជាក់ស្តែង និងមាត្រាច្បាប់ដែលបានផ្ទៀងផ្ទាត់ (មិនប្រើការសន្និដ្ឋានខ្វះមូលដ្ឋាន)។\n` +
      `• **២. ការចាត់ការឆ្លងស្ថាប័ន** ៖ បែងចែកភារកិច្ចច្បាស់លាស់តាមសមត្ថកិច្ចជំនាញ និងកំណត់ពេលវេលាឆ្លើយតបឱ្យបានឆាប់រហ័ស។\n` +
      `• **៣. យន្តការឃ្លាំមើល និងតម្លាភាព** ៖ រក្សាឯកសារ/ភស្តុតាងសវនកម្ម និងទទួលពាក្យបណ្តឹងសម្ងាត់ដើម្បីការពារយុត្តិធម៌សង្គម។\n\n` +
      `⚖️ **មាត្រាច្បាប់យោងដែលបានពិនិត្យ** ៖\n${lawCitationsStr} ៕`;
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
    return ['/interior', '/moj', '/acu'];
  }
}