import { khmerLegalEngine } from './legal-engine.js';
import { NationalIngestionRegistry } from './ingestion-registry.js';
import { KhmerLanguageAuditor } from './khmer-auditor.js';
import { NewsCredibilityEngine } from './credibility-engine.js';
import { PublicSentimentRadar } from './sentiment-radar.js';
import { LLMGateway } from '../llm/gateway.js';

export interface SpokespersonResponse {
  agentName: string;
  roleTitle: string;
  officialContent: string;
  citedLaws: string[];
  credibilityBadge?: string;
  fixesAppliedCount: number;
}

export class InstitutionalSpokespersonOrchestrator {
  /**
   * Generates a fully empowered institutional spokesperson response.
   */
  public static async generateSpokespersonResponse(params: {
    agentCommand: string;
    agentName: string;
    institutionTitle: string;
    userQuery: string;
    model?: string;
  }): Promise<SpokespersonResponse> {
    const { agentCommand, agentName, institutionTitle, userQuery, model } = params;

    // 1. Fetch Live Institutional Ingestion & Briefings
    const briefings = await NationalIngestionRegistry.getLatestBriefings(agentCommand);
    const briefingText = briefings.map(b => `- ${b.title} (${b.date})`).join('\n');

    // 2. Search Relevant Cambodian Laws & Articles
    const relevantLaws = khmerLegalEngine.searchRelevantLaws(userQuery, 3);
    const antiCorruptionLaws = khmerLegalEngine.getAntiCorruptionArticles();
    const antiNepotismLaws = khmerLegalEngine.getAntiNepotismAndEthicsArticles();
    const democracyLaws = khmerLegalEngine.getDemocraticGovernanceArticles();

    // 3. Evaluate Sentiment & Urgency
    const sentiment = PublicSentimentRadar.evaluatePublicConcern(userQuery);

    // 4. Construct System Prompt with Sovereign Cambodian Governance Mandates
    const systemPrompt = `
អ្នកគឺជា៖ «${agentName}»
តួនាទីផ្លូវការ៖ តំណាង ទីប្រឹក្សាជាន់ខ្ពស់ និងអ្នកនាំពាក្យផ្លូវការនៃ «${institutionTitle}»

[បេសកកម្ម និងគោលការណ៍គ្រឹះមិនអាចរំលោភបាន]៖
១. ជំរុញការអភិវឌ្ឍសង្គមជាតិ លើកកម្ពស់ជីវភាពប្រជាពលរដ្ឋ និងសេដ្ឋកិច្ចប្រកបដោយចីរភាព។
២. ពង្រឹងយុត្តិធម៌សង្គម នីតិរដ្ឋ សមភាពនៅចំពោះមុខច្បាប់ និងការការពារសិទ្ធិស្របច្បាប់របស់ប្រជាពលរដ្ឋ។
៣. ប្រឆាំងដាច់ខាតអំពើពុករលួយ គ្មានការយោគយល់ ឬការលើកលែងឡើយ (ផ្អែកលើច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ)។
៤. ប្រឆាំងដាច់ខាតបក្ខពួកនិយម និងគ្រួសារនិយម លើកកម្ពស់គុណធិបតេយ្យ (Meritocracy) និងក្រមសីលធម៌មន្ត្រីរាជការស៊ីវិល។
៥. គោរព និងអនុវត្តយ៉ាងម៉ឺងម៉ាត់តាមរដ្ឋធម្មនុញ្ញ និងច្បាប់ទាំងអស់នៃព្រះរាជាណាចក្រកម្ពុជា។
៦. គោរពគោលការណ៍គ្រឹះនៃលទ្ធិប្រជាធិបតេយ្យសេរីពហុបក្ស (មាត្រា ៥១ នៃរដ្ឋធម្មនុញ្ញ) បើកចំហទទួលស្តាប់មតិរិះគន់ស្ថាបនា។

[ព័ត៌មាន និងសេចក្តីប្រកាសចុងក្រោយនៃស្ថាប័នរបស់អ្នក]៖
${briefingText || 'បន្តបម្រើសេវាសាធារណៈជូនប្រជាពលរដ្ឋតាមស្តង់ដារគុណភាព និងតម្លាភាព។'}

[មាត្រាច្បាប់កម្ពុជាជាមូលដ្ឋានយោង]៖
${khmerLegalEngine.formatLegalCitations(relevantLaws.length > 0 ? relevantLaws : [...antiCorruptionLaws.slice(0, 1), ...democracyLaws.slice(0, 1)])}

[របៀបឆ្លើយ]៖
- ឆ្លើយជាភាសាខ្មែរផ្លូវការ ថ្លៃថ្នូរ មានវិជ្ជាជីវៈខ្ពស់ ផ្អែកលើទិន្នន័យជាក់ស្តែង និងច្បាប់រដ្ឋ។
- លើកយកដំណោះស្រាយជាក់ស្តែង (Concrete Actionable Solutions) ចំពោះបញ្ហាចំពោះមុខ។
- បញ្ចប់ដោយការប្តេជ្ញាចិត្តស្មោះត្រង់ចំពោះជាតិ មាតុភូមិ និងប្រជាពលរដ្ឋ។
`.trim();

    // 5. Query LLM Gateway
    const llmRes = await LLMGateway.generateResponse({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sentiment.sanitizedSummary }
      ],
      preferredModel: model || 'gemini-2.5-flash'
    });

    // 6. Audit & Purify Output through Chuon Nath Khmer Auditor
    const { cleanText, fixesAppliedCount } = KhmerLanguageAuditor.auditAndPurify(llmRes.content);

    // 7. Calculate Credibility Badge
    const credibility = NewsCredibilityEngine.evaluateCredibility(
      institutionTitle,
      cleanText,
      institutionTitle
    );

    return {
      agentName,
      roleTitle: institutionTitle,
      officialContent: cleanText,
      citedLaws: relevantLaws.map(l => `${l.code_name} - ${l.article}`),
      credibilityBadge: credibility.badge,
      fixesAppliedCount
    };
  }
}
