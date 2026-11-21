import { KhmerLanguageAuditor } from './khmer-auditor.js';

export interface CitizenCommentAction {
  commentId: string;
  citizenName: string;
  rawMessage: string;
  intent: 'PUBLIC_SERVICE_INQUIRY' | 'CORRUPTION_OR_BRIBERY_REPORT' | 'EMERGENCY_OR_CRIME' | 'SPAM_OR_MALICIOUS' | 'GENERAL_INQUIRY';
  targetAgencyCommand: string;
  agencyNameKhmer: string;
  isSpamShieldQuarantined: boolean;
  ticketId?: string;
  officialPublicReplyKhmer: string;
  hotlineNumber: string;
}

export class AutonomousCitizenCommentResponder {
  private static SPAM_REGEX = /(t\.me\/|whatsapp|crypto|bitcoin|hack|18\+|កាស៊ីណូ|បនល្បែង|sex|sexy)/i;

  private static PUBLIC_SERVICES: Array<{
    keywords: string[];
    agencyCmd: string;
    agencyName: string;
    hotline: string;
    guidanceKhmer: string;
  }> = [
    {
      keywords: ['អត្តសញ្ញាណប័ណ្ណ', 'សំបុត្រកំណើត', 'សៀវភៅគ្រួសារ', 'លិខិតឆ្លងដែន', 'passport'],
      agencyCmd: '/interior',
      agencyName: 'អគ្គនាយកដ្ឋានអត្តសញ្ញាណកម្ម (ក្រសួងមហាផ្ទៃ)',
      hotline: '117 ឬ 1288',
      guidanceKhmer: 'លោកអ្នកអាចអញ្ជើញទៅកាន់ច្រកចេញចូលតែមួយនៅសាលាក្រុង/ស្រុក/ខណ្ឌ ឬអគ្គនាយកដ្ឋានអត្តសញ្ញាណកម្ម ដោយភ្ជាប់ជាមួយសំបុត្រកំណើតច្បាប់ដើម និងសៀវភៅស្នាក់នៅ'
    },
    {
      keywords: ['ប័ណ្ណបើកបរ', 'ប្តូរប័ណ្ណ', 'ពន្ធផ្លូវ', 'ឆៀកឡាន', 'ស្លាកលេខ'],
      agencyCmd: '/mpwt',
      agencyName: 'ក្រសួងសាធារណការ និងដឹកជញ្ជូន',
      hotline: '1275',
      guidanceKhmer: 'លោកអ្នកអាចស្នើសុំ ឬពន្យារប័ណ្ណបើកបរតាមរយៈប្រព័ន្ធស្វ័យប្រវត្តកម្ម ឬនៅតាមផ្សារទំនើបអ៊ីអន (Aeon 1, 2) និងមន្ទីរសាធារណការរាជធានី-ខេត្ត'
    },
    {
      keywords: ['ពន្ធដារ', 'បង់ពន្ធ', 'ប្រកាសពន្ធ', 'អាករ', 'GDT'],
      agencyCmd: '/tax',
      agencyName: 'អគ្គនាយកដ្ឋានពន្ធដារ (GDT)',
      hotline: '1277',
      guidanceKhmer: 'លោកអ្នកអាចបង់ពន្ធ ឬប្រកាសពន្ធប្រចាំខែតាមរយៈ GDT Taxpayer App ឬនៅសាខាពន្ធដារទូទាំងប្រទេស'
    },
    {
      keywords: ['ចុះបញ្ជីពាណិជ្ជកម្ម', 'បើកក្រុមហ៊ុន', 'ម៉ាកសញ្ញា', 'អាជ្ញាប័ណ្ណ'],
      agencyCmd: '/moc',
      agencyName: 'ក្រសួងពាណិជ្ជកម្ម',
      hotline: '1266',
      guidanceKhmer: 'លោកអ្នកអាចចុះបញ្ជីពាណិជ្ជកម្មតាមប្រព័ន្ធអនឡាញ CamDX (Single Portal) ទទួលបានវិញ្ញាបនបត្រឌីជីថលស្របច្បាប់'
    },
    {
      keywords: ['ប្លង់ដី', 'ផ្ទេរសិទ្ធិ', 'វាស់វែងដី', 'វិវាទដី'],
      agencyCmd: '/mlmupc',
      agencyName: 'ក្រសួងរៀបចំដែនដី នគរូបនីយកម្ម និងសំណង់',
      hotline: '1299',
      guidanceKhmer: 'លោកអ្នកអាចទាក់ទងច្រកចេញចូលតែមួយ ឬការិយាល័យភូមិបាលស្រុក/ខណ្ឌ ដើម្បីពិនិត្យឯកសិទ្ធិ និងវាស់វែងក្បាលដីតាមច្បាប់ភូមិបាល'
    }
  ];

  /**
   * Evaluates citizen comment, applies spam shield, identifies intent, and produces official response.
   */
  public static processCitizenComment(params: {
    commentId: string;
    citizenName: string;
    messageText: string;
  }): CitizenCommentAction {
    const { commentId, citizenName, messageText } = params;
    const txtLower = messageText.toLowerCase().trim();

    // 1. Spam & State Security Shield
    if (this.SPAM_REGEX.test(txtLower)) {
      return {
        commentId,
        citizenName,
        rawMessage: messageText,
        intent: 'SPAM_OR_MALICIOUS',
        targetAgencyCommand: '/police',
        agencyNameKhmer: 'នគរបាលប្រឆាំងបទល្មើសបច្ចេកវិទ្យា',
        isSpamShieldQuarantined: true,
        hotlineNumber: '117',
        officialPublicReplyKhmer: 'សារនេះត្រូវបានទប់ស្កាត់ដោយស្វ័យប្រវត្ត ដោយសារផ្ទុយនឹងគោលការណ៍សុវត្ថិភាពសហគមន៍ ៕'
      };
    }

    // 2. Corruption / Bribe Allegation
    if (['ពុករលួយ', 'ស៊ីសំណូក', 'ទារលុយ', 'ជំរិត', 'កេងប្រវ័ញ្ច'].some(w => txtLower.includes(w))) {
      const ticketId = `TK-ACU-${Date.now().toString().slice(-6)}`;
      const replyRaw = `
សូមជម្រាបសួរលោក/លោកស្រី ${citizenName}
អង្គភាពប្រឆាំងអំពើពុករលួយ (ACU) និងរាជរដ្ឋាភិបាលមានគោលការណ៍ប្រឆាំងដាច់ខាតអំពើពុករលួយ និងបក្ខពួកនិយម។
ពាក្យបណ្តឹងរបស់លោកអ្នកត្រូវបានបង្កើតលេខកូដសម្ងាត់ ៖ **${ticketId}**។
សូមលោកអ្នកផ្ញើភស្តុតាងលម្អិត ឬទាក់ទងមកកាន់លេខ Hotline ពិសេស ៖ **1282** ដើម្បីមន្ត្រីស៊ើបអង្កេតចាត់វិធានការជាសម្ងាត់ ៕
`.trim();
      const { cleanText } = KhmerLanguageAuditor.auditAndPurify(replyRaw);

      return {
        commentId,
        citizenName,
        rawMessage: messageText,
        intent: 'CORRUPTION_OR_BRIBERY_REPORT',
        targetAgencyCommand: '/acu',
        agencyNameKhmer: 'អង្គភាពប្រឆាំងអំពើពុករលួយ (ACU)',
        isSpamShieldQuarantined: false,
        ticketId,
        officialPublicReplyKhmer: cleanText,
        hotlineNumber: '1282'
      };
    }

    // 3. Emergency / Crime / Accidents
    if (['ចោរ', 'ប្លន់', 'បុកស្លាប់', 'ហិង្សា', 'អាសន្ន', 'សង្គ្រោះបន្ទាន់'].some(w => txtLower.includes(w))) {
      const ticketId = `TK-POL-${Date.now().toString().slice(-6)}`;
      const replyRaw = `
សូមជម្រាបជូន ៖ ករណីអាសន្ន ឬបទល្មើសចំពោះមុខ សូមទំនាក់ទំនងទៅកាន់លេខសង្គ្រោះបន្ទាន់ភ្លាមៗ ៖
🚨 **117** (អគ្គស្នងការដ្ឋាននគរបាលជាតិ) ឬ **118** (កងរាជអាវុធហត្ថ)។
លេខកូដសំបុត្រអន្តរាគមន៍ ៖ **${ticketId}** ៕
`.trim();
      const { cleanText } = KhmerLanguageAuditor.auditAndPurify(replyRaw);

      return {
        commentId,
        citizenName,
        rawMessage: messageText,
        intent: 'EMERGENCY_OR_CRIME',
        targetAgencyCommand: '/police',
        agencyNameKhmer: 'អគ្គស្នងការដ្ឋាននគរបាលជាតិ',
        isSpamShieldQuarantined: false,
        ticketId,
        officialPublicReplyKhmer: cleanText,
        hotlineNumber: '117'
      };
    }

    // 4. Public Service Inquiry
    for (const s of this.PUBLIC_SERVICES) {
      if (s.keywords.some(k => txtLower.includes(k.toLowerCase()))) {
        const ticketId = `TK-SVC-${Date.now().toString().slice(-6)}`;
        const replyRaw = `
សូមជម្រាបសួរលោក/លោកស្រី ${citizenName}
ចំពោះការសាកសួរព័ត៌មានអំពីសេវាសាធារណៈរបស់ **${s.agencyName}** (${s.agencyCmd}) ៖
${s.guidanceKhmer}។
លេខកូដតាមដានសំណើ ៖ **${ticketId}** (Hotline: **${s.hotline}**) ៕
`.trim();
        const { cleanText } = KhmerLanguageAuditor.auditAndPurify(replyRaw);

        return {
          commentId,
          citizenName,
          rawMessage: messageText,
          intent: 'PUBLIC_SERVICE_INQUIRY',
          targetAgencyCommand: s.agencyCmd,
          agencyNameKhmer: s.agencyName,
          isSpamShieldQuarantined: false,
          ticketId,
          officialPublicReplyKhmer: cleanText,
          hotlineNumber: s.hotline
        };
      }
    }

    // 5. General Inquiry
    const ticketId = `TK-GEN-${Date.now().toString().slice(-6)}`;
    const replyRaw = `
សូមជម្រាបសួរលោក/លោកស្រី ${citizenName}
ស្ថាប័នរាជរដ្ឋាភិបាលសូមថ្លែងអំណរគុណចំពោះមតិ និងសំណួររបស់លោកអ្នក។ សំណើត្រូវបានកត់ត្រាក្រោមលេខកូដ **${ticketId}** ហើយក្រុមការងារនឹងផ្តល់ព័ត៌មានលម្អិតជូនលោកអ្នកបន្ថែមទៀត ៕
`.trim();
    const { cleanText } = KhmerLanguageAuditor.auditAndPurify(replyRaw);

    return {
      commentId,
      citizenName,
      rawMessage: messageText,
      intent: 'GENERAL_INQUIRY',
      targetAgencyCommand: '/interior',
      agencyNameKhmer: 'ច្រកចេញចូលតែមួយ និងសេវារដ្ឋបាលទូទៅ',
      isSpamShieldQuarantined: false,
      ticketId,
      officialPublicReplyKhmer: cleanText,
      hotlineNumber: '1288'
    };
  }
}
