import React, { useEffect, useState, useRef } from 'react';
import {
  Send, Users, Bot, Sparkles, CheckCircle2,
  Clock, AlertTriangle, GitCommit, CornerDownRight, Shield,
  ThumbsUp, ThumbsDown, Image as ImageIcon
} from 'lucide-react';
import { api, Message, Agent } from '../lib/api';

export const ChatRoom: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<{ agentName: string; state: string } | null>(null);
  const [turnQueue, setTurnQueue] = useState<{ currentSpeaker?: string; waiting: string[] }>({ waiting: [] });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadInitial = async () => {
    try {
      const [r, ag] = await Promise.all([api.getRooms(), api.getAgents()]);
      setRooms(r);
      setAgents(ag);
      if (r.length > 0 && !selectedRoomId) {
        setSelectedRoomId(r[0].id);
        const ms = await api.getMessages(r[0].id);
        setMessages(ms);
      }
    } catch (err) {
      console.error('Failed to load chat data:', err);
    }
  };

  useEffect(() => {
    loadInitial();
    const unsubscribe = api.subscribeWs((event) => {
      if (event.type === 'NEW_MESSAGE') {
        if (!selectedRoomId || event.message.roomId === selectedRoomId) {
          setMessages((prev) => [...prev, event.message]);
        }
      }
      if (event.type === 'AGENT_STATUS') {
        if (event.state === 'idle') {
          setActiveSpeaker(null);
        } else {
          setActiveSpeaker({ agentName: event.agentName, state: event.state });
        }
      }
      if (event.type === 'AGENT_QUEUE') {
        setTurnQueue(event.queueInfo);
      }
    });

    return () => unsubscribe();
  }, [selectedRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeSpeaker]);

  const handleFeedback = async (messageId: string, rating: 1 | -1) => {
    try {
      await fetch(`/api/messages/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      alert(rating === 1 ? '👍 បានកត់ត្រាការគាំទ្រ (Helpful)!' : '👎 បានកត់ត្រាមតិកែលម្អ (Needs Improvement)!');
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  const handleRoomChange = async (id: string) => {
    setSelectedRoomId(id);
    const ms = await api.getMessages(id);
    setMessages(ms);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || sending || !selectedRoomId) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    try {
      await api.sendMessage(selectedRoomId, content);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleApproveInline = async (aprId: string) => {
    await api.approveRequest(aprId);
    if (selectedRoomId) {
      const ms = await api.getMessages(selectedRoomId);
      setMessages(ms);
    }
  };

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#0a0f1d] overflow-hidden">
      {/* Rooms Sidebar */}
      <div className="w-56 border-r border-slate-800 bg-[#0d1424] flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300">Project Rooms</span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
            {rooms.length}
          </span>
        </div>

        <div className="p-2 space-y-1 overflow-y-auto flex-1">
          {rooms.map((room) => {
            const isSelected = room.id === selectedRoomId;
            return (
              <button
                key={room.id}
                onClick={() => handleRoomChange(room.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span className="truncate">{room.name}</span>
              </button>
            );
          })}
        </div>

        {/* Member Agents in this room */}
        <div className="p-3 border-t border-slate-800 bg-[#0b101d]">
          <span className="text-[11px] font-semibold text-slate-400 block mb-2">Team Squad</span>
          <div className="space-y-1.5">
            {agents.map((ag) => (
              <div key={ag.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: ag.avatarColor || '#10b981' }}
                />
                <span className="truncate">{ag.name}</span>
                <span className="text-[9px] text-slate-500 font-mono ml-auto uppercase">{ag.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        {/* Chat Room Header */}
        <div className="h-14 border-b border-slate-800 bg-[#0d1424] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-100">{currentRoom?.name || 'Group Chat'}</h2>
            <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              Anti-Collision Turn Locking Active
            </span>
          </div>

          {/* Turn-Taking Waiting Indicator */}
          {turnQueue.waiting.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-emerald-500/30 text-xs text-emerald-300 animate-pulse">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px]">
                {turnQueue.waiting[0]} waits for {turnQueue.currentSpeaker || 'Dev'}, then answers
              </span>
            </div>
          )}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => {
            const isHuman = m.senderType === 'human';
            const isSystem = m.senderType === 'system';

            if (isSystem) {
              return (
                <div key={m.id} className="flex justify-center my-2">
                  <div className="px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-400 max-w-xl text-center">
                    {m.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl ${isHuman ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-sm ${
                    isHuman
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                      : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600'
                  }`}
                >
                  {isHuman ? 'YOU' : m.senderName.substring(0, 2).toUpperCase()}
                </div>

                {/* Message Bubble */}
                <div className={`space-y-1.5 ${isHuman ? 'items-end' : ''}`}>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-semibold text-slate-300">{m.senderName}</span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isHuman
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-[#131b2e] border border-slate-800 text-slate-200 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* Inline Code Diff or Approval Card */}
                  {m.metadata?.diffSnippet && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 max-w-xl">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-mono flex items-center gap-1 text-emerald-400">
                          <GitCommit className="w-3.5 h-3.5" /> Proposed Code Diff
                        </span>
                        {m.metadata.approvalId && (
                          <button
                            onClick={() => handleApproveInline(m.metadata!.approvalId!)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-all"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Approve & Merge</span>
                          </button>
                        )}
                      </div>
                      <pre className="text-[10px] p-2 rounded-lg bg-[#0a0f1d] font-mono text-emerald-300 overflow-x-auto max-h-36">
                        {m.metadata.diffSnippet}
                      </pre>
                    </div>
                  )}

                  {/* Metadata Reasoning Brief & Feedback */}
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 font-mono">
                    {m.metadata?.reasoningBrief ? (
                      <span>⚡ {m.metadata.reasoningBrief}</span>
                    ) : <span />}
                    {!isHuman && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          onClick={() => handleFeedback(m.id, 1)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                          title="ចម្លើយល្អ & មានប្រយោជន៍ (Helpful)"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(m.id, -1)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                          title="ចម្លើយត្រូវការកែលម្អ (Needs Improvement)"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Live Typing & Working Indicator */}
          {activeSpeaker && (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-emerald-400">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-3.5 py-2 rounded-2xl bg-[#131b2e] border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <span className="font-semibold">{activeSpeaker.agentName}</span>
                <span>
                  {activeSpeaker.state === 'running_tests'
                    ? 'is running test suite...'
                    : activeSpeaker.state === 'reviewing_code'
                    ? 'is auditing security & diffs...'
                    : 'is typing...'}
                </span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box with @mention shortcut */}
        <div className="p-3 border-t border-slate-800 bg-[#0d1424]">
          {/* Quick @mention bar */}
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto text-[11px] text-slate-400 pb-1">
            <span className="text-[10px] text-slate-500 font-mono shrink-0">Quick Mention:</span>
            {agents.slice(0, 15).map((ag) => (
              <button
                key={ag.id}
                type="button"
                onClick={() => setInput((prev) => `${prev} ${ag.command || `@${ag.name.split(' ')[0]}`} `)}
                className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:text-emerald-300 font-mono text-[10px] transition-colors shrink-0"
              >
                {ag.command || `@${ag.name.split(' ')[0]}`}
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2">
            <label className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 cursor-pointer text-slate-400 hover:text-slate-200 transition-colors shrink-0" title="Upload Image / Screenshot">
              <ImageIcon className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const base64 = reader.result as string;
                    await fetch('/api/upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64Data: base64 })
                    });
                    setInput((prev) => `${prev} [Attached Image: ${file.name}] `);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="បញ្ជាទៅកាន់ /angkor_eyes ឬក្រសួងដូចជា /interior, /mef, /police... (Cmd+Enter ដើម្បីផ្ញើ)"
              className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white shadow-emerald-500/20 shadow-md transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
