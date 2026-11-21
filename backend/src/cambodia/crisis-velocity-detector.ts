import { KhmerLanguageAuditor } from './khmer-auditor.js';

export interface CrisisEngagementMetrics {
  topicId: string;
  topicTitle: string;
  elapsedMinutes: number;
  likes: number;
  comments: number;
  shares: number;
  views?: number;
}

export interface CrisisMomentumReport {
  topicId: string;
  topicTitle: string;
  elapsedMinutes: number;
  velocityPerMinute: number;
  sharesRatio: number;
  commentsRatio: number;
  crisisScore: number; // 0 to 100
  classification: 'VIRAL_EXPLOSION' | 'STRONG_TRACTION' | 'NORMAL_PUBLIC_INTEREST' | 'LOW_MOMENTUM';
  urgentClarificationRequired: boolean;
  recommendedResponseWindowMinutes: number;
  urgencyKhmerReason: string;
  pressClarificationDraftKhmer: string;
}

export class CrisisMomentumDetector {
  private static WEIGHT_LIKE = 1.0;
  private static WEIGHT_COMMENT = 3.5;
  private static WEIGHT_SHARE = 6.0;
  private static WEIGHT_VIEW = 0.05;

  /**
   * Evaluates the crisis propagation velocity and Hawkes process branching factor of a public issue.
   */
  public static evaluateCrisis(metrics: CrisisEngagementMetrics): CrisisMomentumReport {
    const elapsed = Math.max(5.0, metrics.elapsedMinutes);
    const views = metrics.views || 0;

    // 1. Raw weighted engagement points
    const rawPts =
      metrics.likes * this.WEIGHT_LIKE +
      metrics.comments * this.WEIGHT_COMMENT +
      metrics.shares * this.WEIGHT_SHARE +
      views * this.WEIGHT_VIEW;

    // 2. Velocity per minute with time dampening
    const timeFactor = Math.pow(elapsed / 60.0 + 1.0, 0.45);
    const velocity = (rawPts / elapsed) * (1.0 / timeFactor);

    // 3. Structural ratios
    const safeLikes = Math.max(1.0, metrics.likes);
    const sharesRatio = metrics.shares / safeLikes;
    const commentsRatio = metrics.comments / safeLikes;

    // 4. Hawkes Process Branching Factor Proxy
    let branchingBoost = 1.0;
    if (sharesRatio >= 0.30) {
      branchingBoost += 0.40; // Explosive viral compounding
    } else if (sharesRatio >= 0.15) {
      branchingBoost += 0.20;
    }

    if (commentsRatio >= 0.20) {
      branchingBoost += 0.15; // High debate heat
    }

    // 5. Composite Crisis Score (0.0 to 100.0)
    const baseScore = 50.0 * (1.0 - Math.exp(-velocity * 0.45));
    const ratioScore = Math.min(35.0, sharesRatio * 70.0 + commentsRatio * 30.0);
    const volumeScore = Math.min(15.0, (rawPts / 500.0) * 15.0);

    let compositeScore = (baseScore + ratioScore + volumeScore) * branchingBoost;
    compositeScore = Math.round(Math.min(100.0, Math.max(0.0, compositeScore)) * 10) / 10;

    // 6. Classification & Thresholds
    let classification: CrisisMomentumReport['classification'] = 'LOW_MOMENTUM';
    let urgentClarification = false;
    let windowMin = 1440; // 24 hours
    let reason = 'ចលនាកង្វល់នៅកម្រិតធម្មតា មិនទាន់ទាមទារសេចក្តីថ្លែងការណ៍បន្ទាន់ឡើយ ៕';

    if (compositeScore >= 80.0) {
      classification = 'VIRAL_EXPLOSION';
      urgentClarification = true;
      windowMin = 30; // 30 mins
      reason = `ល្បឿនចែកចាយខ្ពស់ខ្លាំង (${velocity.toFixed(1)} pts/min) ជាមួយអត្រា Shares ខ្ពស់ (${sharesRatio.toFixed(2)})។ ស្ថាប័នត្រូវចេញសេចក្តីបំភ្លឺក្នុងរយៈពេល ៣០ នាទី ៕`;
    } else if (compositeScore >= 65.0) {
      classification = 'STRONG_TRACTION';
      urgentClarification = true;
      windowMin = 120; // 2 hours
      reason = `ការចាប់អារម្មណ៍របស់សាធារណជនកើនឡើងខ្លាំង (${compositeScore}/100)។ គប្បីត្រៀមព័ត៌មានផ្លូវការបំភ្លឺជូនពលរដ្ឋ ៕`;
    } else if (compositeScore >= 40.0) {
      classification = 'NORMAL_PUBLIC_INTEREST';
      urgentClarification = false;
      windowMin = 360; // 6 hours
      reason = 'កង្វល់សាធារណៈស្ថិតក្នុងគន្លងធម្មតា អាចឆ្លើយតបតាមកាលវិភាគទៀងទាត់ ៕';
    }

    // 7. Draft urgent clarification
    const draftRaw = `
សេចក្តីប្រកាសព័ត៌មាន និងបំភ្លឺជាបន្ទាន់ ៖
ពាក់ព័ន្ធនឹងព័ត៌មានដែលកំពុងត្រូវបានចែកចាយលើបណ្តាញសង្គមស្តីពី "${metrics.topicTitle}"
ស្ថាប័នជំនាញនៃរាជរដ្ឋាភិបាលសូមជម្រាបជូនសាធារណជនមេត្តាជ្រាបថា សមត្ថកិច្ចកំពុងចាត់វិធានការស្រាវជ្រាវយ៉ាងម៉ឺងម៉ាត់ ស្របតាមច្បាប់ និងតម្លាភាព។
សូមបងប្អូនប្រជាពលរដ្ឋរក្សាភាពស្ងប់ស្ងាត់ និងជៀសវាងការចែកចាយព័ត៌មានមិនពិត ឬបំផ្លើស ដែលនាំឱ្យប៉ះពាល់ដល់សណ្តាប់ធ្នាប់សង្គម ៕
`.trim();

    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(draftRaw);

    return {
      topicId: metrics.topicId,
      topicTitle: metrics.topicTitle,
      elapsedMinutes: Math.round(elapsed),
      velocityPerMinute: Math.round(velocity * 100) / 100,
      sharesRatio: Math.round(sharesRatio * 1000) / 1000,
      commentsRatio: Math.round(commentsRatio * 1000) / 1000,
      crisisScore: compositeScore,
      classification,
      urgentClarificationRequired: urgentClarification,
      recommendedResponseWindowMinutes: windowMin,
      urgencyKhmerReason: reason,
      pressClarificationDraftKhmer: cleanText
    };
  }
}
