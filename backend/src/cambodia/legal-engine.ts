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
              const key = `${item.code_name || ''}-${item.article || ''}`;
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

  /**
   * Search relevant Cambodian laws based on keywords, topics, or citizen concerns.
   */
  public searchRelevantLaws(query: string, limit = 3): LegalArticle[] {
    const qLower = query.toLowerCase();
    const scored: { item: LegalArticle; score: number }[] = [];

    for (const law of this.laws) {
      let score = 0;
      const titleLower = (law.title || '').toLowerCase();
      const summaryLower = (law.summary || '').toLowerCase();
      const fullTextLower = (law.full_text || '').toLowerCase();

      // Check keywords
      if (law.keywords && Array.isArray(law.keywords)) {
        for (const kw of law.keywords) {
          if (qLower.includes(kw.toLowerCase())) {
            score += 4;
          }
        }
      }

      if (titleLower.includes(qLower)) score += 5;
      if (summaryLower.includes(qLower)) score += 3;
      if (fullTextLower.includes(qLower)) score += 2;

      const codeName = law.code_name || '';

      // Anti-corruption specific triggers
      if (/(?:ពុករលួយ|សូកប៉ាន់|សំណូក|កិបកេង|លុយកខ្វក់|acu)/i.test(query) && codeName.includes('ប្រឆាំងអំពើពុករលួយ')) {
        score += 8;
      }

      // Anti-nepotism & ethics triggers
      if (/(?:បក្ខពួក|គ្រួសារនិយម|សីលធម៌|មន្ត្រីរាជការ|អព្យាក្រឹត)/i.test(query) && codeName.includes('មន្ត្រីរាជការស៊ីវិល')) {
        score += 8;
      }

      // Social justice & court triggers
      if (/(?:យុត្តិធម៌|តុលាការ|ចៅក្រម|ព្រះរាជអាជ្ញា|សិទ្ធិ|ដីធ្លី)/i.test(query) && (codeName.includes('ចៅក្រម') || codeName.includes('ព្រហ្មទណ្ឌ') || codeName.includes('ដីធ្លី'))) {
        score += 8;
      }

      // Multiparty democracy triggers
      if (/(?:ប្រជាធិបតេយ្យ|ពហុបក្ស|បោះឆ្នោត|សេរីភាព|រដ្ឋធម្មនុញ្ញ|មាត្រា ៥១)/i.test(query) && codeName.includes('រដ្ឋធម្មនុញ្ញ')) {
        score += 8;
      }

      if (score > 0) {
        scored.push({ item: law, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.item);
  }

  /**
   * Core Anti-Corruption Articles (Law on Anti-Corruption 2010/2011).
   */
  public getAntiCorruptionArticles(): LegalArticle[] {
    return this.laws.filter(l => (l.code_name || '').includes('ប្រឆាំងអំពើពុករលួយ')).slice(0, 5);
  }

  /**
   * Core Anti-Nepotism & Civil Service Ethics Articles.
   */
  public getAntiNepotismAndEthicsArticles(): LegalArticle[] {
    return this.laws.filter(l => (l.code_name || '').includes('មន្ត្រីរាជការស៊ីវិល')).slice(0, 5);
  }

  /**
   * Social Justice, Judiciary & Rule of Law Articles.
   */
  public getSocialJusticeArticles(): LegalArticle[] {
    return this.laws.filter(l => (l.code_name || '').includes('ចៅក្រម') || (l.code_name || '').includes('សិទ្ធិមនុស្ស')).slice(0, 5);
  }

  /**
   * Constitutional Democratic Governance (Article 51 Liberal Multiparty Democracy).
   */
  public getDemocraticGovernanceArticles(): LegalArticle[] {
    return this.laws.filter(l => (l.code_name || '').includes('រដ្ឋធម្មនុញ្ញ') && ((l.article || '').includes('៥១') || (l.summary || '').includes('ប្រជាធិបតេយ្យ'))).slice(0, 3);
  }

  /**
   * Format legal citations nicely for AI System Prompts and Advisor Answers.
   */
  public formatLegalCitations(articles: LegalArticle[]): string {
    if (!articles || articles.length === 0) return '';
    return articles.map((art, idx) => {
      return `${idx + 1}. [${art.code_name}] ${art.article} «${art.title}» ៖ ${art.summary}`;
    }).join('\n');
  }
}

export const khmerLegalEngine = KhmerLegalEngine.getInstance();
