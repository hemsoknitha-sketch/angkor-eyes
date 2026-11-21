import React from 'react';
import {
  Shield, Lock, Key, AlertTriangle, CheckCircle2,
  Terminal, FileCode, Check
} from 'lucide-react';

export const Security: React.FC = () => {
  const policies = [
    {
      title: 'Prompt Injection Defense & Instruction Hierarchy',
      desc: 'System Directives > Human Directives > Tool Output. Untrusted content is sandboxed inside <<<UNTRUSTED_CONTENT>>> tags to neutralize adversarial jailbreak attempts.',
      status: 'Active & Enforced',
      color: 'text-emerald-400'
    },
    {
      title: 'PII & Secret Redaction Scanner',
      desc: 'All outbound LLM traffic is scanned with regex and entropy detectors. API keys, JWTs, AWS credentials, and DB connections are redacted before transmission.',
      status: 'Active (8 Patterns)',
      color: 'text-emerald-400'
    },
    {
      title: 'TOCTOU Approval State Machine',
      desc: 'Cryptographic SHA-256 hash (action_hash) locks git commit SHA and payload. Any commit changes between approval and execution will abort the action.',
      status: 'Active & Cryptographic',
      color: 'text-emerald-400'
    },
    {
      title: 'Sandboxed Command Allowlist',
      desc: 'Local Runner restricts command execution to approved binaries (git, npm, pytest, etc.). Directory traversal outside worktree base path is hard-blocked.',
      status: 'Active on Runner',
      color: 'text-emerald-400'
    }
  ];

  const capabilityMatrix = [
    { role: 'Lead Agent (Rex)', plan: true, read: true, write: false, test: false, commit: false, merge: false, push: false },
    { role: 'Developer (Dara)', plan: false, read: true, write: true, test: true, commit: true, merge: false, push: false },
    { role: 'QA Tester (Bopha)', plan: false, read: true, write: false, test: true, commit: false, merge: false, push: false },
    { role: 'Code Reviewer (Sok)', plan: false, read: true, write: false, test: true, commit: false, merge: false, push: false },
    { role: 'Security Auditor', plan: false, read: true, write: false, test: true, commit: false, merge: false, push: false },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <span>មជ្ឈមណ្ឌលសុវត្ថិភាព & សិទ្ធិ (Security & Policy Center)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          ការពារកុំព្យូទ័រ និងទិន្នន័យរបស់អ្នក: Capability Matrix, Secret Redactor, និង Injection Defense
        </p>
      </div>

      {/* Active Security Defenses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {policies.map((p, i) => (
          <div key={i} className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">{p.title}</h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 ${p.color}`}>
                {p.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Role-Based Capability Matrix */}
      <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-emerald-400" /> Agent Capability & Permission Matrix (Backend Policy Engine):
        </span>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-center">Plan & Delegate</th>
                <th className="py-2.5 px-3 text-center">Read Files</th>
                <th className="py-2.5 px-3 text-center">Write Worktree</th>
                <th className="py-2.5 px-3 text-center">Run Tests</th>
                <th className="py-2.5 px-3 text-center">Commit Branch</th>
                <th className="py-2.5 px-3 text-center">Merge Main</th>
                <th className="py-2.5 px-3 text-center">Push Remote</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {capabilityMatrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40">
                  <td className="py-3 px-3 font-bold text-slate-200">{row.role}</td>
                  <td className="py-3 px-3 text-center">{row.plan ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-3 px-3 text-center">{row.read ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-3 px-3 text-center">{row.write ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-3 px-3 text-center">{row.test ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-3 px-3 text-center">{row.commit ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-3 px-3 text-center text-amber-400">{row.merge ? '✓' : '🔒 Approval Gate'}</td>
                  <td className="py-3 px-3 text-center text-amber-400">{row.push ? '✓' : '🔒 Approval Gate'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
