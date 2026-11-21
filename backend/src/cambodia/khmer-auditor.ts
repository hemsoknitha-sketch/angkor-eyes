export class KhmerLanguageAuditor {
  private static punctuationReplacements: [RegExp, string][] = [
    [/\s+៖/g, '៖'],
    [/\s+។/g, '។'],
    [/\s+៕/g, ' ៕'],
    [/៖([^\s])/g, '៖ $1'],
    [/([^\s])។/g, '$1។'],
    [/(?<!\d)[\!\?]+|(?<!\d)\.(?!\d)/g, '។'],
    [/។{2,}/g, '។'],
    [/៕{2,}/g, ' ៕'],
    [/[\.។\s]+៕/g, ' ៕'],
    [/[ \t]{2,}/g, ' ']
  ];

  // Chuon Nath Khmer Dictionary Rules & Common Journalistic Orthographic Corrections
  private static chuonNathDictionaryRules: [RegExp, string][] = [
    [/ព័ត៏មាន/g, 'ព័ត៌មាន'],
    [/រដ្ឋធម្មនុញ្ញ័/g, 'រដ្ឋធម្មនុញ្ញ'],
    [/ប្រជាធិបតេយ្យ៍/g, 'ប្រជាធិបតេយ្យ'],
    [/អន្តរជាំតិ/g, 'អន្តរជាតិ'],
    [/សន្តិសុខ័/g, 'សន្តិសុខ'],
    [/កិច្ចសហប្រតិបត្តការ/g, 'កិច្ចសហប្រតិបត្តិការ'],
    [/ព្រះរាជាណាចក្រកម្ពុជា\s+៖/g, 'ព្រះរាជាណាចក្រកម្ពុជា៖'],
    [/\bកម្លាំងនប៉ុស្តិ៍/g, 'កម្លាំងប៉ុស្តិ៍'],
    [/\bនប៉ុស្តិ៍/g, 'ប៉ុស្តិ៍'],
    [/លោក\s+ជំទាវ/g, 'លោកជំទាវ'],
    [/ឧត្តមសេនីយ៍\s+ទោ/g, 'ឧត្តមសេនីយ៍ទោ'],
    [/ឧត្តមសេនីយ៍\s+ឯក/g, 'ឧត្តមសេនីយ៍ឯក'],
    [/ឧត្តមសេនីយ៍\s+ត្រី/g, 'ឧត្តមសេនីយ៍ត្រី'],
    [/មេបញ្ជាការ\s+រង/g, 'មេបញ្ជាការរង'],
    [/វិធានការ\s+យុទ្ធសាស្ត្រ/g, 'វិធានការយុទ្ធសាស្ត្រ'],
    [/ប្រធាន\s+ថ្មី/g, 'ប្រធានថ្មី'],
    [/ប្រធាន\s+បទ/g, 'ប្រធានបទ'],
    [/ថ្នាក់\s+ដឹកនាំ/g, 'ថ្នាក់ដឹកនាំ'],
    [/រាជរដ្ឋាភិបាល\s+កម្ពុជា/g, 'រាជរដ្ឋាភិបាលកម្ពុជា'],
    [/ទីស្តីការ\s+គណៈរដ្ឋមន្ត្រី/g, 'ទីស្តីការគណៈរដ្ឋមន្ត្រី'],
    [/ក្រសួង\s+មហាផ្ទៃ/g, 'ក្រសួងមហាផ្ទៃ'],
    [/ក្រសួង\s+ការពារជាតិ/g, 'ក្រសួងការពារជាតិ'],
    [/ក្រសួង\s+យុត្តិធម៌/g, 'ក្រសួងយុត្តិធម៌'],
    [/ក្រសួង\s+សេដ្ឋកិច្ច/g, 'ក្រសួងសេដ្ឋកិច្ច'],
    [/តុលាការ\s+កំពូល/g, 'តុលាការកំពូល']
  ];

  // Vietnamese & Thai Leak Filters
  private static foreignScriptPatterns: RegExp[] = [
    /[\u0e00-\u0e7f]+/g, // Thai Unicode script
    /\b(?:nhằm|của|và|trong|người|với|tại|theo|thông|tin|báo)\b/gi // Common Vietnamese particles
  ];

  /**
   * Complete audit & purification of Khmer text to institutional gold standard.
   */
  public static auditAndPurify(rawText: string): { cleanText: string; fixesAppliedCount: number } {
    if (!rawText) return { cleanText: '', fixesAppliedCount: 0 };

    let text = rawText;
    let fixesCount = 0;

    // 1. Purge HTML tags and entities
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/&(?:nbsp|amp|quot|lt|gt);/g, ' ');

    // 2. Strip foreign script leaks
    for (const pattern of this.foreignScriptPatterns) {
      if (pattern.test(text)) {
        fixesCount++;
        text = text.replace(pattern, '');
      }
    }

    // 3. Chuon Nath Spelling Dictionary corrections
    for (const [regex, replacement] of this.chuonNathDictionaryRules) {
      if (regex.test(text)) {
        fixesCount++;
        text = text.replace(regex, replacement);
      }
    }

    // 4. Honorific Spacing (ensure single space after Samdech, H.E., etc.)
    text = text.replace(/(សម្តេច(?:អគ្គមហាសេនាបតីតេជោ|មហាបវរធិបតី|ក្រឡាហោម|ពិជ័យសេនា)?)\s*([ក-អ])/g, '$1 $2');
    text = text.replace(/(ឯកឧត្តម|លោកជំទាវ)\s*([ក-អ])/g, '$1 $2');

    // 5. Punctuation & Orthographic cleanup
    for (const [regex, replacement] of this.punctuationReplacements) {
      text = text.replace(regex, replacement);
    }

    // Enforce final closing ' ៕' for official statements
    text = text.trim();
    if (text.endsWith(' ៕')) {
      // already ends with formal closing
    } else if (text.endsWith('។')) {
      text = text.slice(0, -1) + ' ៕';
    } else if (text.length > 0) {
      text = text + ' ៕';
    }

    return { cleanText: text, fixesAppliedCount: fixesCount };
  }
}
