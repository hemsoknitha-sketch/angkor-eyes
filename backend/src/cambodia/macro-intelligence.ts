export interface CambodiaMacroIndicators {
  exchangeRateUsdKhr: number; // e.g. 4075 KHR/USD
  annualInflationPct: number; // e.g. 2.4%
  centralBankReservesUsdBillion: number; // e.g. $21.5B
  nbcPolicyRatePct: number; // e.g. 3.25%
  csxIndex: number; // Cambodia Securities Exchange
  goldOunceUsd: number; // Global Spot Gold
  goldDamlungKhr: number; // Gold per Damlung (1.2 oz) in Khmer Riel
  asOfDate: string;
}

export class CambodiaMacroIntelligence {
  private static cachedIndicators: CambodiaMacroIndicators = {
    exchangeRateUsdKhr: 4075,
    annualInflationPct: 2.3,
    centralBankReservesUsdBillion: 21.8,
    nbcPolicyRatePct: 3.25,
    csxIndex: 462.5,
    goldOunceUsd: 2680.5,
    goldDamlungKhr: 13125000,
    asOfDate: new Date().toISOString()
  };

  public static getMacroIndicators(): CambodiaMacroIndicators {
    return {
      ...this.cachedIndicators,
      asOfDate: new Date().toLocaleDateString('km-KH')
    };
  }

  /**
   * Formats a formal macroeconomic briefing for the Ministry of Economy & Finance (MEF)
   * and National Bank of Cambodia (NBC).
   */
  public static getFormattedMacroBriefing(): string {
    const ind = this.getMacroIndicators();
    return `
📊 **សូចនាករសេដ្ឋកិច្ចម៉ាក្រូ & ហិរញ្ញវត្ថុជាតិ (MACROECONOMIC INDICATORS)** ៖
• អត្រាប្តូរប្រាក់ផ្លូវការ (NBC Benchmark) ៖ **១ ដុល្លារ = ${ind.exchangeRateUsdKhr.toLocaleString()} រៀល**
• អត្រាអតិផរណាប្រចាំឆ្នាំ ៖ **${ind.annualInflationPct}%** (ស្ថិតក្នុងរង្វង់គ្រប់គ្រងបានល្អ)
• ទុនបម្រុងអន្តរជាតិជាតិ (NBC Foreign Reserves) ៖ **~${ind.centralBankReservesUsdBillion} ពាន់លានដុល្លារអាមេរិក**
• សន្ទស្សន៍ផ្សារមូលបត្រកម្ពុជា (CSX Index) ៖ **${ind.csxIndex} ពិន្ទុ**
• តម្លៃមាសអន្តរជាតិ (Spot Gold) ៖ **\$${ind.goldOunceUsd.toLocaleString()} / Ounce** (~${(ind.goldDamlungKhr / 1000000).toFixed(2)} លានរៀល/តម្លឹង)
`.trim();
  }
}
