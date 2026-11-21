import { useState } from "react";

/** 3 steps: Connect Repo → Create first Agents → Trial Task. */
export default function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [repo, setRepo] = useState("");
  const steps = [
    { title: "1️⃣ ភ្ជាប់ Repo · Connect Repo", body: "បញ្ចូល URL របស់ Git repo (GitHub/GitLab)។", content: <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder="https://github.com/you/my-shop" value={repo} onChange={(e) => setRepo(e.target.value)} /> },
    { title: "2️⃣ បង្កើតភ្នាក់ងារដំបូង · Create First Agents", body: "Lead នឹងស្នើ Dev + QA + Reviewer សម្រាប់គម្រោងរបស់អ្នក។", content: <p className="text-sm">🤖 Lead · Dev · QA · Reviewer — រួចរាល់ដើម្បីបង្កើត</p> },
    { title: "3️⃣ កិច្ចការសាកល្បង · Trial Task", body: "សាកផ្ញើកិច្ចការតូចមួយទៅ Lead Agent ហើយមើលវាបែងចែកការងារ។", content: <p className="text-sm">ឧ. “បន្ថែមទំព័រ About” — Try: “Add an About page”</p> },
  ];
  const s = steps[step];
  return (
    <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 max-w-lg mx-auto">
      <h3 className="font-semibold text-lg mb-1">{s.title}</h3>
      <p className="text-sm text-zinc-500 mb-4">{s.body}</p>
      {s.content}
      <div className="flex justify-between mt-5">
        <button disabled={step === 0} onClick={() => setStep(step - 1)} className="px-3 py-2 rounded bg-zinc-100 dark:bg-zinc-800 disabled:opacity-40">← ថយ</button>
        {step < 2 ? <button onClick={() => setStep(step + 1)} className="px-4 py-2 rounded bg-violet-600 text-white">បន្ត →</button>
          : <button onClick={onDone} className="px-4 py-2 rounded bg-green-600 text-white">✅ ចាប់ផ្តើម · Start</button>}
      </div>
      <div className="text-xs text-zinc-400 mt-3 text-center">ជំហាន {step + 1} / 3</div>
    </div>
  );
}
