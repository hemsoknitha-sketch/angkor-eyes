import { KhmerLanguageAuditor } from './khmer-auditor.js';
import { khmerLegalEngine, type LegalArticle } from './legal-engine.js';

export interface SocialTrendAnalysis {
  isViral: boolean;
  viralScore: number; // 0 to 100
  matchedKeywords: string[];
  category: 'CORRUPTION_NEPOTISM' | 'CRIME_SECURITY' | 'LAND_DISPUTE_RIGHTS' | 'TRAFFIC_SAFETY' | 'CYBER_FRAUD' | 'CONSTITUTIONAL_DEMOCRACY' | 'GENERAL_CIVIC';
  topicLabel: string;
  responsibleAgentCommand: string;
  responsibleMinistryKhmer: string;
  legalAnchor: string;
  citedArticles: LegalArticle[];
  actionBriefKhmer: string;
}

export const CAMBODIA_VIRAL_DEBATE_KEYWORDS = [
  // Social Debate & Public Agitation
  'ផ្ទុះការជជែក', 'វែកញ៉ែក', 'មតិរិះគន់', 'ប្រតិកម្ម', 'ប្រជាពលរដ្ឋ', 'សំណូមពរ', 'ជួយស្វែងរកយុត្តិធម៌',
  // Crime & Injustice
  'ឃាតកម្ម', 'ចោរកម្ម', 'ចោរឆក់', 'ចោរប្លន់', 'អយុត្តិធម៌សង្គម', 'ជម្លោះដីធ្លី', 'ហិង្សា', 'អំពើអយុត្តិធម៌',
  // Corruption & Nepotism
  'អំពើពុករលួយ', 'ជំរិតទារប្រាក់', 'ស៊ីសំណូក', 'កេងប្រវ័ញ្ច', 'ល្មើសច្បាប់', 'បក្សពួកនិយម', 'បក្ខពួក', 'អំណាចខុសច្បាប់',
  // Traffic & Public Order
  'គ្រោះថ្នាក់ចរាចរណ៍', 'បុកប៉ះ', 'រត់គេចខ្លួន', 'បើកបរបុក', 'ស្នងការ', 'ស្នងការដ្ឋាន', 'សមត្ថកិច្ច',
  // Online Scams & Cybercrime
  'ឆបោកតាមអនឡាញ', 'បង្ក្រាប', 'ល្បែងស៊ីសង', 'ចាប់ខ្លួន', 'អន្តរាគមន៍', 'ចាត់វិធានការ', 'ជួញដូរមនុស្ស',
  // Governance & Rule of Law
  'រដ្ឋធម្មនុញ្ញ', 'នីតិរដ្ឋ', 'លទ្ធិប្រជាធិបតេយ្យ', 'សិទ្ធិមនុស្ស', 'តម្លាភាព', 'យុត្តិធម៌'
];

export class CambodiaSocialDebateRadar {
  /**
   * Evaluates text from citizen forums, news feeds, or social media to detect breaking debates,
   * calculate viral velocity, and assign responsible ministry spokespersons.
   */
  public static analyzeDebate(title: string, content: string): SocialTrendAnalysis {
    const combined = `${title} ${content}`.toLowerCase();
    const matched = CAMBODIA_VIRAL_DEBATE_KEYWORDS.filter(k => combined.includes(k.toLowerCase()));

    const matchCount = matched.length;
    const hasHighImpactTrigger = ['ផ្ទុះ', 'វែកញ៉ែក', 'អយុត្តិធម៌', 'ពុករលួយ', 'បក្សពួក', 'ឃាតកម្ម', 'គ្រោះថ្នាក់', 'ឆបោក'].some(w => combined.includes(w));
    const baseScore = Math.min(100, matchCount * 14 + (hasHighImpactTrigger ? 35 : 10));
    const isViral = baseScore >= 45 || matchCount >= 2;

    let category: SocialTrendAnalysis['category'] = 'GENERAL_CIVIC';
    let topicLabel = 'ព័ត៌មាន និងកង្វល់ទូទៅរបស់ប្រជាពលរដ្ឋ';
    let agentCmd = '/interior';
    let ministryName = 'ក្រសួងមហាផ្ទៃ';
    let legalAnchor = 'រដ្ឋធម្មនុញ្ញ មាត្រា ៥១ (អំណាចជារបស់ប្រជាពលរដ្ឋ)';
    let citedLaws: LegalArticle[] = [];

    if (['អំពើពុករលួយ', 'ជំរិត', 'ស៊ីសំណូក', 'កេងប្រវ័ញ្ច', 'បក្សពួកនិយម', 'បក្ខពួក'].some(w => combined.includes(w))) {
      category = 'CORRUPTION_NEPOTISM';
      topicLabel = '🔥 ការពារនីតិរដ្ឋ ប្រឆាំងអំពើពុករលួយ និងបក្ខពួកនិយម';
      agentCmd = '/acu';
      ministryName = 'អង្គភាពប្រឆាំងអំពើពុករលួយ (ACU) & ក្រសួងយុត្តិធម៌';
      legalAnchor = 'ច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ និងក្រមសីលធម៌មន្ត្រីរាជការស៊ីវិល';
      citedLaws = khmerLegalEngine.getAntiCorruptionArticles().concat(khmerLegalEngine.getAntiNepotismAndEthicsArticles()).slice(0, 3);
    } else if (['ឃាតកម្ម', 'ចោរកម្ម', 'ចោរឆក់', 'ចោរប្លន់', 'ហិង្សា'].some(w => combined.includes(w))) {
      category = 'CRIME_SECURITY';
      topicLabel = '🚨 សន្តិសុខសង្គម បទល្មើសព្រហ្មទណ្ឌ និងសុវត្ថិភាពភូមិ-ឃុំ';
      agentCmd = '/police';
      ministryName = 'អគ្គស្នងការដ្ឋាននគរបាលជាតិ & ក្រសួងមហាផ្ទៃ';
      legalAnchor = 'ក្រមព្រហ្មទណ្ឌនៃព្រះរាជាណាចក្រកម្ពុជា';
      citedLaws = khmerLegalEngine.searchRelevantLaws('ព្រហ្មទណ្ឌ បទល្មើស សន្តិសុខ').slice(0, 2);
    } else if (['អយុត្តិធម៌', 'ជម្លោះដីធ្លី', 'ស្វែងរកយុត្តិធម៌', 'សិទ្ធិមនុស្ស'].some(w => combined.includes(w))) {
      category = 'LAND_DISPUTE_RIGHTS';
      topicLabel = '⚖️ យុត្តិធម៌សង្គម វិវាទដីធ្លី និងការការពារសិទ្ធិប្រជាពលរដ្ឋ';
      agentCmd = '/mlmupc';
      ministryName = 'ក្រសួងរៀបចំដែនដី នគរូបនីយកម្ម និងសំណង់ & គណៈកម្មាធិការសិទ្ធិមនុស្ស';
      legalAnchor = 'រដ្ឋធម្មនុញ្ញ មាត្រា ៣១ (សិទ្ធិមនុស្ស) & ច្បាប់ភូមិបាលឆ្នាំ២០០១';
      citedLaws = khmerLegalEngine.searchRelevantLaws('ភូមិបាល ដីធ្លី សិទ្ធិមនុស្ស').slice(0, 2);
    } else if (['ចរាចរណ៍', 'គ្រោះថ្នាក់', 'បុកប៉ះ', 'រត់គេច'].some(w => combined.includes(w))) {
      category = 'TRAFFIC_SAFETY';
      topicLabel = '🚗 សុវត្ថិភាពចរាចរណ៍ផ្លូវគោក និងសណ្តាប់ធ្នាប់សាធារណៈ';
      agentCmd = '/mpwt';
      ministryName = 'ក្រសួងសាធារណការ និងដឹកជញ្ជូន & អគ្គស្នងការដ្ឋាននគរបាលជាតិ';
      legalAnchor = 'ច្បាប់ស្តីពីចរាចរណ៍ផ្លូវគោក មាត្រា ៨៣ និង ៨៥';
      citedLaws = khmerLegalEngine.searchRelevantLaws('ចរាចរណ៍ ផ្លូវគោក').slice(0, 2);
    } else if (['ឆបោក', 'អនឡាញ', 'ល្បែងស៊ីសង', 'បង្ក្រាប'].some(w => combined.includes(w))) {
      category = 'CYBER_FRAUD';
      topicLabel = '🛡️ បង្ក្រាបបទល្មើសបច្ចេកវិទ្យា ការឆបោកអនឡាញ និងល្បែងស៊ីសងខុសច្បាប់';
      agentCmd = '/mptc';
      ministryName = 'ក្រសួងប្រៃសណីយ៍ និងទូរគមនាគមន៍ & នគរបាលប្រឆាំងបទល្មើសបច្ចេកវិទ្យា';
      legalAnchor = 'វិធានការសន្តិសុខឌីជីថល និងច្បាប់ស្តីពីការប្រឆាំងការឆបោក';
      citedLaws = khmerLegalEngine.searchRelevantLaws('ទូរគមនាគមន៍ បច្ចេកវិទ្យា').slice(0, 2);
    } else if (['រដ្ឋធម្មនុញ្ញ', 'នីតិរដ្ឋ', 'លទ្ធិប្រជាធិបតេយ្យ'].some(w => combined.includes(w))) {
      category = 'CONSTITUTIONAL_DEMOCRACY';
      topicLabel = '🏛️ នីតិរដ្ឋ អភិបាលកិច្ច និងគោលការណ៍គ្រឹះនៃលទ្ធិប្រជាធិបតេយ្យសេរីពហុបក្ស';
      agentCmd = '/ocm';
      ministryName = 'ទីស្ដីការគណៈរដ្ឋមន្ត្រី & ព្រឹទ្ធសភា';
      legalAnchor = 'រដ្ឋធម្មនុញ្ញនៃព្រះរាជាណាចក្រកម្ពុជា មាត្រា ៥១';
      citedLaws = khmerLegalEngine.getDemocraticGovernanceArticles().slice(0, 2);
    }

    if (citedLaws.length === 0) {
      citedLaws = khmerLegalEngine.getDemocraticGovernanceArticles().slice(0, 1);
    }

    const actionRaw = `
ស្ថាប័នសមត្ថកិច្ច **${ministryName}** (${agentCmd}) ត្រូវចេញសេចក្តីបំភ្លឺ និងចាត់វិធានការដោះស្រាយជាបន្ទាន់ស្របតាម **${legalAnchor}**។
រាល់ការដោះស្រាយត្រូវប្រកាន់ខ្ជាប់នូវគោលការណ៍យុត្តិធម៌សង្គម តម្លាភាព និងប្រឆាំងដាច់ខាតអំពើពុករលួយ និងបក្ខពួកនិយម ៕
`.trim();

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(actionRaw);

    return {
      isViral,
      viralScore: baseScore,
      matchedKeywords: matched,
      category,
      topicLabel,
      responsibleAgentCommand: agentCmd,
      responsibleMinistryKhmer: ministryName,
      legalAnchor,
      citedArticles: citedLaws,
      actionBriefKhmer: cleanText
    };
  }
}
