import fs from 'node:fs';
import path from 'node:path';

export interface LegalArticle {
  code_name: string;
  chapter?: string;
  section?: string;
  article: string;
  category?: string;
  title: string;
  summary: string;
  full_text: string;
  keywords?: string[];
}

export interface GroundedLegalMatch {
  article: LegalArticle;
  groundingScore: number;
  matchedFactSignals: string[];
  isFactGrounded: boolean;
}

const FACT_SIGNAL_GROUPS: Array<{ domain: string; triggers: RegExp; lawHints: RegExp }> = [
  {
    domain: 'traffic_drunk_driving',
    triggers: /(ចរាចរណ៍|បើកបរ|ស្រវឹង|អាកុល|គ្រោះថ្នាក់|បុក|ល្បឿន)/i,
    lawHints: /(ចរាចរណ៍|ផ្លូវគោក|គ្រឿងស្រវឹង|គ្រោះថ្នាក់)/i
  },
  {
    domain: 'cyber_fraud_scam',
    triggers: /(ឆបោក|អនឡាញ|សាយប័រ|ល្បែង|ហែក|បន្លំ|scam|cyber|fake news|ព័ត៌មានក្លែងក្លាយ)/i,
    lawHints: /(បច្ចេកវិទ្យា|អ៊ីនធឺណិត|ឆបោក|ព័ត៌មានក្លែងក្លាយ|សាយប័រ|ពាណិជ្ជកម្មតាមប្រព័ន្ធអេឡិចត្រូនិក)/i
  },
  {
    domain: 'land_property_dispute',
    triggers: /(ដីធ្លី|ប្លង់|ដី|ព្រំ|ទន្ទ្រាន|កម្មសិទ្ធិ|សំណង់)/i,
    lawHints: /(ដីធ្លី|ភូមិបាល|កម្មសិទ្ធិ|សំណង់|អចលនវត្ថុ)/i
  },
  {
    domain: 'anti_corruption_bribery',
    triggers: /(ពុករលួយ|សំណូក|សូកប៉ាន់|ទារលុយ|ជំរិត|កេងប្រវ័ញ្ច|acu)/i,
    lawHints: /(ប្រឆាំងអំពើពុករលួយ|សូកប៉ាន់|សំណូក|មន្ត្រីរាជការស៊ីវិល|acu)/i
  },
  {
    domain: 'tax_customs_finance',
    triggers: /(ពន្ធ|គយ|អាករ|ថវិកា|ហិរញ្ញវត្ថុ|ធនាគារ|វិនិយោគ|vat|tax)/i,
    lawHints: /(សារពើពន្ធ|ពន្ធដារ|គយ|ហិរញ្ញវត្ថុ|ធនាគារ|វិនិយោគ|សម្អាតប្រាក់)/i
  },
  {
    domain: 'constitution_democracy_rights',
    triggers: /(រដ្ឋធម្មនុញ្ញ|ប្រជាធិបតេយ្យ|ពហុបក្ស|សិទ្ធិមនុស្ស|បោះឆ្នោត|នីតិរដ្ឋ|មាត្រា ៥១)/i,
    lawHints: /(រដ្ឋធម្មនុញ្ញ|ប្រជាធិបតេយ្យ|សិទ្ធិមនុស្ស|បោះឆ្នោត|តុលាការ|ចៅក្រម)/i
  }
];

export class KhmerLegalEngine {
  private static instance: KhmerLegalEngine;
  private laws: LegalArticle[] = [];
  private dataDir: string;

  private constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data/laws');
    if (!fs.existsSync(this.dataDir)) {
      this.dataDir = path.resolve(process.cwd(), 'backend/data/laws');
    }
    this.loadLaws();
  }

  public static getInstance(): KhmerLegalEngine {
    if (!KhmerLegalEngine.instance) {
      KhmerLegalEngine.instance = new KhmerLegalEngine();
    }
    return KhmerLegalEngine.instance;
  }

  private loadLaws(): void {
    if (!fs.existsSync(this.dataDir)) return;

    const files = fs.readdirSync(this.dataDir);
    const seen = new Set<string>();

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.dataDir, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const items = JSON.parse(raw);
          if (Array.isArray(items)) {
            for (const item of items) {
              const key = `${(item.code_name || '').trim()}::${(item.article || '').trim()}`;
              if (!seen.has(key)) {
                seen.add(key);
                this.laws.push(item);
              }
            }
          }
        } catch (err) {
          console.error(`[LegalEngine] Error loading ${file}:`, err);
        }
      }
    }
    console.log(`⚖️ [KhmerLegalEngine] Loaded ${this.laws.length} Cambodian legal articles into index.`);
  }

  private tokenize(text: string): Set<string> {
    const cleaned = text.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').trim();
    const parts = cleaned.split(/\s+/).filter(t => t.length >= 2);
    const set = new Set<string>(parts);
    for (const tok of parts) {
      if (tok.length >= 3) {
        for (let i = 0; i <= tok.length - 3; i++) {
          set.add(tok.slice(i, i + 3));
        }
      }
    }
    return set;
  }

  private semanticOverlapScore(queryTokens: Set<string>, docTokens: Set<string>): number {
    if (queryTokens.size === 0 || docTokens.size === 0) return 0;
    let hits = 0;
    for (const qt of queryTokens) {
      if (docTokens.has(qt)) hits++;
    }
    return hits / Math.sqrt(queryTokens.size * docTokens.size);
  }

  /**
   * Search and verify Cambodian legal articles grounded against factual signals and semantic similarity.
   */
  public searchGroundedLaws(query: string, limit = 3): GroundedLegalMatch[] {
    const qLower = query.toLowerCase();
    const qTokens = this.tokenize(query);
    const activeFactGroups = FACT_SIGNAL_GROUPS.filter(g => g.triggers.test(query));
    const results: GroundedLegalMatch[] = [];

    for (const law of this.laws) {
      const codeName = law.code_name || '';
      const title = law.title || '';
      const summary = law.summary || '';
      const fullText = law.full_text || '';
      const kwList = Array.isArray(law.keywords) ? law.keywords : [];
      const corpusStr = `${codeName} ${title} ${summary} ${fullText} ${kwList.join(' ')}`;
      const docTokens = this.tokenize(corpusStr);

      let score = this.semanticOverlapScore(qTokens, docTokens) * 12;
      const matchedSignals: string[] = [];

      for (const kw of kwList) {
        if (kw && qLower.includes(kw.toLowerCase())) {
          score += 4;
          matchedSignals.push(`kw:${kw}`);
        }
      }

      if (qLower.length >= 3 && title.toLowerCase().includes(qLower)) {
        score += 5;
        matchedSignals.push('title-exact');
      }
      if (qLower.length >= 3 && summary.toLowerCase().includes(qLower)) {
        score += 3;
        matchedSignals.push('summary-match');
      }

      let factMatchCount = 0;
      for (const group of activeFactGroups) {
        if (group.lawHints.test(corpusStr)) {
          score += 9;
          factMatchCount++;
          matchedSignals.push(`fact:${group.domain}`);
        }
      }

      if (score > 0.35 || factMatchCount > 0) {
        const normalized = Math.min(100, Math.round(score * 5));
        results.push({
          article: law,
          groundingScore: normalized,
          matchedFactSignals: matchedSignals,
          isFactGrounded: factMatchCount > 0 || normalized >= 45
        });
      }
    }

    results.sort((a, b) => b.groundingScore - a.groundingScore);
    return results.slice(0, limit);
  }

  public searchRelevantLaws(query: string, limit = 3): LegalArticle[] {
    return this.searchGroundedLaws(query, limit).map(m => m.article);
  }

  public getAntiCorruptionArticles(): LegalArticle[] {
    return this.laws.filter(l => (l.code_name || '').includes('ប្រឆាំងអំពើពុករលួយ')).slice(0, 5);
  }

  public getAntiNepotismAndEthicsArticles(): LegalArticle[] {
    return this.laws.filter(l => (l.code_name || '').includes('មន្ត្រីរាជការស៊ីវិល')).slice(0, 5);
  }

  public getSocialJusticeArticles(): LegalArticle[] {
    return this.laws.filter(l => (l.code_name || '').includes('ចៅក្រម') || (l.code_name || '').includes('សិទ្ធិមនុស្ស')).slice(0, 5);
  }

  public getDemocraticGovernanceArticles(): LegalArticle[] {
    return this.laws.filter(
      l => (l.code_name || '').includes('រដ្ឋធម្មនុញ្ញ') && ((l.article || '').includes('៥១') || (l.summary || '').includes('ប្រជាធិបតេយ្យ'))
    ).slice(0, 3);
  }

  public formatLegalCitations(articles: LegalArticle[]): string {
    if (!articles || articles.length === 0) return '';
    return articles.map((art, idx) => {
      return `${idx + 1}. [${art.code_name}] ${art.article} «${art.title}» ៖ ${art.summary}`;
    }).join('\n');
  }

  public formatGroundedCitations(matches: GroundedLegalMatch[]): string {
    if (!matches || matches.length === 0) return '';
    return matches.map((m, idx) => {
      const art = m.article;
      const statusTag = m.isFactGrounded ? 'ផ្ទៀងផ្ទាត់អង្គហេតុ (Grounded)' : 'ស្រដៀងគ្នាតាមបរិបទ';
      return `${idx + 1}. [${art.code_name}] ${art.article} «${art.title}» (${statusTag} ${m.groundingScore}%) ៖ ${art.summary}`;
    }).join('\n');
  }
}

export const khmerLegalEngine = KhmerLegalEngine.getInstance();