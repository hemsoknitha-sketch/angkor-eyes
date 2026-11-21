import { useState } from "react";
import { api } from "../lib/api";

export default function FeedbackButtons({ messageId }: { messageId: string }) {
  const [voted, setVoted] = useState<1 | -1 | null>(null);
  const vote = (v: 1 | -1) => { setVoted(v); void api.feedback(messageId, v); };
  return (
    <div className="flex gap-1 mt-1">
      <button aria-label="good" onClick={() => vote(1)} className={`text-sm px-1.5 rounded ${voted === 1 ? "bg-green-200 dark:bg-green-900" : "opacity-60 hover:opacity-100"}`}>👍</button>
      <button aria-label="bad" onClick={() => vote(-1)} className={`text-sm px-1.5 rounded ${voted === -1 ? "bg-red-200 dark:bg-red-900" : "opacity-60 hover:opacity-100"}`}>👎</button>
    </div>
  );
}
