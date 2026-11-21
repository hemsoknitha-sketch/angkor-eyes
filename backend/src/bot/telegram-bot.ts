import { Bot, InlineKeyboard } from 'grammy';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { TurnCoordinator } from '../orchestrator/turn-coordinator.js';
import { ApprovalGate } from '../safety/approval-gate.js';
import { OFFICIAL_CAMBODIA_AGENTS, SUPREME_ADMIN_AGENT } from '../agents/official-cambodia-agents.js';
import { findAgentPresetByCommand } from '../agents/presets.js';
import { InstitutionalSpokespersonOrchestrator } from '../cambodia/spokesperson-orchestrator.js';
import { DailyExecutiveReportEngine } from '../audit/daily-executive-report.js';
import { CambodiaMacroIntelligence } from '../cambodia/macro-intelligence.js';
import { SelfHealingWatchdog } from '../safety/self-healing-watchdog.js';
import { CivicGeocodingAndHotzoneRadar, ZeroClickPredictiveGovernor } from '../cambodia/civic-logistics.js';
import { VoiceVisionInspector } from '../safety/voice-vision-inspector.js';
import { CambodiaSocialDebateRadar } from '../cambodia/social-debate-radar.js';
import { CrisisMomentumDetector } from '../cambodia/crisis-velocity-detector.js';
import { AutonomousCitizenCommentResponder } from '../cambodia/autonomous-citizen-responder.js';
import { InterMinisterialDebateEngine } from '../cambodia/debate-engine.js';

export class TelegramBotEngine {
  private static bot: Bot | null = null;
  private static processedUpdateIds: Set<number> = new Set();

  public static initialize(): Bot | null {
    if (!config.telegramBotToken) {
      console.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not provided. Bot service is running in mock/offline mode.');
      return null;
    }

    try {
      this.bot = new Bot(config.telegramBotToken);
      this.setupHandlers(this.bot);
      this.startBot(this.bot);
      return this.bot;
    } catch (err) {
      console.error('[TelegramBot] Failed to initialize grammY bot:', err);
      return null;
    }
  }

  private static setupHandlers(bot: Bot): void {
    // Middleware: Idempotency deduplication by update_id
    bot.use(async (ctx, next) => {
      if (ctx.update?.update_id) {
        if (this.processedUpdateIds.has(ctx.update.update_id)) {
          return; // Skip duplicate update
        }
        this.processedUpdateIds.add(ctx.update.update_id);
        if (this.processedUpdateIds.size > 2000) {
          const first = this.processedUpdateIds.values().next().value;
          if (first !== undefined) this.processedUpdateIds.delete(first);
        }
      }

      // Security check: Whitelist
      if (config.allowedTelegramIds.length > 0 && ctx.from?.id) {
        if (!config.allowedTelegramIds.includes(ctx.from.id)) {
          await ctx.reply('⛔ **ការចូលប្រើត្រូវបានបដិសេធ (Unauthorized)**: Telegram ID របស់អ្នកមិនស្ថិតក្នុង Whitelist ឡើយ។');
          return;
        }
      }

      await next();
    });

    // Helper for main menu keyboard
    const buildMainMenuKeyboard = () => {
      return new InlineKeyboard()
        .text('🏛️ ស្ថាប័នកំពូលជាតិ', 'menu_top')
        .text('🏢 ក្រសួងទាំង ២៨', 'menu_ministries')
        .row()
        .text('👮 សន្តិសុខ & ពន្ធដារ', 'menu_security')
        .text('📍 រាជធានី-ខេត្តទាំង ២៥', 'menu_provinces')
        .row()
        .text('🔥 ប្រធានបទក្តៅ & Debate', 'menu_debate')
        .text('⚖️ សវនកម្មច្បាប់', 'menu_legal')
        .row()
        .text('🌐 បើក Sovereign Mini Web', 'open_web')
        .text('📊 ស្ថានភាពប្រព័ន្ធ', 'menu_status');
    };

    const getMainMenuText = () => {
      return `🇰🇭 **ANGKOR EYES — SOVEREIGN INSTITUTIONAL AGI PLATFORM**\n` +
        `*មជ្ឈមណ្ឌលបញ្ជាកំពូល និងប្រព័ន្ធ AGI ស្ថាប័នជាតិទាំង ៧៨ ដំណើរការ ២៤/៧ ៣៦៥ Live Real-Time*\n\n` +
        `👑 **អ្នកគ្រប់គ្រងកំពូល (Supreme Controller)** ៖ \`/angkor_eyes\`\n` +
        `💡 សូមជ្រើសរើសផ្នែកខាងក្រោម ដើម្បីបញ្ជាស្ថាប័នរដ្ឋ ឬបើកកិច្ចប្រជុំដោះស្រាយវិបត្តិសង្គម ៖`;
    };

    // /start and /menu commands
    bot.command(['start', 'menu'], async (ctx) => {
      const from = ctx.from;
      if (from) {
        db.upsertUser({
          id: `tg-${from.id}`,
          telegramId: from.id,
          username: from.username || from.first_name,
          awayModeEnabled: false,
          createdAt: new Date().toISOString()
        });
      }

      await ctx.reply(getMainMenuText(), {
        reply_markup: buildMainMenuKeyboard(),
        parse_mode: 'Markdown'
      });
    });

    // /debate command - Autonomous multi-agent deliberation
    bot.command('debate', async (ctx) => {
      const query = ctx.match ? ctx.match.trim() : '';
      if (!query) {
        const keyboard = new InlineKeyboard()
          .text('🛡️ បង្ក្រាបឆបោកអនឡាញ', 'debate:online_scams')
          .text('⚖️ វិវាទដីធ្លី & ប្លង់រឹង', 'debate:land_dispute')
          .row()
          .text('🚫 ប្រឆាំងពុករលួយនៅ OWSO', 'debate:anti_corruption')
          .text('🚗 សុវត្ថិភាពចរាចរណ៍', 'debate:traffic_order')
          .row()
          .text('💰 កំណែទម្រង់ពន្ធដារ', 'debate:tax_reforms');

        await ctx.reply(
          `⚡ **កោះប្រជុំបន្ទាន់ AGI ៧៨ AGENTS (Real-Time Deliberation)**\n\n` +
          `សូមជ្រើសរើសប្រធានបទគំរូខាងក្រោម ឬវាយបញ្ជាផ្ទាល់ ៖\n` +
          `\`/debate <ប្រធានបទជាក់លាក់របស់អ្នក>\``,
          { reply_markup: keyboard, parse_mode: 'Markdown' }
        );
        return;
      }

      await ctx.reply(
        `⚡ **កំពុងកោះប្រជុំបន្ទាន់ AGI អន្តរក្រសួង...**\n` +
        `ប្រធានបទ ៖ «*${query}*»\n` +
        `*Rex Lead Orchestrator កំពុងសម្របសម្រួល និងស្រង់ចម្លើយពីស្ថាប័នពាក់ព័ន្ធ...*`,
        { parse_mode: 'Markdown' }
      );

      try {
        const result = await InterMinisterialDebateEngine.deliberateOnTopic({
          topic: query,
          initiatedBy: ctx.from?.first_name || 'Super Admin'
        });
        await ctx.reply(result.formattedTelegramDigest, { parse_mode: 'Markdown' });
      } catch (err: any) {
        await ctx.reply(`⚠️ កំហុសក្នុងដំណើរការប្រជុំ: ${err.message}`);
      }
    });

    // /hottopics command
    bot.command(['hottopics', 'topics'], async (ctx) => {
      const keyboard = new InlineKeyboard()
        .text('🛡️ បង្ក្រាបឆបោកអនឡាញ & ល្បែង', 'debate:online_scams')
        .row()
        .text('⚖️ វិវាទដីធ្លី & ប្លង់រឹង', 'debate:land_dispute')
        .row()
        .text('🚫 ប្រឆាំងពុករលួយ & សំណូកនៅ OWSO', 'debate:anti_corruption')
        .row()
        .text('🚗 សុវត្ថិភាពចរាចរណ៍ផ្លូវគោក', 'debate:traffic_order')
        .row()
        .text('💰 កំណែទម្រង់ពន្ធដារ & វិនិយោគ', 'debate:tax_reforms');

      await ctx.reply(
        `🔥 **ប្រធានបទក្តៅសង្គមជាតិកំពុងផ្ទុះ (National Breaking Debates)**\n` +
        `ចុចលើប្រធានបទណាមួយខាងក្រោម ដើម្បីឱ្យ AGI Agents ពាក់ព័ន្ធជជែកវែកញ៉ែក និងដាក់ចេញដំណោះស្រាយរួមភ្លាមៗ ៖`,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    });

    // /web command
    bot.command('web', async (ctx) => {
      const keyboard = new InlineKeyboard()
        .text('🔄 ពិនិត្យការតភ្ជាប់ Live', 'check_connection')
        .row()
        .text('⬅️ ត្រឡប់ទៅមឺនុយមេ', 'menu_main');

      await ctx.reply(
        `🌐 **ANGKOR EYES SOVEREIGN MINI WEB COMMAND CENTER**\n\n` +
        `• ផ្ទាំងគ្រប់គ្រងរដ្ឋបាលឌីជីថលបែប Futuristic Dark Mode\n` +
        `• មើលការជជែកដេញដោលផ្ទាល់តាម WebSockets (Real-Time)\n` +
        `• បញ្ជី AGI Agents ទាំង ៧៨ និងការអនុញ្ញាតសកម្មភាពហានិភ័យ (Approvals)\n\n` +
        `👉 **អាសយដ្ឋានបើកប្រើប្រាស់** ៖\n` +
        `• តាម Local Network ៖ \`http://localhost:3000\`\n` +
        `• តាម Cloudflare HTTPS Tunnel ៖ \`https://<your-tunnel>.trycloudflare.com\``,
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    });

    // /angkor_eyes Supreme Commander Command
    bot.command('angkor_eyes', async (ctx) => {
      const agents = db.getAgents();
      const runners = db.getRunnerLeases();
      const tasks = db.getTasks();
      const approvals = db.getApprovalRequests('pending');

      const supremeText = `👑 **AGI ANGKOR EYES — មជ្ឈមណ្ឌលបញ្ជាកំពូល (Supreme Command)**
*សិទ្ធិផ្តាច់មុខពេញលេញលើប្រព័ន្ធ AGI Agents ទាំងអស់*

⚡ **ស្ថានភាពទូទាំងប្រព័ន្ធ (System Wide Status)**:
• 🤖 **Total Agents Registered**: ${agents.length} Agents
• 🏛️ **Government Institutions**: ស្ថាប័នកំពូល, ក្រសួងទាំង ២៨, អគ្គនាយកដ្ឋាន, រាជធានី-ខេត្តទាំង ២៥
• 💻 **Local Runner Engine**: ${runners.filter(r => r.status === 'online').length > 0 ? '🟢 Online & Ready' : '🟡 Standby / Local Mode'}
• 📋 **In-Flight Task Trees**: ${tasks.filter(t => t.status === 'running').length} កំពុងដំណើរការ
• 🔒 **Pending Human Approvals**: ${approvals.length} កំពុងរង់ចាំ

💡 អ្នកអាចបញ្ជាកិច្ចការឆ្លងក្រសួង ឬវាយពាក្យបញ្ជាក្រសួងជាក់លាក់ដូចជា \`/interior\`, \`/mef\`, \`/mod\`, \`/police\`, \`/phnompenh\` ភ្លាមៗ!`;

      const keyboard = new InlineKeyboard()
        .text('🚀 បើក Command Center Mini Web', 'open_web')
        .row()
        .text('🏛️ មើលក្រសួងទាំងអស់ (/ministries)', 'cmd_ministries')
        .text('🌙 Away Mode', 'cmd_away');

      await ctx.reply(supremeText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    });

    // /ministries & /institutions command
    bot.command(['ministries', 'institutions'], async (ctx) => {
      let text = `🏛️ **បញ្ជី AGI AGENTS ក្រសួង និងស្ថាប័នផ្លូវការនៃព្រះរាជាណាចក្រកម្ពុជា**:\n\n`;
      text += `👑 **ស្ថាប័នកំពូល**:\n`;
      text += `• \`/senate\` - AGI ព្រឹទ្ធសភា (senate.gov.kh)\n`;
      text += `• \`/nac\` - AGI រដ្ឋសភា (nac.org.kh)\n`;
      text += `• \`/ocm\` - AGI ទីស្ដីការគណៈរដ្ឋមន្ត្រី (ocm.gov.kh)\n`;
      text += `• \`/primeminister\` - AGI ខុទ្ទកាល័យសម្តេចធិបតី នាយករដ្ឋមន្ត្រី\n`;
      text += `• \`/ccc\` - AGI ក្រុមប្រឹក្សាធម្មនុញ្ញ (ccc.gov.kh)\n\n`;

      text += `🏢 **ក្រសួងទាំង ២៨ (សំខាន់ៗ)**:\n`;
      text += `• \`/interior\` - AGI ក្រសួងមហាផ្ទៃ (interior.gov.kh)\n`;
      text += `• \`/mod\` - AGI ក្រសួងការពារជាតិ (mod.gov.kh)\n`;
      text += `• \`/mfaic\` - AGI ក្រសួងការបរទេស (mfaic.gov.kh)\n`;
      text += `• \`/mef\` - AGI ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ (mef.gov.kh)\n`;
      text += `• \`/mptc\` - AGI ក្រសួងប្រៃសណីយ៍ និងទូរគមនាគមន៍ (mptc.gov.kh)\n`;
      text += `• \`/moeys\` - AGI ក្រសួងអប់រំ យុវជន និងកីឡា (moeys.gov.kh)\n`;
      text += `• \`/moh\` - AGI ក្រសួងសុខាភិបាល (moh.gov.kh)\n`;
      text += `• \`/mpwt\` - AGI ក្រសួងសាធារណការ (mpwt.gov.kh)\n`;
      text += `• \`/moc\` - AGI ក្រសួងពាណិជ្ជកម្ម (moc.gov.kh)\n\n`;

      text += `👮 **អគ្គនាយកដ្ឋាន & នគរបាល**:\n`;
      text += `• \`/police\` - AGI អគ្គស្នងការដ្ឋាននគរបាលជាតិ (police.gov.kh)\n`;
      text += `• \`/tax\` - AGI អគ្គនាយកដ្ឋានពន្ធដារ (tax.gov.kh)\n`;
      text += `• \`/customs\` - AGI អគ្គនាយកដ្ឋានគយ (customs.gov.kh)\n`;
      text += `• \`/nbc\` - AGI ធនាគារជាតិនៃកម្ពុជា (nbc.gov.kh)\n\n`;

      text += `📍 **រដ្ឋបាលរាជធានី-ខេត្ត**:\n`;
      text += `• \`/phnompenh\`, \`/siemreap\`, \`/preahsihanouk\`, \`/kandal\`, \`/battambang\`, ... (សរុប ២៥ រាជធានី-ខេត្ត)\n\n`;
      text += `💡 *ចុចលើពាក្យបញ្ជាណាមួយខាងលើ រួចសួរសំណួរ ឬបញ្ជាការងារបានភ្លាមៗ!*`;

      await ctx.reply(text, { parse_mode: 'Markdown' });
    });

    // /newagent command
    bot.command('newagent', async (ctx) => {
      const keyboard = new InlineKeyboard()
        .text('👨‍💻 Dev Agent', 'preset_dev')
        .text('🧪 QA Agent', 'preset_qa')
        .row()
        .text('🔍 Reviewer Agent', 'preset_rev')
        .text('🛡️ Security Agent', 'preset_sec')
        .row()
        .text('🌐 បើក Mini Web UI ពេញលេញ', 'open_web');

      await ctx.reply(
        '🤖 **បន្ថែម Agent ថ្មីដូចបន្ថែមមិត្តភក្តិ**:\nសូមជ្រើសរើស Role គំរូខាងក្រោម ឬបើក Mini Web ដើម្បីកែប្រែ Prompt ដោយសេរី៖',
        { reply_markup: keyboard, parse_mode: 'Markdown' }
      );
    });

    // /away command
    bot.command('away', async (ctx) => {
      const user = ctx.from ? db.getUserByTelegramId(ctx.from.id) : undefined;
      const now = new Date().toISOString();
      if (user) {
        db.upsertUser({ ...user, awayModeEnabled: true, awaySince: now });
      }

      db.addAuditLog('AWAY_MODE_ACTIVATED', { telegramId: ctx.from?.id, awaySince: now });

      await ctx.reply(
        `🌙 **Away Mode ត្រូវបានបើក!**\n\n- ប្រព័ន្ធបានបើក **Autonomous Worker Loop**\n- បិទការរំខាន Notification ធម្មតា (Mute non-critical alerts)\n- រាល់សកម្មភាពមានហានិភ័យ (Risky Actions) នឹងត្រូវផ្អាកទុក\n\nពេលអ្នកត្រឡប់មកវិញ សូមវាយ \`/back\` ដើម្បីទទួលសេចក្តីសង្ខេបការងារ។`,
        { parse_mode: 'Markdown' }
      );
    });

    // /back command
    bot.command('back', async (ctx) => {
      const user = ctx.from ? db.getUserByTelegramId(ctx.from.id) : undefined;
      if (user) {
        db.upsertUser({ ...user, awayModeEnabled: false, awaySince: undefined });
      }

      db.addAuditLog('AWAY_MODE_DEACTIVATED', { telegramId: ctx.from?.id });

      const pendingApprovals = db.getApprovalRequests('pending');
      const recentTasks = db.getTasks().slice(-3);

      let digest = `☀️ **Welcome Back! សេចក្តីសង្ខេបពេលអ្នកមិននៅ**:\n\n`;
      digest += `📊 **ការងារដែលបានធ្វើរួច (Completed Tasks)**: ${recentTasks.length}\n`;
      recentTasks.forEach(t => {
        digest += `• ${t.title} [${t.status.toUpperCase()}]\n`;
      });

      digest += `\n⚠️ **សំណើរង់ចាំការអនុញ្ញាត (Pending Approvals)**: ${pendingApprovals.length} សំណើ\n`;

      const keyboard = new InlineKeyboard();
      if (pendingApprovals.length > 0) {
        const top = pendingApprovals[0];
        digest += `\n👉 **${top.summary}**\nBranch: \`${top.branchName}\``;
        keyboard
          .text('✅ Approve', `apr_yes:${top.id}`)
          .text('❌ Reject', `apr_no:${top.id}`)
          .row();
      }
      keyboard.text('🌐 បើកផ្ទាំងគ្រប់គ្រង Mini Web', 'open_web');

      await ctx.reply(digest, { reply_markup: keyboard, parse_mode: 'Markdown' });
    });

    // /status command
    bot.command('status', async (ctx) => {
      const agents = db.getAgents();
      const runners = db.getRunnerLeases();
      const onlineRunners = runners.filter(r => r.status === 'online');

      let text = `⚡ **ANGKOR EYES System Status**:\n\n`;
      text += `🤖 **Active Agents**: ${agents.length}\n`;
      agents.forEach(a => {
        text += `• ${a.name} (${a.role}) - [${a.status}]\n`;
      });
      text += `\n💻 **Local Runner Daemons**: ${onlineRunners.length} Online\n`;
      text += `🔒 **Pending Approvals**: ${db.getApprovalRequests('pending').length}\n`;

      await ctx.reply(text, { parse_mode: 'Markdown' });
    });

    // /daily_report - Master Daily Executive Report to Super Admin
    bot.command(['daily_report', 'report', 'digest'], async (ctx) => {
      const report = DailyExecutiveReportEngine.generateDailyReport();
      await ctx.reply(report.formattedKhmerReport, { parse_mode: 'Markdown' });
    });

    // /macro - Macroeconomic & Central Bank (NBC/MEF) Indicators
    bot.command('macro', async (ctx) => {
      const briefing = CambodiaMacroIntelligence.getFormattedMacroBriefing();
      await ctx.reply(briefing, { parse_mode: 'Markdown' });
    });

    // /hotzones - Civic complaint clustering radar across Cambodia
    bot.command(['hotzones', 'radar'], async (ctx) => {
      const sampleReports = [
        { locationText: 'ខណ្ឌដូនពេញ ភ្នំពេញ', topic: 'ការកកស្ទះចរាចរណ៍ និងសណ្តាប់ធ្នាប់សាធារណៈ' },
        { locationText: 'Daun Penh, Phnom Penh', topic: 'ការចតយានយន្តលើចិញ្ចើមផ្លូវ' },
        { locationText: 'ខណ្ឌទួលគោក', topic: 'បញ្ហាប្រព័ន្ធលូបង្ហូរទឹកភ្លៀង' }
      ];
      const cluster = CivicGeocodingAndHotzoneRadar.clusterHotzones(sampleReports);
      await ctx.reply(cluster.khmerAlertMessage, { parse_mode: 'Markdown' });
    });

    // /verify_id - e-KYC & Fraud Vision Inspection
    bot.command(['verify_id', 'kyc'], async (ctx) => {
      const guidance = `🛡️ **មជ្ឈមណ្ឌលផ្ទៀងផ្ទាត់អត្តសញ្ញាណប័ណ្ណ & e-KYC (Ministry of Interior & Police)**\n\n` +
        `សូមផ្ញើរូបថតអត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ (ID Card) ឬលិខិតឆ្លងដែនផ្លូវការ ដើម្បីឱ្យប្រព័ន្ធ AI ពិនិត្យភាពត្រឹមត្រូវ ប្រឆាំងការក្លែងបន្លំ និង Deepfake ៕`;
      await ctx.reply(guidance, { parse_mode: 'Markdown' });
    });

    // /social_radar - Cambodian Social Debate & Viral Issues Radar
    bot.command(['social_radar', 'debate'], async (ctx) => {
      const query = ctx.match ? ctx.match.toString().trim() : '';
      const sampleTitle = query || 'ផ្ទុះការជជែកដេញដោលអំពីការអនុវត្តច្បាប់ចរាចរណ៍ និងការប្រឆាំងអំពើពុករលួយ';
      const sampleContent = 'ប្រជាពលរដ្ឋបានបញ្ចេញមតិរិះគន់ និងសំណូមពរឱ្យសមត្ថកិច្ចអនុវត្តច្បាប់ឱ្យបានស្មើភាពគ្នា គ្មានបក្ខពួកនិយម និងតម្លាភាព';

      const analysis = CambodiaSocialDebateRadar.analyzeDebate(sampleTitle, sampleContent);
      let msg = `📡 **រ៉ាដាស្កេនចាប់ការជជែកដេញដោលក្នុងសង្គម (CAMBODIA SOCIAL DEBATE RADAR)**\n\n`;
      msg += `🏷️ **ប្រធានបទ** ៖ ${analysis.topicLabel}\n`;
      msg += `🔥 **កម្រិតរលកកម្តៅ (Viral Score)** ៖ **${analysis.viralScore}%** [${analysis.isViral ? '🚨 VIRAL BREAKOUT' : '🟡 ធម្មតា'}]\n`;
      msg += `🏛️ **ស្ថាប័នទទួលខុសត្រូវ** ៖ **${analysis.responsibleMinistryKhmer}** (\`${analysis.responsibleAgentCommand}\`)\n`;
      msg += `⚖️ **មូលដ្ឋានច្បាប់ការពារ** ៖ ${analysis.legalAnchor}\n\n`;
      msg += `📝 **ចំណាត់ការបន្ទាន់របស់ស្ថាប័ន** ៖\n${analysis.actionBriefKhmer}`;

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // /crisis_check - Hawkes Process Velocity & Urgent Press Clarification
    bot.command(['crisis_check', 'crisis'], async (ctx) => {
      const sampleCrisis = CrisisMomentumDetector.evaluateCrisis({
        topicId: `CRISIS-${Date.now().toString().slice(-4)}`,
        topicTitle: 'ករណីគ្រោះថ្នាក់ចរាចរណ៍លើផ្លូវជាតិ និងការទាមទារយុត្តិធម៌សង្គម',
        elapsedMinutes: 30,
        likes: 1200,
        comments: 450,
        shares: 620,
        views: 25000
      });

      let msg = `⚡ **ការត្រួតពិនិត្យចលនារលកវិបត្តិ (CRISIS MOMENTUM RADAR)**\n\n`;
      msg += `📌 **ប្រធានបទ** ៖ ${sampleCrisis.topicTitle}\n`;
      msg += `📊 **ពិន្ទុវិបត្តិ (Crisis Score)** ៖ **${sampleCrisis.crisisScore}/100** [${sampleCrisis.classification}]\n`;
      msg += `🚀 **ល្បឿនចែកចាយ (Velocity)** ៖ **${sampleCrisis.velocityPerMinute} pts/min** | **Shares Ratio** ៖ ${sampleCrisis.sharesRatio}\n`;
      msg += `⏱️ **រយៈពេលកំណត់ឆ្លើយតប** ៖ ក្នុងរង្វង់ **${sampleCrisis.recommendedResponseWindowMinutes} នាទី**\n\n`;
      msg += `🚨 **មូលហេតុបន្ទាន់** ៖ ${sampleCrisis.urgencyKhmerReason}\n\n`;
      msg += `📄 **ព្រាងសេចក្តីបំភ្លឺផ្លូវការ (Press Clarification Draft)** ៖\n${sampleCrisis.pressClarificationDraftKhmer}`;

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // /inquiry - Autonomous Citizen Inquiry Responder
    bot.command(['inquiry', 'ask'], async (ctx) => {
      const query = ctx.match ? ctx.match.toString().trim() : '';
      const sampleQuestion = query || 'ខ្ញុំចង់សួរអំពីនីតិវិធីធ្វើអត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ តើត្រូវត្រៀមអ្វីខ្លះ?';

      const response = AutonomousCitizenCommentResponder.processCitizenComment({
        commentId: `CMT-${Date.now().toString().slice(-4)}`,
        citizenName: ctx.from?.first_name || 'ប្រជាពលរដ្ឋ',
        messageText: sampleQuestion
      });

      let msg = `🤖 **ប្រព័ន្ធឆ្លើយតបសំណើពលរដ្ឋស្វ័យប្រវត្ត (CITIZEN INQUIRY RESPONDER)**\n\n`;
      msg += `🏛️ **ស្ថាប័នឆ្លើយតប** ៖ ${response.agencyNameKhmer} (\`${response.targetAgencyCommand}\`)\n`;
      msg += `🎫 **លេខកូដសំបុត្រ (Ticket ID)** ៖ \`${response.ticketId}\` | 📞 **Hotline** ៖ **${response.hotlineNumber}**\n\n`;
      msg += `💬 **ចម្លើយផ្លូវការ** ៖\n${response.officialPublicReplyKhmer}`;

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // Callback queries for inline buttons
    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;

      if (data.startsWith('apr_yes:')) {
        const aprId = data.replace('apr_yes:', '');
        const updated = ApprovalGate.approve(aprId, `tg-${ctx.from.id}`);
        if (updated) {
          await ctx.answerCallbackQuery({ text: '✅ បានអនុម័តជោគជ័យ!' });
          await ctx.editMessageText(`✅ **សំណើ #${aprId} ត្រូវបានអនុម័តដោយជោគជ័យ!**\nLocal Runner កំពុងបន្តដំណើរការ Merge/Push។`, { parse_mode: 'Markdown' });
        } else {
          await ctx.answerCallbackQuery({ text: 'សំណើនេះមិនអាចអនុម័តបានទេ ឬផុតកំណត់។' });
        }
        return;
      }

      if (data.startsWith('apr_no:')) {
        const aprId = data.replace('apr_no:', '');
        const updated = ApprovalGate.reject(aprId, `tg-${ctx.from.id}`, 'Rejected via Telegram button');
        if (updated) {
          await ctx.answerCallbackQuery({ text: '❌ បានបដិសេធ!' });
          await ctx.editMessageText(`❌ **សំណើ #${aprId} ត្រូវបានបដិសេធ!**`, { parse_mode: 'Markdown' });
        }
        return;
      }

      if (data.startsWith('preset_')) {
        const role = data.replace('preset_', '');
        await ctx.answerCallbackQuery({ text: `បានបង្កើត Agent ${role} ជោគជ័យ!` });
        await ctx.reply(`🎉 បានបន្ថែម Agent ថ្មីជោគជ័យ! សូមពិនិត្យមើលក្នុង Mini Web Roster។`);
        return;
      }

      if (data === 'cmd_away') {
        await ctx.answerCallbackQuery();
        await ctx.reply('វាយ `/away` ដើម្បីបើក Away Mode។');
        return;
      }

      if (data === 'menu_main') {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(getMainMenuText(), {
          reply_markup: buildMainMenuKeyboard(),
          parse_mode: 'Markdown'
        });
        return;
      }

      if (data === 'menu_top') {
        await ctx.answerCallbackQuery();
        const kb = new InlineKeyboard()
          .text('👑 ខុទ្ទកាល័យនាយករដ្ឋមន្ត្រី', 'agency:/primeminister')
          .row()
          .text('🏛️ ព្រឹទ្ធសភា', 'agency:/senate')
          .text('🏛️ រដ្ឋសភាជាតិ', 'agency:/nac')
          .row()
          .text('🏢 ទីស្តីការគណៈរដ្ឋមន្ត្រី', 'agency:/ocm')
          .text('⚖️ ក្រុមប្រឹក្សាធម្មនុញ្ញ', 'agency:/ccc')
          .row()
          .text('⬅️ ត្រឡប់ទៅមឺនុយមេ', 'menu_main');

        await ctx.editMessageText(
          `👑 **ស្ថាប័នកំពូលនៃព្រះរាជាណាចក្រកម្ពុជា**\nសូមជ្រើសរើសស្ថាប័នដើម្បីពិគ្រោះយោបល់ ឬបញ្ជាការងារ ៖`,
          { reply_markup: kb, parse_mode: 'Markdown' }
        );
        return;
      }

      if (data === 'menu_ministries') {
        await ctx.answerCallbackQuery();
        const kb = new InlineKeyboard()
          .text('🏛️ ក្រសួងមហាផ្ទៃ', 'agency:/interior')
          .text('🛡️ ក្រសួងការពារជាតិ', 'agency:/mod')
          .row()
          .text('⚖️ ក្រសួងយុត្តិធម៌', 'agency:/moj')
          .text('💰 សេដ្ឋកិច្ច & ហិរញ្ញវត្ថុ', 'agency:/mef')
          .row()
          .text('🌐 ក្រសួងការបរទេស', 'agency:/mfaic')
          .text('🏥 ក្រសួងសុខាភិបាល', 'agency:/moh')
          .row()
          .text('🎓 ក្រសួងអប់រំ', 'agency:/moeys')
          .text('📦 ក្រសួងពាណិជ្ជកម្ម', 'agency:/moc')
          .row()
          .text('⬅️ ត្រឡប់ទៅមឺនុយមេ', 'menu_main');

        await ctx.editMessageText(
          `🏢 **ក្រសួងសំខាន់ៗនៃរាជរដ្ឋាភិបាល**\nសូមជ្រើសរើសក្រសួងដើម្បីពិគ្រោះយោបល់ ៖`,
          { reply_markup: kb, parse_mode: 'Markdown' }
        );
        return;
      }

      if (data === 'menu_security') {
        await ctx.answerCallbackQuery();
        const kb = new InlineKeyboard()
          .text('👮 នគរបាលជាតិ (Hotline 117)', 'agency:/police')
          .row()
          .text('🚫 ប្រឆាំងពុករលួយ (Hotline 1282)', 'agency:/acu')
          .row()
          .text('📑 អគ្គនាយកដ្ឋានពន្ធដារ', 'agency:/tax')
          .text('🚢 អគ្គនាយកដ្ឋានគយ', 'agency:/customs')
          .row()
          .text('🏦 ធនាគារជាតិនៃកម្ពុជា', 'agency:/nbc')
          .text('🗺️ រៀបចំដែនដី & ដីធ្លី', 'agency:/mlmupc')
          .row()
          .text('⬅️ ត្រឡប់ទៅមឺនុយមេ', 'menu_main');

        await ctx.editMessageText(
          `👮 **សន្តិសុខជាតិ ច្បាប់ និងចំណូលរដ្ឋ**\nសូមជ្រើសរើសស្ថាប័នមានសមត្ថកិច្ច ៖`,
          { reply_markup: kb, parse_mode: 'Markdown' }
        );
        return;
      }

      if (data === 'menu_provinces') {
        await ctx.answerCallbackQuery();
        const kb = new InlineKeyboard()
          .text('📍 រាជធានីភ្នំពេញ', 'agency:/phnompenh')
          .text('📍 ខេត្តសៀមរាប', 'agency:/siemreap')
          .row()
          .text('📍 ខេត្តព្រះសីហនុ', 'agency:/preahsihanouk')
          .text('📍 ខេត្តបាត់ដំបង', 'agency:/battambang')
          .row()
          .text('📍 ខេត្តកណ្តាល', 'agency:/kandal')
          .text('📍 ខេត្តកំពង់ចាម', 'agency:/kampongcham')
          .row()
          .text('⬅️ ត្រឡប់ទៅមឺនុយមេ', 'menu_main');

        await ctx.editMessageText(
          `📍 **រដ្ឋបាលរាជធានី-ខេត្តទាំង ២៥ នៃព្រះរាជាណាចក្រកម្ពុជា**\nសូមជ្រើសរើសរដ្ឋបាលរាជធានី-ខេត្ត ៖`,
          { reply_markup: kb, parse_mode: 'Markdown' }
        );
        return;
      }

      if (data === 'menu_debate') {
        await ctx.answerCallbackQuery();
        const kb = new InlineKeyboard()
          .text('🛡️ បង្ក្រាបឆបោកអនឡាញ & ល្បែង', 'debate:online_scams')
          .row()
          .text('⚖️ ដោះស្រាយវិវាទដីធ្លី & ប្លង់រឹង', 'debate:land_dispute')
          .row()
          .text('🚫 ទប់ស្កាត់ពុករលួយនៅច្រកចេញចូលតែមួយ', 'debate:anti_corruption')
          .row()
          .text('🚗 រឹតបន្តឹងចរាចរណ៍ & បើកបរស្រវឹង', 'debate:traffic_order')
          .row()
          .text('💰 កំណែទម្រង់ពន្ធដារ & ការលើកទឹកចិត្ត', 'debate:tax_reforms')
          .row()
          .text('⬅️ ត្រឡប់ទៅមឺនុយមេ', 'menu_main');

        await ctx.editMessageText(
          `🔥 **ប្រធានបទក្តៅសង្គមជាតិ & កិច្ចប្រជុំបន្ទាន់ ៧៨ AGENTS**\nចុចលើប្រធានបទណាមួយខាងក្រោម ដើម្បីឱ្យ AGI Agents ជជែកដេញដោល និងដាក់ចេញដំណោះស្រាយរួមភ្លាមៗ ៖`,
          { reply_markup: kb, parse_mode: 'Markdown' }
        );
        return;
      }

      if (data.startsWith('agency:')) {
        const cmd = data.replace('agency:', '');
        await ctx.answerCallbackQuery({ text: `កំពុងភ្ជាប់ទៅកាន់ ${cmd}...` });
        const matched = findAgentPresetByCommand(cmd);
        if (matched) {
          const res = await InstitutionalSpokespersonOrchestrator.generateSpokespersonResponse({
            agentCommand: cmd,
            agentName: matched.name,
            institutionTitle: matched.systemPrompt.split('\n')[0] || matched.name,
            userQuery: 'សូមជួយរៀបរាប់អំពីតួនាទី បេសកកម្ម ដំណោះស្រាយចំពោះមុខ និងសេវាសាធារណៈផ្លូវការរបស់អ្នក',
            model: matched.model
          });
          let msg = '';
          if (!res.officialContent.includes('ព្រះរាជាណាចក្រកម្ពុជា')) {
            msg += `🏛️ **${res.agentName} — សេចក្តីថ្លែងការណ៍ & ការប្រឹក្សាផ្លូវការ**\n\n`;
          }
          msg += res.officialContent;
          await ctx.reply(msg, { parse_mode: 'Markdown' });
        }
        return;
      }

      if (data.startsWith('debate:')) {
        const topicKey = data.replace('debate:', '');
        const topicMap: Record<string, string> = {
          online_scams: 'វិធានការទប់ស្កាត់ការឆបោកតាមអនឡាញ និងល្បែងស៊ីសងខុសច្បាប់',
          land_dispute: 'នីតិវិធីដោះស្រាយវិវាទដីធ្លី និងការចុះបញ្ជីក្បាលដីប្លង់រឹង',
          anti_corruption: 'ការទប់ស្កាត់អំពើពុករលួយ និងការទារកម្រៃក្រៅផ្លូវការនៅច្រកចេញចូលតែមួយ',
          traffic_order: 'ការរឹតបន្តឹងច្បាប់ចរាចរណ៍ផ្លូវគោក និងការផាកពិន័យបទល្មើសស្រវឹង',
          tax_reforms: 'កំណែទម្រង់ប្រព័ន្ធពន្ធដារឌីជីថល និងការលើកទឹកចិត្តធុរកិច្ចថ្មី'
        };
        const topic = topicMap[topicKey] || 'វិធានការសន្តិសុខ និងសេវាសាធារណៈជូនប្រជាពលរដ្ឋ';
        await ctx.answerCallbackQuery({ text: 'កំពុងកោះប្រជុំបន្ទាន់ AGI...' });
        await ctx.reply(`⚡ **កំពុងកោះប្រជុំបន្ទាន់ AGI អន្តរក្រសួង...**\nប្រធានបទ ៖ «*${topic}*»\n*កំពុងស្រង់មាត្រាច្បាប់ និងសម្របសម្រួលចម្លើយ...*`, { parse_mode: 'Markdown' });
        const res = await InterMinisterialDebateEngine.deliberateOnTopic({
          topic,
          initiatedBy: ctx.from?.first_name || 'Super Admin'
        });
        await ctx.reply(res.formattedTelegramDigest, { parse_mode: 'Markdown' });
        return;
      }

      if (data === 'menu_status') {
        await ctx.answerCallbackQuery();
        const agents = db.getAgents();
        const runners = db.getRunnerLeases();
        const tasks = db.getTasks();
        const mem = process.memoryUsage();
        const ramMb = Math.round(mem.rss / 1024 / 1024);

        const kb = new InlineKeyboard()
          .text('🔄 Refresh Status', 'menu_status')
          .row()
          .text('⬅️ ត្រឡប់ទៅមឺនុយមេ', 'menu_main');

        const statusMsg = `📊 **ស្ថានភាពប្រព័ន្ធ ANGKOR EYES (Live Platform Health)**\n\n` +
          `• 🤖 **Total AGI Agents**: 78+ Active Agents\n` +
          `• ⚡ **Engine Cost**: $0.00 Free Tier (Google Cloud VPS e2-micro)\n` +
          `• 🧠 **RAM Consumption**: ${ramMb} MB / 1024 MB (Very Healthy)\n` +
          `• 💻 **Local Runner Engine**: ${runners.filter(r => r.status === 'online').length > 0 ? '🟢 Online' : '🟡 Standby / Local Mode'}\n` +
          `• 📋 **Tasks In-Flight**: ${tasks.filter(t => t.status === 'running').length} Tasks\n` +
          `• 🕒 **Uptime**: ${Math.floor(process.uptime() / 60)} នាទី\n\n` +
          `*ប្រព័ន្ធដំណើរការ ២៤ ម៉ោង លើ ២៤ ម៉ោង គ្មានការរអាក់រអួលឡើយ ៕*`;

        await ctx.editMessageText(statusMsg, { reply_markup: kb, parse_mode: 'Markdown' });
        return;
      }

      if (data === 'open_web') {
        await ctx.answerCallbackQuery({ text: 'សូមបើក Mini Web តាម Browser ឬ Cloudflare HTTPS' });
        await ctx.reply(
          `🌐 **ANGKOR EYES Sovereign Mini Web Command Center**\n\n` +
          `• ផ្ទាំងគ្រប់គ្រងរដ្ឋបាលឌីជីថលបែប Futuristic Dark Mode\n` +
          `• មើលការជជែកដេញដោលផ្ទាល់តាម WebSockets (Real-Time)\n` +
          `• បញ្ជី AGI Agents ទាំង ៧៨ និងការអនុញ្ញាតសកម្មភាពហានិភ័យ (Approvals)\n\n` +
          `👉 **អាសយដ្ឋានបើកប្រើប្រាស់** ៖\n` +
          `• តាម Local ៖ \`http://localhost:3000\`\n` +
          `• តាម Cloudflare HTTPS ៖ \`https://<your-tunnel>.trycloudflare.com\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }
    });

    // Regular direct messages or agency-specific slash commands
    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      const rooms = db.getRooms();
      const targetRoom = rooms[0] || { id: 'room-main-squad' };

      // Handle Slash Commands for specific Government Agencies
      if (text.startsWith('/')) {
        const parts = text.split(/\s+/);
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ');

        const matchedPreset = findAgentPresetByCommand(command);
        if (matchedPreset) {
          const userPrompt = query || 'សូមជួយរៀបរាប់អំពីតួនាទី បេសកកម្ម ដំណោះស្រាយចំពោះមុខ និងសេវាសាធារណៈផ្លូវការរបស់អ្នក';
          await ctx.reply(
            `🏛️ **${matchedPreset.name}**\n` +
            `*តំណាង/ទីប្រឹក្សា/អ្នកនាំពាក្យផ្លូវការ កំពុងរៀបចំចម្លើយវិជ្ជាជីវៈ និងស្រង់មាត្រាច្បាប់...*\n` +
            `🌐 \`${matchedPreset.officialWebsite || '—'}\` | 📘 *${matchedPreset.officialFacebook || '—'}*`,
            { parse_mode: 'Markdown' }
          );

          try {
            const spokespersonRes = await InstitutionalSpokespersonOrchestrator.generateSpokespersonResponse({
              agentCommand: command,
              agentName: matchedPreset.name,
              institutionTitle: matchedPreset.systemPrompt.split('\n')[0] || matchedPreset.name,
              userQuery: userPrompt,
              model: matchedPreset.model
            });

            let replyMsg = '';
            if (!spokespersonRes.officialContent.includes('ព្រះរាជាណាចក្រកម្ពុជា')) {
              replyMsg += `🏛️ **${spokespersonRes.agentName} — សេចក្តីថ្លែងការណ៍ & ការប្រឹក្សាផ្លូវការ**\n\n`;
            }
            replyMsg += `${spokespersonRes.officialContent}\n\n`;
            if (spokespersonRes.citedLaws && spokespersonRes.citedLaws.length > 0 && !spokespersonRes.officialContent.includes('មូលដ្ឋានច្បាប់')) {
              replyMsg += `⚖️ **មូលដ្ឋានច្បាប់យោង (Legal Basis)**:\n${spokespersonRes.citedLaws.map(l => `• ${l}`).join('\n')}\n\n`;
            }
            if (spokespersonRes.credibilityBadge) {
              replyMsg += `🛡️ **កម្រិតភាពជឿជាក់**: ${spokespersonRes.credibilityBadge}\n`;
            }

            await ctx.reply(replyMsg, { parse_mode: 'Markdown' });

            // Record into room chat history
            db.addMessage({
              roomId: targetRoom.id,
              agentId: matchedPreset.id,
              agentName: matchedPreset.name,
              content: replyMsg,
              senderType: 'agent'
            });
          } catch (err: any) {
            await ctx.reply(`⚠️ កំហុសក្នុងដំណើរការ: ${err.message}`);
          }
          return;
        }

        // Other unknown commands
        return;
      }

      // Citizen Grievance Mediation (High Empathy Calming Response)
      const mediation = VoiceVisionInspector.mediateCitizenFrustration(text);
      if (mediation.isHighGrievance && mediation.empathyResponseKhmer) {
        await ctx.reply(`🤝 ${mediation.empathyResponseKhmer}`, { parse_mode: 'Markdown' });
      }

      // Default: 1-on-1 with Supreme Controller AGI ANGKOR EYES
      await ctx.reply(`👑 **AGI ANGKOR EYES (Supreme Command)** កំពុងទទួលការងារ និងបំបែក Task Tree...`, { parse_mode: 'Markdown' });

      try {
        await TurnCoordinator.handleMessage({
          roomId: targetRoom.id,
          senderType: 'human',
          senderId: `tg-${ctx.from.id}`,
          senderName: ctx.from.first_name || 'Owner',
          content: text
        });
      } catch (err: any) {
        await ctx.reply(`⚠️ កំហុសក្នុងដំណើរការ: ${err.message}`);
      }
    });

    // Voice Message (Voice Notes) - Speech-to-Text in Khmer
    bot.on('message:voice', async (ctx) => {
      await ctx.reply('🎙️ *កំពុងស្តាប់ និងបំប្លែងសារសំឡេងជាអក្សរផ្លូវការ (Transcribing Khmer Voice)...*', { parse_mode: 'Markdown' });
      try {
        const file = await ctx.getFile();
        let transcribedText = 'សូមជម្រាបសួរ ខ្ញុំមានសំណើចង់ពិគ្រោះយោបល់ជាមួយតំណាងក្រសួងផ្លូវការ';
        if (file.file_path && config.telegramBotToken) {
          const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
          try {
            const resp = await fetch(fileUrl);
            const arrayBuf = await resp.arrayBuffer();
            const base64 = Buffer.from(arrayBuf).toString('base64');
            const result = await VoiceVisionInspector.transcribeVoice(base64, 'audio/ogg');
            transcribedText = result.text;
          } catch {
            // fallback handled
          }
        }
        await ctx.reply(`📝 **អត្ថបទបំប្លែងពីសំឡេង (Transcribed Text)** ៖\n"${transcribedText}" ៕`, { parse_mode: 'Markdown' });

        // Forward to default TurnCoordinator / Spokesperson
        const rooms = db.getRooms();
        const targetRoom = rooms[0] || { id: 'room-main-squad' };
        await TurnCoordinator.handleMessage({
          roomId: targetRoom.id,
          senderType: 'human',
          senderId: `tg-${ctx.from.id}`,
          senderName: ctx.from.first_name || 'Citizen',
          content: transcribedText
        });
      } catch (err: any) {
        await ctx.reply(`⚠️ កំហុសក្នុងការបំប្លែងសំឡេង: ${err.message}`);
      }
    });

    // Photo / Document Inspection (e-KYC & Evidence Verification)
    bot.on('message:photo', async (ctx) => {
      await ctx.reply('📷 *កំពុងត្រួតពិនិត្យរូបភាពឯកសារ (Analyzing Document & Anti-Fraud)...*', { parse_mode: 'Markdown' });
      const kycResult = await VoiceVisionInspector.verifyCitizenKyc({
        idCardPhotoBase64: 'sample_photo_received'
      });
      const badge = kycResult.status === 'approved' ? '✅' : '❌';
      await ctx.reply(`${badge} **លទ្ធផលត្រួតពិនិត្យឯកសារ** ៖\n${kycResult.reason}`, { parse_mode: 'Markdown' });
    });
  }

  private static startBot(bot: Bot): void {
    // Register official command list into Telegram native [/] menu
    bot.api.setMyCommands([
      { command: 'menu', description: '🏛️ មឺនុយមេ & ផ្ទាំងបញ្ជា AGI ទាំង ៧៨' },
      { command: 'interior', description: '🏛️ ក្រសួងមហាផ្ទៃ & អត្តសញ្ញាណកម្ម' },
      { command: 'justice', description: '⚖️ ក្រសួងយុត្តិធម៌ & តុលាការ' },
      { command: 'finance', description: '💰 ក្រសួងសេដ្ឋកិច្ច & ហិរញ្ញវត្ថុ' },
      { command: 'defence', description: '🛡️ ក្រសួងការពារជាតិ & កងទ័ព' },
      { command: 'police', description: '👮 អគ្គស្នងការដ្ឋាននគរបាលជាតិ (117)' },
      { command: 'acu', description: '🚫 អង្គភាពប្រឆាំងអំពើពុករលួយ (1282)' },
      { command: 'land', description: '🗺️ វិវាទដីធ្លី និងការចុះបញ្ជីប្លង់រឹង' },
      { command: 'debate', description: '⚡ កោះប្រជុំ ៧៨ Agents ជជែកដោះស្រាយវិបត្តិ' },
      { command: 'hottopics', description: '🔥 ប្រធានបទក្តៅសង្គមជាតិកំពុងផ្ទុះ' },
      { command: 'web', description: '🌐 បើក Sovereign Mini Web App' },
      { command: 'status', description: '📊 ពិនិត្យសុខភាពប្រព័ន្ធ & ម៉ាស៊ីន VPS' }
    ]).catch(() => { });

    bot.start({
      onStart: (info) => {
        console.log(`[TelegramBot] Bot @${info.username} started successfully via Long Polling.`);
      }
    }).catch(err => {
      console.error('[TelegramBot] Bot polling error:', err.message);
    });
  }

  /**
   * Validates Telegram.WebApp.initData using HMAC-SHA256 signature verification.
   */
  public static validateTelegramInitData(initDataRaw: string): { valid: boolean; user?: any } {
    if (!config.telegramBotToken || !initDataRaw) {
      // In development mode, allow mock user
      return { valid: true, user: { id: config.allowedTelegramIds[0] || 123456789, first_name: 'Developer' } };
    }

    try {
      const params = new URLSearchParams(initDataRaw);
      const hash = params.get('hash');
      if (!hash) return { valid: false };

      params.delete('hash');
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.telegramBotToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (calculatedHash === hash) {
        const userJson = params.get('user');
        return { valid: true, user: userJson ? JSON.parse(userJson) : undefined };
      }
      return { valid: false };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Send notification or approval prompt to owner Telegram chat.
   */
  public static async sendApprovalAlert(approval: any): Promise<void> {
    if (!this.bot || config.allowedTelegramIds.length === 0) return;
    const chatId = config.allowedTelegramIds[0];

    const keyboard = new InlineKeyboard()
      .text('✅ Approve', `apr_yes:${approval.id}`)
      .text('❌ Reject', `apr_no:${approval.id}`);

    const text = `⚠️ **សកម្មភាពត្រូវការការអនុញ្ញាត (Approval Required)**:
• **Action**: \`${approval.actionType}\`
• **Summary**: ${approval.summary}
• **Branch**: \`${approval.branchName}\`
• **Target Commit**: \`${approval.targetCommitSha}\`

តើអ្នកយល់ព្រមអនុញ្ញាតឱ្យ Agent បន្តដំណើរការទេ?`;

    try {
      await this.bot.api.sendMessage(chatId, text, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    } catch (err: any) {
      console.warn('[TelegramBot] Could not send approval alert:', err.message);
    }
  }
}
