export interface CredibilityEvaluation {
  score: number; // 0.0 to 100.0%
  level: 'OFFICIAL_VERIFIED' | 'HIGH_CREDIBILITY' | 'PENDING_VERIFICATION';
  badge: string;
  auditReasons: string[];
}

export class NewsCredibilityEngine {
  private static officialKeywords = [
    'ក្រសួង', 'រាជរដ្ឋាភិបាល', 'ទីស្តីការគណៈរដ្ឋមន្ត្រី', 'រដ្ឋសភា', 'ព្រឹទ្ធសភា',
    'អគ្គស្នងការដ្ឋាន', 'កងយោធពលខេមរភូមិន្ទ', 'រដ្ឋបាលខេត្ត', 'សេចក្តីថ្លែងការណ៍',
    'ក្រសួងការពារជាតិ', 'ក្រសួងការបរទេស', 'សេចក្តីប្រកាស', 'មាត្រា ៥១', 'រដ្ឋធម្មនុញ្ញ',
    'អង្គភាពប្រឆាំងអំពើពុករលួយ', 'ACU'
  ];

  public static evaluateCredibility(title: string, content: string, sourceName = 'Official'): CredibilityEvaluation {
    let score = 80.0;
    const auditReasons: string[] = [];

    // 1. State/Ministry Source Verification (+15%)
    const isOfficialSource = /(?:Ministry|AKP|Government|រដ្ឋ|ក្រសួង|រដ្ឋបាល|អគ្គ|ACU)/i.test(sourceName);
    if (isOfficialSource) {
      score += 15.0;
      auditReasons.push('✅ ប្រភពចេញពីស្ថាប័នរដ្ឋ/ក្រសួងផ្លូវការ (+១៥%)');
    }

    // 2. Official Keyword Cross-Reference (+5%)
    const matchedKws = this.officialKeywords.filter(kw => title.includes(kw) || content.includes(kw));
    if (matchedKws.length > 0) {
      score += 5.0;
      auditReasons.push(`✅ មានពាក្យគន្លឹះផ្លូវការ ៖ ${matchedKws.slice(0, 3).join(', ')} (+៥%)`);
    }

    // 3. Constitutional Article 51 / Rule of Law Reference (+5%)
    if (content.includes('មាត្រា ៥១') || content.includes('រដ្ឋធម្មនុញ្ញ') || content.includes('នីតិរដ្ឋ')) {
      score += 5.0;
      auditReasons.push('✅ យោងលើមាត្រា ៥១ នៃរដ្ឋធម្មនុញ្ញ & នីតិរដ្ឋ (+៥%)');
    }

    const finalScore = Math.min(score, 100.0);

    let badge = '🟡 ស្ថិតក្នុងការផ្ទៀងផ្ទាត់ (Pending Verification): ៦៥% - ៨៤%';
    let level: CredibilityEvaluation['level'] = 'PENDING_VERIFICATION';

    if (finalScore >= 95.0) {
      badge = '🟢 ភាពជឿជាក់ផ្លូវការ (Official Credibility): ៩៥% - ១០០%';
      level = 'OFFICIAL_VERIFIED';
    } else if (finalScore >= 85.0) {
      badge = '🔵 ភាពជឿជាក់ខ្ពស់ (High Credibility): ៨៥% - ៩៤%';
      level = 'HIGH_CREDIBILITY';
    }

    return {
      score: Math.round(finalScore * 10) / 10,
      level,
      badge,
      auditReasons
    };
  }
}
