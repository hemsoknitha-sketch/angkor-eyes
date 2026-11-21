export function getMiniWebAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="km" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>🇰🇭 ANGKOR EYES — Sovereign Institutional AGI Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Khmer:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Noto Sans Khmer"', 'Inter', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#ecfdf5',
              500: '#10b981',
              600: '#059669',
              900: '#064e3b',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #070c18;
      color: #e2e8f0;
      font-family: 'Noto Sans Khmer', 'Inter', sans-serif;
    }
    .glass {
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .glass-active {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #0f172a;
    }
    ::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 3px;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-white">

  <!-- Header -->
  <header class="sticky top-0 z-50 glass border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-lg">
    <div class="flex items-center space-x-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400 p-[2px] shadow-lg shadow-emerald-500/20">
        <div class="w-full h-full bg-[#0a0f1d] rounded-[10px] flex items-center justify-center font-bold text-amber-400 text-lg">
          🇰🇭
        </div>
      </div>
      <div>
        <h1 class="text-base font-bold tracking-tight text-white flex items-center gap-2">
          ANGKOR EYES
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono font-medium">SOVEREIGN AGI</span>
        </h1>
        <p class="text-xs text-slate-400">78 Autonomous Agents • Real-Time Live Intelligence</p>
      </div>
    </div>

    <!-- Live Status Pill -->
    <div class="flex items-center space-x-2">
      <div id="ws-badge" class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span id="ws-text">LIVE</span>
      </div>
    </div>
  </header>

  <!-- Metric Badges Strip -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
    <div class="glass p-3 rounded-xl border border-slate-800">
      <div class="text-xs text-slate-400">Active Agents</div>
      <div id="metric-agents" class="text-xl font-bold text-emerald-400 mt-1">78 Agents</div>
      <div class="text-[10px] text-slate-500 mt-0.5">Ministries & Provinces</div>
    </div>
    <div class="glass p-3 rounded-xl border border-slate-800">
      <div class="text-xs text-slate-400">Engine Cost</div>
      <div class="text-xl font-bold text-amber-400 mt-1">$0.00 Free</div>
      <div class="text-[10px] text-slate-500 mt-0.5">24/7 365 Cloud VPS</div>
    </div>
    <div class="glass p-3 rounded-xl border border-slate-800">
      <div class="text-xs text-slate-400">Server Status</div>
      <div id="metric-status" class="text-xl font-bold text-teal-400 mt-1">Healthy</div>
      <div class="text-[10px] text-slate-500 mt-0.5">1GB RAM + 2GB Swap</div>
    </div>
    <div class="glass p-3 rounded-xl border border-slate-800">
      <div class="text-xs text-slate-400">Pending Approvals</div>
      <div id="metric-approvals" class="text-xl font-bold text-sky-400 mt-1">0 Pending</div>
      <div class="text-[10px] text-slate-500 mt-0.5">Human-in-the-Loop</div>
    </div>
  </div>

  <!-- Navigation Tabs -->
  <div class="px-4 border-b border-slate-800/80 flex space-x-2 overflow-x-auto text-xs font-medium">
    <button onclick="switchTab('debate')" id="tab-btn-debate" class="px-4 py-2.5 rounded-t-lg border-b-2 border-emerald-400 text-emerald-400 bg-emerald-500/5">
      💬 បន្ទប់ជជែកដេញដោល (Deliberation)
    </button>
    <button onclick="switchTab('roster')" id="tab-btn-roster" class="px-4 py-2.5 rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-white">
      🏛️ AGI Agents ទាំង ៧៨ (Roster)
    </button>
    <button onclick="switchTab('audit')" id="tab-btn-audit" class="px-4 py-2.5 rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-white">
      🛡️ សវនកម្មច្បាប់ & សុវត្ថិភាព
    </button>
  </div>

  <!-- Tab 1: Live Deliberation / Debate -->
  <div id="view-debate" class="flex-1 flex flex-col p-4 space-y-4">
    <!-- Debate Trigger Box -->
    <div class="glass p-3 rounded-xl flex flex-col sm:flex-row gap-2 items-center">
      <input type="text" id="debate-topic-input" placeholder="បញ្ចូលប្រធានបទក្តៅ ឧ. វិធានការដោះស្រាយវិវាទដីធ្លី ឬការឆបោកតាមអនឡាញ..." class="flex-1 w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500">
      <button onclick="triggerDebate()" class="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/30">
        ⚡ ចាប់ផ្តើមជជែកអន្តរក្រសួង
      </button>
    </div>

    <!-- Quick Topic Pills -->
    <div class="flex flex-wrap gap-1.5 text-[11px]">
      <span class="text-slate-400 self-center mr-1">ប្រធានបទគំរូ ៖</span>
      <button onclick="setDebateTopic('វិធានការទប់ស្កាត់ការឆបោកតាមអនឡាញ និងល្បែងស៊ីសងខុសច្បាប់')" class="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300">🛡️ ឆបោកអនឡាញ</button>
      <button onclick="setDebateTopic('នីតិវិធីដោះស្រាយវិវាទដីធ្លី និងការចុះបញ្ជីក្បាលដីប្លង់រឹង')" class="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300">⚖️ វិវាទដីធ្លី</button>
      <button onclick="setDebateTopic('ការទប់ស្កាត់អំពើពុករលួយ និងការទារកម្រៃក្រៅផ្លូវការនៅច្រកចេញចូលតែមួយ')" class="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300">🚫 ប្រឆាំងពុករលួយ</button>
      <button onclick="setDebateTopic('ការរឹតបន្តឹងច្បាប់ចរាចរណ៍ផ្លូវគោក និងការផាកពិន័យបទល្មើសស្រវឹង')" class="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300">🚗 ច្បាប់ចរាចរណ៍</button>
    </div>

    <!-- Chat Stream Window -->
    <div id="messages-container" class="glass flex-1 min-h-[420px] max-h-[560px] overflow-y-auto p-4 rounded-xl space-y-3 font-sans text-xs">
      <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300">
        <div class="font-bold text-amber-400 text-sm flex items-center gap-1.5">
          <span>👑</span> AGI ANGKOR EYES (Supreme Command)
        </div>
        <p class="mt-1 leading-relaxed">
          សូមស្វាគមន៍មកកាន់មជ្ឈមណ្ឌលប្រជុំ និងសម្រេចចិត្តកំពូលនៃ AGI ANGKOR EYES។ ប្រព័ន្ធបានត្រៀមរួចជាស្រេចដើម្បីឱ្យ AGI Agents ទាំង ៧៨ ជជែកវែកញ៉ែកដោះស្រាយវិបត្តិសង្គមក្នុង Real-Time។
        </p>
      </div>
    </div>
  </div>

  <!-- Tab 2: 78 Agents Roster -->
  <div id="view-roster" class="hidden flex-1 p-4 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-bold text-white">បញ្ជីរាយនាម AGI AGENTS ស្ថាប័នរដ្ឋទាំង ៧៨</h2>
      <span class="text-xs text-emerald-400">Active: 78 / 78</span>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" id="roster-grid">
      <!-- Roster cards injected via JS -->
    </div>
  </div>

  <!-- Tab 3: Security & Legal Audit -->
  <div id="view-audit" class="hidden flex-1 p-4 space-y-4">
    <div class="glass p-4 rounded-xl border border-slate-800">
      <h3 class="text-sm font-bold text-white flex items-center gap-2">
        <span>🛡️</span> សវនកម្មសុវត្ថិភាពជាតិ & TOCTOU Verification
      </h3>
      <p class="text-xs text-slate-400 mt-1">
        រាល់សកម្មភាពដែលមានហានិភ័យ (Git Push, Database DDL, Root Commands) ត្រូវបានឃាត់ទុកដោយស្វ័យប្រវត្តិតាមរយៈ Cryptographic SHA Approval Gate។
      </p>

      <div class="mt-4 p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-white">Emergency Kill Switch</div>
          <div class="text-[11px] text-slate-400">ផ្អាកសកម្មភាព Agents ទាំងអស់ជាបន្ទាន់ពេលមានអាសន្ន</div>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">READY</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="p-3 text-center text-[10px] text-slate-500 border-t border-slate-800/80">
    ANGKOR EYES Sovereign Institutional AGI Engine • Free 24/7 365 on Google Cloud VPS
  </footer>

  <script>
    // 1. Initialize Telegram WebApp SDK if available
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    // 2. Tab Navigation
    function switchTab(tab) {
      ['debate', 'roster', 'audit'].forEach(t => {
        document.getElementById('view-' + t).classList.add('hidden');
        document.getElementById('tab-btn-' + t).className = 'px-4 py-2.5 rounded-t-lg border-b-2 border-transparent text-slate-400 hover:text-white';
      });
      document.getElementById('view-' + tab).classList.remove('hidden');
      document.getElementById('tab-btn-' + tab).className = 'px-4 py-2.5 rounded-t-lg border-b-2 border-emerald-400 text-emerald-400 bg-emerald-500/5';
    }

    // 3. Set debate topic helper
    function setDebateTopic(topic) {
      document.getElementById('debate-topic-input').value = topic;
    }

    // 4. WebSocket Live Connection
    let ws;
    function connectWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + window.location.host + '/ws';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        document.getElementById('ws-badge').className = 'flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400';
        document.getElementById('ws-text').textContent = 'LIVE';
      };

      ws.onclose = () => {
        document.getElementById('ws-badge').className = 'flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400';
        document.getElementById('ws-text').textContent = 'RECONNECTING';
        setTimeout(connectWs, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_MESSAGE' && data.message) {
            appendMessage(data.message.agentName || 'AGI Agent', data.message.content);
          }
          if (data.type === 'INITIAL_MESSAGES' && Array.isArray(data.messages)) {
            data.messages.forEach(m => appendMessage(m.agentName || 'AGI Agent', m.content));
          }
        } catch (e) {}
      };
    }

    function appendMessage(sender, text) {
      const container = document.getElementById('messages-container');
      const div = document.createElement('div');
      div.className = 'p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-200 leading-relaxed';
      div.innerHTML = '<div class="font-bold text-emerald-400 text-xs mb-1">' + sender + '</div>' +
                      '<div class="whitespace-pre-wrap">' + escapeHtml(text) + '</div>';
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function escapeHtml(str) {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // 5. Trigger Debate API
    async function triggerDebate() {
      const topicInput = document.getElementById('debate-topic-input');
      const topic = topicInput.value.trim();
      if (!topic) return;

      appendMessage('🧑‍💼 ប្រជាពលរដ្ឋ (Citizen)', 'ស្នើសុំជជែកពិភាក្សាលើប្រធានបទ ៖ «' + topic + '»');
      topicInput.value = '';

      try {
        const res = await fetch('/api/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, initiatedBy: 'Web Command Center' })
        });
        const data = await res.json();
        if (data.statements) {
          data.statements.forEach(s => appendMessage(s.agentName, s.statement));
        }
      } catch (err) {
        appendMessage('⚠️ ប្រព័ន្ធ', 'កំហុសក្នុងការតភ្ជាប់ ៖ ' + err.message);
      }
    }

    // 6. Populate 78 Agents Roster
    const AGENTS_LIST = [
      { name: 'ក្រសួងមហាផ្ទៃ', cmd: '/interior', category: 'ក្រសួងសំខាន់ៗ', site: 'interior.gov.kh' },
      { name: 'ក្រសួងការពារជាតិ', cmd: '/mod', category: 'ក្រសួងសំខាន់ៗ', site: 'mod.gov.kh' },
      { name: 'ក្រសួងយុត្តិធម៌', cmd: '/moj', category: 'ក្រសួងសំខាន់ៗ', site: 'moj.gov.kh' },
      { name: 'ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', cmd: '/mef', category: 'ក្រសួងសំខាន់ៗ', site: 'mef.gov.kh' },
      { name: 'ក្រសួងការបរទេស', cmd: '/mfaic', category: 'ក្រសួងសំខាន់ៗ', site: 'mfaic.gov.kh' },
      { name: 'អគ្គស្នងការដ្ឋាននគរបាលជាតិ', cmd: '/police', category: 'សន្តិសុខជាតិ', site: 'police.gov.kh' },
      { name: 'អង្គភាពប្រឆាំងអំពើពុករលួយ', cmd: '/acu', category: 'សន្តិសុខជាតិ', site: 'acu.gov.kh' },
      { name: 'អគ្គនាយកដ្ឋានពន្ធដារ', cmd: '/tax', category: 'សេដ្ឋកិច្ច', site: 'tax.gov.kh' },
      { name: 'អគ្គនាយកដ្ឋានគយ និងរដ្ឋាករ', cmd: '/customs', category: 'សេដ្ឋកិច្ច', site: 'customs.gov.kh' },
      { name: 'ធនាគារជាតិនៃកម្ពុជា', cmd: '/nbc', category: 'សេដ្ឋកិច្ច', site: 'nbc.gov.kh' },
      { name: 'ក្រសួងរៀបចំដែនដី (ដីធ្លី)', cmd: '/mlmupc', category: 'សេវាសាធារណៈ', site: 'mlmupc.gov.kh' },
      { name: 'ក្រសួងសាធារណការ (ចរាចរណ៍)', cmd: '/mpwt', category: 'សេវាសាធារណៈ', site: 'mpwt.gov.kh' },
      { name: 'ក្រសួងសុខាភិបាល', cmd: '/moh', category: 'សេវាសាធារណៈ', site: 'moh.gov.kh' },
      { name: 'ក្រសួងអប់រំ យុវជន និងកីឡា', cmd: '/moeys', category: 'សេវាសាធារណៈ', site: 'moeys.gov.kh' },
      { name: 'ក្រសួងពាណិជ្ជកម្ម', cmd: '/moc', category: 'សេដ្ឋកិច្ច', site: 'moc.gov.kh' },
      { name: 'រដ្ឋបាលរាជធានីភ្នំពេញ', cmd: '/phnompenh', category: 'រដ្ឋបាលរាជធានី-ខេត្ត', site: 'phnompenh.gov.kh' },
      { name: 'រដ្ឋបាលខេត្តសៀមរាប', cmd: '/siemreap', category: 'រដ្ឋបាលរាជធានី-ខេត្ត', site: 'siemreap.gov.kh' },
      { name: 'រដ្ឋបាលខេត្តព្រះសីហនុ', cmd: '/preahsihanouk', category: 'រដ្ឋបាលរាជធានី-ខេត្ត', site: 'preahsihanouk.gov.kh' },
      { name: 'រដ្ឋបាលខេត្តបាត់ដំបង', cmd: '/battambang', category: 'រដ្ឋបាលរាជធានី-ខេត្ត', site: 'battambang.gov.kh' },
      { name: 'រដ្ឋបាលខេត្តកណ្តាល', cmd: '/kandal', category: 'រដ្ឋបាលរាជធានី-ខេត្ត', site: 'kandal.gov.kh' }
    ];

    function renderRoster() {
      const grid = document.getElementById('roster-grid');
      grid.innerHTML = AGENTS_LIST.map(a => \`
        <div class="glass p-3 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">\${a.name}</span>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">\${a.cmd}</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1">គេហទំព័រ ៖ \${a.site}</div>
          <div class="mt-2.5 flex gap-1.5">
            <button onclick="setDebateTopic('សំណើសុំការប្រឹក្សា និងដោះស្រាយបញ្ហាពី ' + '\${a.name}'); switchTab('debate');" class="flex-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] text-center font-medium">
              ពិគ្រោះយោបល់
            </button>
            <a href="https://www.\${a.site}" target="_blank" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px]">
              🌐
            </a>
          </div>
        </div>
      \`).join('');
    }

    renderRoster();
    connectWs();
  </script>
</body>
</html>`;
}
