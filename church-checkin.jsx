import { useState, useEffect, useRef } from "react";

const COLORS = {
  cream: "#FDF6EC",
  gold: "#C9902A",
  goldLight: "#E8B84B",
  navy: "#1A2744",
  navyLight: "#263560",
  sage: "#5C7A5E",
  rose: "#C4606A",
  red: "#6b040e",
  warm: "#F5E6D0",
  text: "#2C1A0E",
};

const initialChildren = [
  { id: 1, name: "Amara Johnson", age: 7, guardian: "Mrs. Johnson", guardianPhone: "080-1234-5678", allergies: "Peanuts", checkedIn: false, checkInTime: null, checkOutTime: null, tag: "A001" },
  { id: 2, name: "David Okafor", age: 5, guardian: "Mr. Okafor", guardianPhone: "080-2345-6789", allergies: "None", checkedIn: false, checkInTime: null, checkOutTime: null, tag: "A002" },
  { id: 3, name: "Grace Mensah", age: 9, guardian: "Mrs. Mensah", guardianPhone: "080-3456-7890", allergies: "Lactose", checkedIn: false, checkInTime: null, checkOutTime: null, tag: "A003" },
  { id: 4, name: "Emmanuel Adebayo", age: 6, guardian: "Pastor Adebayo", guardianPhone: "080-4567-8901", allergies: "None", checkedIn: false, checkInTime: null, checkOutTime: null, tag: "A004" },
  { id: 5, name: "Faith Nwosu", age: 8, guardian: "Mrs. Nwosu", guardianPhone: "080-5678-9012", allergies: "Eggs", checkedIn: false, checkInTime: null, checkOutTime: null, tag: "A005" },
  { id: 6, name: "Isaac Balogun", age: 4, guardian: "Dr. Balogun", guardianPhone: "080-6789-0123", allergies: "None", checkedIn: false, checkInTime: null, checkOutTime: null, tag: "A006" },
];

function now() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function Badge({ color, children }) {
  const bg = color === "green" ? "#d1fae5" : color === "red" ? "#fee2e2" : color === "yellow" ? "#fef3c7" : "#e0e7ff";
  const text = color === "green" ? "#065f46" : color === "red" ? "#991b1b" : color === "yellow" ? "#92400e" : "#3730a3";
  return (
    <span style={{ background: bg, color: text, padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
      {children}
    </span>
  );
}

function BrandLogo() {
  const rays = Array.from({ length: 16 }, (_, index) => ({
    id: index,
    rotate: index * 22.5,
  }));

  return (
    <div
      aria-label="LightNation logo"
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "#ff5b00",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 0 0 4px rgba(255, 91, 0, 0.14)",
        flexShrink: 0,
      }}
    >
      {rays.map((ray) => (
        <span
          key={ray.id}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "18%",
            height: "80%",
            transform: `translate(-50%, -50%) rotate(${ray.rotate}deg) translateY(-18%)`,
            transformOrigin: "center center",
            borderRadius: 8,
            background: "rgba(255,255,255,0.08)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: "22%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
        }}
      />
    </div>
  );
}

function ChildCard({ child, onCheckIn, onCheckOut, onSelect, selected }) {
  return (
    <div
      onClick={() => onSelect(child)}
      style={{
        background: selected ? COLORS.warm : "#fff",
        border: `2px solid ${selected ? COLORS.gold : "#e8ddd0"}`,
        borderRadius: 16,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: selected ? `0 4px 20px ${COLORS.gold}33` : "0 2px 8px #0001",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Cotham Sans', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.navy }}>
            {child.name}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Age {child.age} · Tag: <b>{child.tag}</b></div>
          <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{child.guardian}</div>
          {child.allergies !== "None" && (
            <div style={{ fontSize: 11, color: COLORS.rose, marginTop: 4, fontWeight: 600 }}>⚠ {child.allergies}</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <Badge color={child.checkedIn ? "green" : "red"}>{child.checkedIn ? "In" : "Out"}</Badge>
          {child.checkInTime && !child.checkedIn && (
            <div style={{ fontSize: 10, color: "#aaa" }}>Left {child.checkOutTime}</div>
          )}
          {child.checkedIn && (
            <div style={{ fontSize: 10, color: "#aaa" }}>In at {child.checkInTime}</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={e => { e.stopPropagation(); onCheckIn(child.id); }}
          disabled={child.checkedIn}
          style={{
            flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
            background: child.checkedIn ? "#e8e8e8" : COLORS.sage,
            color: child.checkedIn ? "#aaa" : "#fff",
            fontWeight: 700, fontSize: 12, cursor: child.checkedIn ? "default" : "pointer",
            transition: "background 0.2s",
          }}
        >✓ Check In</button>
        <button
          onClick={e => { e.stopPropagation(); onCheckOut(child.id); }}
          disabled={!child.checkedIn}
          style={{
            flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
            background: !child.checkedIn ? "#e8e8e8" : COLORS.rose,
            color: !child.checkedIn ? "#aaa" : "#fff",
            fontWeight: 700, fontSize: 12, cursor: !child.checkedIn ? "default" : "pointer",
            transition: "background 0.2s",
          }}
        >✕ Check Out</button>
      </div>
    </div>
  );
}

function AIChat({ children: childList }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hello! I'm your Children's Church assistant. Ask me anything — attendance, allergies, who's still inside, or anything else." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    const attendanceSummary = childList.map(c =>
      `${c.name} (Age ${c.age}, Tag ${c.tag}): ${c.checkedIn ? `Checked IN at ${c.checkInTime}` : c.checkOutTime ? `Checked OUT at ${c.checkOutTime}` : "Not yet checked in"}. Guardian: ${c.guardian} (${c.guardianPhone}). Allergies: ${c.allergies}.`
    ).join("\n");

    const systemPrompt = `You are a helpful assistant for a children's church check-in system. Today is Sunday. Here is the current attendance data:\n\n${attendanceSummary}\n\nAnswer questions about the children, attendance, allergies, guardians, or anything related. Be concise, warm, and helpful.`;

    try {
      const payload = {
        system: systemPrompt,
        messages: [
          ...messages.filter(m => m.role !== 'assistant' || m !== messages[0]).map(m => ({ role: m.role, content: m.text })),
          { role: 'user', content: userMsg }
        ]
      };
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      const reply = data.reply || 'Sorry, I could not get a response from the assistant.';
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error connecting to AI. Please try again.' }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff", borderRadius: 20, overflow: "hidden", border: `1px solid #e8ddd0` }}>
      <div style={{ background: COLORS.red, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "20%", background: COLORS.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✦</div>
        <div>
          <div style={{ color: "#fff", fontFamily: "'Cotham Sans', sans-serif", fontWeight: 700, fontSize: 15 }}>AI Assistant</div>
          <div style={{ color: COLORS.goldLight, fontSize: 11 }}>Children's Church Helper</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: COLORS.cream }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? COLORS.blue : "#fff",
              color: m.role === "user" ? "#fff" : COLORS.text,
              fontSize: 13, lineHeight: 1.5,
              boxShadow: "0 1px 4px #0001",
              border: m.role === "assistant" ? `1px solid #e8ddd0` : "none"
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex" }}>
            <div style={{ padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "#fff", border: `1px solid #e8ddd0`, fontSize: 13, color: "#aaa" }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #e8ddd0", display: "flex", gap: 8, background: "#fff" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about attendance, allergies..."
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 12, border: `1.5px solid #e8ddd0`,
            fontSize: 13, outline: "none", fontFamily: "inherit", background: COLORS.cream
          }}
        />
        <button
          onClick={send}
          style={{
            padding: "10px 18px", borderRadius: 12, border: "none",
            background: COLORS.gold, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer"
          }}
        >↑</button>
      </div>
    </div>
  );
}

function AddChildModal({ onAdd, onClose, initial }) {
  // accept optional initial values via props
  const [form, setForm] = useState(initial ? { id: initial.id, name: initial.name || "", age: initial.age || "", guardian: initial.guardian || "", guardianPhone: initial.guardianPhone || "", allergies: initial.allergies || "", tag: initial.tag } : { name: "", age: "", guardian: "", guardianPhone: "", allergies: "" });

  useEffect(() => {
    if (initial) {
      setForm({ id: initial.id, name: initial.name || "", age: initial.age || "", guardian: initial.guardian || "", guardianPhone: initial.guardianPhone || "", allergies: initial.allergies || "", tag: initial.tag });
    } else {
      setForm({ name: "", age: "", guardian: "", guardianPhone: "", allergies: "" });
    }
  }, [initial]);

  function submit() {
    if (!form.name || !form.age || !form.guardian) return;
    const payload = {
      ...form,
      age: Number(form.age),
      allergies: form.allergies || "None",
      tag: form.tag || "A" + String(Math.floor(Math.random() * 900) + 100),
    };
    console.log('AddChildModal submit payload:', payload);
    onAdd(payload);
    onClose();
  }

  const field = (label, key, placeholder, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e8ddd0", fontSize: 13, boxSizing: "border-box", outline: "none" }}
      />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0007", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#e8ddd0", borderRadius: 20, padding: 28, width: 360, maxWidth: "95vw", boxShadow: "0 20px 60px #0003" }}>
        <div style={{ fontFamily: "'Cotham Sans', sans-serif", fontSize: 20, fontWeight: 700, color: COLORS.navy, marginBottom: 20 }}>Register New Child</div>
        {field("Child's Full Name", "name", "e.g. Amara Johnson")}
        {field("Age", "age", "e.g. 7", "number")}
        {field("Guardian Name", "guardian", "e.g. Mrs. Johnson")}
        {field("Guardian Phone", "guardianPhone", "e.g. 080-1234-5678")}
        {field("Allergies (if any)", "allergies", "e.g. Peanuts, or leave blank")}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, border: "1.5px solid #e8ddd0", background: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={submit} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: COLORS.gold, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Register</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [children, setChildren] = useState(initialChildren);
  const [editingChild, setEditingChild] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedChild, setSelectedChild] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState("checkin"); // checkin | ai
  const [toast, setToast] = useState(null);

  function showToast(msg, color = COLORS.sage) {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  }

  // Load children from server on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch('/api/children');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (mounted) setChildren(data);
      } catch (e) {
        showToast('Could not load children from server', COLORS.rose);
      }
    }
    load();
    return () => { mounted = false };
  }, []);

  async function checkIn(id) {
    try {
      const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('checkin failed');
      const json = await res.json();
      setChildren(prev => prev.map(c => c.id === id ? { ...c, checkedIn: true, checkInTime: json.checkInTime, checkOutTime: null } : c));
      const child = children.find(c => c.id === id);
      showToast(`✓ ${child?.name || 'Child'} checked in!`, COLORS.sage);
    } catch (e) {
      showToast('Check-in failed', COLORS.rose);
    }
  }

  async function checkOut(id) {
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('checkout failed');
      const json = await res.json();
      setChildren(prev => prev.map(c => c.id === id ? { ...c, checkedIn: false, checkOutTime: json.checkOutTime } : c));
      const child = children.find(c => c.id === id);
      showToast(`${child?.name || 'Child'} checked out.`, COLORS.rose);
    } catch (e) {
      showToast('Check-out failed', COLORS.rose);
    }
  }

  async function addChild(child) {
    try {
      const res = await fetch('/api/children', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(child) });
      if (!res.ok) throw new Error('create failed');
      const created = await res.json();
      // refresh list from server (ensure consistency)
      const r = await fetch(`/api/children`);
      const all = await r.json();
      setChildren(all);
      showToast(`${created.name || child.name} registered!`, COLORS.gold);
    } catch (e) {
      showToast('Registration failed', COLORS.rose);
    }
  }

  async function handleSaveChild(child) {
    try {
      if (child.id) {
        const res = await fetch(`/api/children/${child.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(child) });
        if (!res.ok) {
          const errText = await res.text().catch(() => 'update failed');
          console.error('PUT error', res.status, errText);
          throw new Error(errText || 'update failed');
        }
        const updated = await res.json().catch(() => null);
        console.log('PUT response', updated);
        showToast(`${child.name} updated!`, COLORS.gold);
      } else {
        const res = await fetch('/api/children', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(child) });
        if (!res.ok) {
          const errText = await res.text().catch(() => 'create failed');
          console.error('POST error', res.status, errText);
          throw new Error(errText || 'create failed');
        }
        const created = await res.json().catch(() => null);
        console.log('POST response', created);
        showToast(`${created?.name || child.name} registered!`, COLORS.gold);
      }
      // refresh authoritative list from server
      const r = await fetch(`/api/children`);
      if (!r.ok) throw new Error('refresh failed');
      const all = await r.json();
      setChildren(all);
    } catch (e) {
      console.error('handleSaveChild error:', e);
      showToast(`Save failed: ${e.message || ''}`, COLORS.rose);
    }
  }

  async function deleteChild(id) {
    try {
      await fetch(`/api/children/${id}`, { method: 'DELETE' });
      const r = await fetch(`/api/children`);
      const all = await r.json();
      setChildren(all);
      showToast('Removed', COLORS.rose);
      setSelectedChild(null);
    } catch (e) {
      showToast('Remove failed', COLORS.rose);
    }
  }

  const filtered = children.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.tag.toLowerCase().includes(search.toLowerCase()) || c.guardian.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "in" && c.checkedIn) || (filter === "out" && !c.checkedIn);
    return matchSearch && matchFilter;
  });

  const inCount = children.filter(c => c.checkedIn).length;
  const outCount = children.filter(c => !c.checkedIn).length;
  const allergyCount = children.filter(c => c.allergies !== "None").length;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.cream, fontFamily: "'Lato', sans-serif", color: COLORS.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Cotham+Sans:wght@400;700&family=Lato:wght@400;700&display=swap" rel="stylesheet" />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: toast.color, color: "#fff", padding: "12px 24px", borderRadius: 12,
          fontWeight: 700, fontSize: 14, zIndex: 200, boxShadow: "0 4px 20px #0003",
          animation: "fadeIn 0.2s ease"
        }}>
          {toast.msg}
        </div>
      )}

      {showAdd && <AddChildModal onAdd={handleSaveChild} onClose={() => { setShowAdd(false); setEditingChild(null); }} initial={editingChild} />}

      {/* Header */}
      <div style={{ background: COLORS.red, padding: "20px 24px 0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandLogo />
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#fff", fontWeight: 900, letterSpacing: -0.5 }}>
                  Light Nation Children's Church
                </div>
                <div style={{ color: COLORS.goldLight, fontSize: 12, marginTop: 2 }}>
                  Sunday Check-In System
                </div>
              </div>
            </div>
            <button
              onClick={() => { setEditingChild(null); setShowAdd(true); }}
              style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: COLORS.gold, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              + Register Child
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Total Registered", value: children.length, color: "#fff" },
              { label: "Currently Inside", value: inCount, color: COLORS.goldLight },
              { label: "Checked Out", value: outCount, color: "#f87171" },
              { label: "Allergy Alerts", value: allergyCount, color: "#fbbf24" },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: "#ffffff15", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Cotham Sans', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            {[["checkin", "📋 Check-In"], ["ai", "✦ AI Assistant"]].map(([key, label]) => (
              <div
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: "10px 22px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  borderBottom: tab === key ? `3px solid ${COLORS.gold}` : "3px solid transparent",
                  color: tab === key ? COLORS.goldLight : "#888",
                  transition: "all 0.2s"
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {tab === "checkin" ? (
          <>
            {/* Search & filter */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, tag, or guardian..."
                style={{ flex: 1, padding: "11px 16px", borderRadius: 12, border: "1.5px solid #e8ddd0", fontSize: 13, outline: "none", background: "#fff" }}
              />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{ padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e8ddd0", fontSize: 13, background: "#fff", outline: "none" }}
              >
                <option value="all">All</option>
                <option value="in">Checked In</option>
                <option value="out">Not Checked In</option>
              </select>
            </div>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {filtered.map(child => (
                <ChildCard
                  key={child.id}
                  child={child}
                  onCheckIn={checkIn}
                  onCheckOut={checkOut}
                  onSelect={setSelectedChild}
                  selected={selectedChild?.id === child.id}
                />
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", color: "#aaa", padding: 40, fontSize: 14 }}>
                  No children found.
                </div>
              )}
            </div>

            {/* Selected child detail */}
            {selectedChild && (() => {
              const c = children.find(ch => ch.id === selectedChild.id);
              return (
                <div style={{ marginTop: 24, background: "#fff", borderRadius: 20, padding: 24, border: `2px solid ${COLORS.gold}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontFamily: "'Cotham Sans', sans-serif", fontSize: 18, fontWeight: 700, color: COLORS.navy }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => { setEditingChild(c); setShowAdd(true); }} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: COLORS.navyLight, color: '#fff', cursor: 'pointer' }}>Edit</button>
                      <button onClick={async () => { if (!confirm('Remove this child?')) return; await deleteChild(c.id); }} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: COLORS.rose, color: '#fff', cursor: 'pointer' }}>Remove</button>
                      <button onClick={() => setSelectedChild(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#aaa" }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
                    {[
                      ["Age", c.age],
                      ["Tag", c.tag],
                      ["Guardian", c.guardian],
                      ["Phone", c.guardianPhone],
                      ["Allergies", c.allergies],
                      ["Status", c.checkedIn ? `In (since ${c.checkInTime})` : c.checkOutTime ? `Out (at ${c.checkOutTime})` : "Not arrived"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background: COLORS.cream, borderRadius: 10, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, marginBottom: 2 }}>{k.toUpperCase()}</div>
                        <div style={{ fontWeight: 700, color: k === "Allergies" && v !== "None" ? COLORS.rose : COLORS.navy }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div style={{ height: 520 }}>
            <AIChat children={children} />
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        button:hover { opacity: 0.9; }
        input:focus { border-color: ${COLORS.gold} !important; }
        select:focus { border-color: ${COLORS.gold} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e8ddd0; border-radius: 4px; }
      `}</style>
    </div>
  );
}
