// src/pages/trainer/TrainerChat.jsx
// ──────────────────────────────────────────────────────────────────
// WhatsApp-style chat for trainers:
//   • Desktop: Split view with client list on the left & conversation on the right.
//              Clients list stays permanently mounted with zero flickering/refreshing.
//   • In-Memory Cache: Switching between client chats is instant (0ms delay).
//   • Mobile:  Smooth single-column view with a dedicated "← Chats" back button.
// ──────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search, Send, MessageSquare, ArrowLeft,
  Dumbbell, CheckCheck, User, ClipboardList, X,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d; // ms
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDay(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Group messages by day for date pills
function groupByDay(messages) {
  const groups = [];
  let lastDay = null;
  for (const m of messages) {
    const day = fmtDay(m.created_at);
    if (day !== lastDay) {
      groups.push({ type: 'separator', label: day, key: `sep-${m.id}-${day}` });
      lastDay = day;
    }
    groups.push({ type: 'message', ...m, key: m.id });
  }
  return groups;
}

// Avatar initials badge
function Avatar({ name, size = 42 }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(61, 255, 79, 0.16) 0%, rgba(31, 77, 58, 0.35) 100%)',
        border: '1px solid rgba(61, 255, 79, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-brand)',
        fontWeight: 700,
        fontSize: Math.max(12, Math.round(size * 0.38)),
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      }}
    >
      {initials}
    </div>
  );
}

const QUICK_NUDGES = [
  '💪 Great consistency on your workouts!',
  '💧 Remember to hit your water goal today!',
  '🥗 Don\'t forget to log your meals.',
  '📋 I\'ve updated your training plan for you.',
  'How are your energy levels and soreness?',
];

export function TrainerChat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClientIdFromUrl = searchParams.get('client');

  const [clients, setClients] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  // Previews map: { [clientId]: { body, ts, fromTrainer } }
  const [previews, setPreviews] = useState({});

  // In-memory message cache to allow instant, zero-flicker chat switching: { [clientId]: Message[] }
  const messageCacheRef = useRef({});

  // Responsive state: screen width < 800px is considered mobile view
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 800 : false
  );

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 800);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const selectedClientRef = useRef(null);
  selectedClientRef.current = selectedClient;

  // ── 1. Fetch clients for this trainer ONCE on mount ───────────────
  // NOTE: Does NOT depend on selectedClientIdFromUrl so switching chats never reloads the client list!
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoadingList(true);
      const { data: clientList, error } = await supabase
        .from('profiles')
        .select('id, full_name, goal, diet_pref')
        .eq('trainer_id', user.id)
        .eq('role', 'client')
        .order('full_name');

      if (!isMounted) return;

      if (!error && clientList) {
        setClients(clientList);

        // Fetch latest note for each client to build WhatsApp preview
        if (clientList.length > 0) {
          const previewMap = {};
          await Promise.all(
            clientList.map(async (c) => {
              const { data } = await supabase
                .from('notes')
                .select('body, created_at, author_id')
                .eq('client_id', c.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (data) {
                previewMap[c.id] = {
                  body: data.body,
                  ts: data.created_at,
                  fromTrainer: data.author_id === user.id,
                };
              }
            })
          );
          if (isMounted) setPreviews(previewMap);
        }
      }
      setLoadingList(false);
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [user.id]);

  // ── 2. Sync URL search param with selectedClient (without reloading clients!) ──
  useEffect(() => {
    if (!clients.length) return;

    if (selectedClientIdFromUrl) {
      const found = clients.find((c) => c.id === selectedClientIdFromUrl);
      if (found && selectedClient?.id !== found.id) {
        setSelectedClient(found);
      }
    } else if (isMobile && selectedClient) {
      setSelectedClient(null);
    }
  }, [selectedClientIdFromUrl, clients]); // Notice: only syncs selectedClient object, does not refetch lists!

  // ── 3. Load conversation messages with instantaneous cache ────────
  const loadMessages = useCallback(async (clientId) => {
    // Check if we already have messages in memory
    const cached = messageCacheRef.current[clientId];
    if (cached) {
      // Instantly display cached messages (NO loading spinner / NO blank screen!)
      setMessages(cached);
      setLoadingMsgs(false);
    } else {
      // First time viewing this client: show clean spinner in message pane only
      setLoadingMsgs(true);
      setMessages([]);
    }

    // Fetch from Supabase
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (data) {
      messageCacheRef.current[clientId] = data;
      // Only set if this client is still the active one
      if (selectedClientRef.current?.id === clientId) {
        setMessages(data);
        setLoadingMsgs(false);
      }
    } else {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadMessages(selectedClient.id);
    } else {
      setMessages([]);
      setLoadingMsgs(false);
    }
  }, [selectedClient, loadMessages]);

  // ── 4. Global real-time subscription for notes ───────────────────
  useEffect(() => {
    const channel = supabase
      .channel('trainer-chat-global-notes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes' },
        (payload) => {
          const newNote = payload.new;
          if (!newNote) return;

          // Update in-memory cache for this client
          if (messageCacheRef.current[newNote.client_id]) {
            const list = messageCacheRef.current[newNote.client_id];
            if (!list.some((m) => m.id === newNote.id)) {
              messageCacheRef.current[newNote.client_id] = [...list, newNote];
            }
          }

          // If this note belongs to the currently active conversation, update state
          if (selectedClientRef.current?.id === newNote.client_id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newNote.id)) return prev;
              return [...prev, newNote];
            });
          }

          // Update preview for this client and bump them to the top
          setPreviews((prev) => ({
            ...prev,
            [newNote.client_id]: {
              body: newNote.body,
              ts: newNote.created_at,
              fromTrainer: newNote.author_id === user.id,
            },
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  // ── 5. Scroll to bottom on new messages ──────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 6. Send message ──────────────────────────────────────────────
  async function sendMessage(e, customText) {
    if (e) e.preventDefault();
    const content = (customText !== undefined ? customText : text).trim();
    if (!content || !selectedClient || sending) return;

    if (customText === undefined) setText('');
    setSending(true);

    const { data, error } = await supabase
      .from('notes')
      .insert({
        client_id: selectedClient.id,
        author_id: user.id,
        body: content,
      })
      .select()
      .single();

    if (!error && data) {
      // Update cache
      if (messageCacheRef.current[selectedClient.id]) {
        messageCacheRef.current[selectedClient.id] = [
          ...messageCacheRef.current[selectedClient.id],
          data,
        ];
      } else {
        messageCacheRef.current[selectedClient.id] = [data];
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });

      setPreviews((prev) => ({
        ...prev,
        [selectedClient.id]: {
          body: data.body,
          ts: data.created_at,
          fromTrainer: true,
        },
      }));
    }
    setSending(false);
    inputRef.current?.focus();
  }

  // Select a client to chat with (Zero flicker!)
  function handleSelectClient(client) {
    if (selectedClient?.id === client.id) return;
    setSelectedClient(client);
    setSearchParams({ client: client.id });
    setText('');
  }

  // Go back to the client list / deselect current chat
  function handleBackToClients() {
    setSelectedClient(null);
    setSearchParams({}, { replace: true });
    setText('');
  }

  // Filter & sort clients: newest message first
  const filteredClients = useMemo(() => {
    let list = clients.filter((c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase())
    );
    if (filterActiveOnly) {
      list = list.filter((c) => Boolean(previews[c.id]));
    }
    return list.sort((a, b) => {
      const ta = previews[a.id]?.ts || '';
      const tb = previews[b.id]?.ts || '';
      return tb.localeCompare(ta);
    });
  }, [clients, search, filterActiveOnly, previews]);

  const groupedMessages = useMemo(() => groupByDay(messages), [messages]);

  // Display conditions:
  // On Desktop (!isMobile): BOTH panels are visible side-by-side permanently.
  // On Mobile (isMobile): show client list when !selectedClient, show chat thread when selectedClient.
  const showClientList = !isMobile || !selectedClient;
  const showChatThread = !isMobile || Boolean(selectedClient);

  return (
    <div
      id="chat-root"
      style={{
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '480px',
        background: 'var(--color-surface)',
        borderRadius: isMobile ? 0 : 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: isMobile ? 'none' : 'var(--shadow-card)',
        border: isMobile ? 'none' : '1px solid var(--color-border)',
      }}
    >
      {/* ════════════════════════════════════════════════
          LEFT PANEL – Clients Sidebar
          Permanently mounted on desktop with ZERO reloads!
      ════════════════════════════════════════════════ */}
      {showClientList && (
        <div
          id="chat-client-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: isMobile ? '100%' : '340px',
            minWidth: isMobile ? '100%' : '300px',
            flexShrink: 0,
            background: 'var(--color-surface)',
            borderRight: isMobile ? 'none' : '1px solid var(--color-border)',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Sidebar Header */}
          <div
            style={{
              padding: '1rem',
              background: 'var(--color-surface)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'rgba(61, 255, 79, 0.1)',
                    border: '1px solid rgba(61, 255, 79, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageSquare size={18} color="var(--color-brand)" />
                </div>
                <div>
                  <h1 style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, lineHeight: 1.2, color: '#fff' }}>
                    Client Chats
                  </h1>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    {clients.length} {clients.length === 1 ? 'client' : 'clients'}
                  </span>
                </div>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setFilterActiveOnly(!filterActiveOnly)}
                style={{
                  background: filterActiveOnly ? 'rgba(61, 255, 79, 0.15)' : 'rgba(255,255,255,0.06)',
                  color: filterActiveOnly ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  border: filterActiveOnly ? '1px solid rgba(61, 255, 79, 0.35)' : '1px solid var(--color-border)',
                  borderRadius: '999px',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                title="Show only clients with conversations"
              >
                {filterActiveOnly ? 'Active Chats ✓' : 'All clients'}
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                id="chat-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or start new chat…"
                style={{
                  width: '100%',
                  padding: '0.55rem 2rem 0.55rem 2.2rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-2)',
                  color: '#fff',
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '0.6rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Client List Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Spinner />
              </div>
            ) : filteredClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-text-muted)' }}>
                <MessageSquare size={36} style={{ opacity: 0.25, margin: '0 auto 0.75rem' }} />
                <p style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>No clients found</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {search ? 'Try a different search term' : 'Invite clients using your invite code'}
                </p>
              </div>
            ) : (
              filteredClients.map((c) => {
                const preview = previews[c.id];
                const isSelected = selectedClient?.id === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    id={`chat-client-${c.id}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      background: isSelected ? 'rgba(61, 255, 79, 0.08)' : 'transparent',
                      border: 'none',
                      borderLeft: isSelected ? '3px solid var(--color-brand)' : '3px solid transparent',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Avatar name={c.full_name} size={44} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <p
                          style={{
                            fontWeight: isSelected ? 700 : 600,
                            fontSize: '0.925rem',
                            color: '#FFFFFF',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '160px',
                            margin: 0,
                          }}
                        >
                          {c.full_name}
                        </p>
                        {preview && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: isSelected ? 'var(--color-brand)' : 'var(--color-text-muted)',
                              fontWeight: isSelected ? 700 : 500,
                              flexShrink: 0,
                              marginLeft: '0.25rem',
                            }}
                          >
                            {timeAgo(preview.ts)}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          marginTop: '0.25rem',
                          fontSize: '0.8rem',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {preview ? (
                          <>
                            {preview.fromTrainer && (
                              <CheckCheck size={14} color="var(--color-brand)" style={{ flexShrink: 0 }} />
                            )}
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '190px',
                              }}
                            >
                              {preview.fromTrainer ? 'You: ' : ''}
                              {preview.body}
                            </span>
                          </>
                        ) : (
                          <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Tap to chat</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          RIGHT PANEL – Chat Thread Panel
      ════════════════════════════════════════════════ */}
      {showChatThread && (
        <div
          id="chat-thread-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            width: isMobile ? '100%' : 'auto',
            height: '100%',
            background: 'var(--color-bg)',
            overflow: 'hidden',
          }}
        >
          {!selectedClient ? (
            /* Empty state on desktop when no client is selected */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.25rem',
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg)',
                padding: '2rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: 'rgba(61, 255, 79, 0.08)',
                  border: '1px solid rgba(61, 255, 79, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                <MessageSquare size={38} color="var(--color-brand)" style={{ opacity: 0.85 }} />
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#fff', margin: 0 }}>
                  BodyBuddy Messenger
                </h2>
                <p style={{ fontSize: '0.88rem', maxWidth: '320px', marginTop: '0.4rem', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                  Select any client from the list on the left to view messages and chat in real-time.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Chat Header ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-border)',
                  color: '#fff',
                  flexShrink: 0,
                  zIndex: 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                  {/* Back button */}
                  <button
                    id="chat-back-btn"
                    onClick={handleBackToClients}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      padding: '0.4rem 0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      transition: 'background 0.15s',
                    }}
                    title="Return to client list"
                    aria-label="Back to client list"
                  >
                    <ArrowLeft size={16} />
                    <span className="back-btn-text">{isMobile ? 'Chats' : 'All Chats'}</span>
                  </button>

                  <Avatar name={selectedClient.full_name} size={38} />

                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: '#fff',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedClient.full_name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: 'var(--color-brand)',
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        Client · {selectedClient.goal || 'Fitness'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Jump Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <Link
                    to={`/trainer/plans/${selectedClient.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.65rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                    title="View/Edit Client Plan"
                  >
                    <ClipboardList size={13} color="var(--color-brand)" />
                    <span className="hide-on-compact">Plan</span>
                  </Link>

                  <Link
                    to={`/trainer/clients/${selectedClient.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.65rem',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                    title="View Client Profile"
                  >
                    <User size={13} />
                    <span className="hide-on-compact">Profile</span>
                  </Link>
                </div>
              </div>

              {/* ── Messages Area ── */}
              <div
                id="chat-messages-area"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  background: 'var(--color-bg)',
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              >
                {loadingMsgs ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '3rem' }}>
                    <Spinner />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--color-text-muted)' }}>
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'rgba(61, 255, 79, 0.08)',
                        border: '1px solid rgba(61, 255, 79, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.75rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}
                    >
                      <Dumbbell size={26} color="var(--color-brand)" style={{ opacity: 0.8 }} />
                    </div>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', margin: 0 }}>
                      No messages with {selectedClient.full_name} yet
                    </p>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--color-text-muted)' }}>
                      Send a quick greeting or guidance note below!
                    </p>
                  </div>
                ) : (
                  groupedMessages.map((item) => {
                    if (item.type === 'separator') {
                      return (
                        <div
                          key={item.key}
                          style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0' }}
                        >
                          <span
                            style={{
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-muted)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.85rem',
                              borderRadius: '999px',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {item.label}
                          </span>
                        </div>
                      );
                    }

                    const isTrainer = item.author_id === user.id;

                    return (
                      <div
                        key={item.key}
                        style={{
                          display: 'flex',
                          justifyContent: isTrainer ? 'flex-end' : 'flex-start',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '78%',
                            minWidth: '100px',
                            padding: '0.55rem 0.85rem 0.35rem',
                            borderRadius: isTrainer
                              ? '14px 14px 2px 14px'
                              : '14px 14px 14px 2px',
                            background: isTrainer
                              ? 'linear-gradient(135deg, #1B4D2B 0%, #153E23 100%)'
                              : 'var(--color-surface)',
                            border: isTrainer
                              ? '1px solid rgba(61, 255, 79, 0.25)'
                              : '1px solid var(--color-border)',
                            color: '#FFFFFF',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                            position: 'relative',
                          }}
                        >
                          {!isTrainer && (
                            <p
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: 'var(--color-brand)',
                                marginBottom: '0.2rem',
                                margin: '0 0 0.2rem 0',
                              }}
                            >
                              {selectedClient.full_name}
                            </p>
                          )}

                          <p
                            style={{
                              fontSize: '0.92rem',
                              lineHeight: 1.45,
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              margin: 0,
                              color: '#FFFFFF',
                            }}
                          >
                            {item.body}
                          </p>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                              gap: '0.25rem',
                              marginTop: '0.25rem',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.65rem',
                                color: isTrainer ? 'rgba(255,255,255,0.65)' : 'var(--color-text-muted)',
                                fontWeight: 500,
                              }}
                            >
                              {fmtTime(item.created_at)}
                            </span>
                            {isTrainer && (
                              <CheckCheck size={13} color="var(--color-brand)" style={{ flexShrink: 0 }} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* ── Quick Nudges Bar ── */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  overflowX: 'auto',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--color-surface)',
                  borderTop: '1px solid var(--color-border)',
                  scrollbarWidth: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--color-brand)',
                    flexShrink: 0,
                    marginRight: '0.2rem',
                  }}
                >
                  <Sparkles size={13} color="var(--color-brand)" />
                  <span>Nudge:</span>
                </div>
                {QUICK_NUDGES.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(null, prompt)}
                    disabled={sending}
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '999px',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-brand)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.color = 'var(--color-text)';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* ── Message Input Bar ── */}
              <form
                onSubmit={(e) => sendMessage(e)}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--color-surface)',
                  borderTop: '1px solid var(--color-border)',
                  flexShrink: 0,
                }}
              >
                <input
                  ref={inputRef}
                  id="chat-input"
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Message ${selectedClient.full_name}…`}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    borderRadius: '2rem',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    fontSize: '0.925rem',
                    outline: 'none',
                    color: '#FFFFFF',
                    boxSizing: 'border-box',
                  }}
                  autoComplete="off"
                />

                <button
                  type="submit"
                  id="chat-send-btn"
                  disabled={sending || !text.trim()}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: text.trim() ? 'var(--color-brand)' : 'var(--color-surface-2)',
                    border: 'none',
                    cursor: text.trim() ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                    boxShadow: text.trim() ? '0 2px 8px rgba(61,255,79,0.35)' : 'none',
                  }}
                  aria-label="Send message"
                >
                  <Send size={16} color={text.trim() ? '#000000' : 'var(--color-text-muted)'} style={{ marginLeft: '2px' }} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ── Responsive CSS Rules ── */}
      <style>{`
        @media (max-width: 640px) {
          .hide-on-compact {
            display: none !important;
          }
          .back-btn-text {
            display: inline !important;
          }
        }
      `}</style>
    </div>
  );
}
