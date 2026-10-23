// src/pages/client/ClientNotes.jsx
// ──────────────────────────────────────────────────────────────────
// Shows all notes between trainer and client.
// Client can reply to trainer notes (short text).
// Uses Supabase Realtime subscription for live updates.
// ──────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtDateTime } from '../../lib/utils';

export function ClientNotes() {
  const { user, profile } = useAuth();

  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply,   setReply]   = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const bottomRef = useRef(null);

  async function loadNotes() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: true });

    if (!error) setNotes(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();

    // Realtime subscription for new notes
    const channel = supabase
      .channel('notes-client')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes', filter: `client_id=eq.${user.id}` },
        (payload) => {
          setNotes((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user.id]);

  // Scroll to bottom when notes change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  async function handleSend(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError('');

    const { error } = await supabase.from('notes').insert({
      client_id: user.id,
      author_id: user.id,
      body:      reply.trim(),
    });

    if (error) setError(error.message);
    else setReply('');
    setSending(false);
  }

  if (loading) return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
      <Spinner />
    </div>
  );

  return (
    <div className="page-content">
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-brand)' }}>
          Trainer Notes
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Messages from your trainer
        </p>
      </div>

      {/* ── Notes list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {notes.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No notes yet"
            message="Your trainer will leave notes here as you progress."
          />
        ) : (
          notes.map((note) => {
            const isFromTrainer = note.author_id !== user.id;
            return (
              <div
                key={note.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isFromTrainer ? 'flex-start' : 'flex-end',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '0.75rem 1rem',
                    borderRadius: isFromTrainer
                      ? '0.75rem 0.75rem 0.75rem 0'
                      : '0.75rem 0.75rem 0 0.75rem',
                    background: isFromTrainer
                      ? 'var(--color-surface)'
                      : 'var(--color-brand)',
                    color: isFromTrainer ? 'var(--color-text)' : '#fff',
                    boxShadow: 'var(--shadow-card)',
                    borderLeft: isFromTrainer ? '3px solid var(--color-gold)' : 'none',
                  }}
                >
                  {isFromTrainer && (
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-gold)', marginBottom: '0.3rem' }}>
                      Trainer
                    </p>
                  )}
                  <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>{note.body}</p>
                  <p style={{
                    fontSize: '0.7rem',
                    color: isFromTrainer ? 'var(--color-text-muted)' : 'rgba(255,255,255,0.6)',
                    marginTop: '0.35rem',
                  }}>
                    {fmtDateTime(note.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '0.75rem' }} role="alert">
          {error}
        </div>
      )}

      {/* ── Reply box ── */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex', gap: '0.5rem',
          position: 'sticky', bottom: '5.5rem',
          background: 'var(--color-bg)',
          paddingTop: '0.5rem',
        }}
      >
        <input
          id="note-reply"
          type="text"
          className="form-input"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to your trainer…"
          aria-label="Reply to trainer"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !reply.trim()}
          aria-label="Send reply"
          id="note-send"
          style={{ flexShrink: 0, padding: '0.75rem 1rem' }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
