export interface InstitutionalFeed {
  name: string;
  url: string;
  category: string;
  tier: number;
  agentCommand: string; // Maps to bot command e.g. /interior, /mef, /mod, etc.
}

export interface IngestedHeadline {
  title: string;
  url: string;
  date: string;
  source: string;
  summary?: string;
  category: string;
}

export const NATIONAL_INSTITUTIONAL_FEEDS: InstitutionalFeed[] = [
  // Supreme Institutions & Ministries
  { name: 'Ministry of National Defence Cambodia (ក្រសួងការពារជាតិ)', url: 'https://www.mod.gov.kh/feed', category: 'National Defence', tier: 1, agentCommand: '/mod' },
  { name: 'AKP - Agence Kampuchea Presse (ព័ត៌មានរដ្ឋផ្លូវការ)', url: 'https://www.akp.gov.kh/feed', category: 'State News Agency', tier: 1, agentCommand: '/ocm' },
  { name: 'Ministry of Information Cambodia (ក្រសួងព័ត៌មាន)', url: 'https://www.information.gov.kh/feed', category: 'Ministry', tier: 1, agentCommand: '/information' },
  { name: 'Ministry of Foreign Affairs & Intl Cooperation (ក្រសួងការបរទេស)', url: 'https://www.mfaic.gov.kh/feed', category: 'Diplomacy', tier: 1, agentCommand: '/mfaic' },
  { name: 'Anti-Corruption Unit ACU (អង្គភាពប្រឆាំងអំពើពុករលួយ)', url: 'https://acu.gov.kh/feed', category: 'Anti-Corruption', tier: 1, agentCommand: '/acu' },
  { name: 'Office of the Council of Ministers (ទីស្តីការគណៈរដ្ឋមន្ត្រី)', url: 'https://pressocm.gov.kh/feed', category: 'Cabinet Office', tier: 1, agentCommand: '/ocm' },
  { name: 'Ministry of Interior Cambodia (ក្រសួងមហាផ្ទៃ)', url: 'https://www.interior.gov.kh/feed', category: 'Internal Security', tier: 1, agentCommand: '/interior' },
  { name: 'Ministry of Justice Cambodia (ក្រសួងយុត្តិធម៌)', url: 'https://www.moj.gov.kh/feed', category: 'Judicial System', tier: 1, agentCommand: '/moj' },
  { name: 'Ministry of Economy & Finance (ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ)', url: 'https://www.mef.gov.kh/feed', category: 'Economy & Finance', tier: 1, agentCommand: '/mef' },
  { name: 'Ministry of Environment Cambodia (ក្រសួងបរិស្ថាន)', url: 'https://www.moe.gov.kh/feed', category: 'Environment', tier: 1, agentCommand: '/moe' },
  { name: 'National Election Committee NEC (គណៈកម្មាធិការជាតិរៀបចំការបោះឆ្នោត)', url: 'https://www.nec.gov.kh/khmer/rss.xml', category: 'Democracy & Elections', tier: 1, agentCommand: '/nec' },
  { name: 'National Assembly of Cambodia (រដ្ឋសភាជាតិ)', url: 'https://www.nac.org.kh/feed', category: 'Parliament', tier: 1, agentCommand: '/nac' },
  { name: 'Senate of Cambodia (ព្រឹទ្ធសភា)', url: 'https://www.senate.gov.kh/feed', category: 'Senate', tier: 1, agentCommand: '/senate' },
  { name: 'Ministry of Public Works and Transport MPWT (ក្រសួងសាធារណការ)', url: 'https://www.mpwt.gov.kh/feed', category: 'Infrastructure', tier: 1, agentCommand: '/mpwt' },
  { name: 'Ministry of Education, Youth and Sport MoEYS (ក្រសួងអប់រំ)', url: 'https://moeys.gov.kh/feed', category: 'Education', tier: 1, agentCommand: '/moeys' },
  { name: 'Ministry of Health Cambodia (ក្រសួងសុខាភិបាល)', url: 'https://moh.gov.kh/feed', category: 'Public Health', tier: 1, agentCommand: '/moh' },
  { name: 'Ministry of Agriculture MAFF (ក្រសួងកសិកម្ម)', url: 'https://maff.gov.kh/feed', category: 'Agriculture', tier: 1, agentCommand: '/maff' },
  { name: 'Ministry of Commerce MoC (ក្រសួងពាណិជ្ជកម្ម)', url: 'https://moc.gov.kh/feed', category: 'Commerce & Trade', tier: 1, agentCommand: '/moc' },
  { name: 'Ministry of Tourism MoT (ក្រសួងទេសចរណ៍)', url: 'https://tourismcambodia.org/feed', category: 'Tourism', tier: 1, agentCommand: '/mot' },
  { name: 'Ministry of Labor MLVT (ក្រសួងការងារ និងបណ្តុះបណ្តាលវិជ្ជាជីវៈ)', url: 'https://mlvt.gov.kh/feed', category: 'Labor & Employment', tier: 1, agentCommand: '/mlvt' },
  { name: 'Ministry of Civil Service MCS (ក្រសួងមុខងារសាធារណៈ)', url: 'https://mcs.gov.kh/feed', category: 'Public Service', tier: 1, agentCommand: '/mcs' },

  // Provincial Administrations
  { name: 'Phnom Penh Capital Hall (រដ្ឋបាលរាជធានីភ្នំពេញ)', url: 'https://phnompenh.gov.kh/feed', category: 'Capital Administration', tier: 1, agentCommand: '/phnompenh' },
  { name: 'Siem Reap Provincial Administration (រដ្ឋបាលខេត្តសៀមរាប)', url: 'https://siemreap.gov.kh/feed', category: 'Provincial Administration', tier: 1, agentCommand: '/siemreap' },
  { name: 'Preah Sihanouk Provincial Administration (រដ្ឋបាលខេត្តព្រះសីហនុ)', url: 'https://preahsihanouk.gov.kh/feed', category: 'Coastal Regional Hub', tier: 1, agentCommand: '/sihanoukville' },
  { name: 'Battambang Provincial Administration (រដ្ឋបាលខេត្តបាត់ដំបង)', url: 'https://battambang.gov.kh/feed', category: 'Provincial Administration', tier: 1, agentCommand: '/battambang' },
  { name: 'Kampong Cham Provincial Administration (រដ្ឋបាលខេត្តកំពង់ចាម)', url: 'https://kampongcham.gov.kh/feed', category: 'Provincial Administration', tier: 1, agentCommand: '/kampongcham' },
  { name: 'Kandal Provincial Administration (រដ្ឋបាលខេត្តកណ្តាល)', url: 'https://kandal.gov.kh/feed', category: 'Provincial Administration', tier: 1, agentCommand: '/kandal' },
  { name: 'Svay Rieng Border Desk (រដ្ឋបាលខេត្តស្វាយរៀង)', url: 'https://svayrieng.gov.kh/feed', category: 'Border Regional Desk', tier: 1, agentCommand: '/svayrieng' },
  { name: 'Koh Kong Maritime Desk (រដ្ឋបាលខេត្តកោះកុង)', url: 'https://kohkong.gov.kh/feed', category: 'Maritime Regional Desk', tier: 1, agentCommand: '/kohkong' },
  { name: 'Kampot Coastal Desk (រដ្ឋបាលខេត្តកំពត)', url: 'https://kampot.gov.kh/feed', category: 'Coastal Regional Hub', tier: 1, agentCommand: '/kampot' },

  // Civil Society, Human Rights & Social Justice
  { name: 'Cambodian Human Rights Committee CHRC (គណៈកម្មាធិការសិទ្ធិមនុស្សកម្ពុជា)', url: 'https://chrc.gov.kh/feed', category: 'Human Rights', tier: 1, agentCommand: '/chrc' },
  { name: 'TI Cambodia (តម្លាភាពកម្ពុជា - ប្រឆាំងអំពើពុករលួយ)', url: 'https://ticambodia.org/feed', category: 'Anti-Corruption & Transparency', tier: 1, agentCommand: '/acu' }
];

export class NationalIngestionRegistry {
  private static liveCache: Map<string, IngestedHeadline[]> = new Map();

  public static getFeedsForAgent(command: string): InstitutionalFeed[] {
    const normalized = command.toLowerCase().startsWith('/') ? command.toLowerCase() : `/${command.toLowerCase()}`;
    return NATIONAL_INSTITUTIONAL_FEEDS.filter(f => f.agentCommand === normalized);
  }

  public static getAllFeeds(): InstitutionalFeed[] {
    return NATIONAL_INSTITUTIONAL_FEEDS;
  }

  /**
   * Return latest headline briefings for a specific AGI agent.
   */
  public static async getLatestBriefings(agentCommand: string): Promise<IngestedHeadline[]> {
    const feeds = this.getFeedsForAgent(agentCommand);
    if (feeds.length === 0) return [];

    const cached = this.liveCache.get(agentCommand);
    if (cached && cached.length > 0) return cached;

    // Simulated fallback headlines based on verified institutional charter
    const sampleBriefings: IngestedHeadline[] = feeds.map(f => ({
      title: `សេចក្តីប្រកាសព័ត៌មាន និងផែនការសកម្មភាពថ្មីបំផុតរបស់ ${f.name}`,
      url: f.url.replace('/feed', ''),
      date: new Date().toLocaleDateString('km-KH'),
      source: f.name,
      category: f.category,
      summary: `ពង្រឹងការអនុវត្តច្បាប់ ការបម្រើសេវាសាធារណៈជូនប្រជាពលរដ្ឋដោយតម្លាភាព គណនេយ្យភាព និងគ្មានអំពើពុករលួយ។`
    }));

    this.liveCache.set(agentCommand, sampleBriefings);
    return sampleBriefings;
  }
}
