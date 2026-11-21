export interface SentimentBreakdown {
  supportPct: number;
  concernPct: number;
  proposalPct: number;
  urgencyScore: number;
  isUrgentCivicIssue: boolean;
  sanitizedSummary: string;
}

export class PublicSentimentRadar {
  /**
   * Sanitizes citizen comments and queries by scrubbing PII, phone numbers, and direct handles.
   */
  public static sanitizeCitizenInput(text: string): string {
    if (!text) return '';
    let cleaned = text;
    // Strip URLs
    cleaned = cleaned.replace(/https?:\/\/\S+|www\.\S+/gi, '[URL_REMOVED]');
    // Strip Telegram/FB user handle mentions
    cleaned = cleaned.replace(/@\w+/g, '[CITIZEN]');
    // Strip telephone numbers (8 to 11 digits)
    cleaned = cleaned.replace(/\b0\d{1,2}[- ]?\d{3}[- ]?\d{3,4}\b/g, '[PHONE_PROTECTED]');
    return cleaned.trim();
  }

  /**
   * Evaluates the tone and urgency of public civic concerns.
   */
  public static evaluatePublicConcern(text: string): SentimentBreakdown {
    const sanitized = this.sanitizeCitizenInput(text);
    const textLower = sanitized.toLowerCase();

    let concernCount = 0;
    let proposalCount = 0;
    let supportCount = 0;

    // Concern indicators
    const concernWords = ['ព្រួយបារម្ភ', 'បញ្ហា', 'ខ្វះខាត', 'យឺតយ៉ាវ', 'អយុត្តិធម៌', 'រងគ្រោះ', 'ជម្លោះ', 'ពុករលួយ', 'បក្ខពួក', 'បាត់បង់'];
    // Proposal indicators
    const proposalWords = ['ស្នើសុំ', 'សំណូមពរ', 'ដំណោះស្រាយ', 'កែលម្អ', 'ជួយអន្តរាគមន៍', 'វិធានការ', 'សំណើ'];
    // Support indicators
    const supportWords = ['គាំទ្រ', 'សាទរ', 'ជោគជ័យ', 'អរគុណ', 'ពេញចិត្ត', 'រីកចម្រើន', 'កោតសរសើរ'];

    for (const w of concernWords) {
      if (textLower.includes(w)) concernCount++;
    }
    for (const w of proposalWords) {
      if (textLower.includes(w)) proposalCount++;
    }
    for (const w of supportWords) {
      if (textLower.includes(w)) supportCount++;
    }

    const total = Math.max(1, concernCount + proposalCount + supportCount);
    const concernPct = Math.round((concernCount / total) * 100);
    const proposalPct = Math.round((proposalCount / total) * 100);
    const supportPct = Math.round((supportCount / total) * 100);

    const urgencyScore = concernCount * 2 + proposalCount;
    const isUrgentCivicIssue = urgencyScore >= 3 || textLower.includes('បន្ទាន់') || textLower.includes('អន្តរាគមន៍បន្ទាន់');

    return {
      supportPct,
      concernPct,
      proposalPct,
      urgencyScore,
      isUrgentCivicIssue,
      sanitizedSummary: sanitized
    };
  }
}
