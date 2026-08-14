'use client';

import { useState, useEffect, useRef } from 'react';
import { getPortalCode } from '@/lib/student-session';
import type { StudentFeedback } from '@/lib/types';

export default function FeedbackPage() {
  const [messages, setMessages] = useState<StudentFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const code = getPortalCode();

  useEffect(() => {
    if (!code) return;
    fetch(`/api/student/feedback?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.feedback ?? []);
        setLoading(false);
      });
  }, [code]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !code || sending) return;
    setSending(true);
    const res = await fetch(`/api/student/feedback?code=${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => [...prev, data.item]);
      setInput('');
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Consultas</h1>
        <p className="text-sm mt-1" style={{ color: '#888' }}>
          Escribile a tu profe. Él o ella lo verá la próxima vez que revise tu perfil.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: '#1a1a1a' }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#555' }}>
            <p className="text-3xl mb-3">💬</p>
            <p className="text-sm">Todavía no enviaste ninguna consulta.</p>
            <p className="text-sm mt-1">¡Escribile a tu profe!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex justify-end">
              <div
                className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5"
                style={{ backgroundColor: '#F5A623', color: '#000' }}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <p className="text-xs opacity-60">
                    {new Date(msg.createdAt).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs opacity-60">
                    {msg.read ? '✓✓ leído' : '✓ enviado'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="flex gap-2 pt-3"
        style={{ borderTop: '1px solid #2a2a2a' }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu consulta… (Enter para enviar)"
          rows={2}
          className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            color: '#f5f5f5',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="px-4 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#F5A623', color: '#000' }}
        >
          {sending ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}
