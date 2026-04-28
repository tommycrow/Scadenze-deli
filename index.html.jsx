
import { useState, useEffect, useRef, useMemo } from "react";

// ─── PALETTE & THEME ────────────────────────────────────────────────
const COLORS = {
  bg: "#0f1117",
  surface: "#1a1d27",
  card: "#21253a",
  border: "#2e3350",
  accent: "#f97316",
  accentDark: "#c2570a",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  text: "#f1f5f9",
  muted: "#64748b",
  subtle: "#334155",
};

// ─── INITIAL DATA ───────────────────────────────────────────────────
const DEFAULT_CATEGORIES = {
  settori: ["Gastronomia", "Latticini", "Bevande", "Surgelati", "Panetteria", "Macelleria", "Pescheria"],
  famiglie: {
    Gastronomia: ["Salumi", "Pasta pronta", "Insalate"],
    Latticini: ["Formaggi", "Yogurt", "Burro", "Panna"],
    Bevande: ["Succhi", "Acqua", "Birra", "Vino"],
    Surgelati: ["Verdure", "Pesce", "Carne", "Pizze"],
    Panetteria: ["Pane", "Paste", "Biscotti"],
    Macelleria: ["Bovino", "Suino", "Pollame"],
    Pescheria: ["Pesce fresco", "Molluschi", "Crostacei"],
  },
  sottofamiglie: {
    Salumi: ["Prosciutto crudo", "Prosciutto cotto", "Salame", "Mortadella"],
    Formaggi: ["Freschi", "Stagionati", "Semistagionati", "Fusi"],
    Yogurt: ["Bianco", "Alla frutta", "Greco"],
    Succhi: ["Arancia", "Mela", "Pesca", "Multivitamina"],
    Pane: ["Bianco", "Integrale", "Speciale"],
  },
};

const DEFAULT_ALERTS = [
  { id: "a1", giorni: 7, ora: "08:00", attivo: true, label: "1 settimana prima" },
  { id: "a2", giorni: 3, ora: "08:00", attivo: true, label: "3 giorni prima" },
  { id: "a3", giorni: 1, ora: "08:00", attivo: true, label: "1 giorno prima" },
  { id: "a4", giorni: 0, ora: "08:00", attivo: true, label: "Giorno stesso" },
];

// ─── STORAGE ─────────────────────────────────────────────────────────
const store = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── AUDIO ALERT ─────────────────────────────────────────────────────
function playAlert(volume = 0.7) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + i * 0.15 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.25);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  } catch {}
}

// ─── HELPERS ─────────────────────────────────────────────────────────
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
function today() { return new Date().toISOString().split("T")[0]; }
function daysLeft(date) {
  const diff = new Date(date) - new Date(today());
  return Math.ceil(diff / 86400000);
}
function statusColor(days) {
  if (days < 0) return COLORS.red;
  if (days <= 3) return COLORS.yellow;
  return COLORS.green;
}
function statusLabel(days) {
  if (days < 0) return "SCADUTO";
  if (days === 0) return "SCADE OGGI";
  if (days === 1) return "SCADE DOMANI";
  return `${days} giorni`;
}
function formatDate(d) {
  if (!d) return "—";
  const [y, m, g] = d.split("-");
  return `${g}/${m}/${y}`;
}

// ─── EMPTY PRODUCT ────────────────────────────────────────────────────
function emptyProduct() {
  return {
    id: uuid(), nomeProdotto: "", codiceABarre: "", qrCode: "", codiceSKU: "",
    descrizione: "", settore: "", famiglia: "", sottofamiglia: "",
    dataProduzione: "", dataScadenza: "", dataApertura: "", giorniVitaDopoApertura: "",
    fornitore: "", numeroFattura: "", dataFattura: "", numeroLotto: "",
    quantitaRicevuta: "", unitaMisura: "pz", prezzoUnitario: "",
    posizioneInterna: "", quantitaAttuale: "", quantitaMinima: "", note: "",
    dataInserimento: today(), ultimaModifica: today(),
  };
}

// ─── ICON COMPONENTS ──────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = "currentColor", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d={d} />
  </svg>
);
const Icons = {
  Home: () => <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />,
  List: () => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  Plus: () => <Icon d="M12 5v14M5 12h14" />,
  Edit: () => <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
  Trash: () => <Icon d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />,
  Bell: () => <Icon d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
  Settings: () => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  Chart: () => <Icon d="M18 20V10M12 20V4M6 20v-6" />,
  Search: () => <Icon d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0" />,
  X: () => <Icon d="M18 6L6 18M6 6l12 12" />,
  Check: () => <Icon d="M20 6L9 17l-5-5" />,
  Scan: () => <Icon d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />,
  Download: () => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  Package: () => <Icon d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />,
  AlertTriangle: () => <Icon d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
  Copy: () => <Icon d="M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />,
};

// ─── BADGE ────────────────────────────────────────────────────────────
function Badge({ days }) {
  const col = statusColor(days);
  const lbl = statusLabel(days);
  return (
    <span style={{
      background: col + "22", color: col, border: `1px solid ${col}55`,
      borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700,
      letterSpacing: 1, fontFamily: "monospace",
    }}>{lbl}</span>
  );
}

// ─── INPUT ────────────────────────────────────────────────────────────
function Input({ label, value, onChange, type = "text", required, placeholder, style, ...p }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{label}{required && <span style={{ color: COLORS.accent }}> *</span>}</label>}
      <input
        type={type} value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8,
          padding: "9px 12px", color: COLORS.text, fontSize: 14, outline: "none",
          transition: "border-color .2s",
        }}
        onFocus={e => e.target.style.borderColor = COLORS.accent}
        onBlur={e => e.target.style.borderColor = COLORS.border}
        {...p}
      />
    </div>
  );
}

function Select({ label, value, onChange, options = [], required, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{label}{required && <span style={{ color: COLORS.accent }}> *</span>}</label>}
      <select
        value={value || ""} onChange={e => onChange(e.target.value)}
        style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8,
          padding: "9px 12px", color: value ? COLORS.text : COLORS.muted, fontSize: 14, outline: "none",
        }}
      >
        <option value="">— Seleziona —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>}
      <textarea
        value={value || ""} onChange={e => onChange(e.target.value)} rows={rows}
        style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8,
          padding: "9px 12px", color: COLORS.text, fontSize: 14, outline: "none", resize: "vertical",
        }}
      />
    </div>
  );
}

// ─── BUTTON ───────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", icon, disabled, style }) {
  const bg = variant === "primary" ? COLORS.accent : variant === "danger" ? COLORS.red : variant === "ghost" ? "transparent" : COLORS.surface;
  const col = variant === "ghost" ? COLORS.muted : COLORS.text;
  const border = variant === "ghost" ? `1px solid ${COLORS.border}` : variant === "secondary" ? `1px solid ${COLORS.border}` : "none";
  const pad = size === "sm" ? "6px 12px" : size === "lg" ? "12px 24px" : "9px 18px";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: bg, color: col, border, borderRadius: 8, padding: pad,
      fontSize: size === "sm" ? 12 : 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1,
      transition: "all .15s", ...style,
    }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.filter = "brightness(1.15)")}
      onMouseLeave={e => e.currentTarget.style.filter = ""}
    >
      {icon}{children}
    </button>
  );
}

// ─── CARD ─────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>;
}

// ─── MODAL ────────────────────────────────────────────────────────────
function Modal({ title, children, onClose, wide }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000a", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16,
        width: "100%", maxWidth: wide ? 800 : 520, maxHeight: "90vh", overflowY: "auto",
        padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: COLORS.text }}>{title}</h2>
          <Btn variant="ghost" size="sm" onClick={onClose} icon={<Icons.X />} />
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── PRODUCT FORM ─────────────────────────────────────────────────────
function ProductForm({ initial, categories, onSave, onClose }) {
  const [p, setP] = useState(initial || emptyProduct());
  const [errors, setErrors] = useState({});
  const [scanning, setScanning] = useState(null);

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v, ultimaModifica: today() }));

  const famiglie = useMemo(() =>
    p.settore ? (categories.famiglie[p.settore] || []) : [], [p.settore, categories]);
  const sottofamiglie = useMemo(() =>
    p.famiglia ? (categories.sottofamiglie[p.famiglia] || []) : [], [p.famiglia, categories]);

  function validate() {
    const e = {};
    if (!p.nomeProdotto.trim()) e.nomeProdotto = true;
    if (!p.dataScadenza) e.dataScadenza = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (validate()) onSave(p);
  }

  function simulateScan(field) {
    const fake = field === "codiceABarre" ? "8001234567890" : "QR-2024-PROD-001";
    set(field, fake);
    setScanning(null);
    alert(`✅ Codice rilevato: ${fake}\n(In produzione usa fotocamera reale con html5-qrcode)`);
  }

  const inputStyle = k => ({ ...(errors[k] ? { borderColor: COLORS.red } : {}) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Identificazione */}
      <div>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>📦 Identificazione</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Nome Prodotto" value={p.nomeProdotto} onChange={v => set("nomeProdotto", v)} required style={{ gridColumn: "span 2", ...inputStyle("nomeProdotto") }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Codice a Barre</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={p.codiceABarre || ""} onChange={e => set("codiceABarre", e.target.value)} style={{ flex: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 14, outline: "none" }} />
              <Btn variant="secondary" size="sm" onClick={() => simulateScan("codiceABarre")} icon={<Icons.Scan />}>Scansiona</Btn>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>QR Code</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={p.qrCode || ""} onChange={e => set("qrCode", e.target.value)} style={{ flex: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 14, outline: "none" }} />
              <Btn variant="secondary" size="sm" onClick={() => simulateScan("qrCode")} icon={<Icons.Scan />}>Scansiona</Btn>
            </div>
          </div>
          <Input label="Codice SKU" value={p.codiceSKU} onChange={v => set("codiceSKU", v)} />
          <Input label="Lotto" value={p.numeroLotto} onChange={v => set("numeroLotto", v)} />
          <Textarea label="Descrizione" value={p.descrizione} onChange={v => set("descrizione", v)} rows={2} />
        </div>
      </div>

      {/* Classificazione */}
      <div>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>🗂️ Classificazione</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Select label="Settore" value={p.settore} onChange={v => set("settore", v)} options={categories.settori} />
          <Select label="Famiglia" value={p.famiglia} onChange={v => set("famiglia", v)} options={famiglie} />
          <Select label="Sottofamiglia" value={p.sottofamiglia} onChange={v => set("sottofamiglia", v)} options={sottofamiglie} />
        </div>
      </div>

      {/* Date */}
      <div>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>📅 Date</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Input label="Data Produzione" value={p.dataProduzione} onChange={v => set("dataProduzione", v)} type="date" />
          <Input label="Data Scadenza" value={p.dataScadenza} onChange={v => set("dataScadenza", v)} type="date" required style={inputStyle("dataScadenza")} />
          <Input label="Data Apertura" value={p.dataApertura} onChange={v => set("dataApertura", v)} type="date" />
          <Input label="Giorni vita dopo apertura" value={p.giorniVitaDopoApertura} onChange={v => set("giorniVitaDopoApertura", v)} type="number" />
        </div>
      </div>

      {/* Fornitore */}
      <div>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>🏭 Fornitore & Fattura</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="Fornitore" value={p.fornitore} onChange={v => set("fornitore", v)} />
          <Input label="N° Fattura" value={p.numeroFattura} onChange={v => set("numeroFattura", v)} />
          <Input label="Data Fattura" value={p.dataFattura} onChange={v => set("dataFattura", v)} type="date" />
        </div>
      </div>

      {/* Magazzino */}
      <div>
        <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>📊 Magazzino</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
          <Input label="Qta Ricevuta" value={p.quantitaRicevuta} onChange={v => set("quantitaRicevuta", v)} type="number" />
          <Select label="U.M." value={p.unitaMisura} onChange={v => set("unitaMisura", v)} options={["pz", "kg", "g", "l", "ml", "cf"]} />
          <Input label="Prezzo Unit. €" value={p.prezzoUnitario} onChange={v => set("prezzoUnitario", v)} type="number" />
          <Input label="Qta Attuale" value={p.quantitaAttuale} onChange={v => set("quantitaAttuale", v)} type="number" />
          <Input label="Qta Minima" value={p.quantitaMinima} onChange={v => set("quantitaMinima", v)} type="number" />
        </div>
        <div style={{ marginTop: 12 }}>
          <Input label="Posizione (es. Frigo 1 / Scaffale A3)" value={p.posizioneInterna} onChange={v => set("posizioneInterna", v)} />
        </div>
      </div>

      <Textarea label="Note" value={p.note} onChange={v => set("note", v)} />

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Annulla</Btn>
        <Btn onClick={handleSave} icon={<Icons.Check />}>Salva Prodotto</Btn>
      </div>
    </div>
  );
}

// ─── PRODUCT DETAIL ───────────────────────────────────────────────────
function ProductDetail({ product, onEdit, onDelete, onDuplicate, onClose }) {
  const days = daysLeft(product.dataScadenza);
  const Row = ({ label, value }) => value ? (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}>
      <span style={{ fontSize: 12, color: COLORS.muted, minWidth: 160, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: COLORS.text }}>{value}</span>
    </div>
  ) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Badge days={days} />
        <span style={{ color: COLORS.muted, fontSize: 13 }}>Scadenza: {formatDate(product.dataScadenza)}</span>
      </div>
      <Row label="Nome Prodotto" value={product.nomeProdotto} />
      <Row label="Codice a Barre" value={product.codiceABarre} />
      <Row label="QR Code" value={product.qrCode} />
      <Row label="SKU" value={product.codiceSKU} />
      <Row label="Lotto" value={product.numeroLotto} />
      <Row label="Settore" value={product.settore} />
      <Row label="Famiglia" value={product.famiglia} />
      <Row label="Sottofamiglia" value={product.sottofamiglia} />
      <Row label="Data Produzione" value={formatDate(product.dataProduzione)} />
      <Row label="Data Apertura" value={formatDate(product.dataApertura)} />
      <Row label="Giorni vita dopo apertura" value={product.giorniVitaDopoApertura} />
      <Row label="Fornitore" value={product.fornitore} />
      <Row label="N° Fattura" value={product.numeroFattura} />
      <Row label="Data Fattura" value={formatDate(product.dataFattura)} />
      <Row label="Quantità Ricevuta" value={product.quantitaRicevuta ? `${product.quantitaRicevuta} ${product.unitaMisura}` : null} />
      <Row label="Quantità Attuale" value={product.quantitaAttuale} />
      <Row label="Quantità Minima" value={product.quantitaMinima} />
      <Row label="Prezzo Unitario" value={product.prezzoUnitario ? `€ ${product.prezzoUnitario}` : null} />
      <Row label="Posizione" value={product.posizioneInterna} />
      <Row label="Note" value={product.note} />
      <Row label="Inserimento" value={formatDate(product.dataInserimento)} />
      <Row label="Ultima Modifica" value={formatDate(product.ultimaModifica)} />
      <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
        <Btn variant="ghost" size="sm" onClick={() => { onDuplicate(product); onClose(); }} icon={<Icons.Copy />}>Duplica</Btn>
        <Btn variant="secondary" size="sm" onClick={() => { onEdit(product); onClose(); }} icon={<Icons.Edit />}>Modifica</Btn>
        <Btn variant="danger" size="sm" onClick={() => { if (confirm("Eliminare questo prodotto?")) { onDelete(product.id); onClose(); } }} icon={<Icons.Trash />}>Elimina</Btn>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────
function Dashboard({ products, onAdd, onDetail }) {
  const scaduti = products.filter(p => daysLeft(p.dataScadenza) < 0);
  const oggi = products.filter(p => daysLeft(p.dataScadenza) === 0);
  const presto = products.filter(p => { const d = daysLeft(p.dataScadenza); return d > 0 && d <= 3; });
  const settimana = products.filter(p => { const d = daysLeft(p.dataScadenza); return d > 3 && d <= 7; });

  const urgent = [...products].filter(p => daysLeft(p.dataScadenza) <= 7).sort((a, b) => daysLeft(a.dataScadenza) - daysLeft(b.dataScadenza));

  const StatCard = ({ label, value, color, icon }) => (
    <Card style={{ textAlign: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, fontWeight: 600 }}>{label}</div>
    </Card>
  );

  return (
    <div style={{ padding: "0 0 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.text }}>Dashboard</h1>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <Btn onClick={onAdd} icon={<Icons.Plus />}>Nuovo Prodotto</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="Prodotti Totali" value={products.length} color={COLORS.text} />
        <StatCard label="Scaduti" value={scaduti.length} color={COLORS.red} />
        <StatCard label="Scadono Oggi" value={oggi.length} color={COLORS.yellow} />
        <StatCard label="Scadono in 3 gg" value={presto.length} color={COLORS.accent} />
      </div>

      {urgent.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Icons.AlertTriangle />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Prodotti Urgenti</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {urgent.map(p => {
              const days = daysLeft(p.dataScadenza);
              const col = statusColor(days);
              return (
                <div key={p.id} onClick={() => onDetail(p)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: col + "11", border: `1px solid ${col}33`,
                  borderRadius: 10, cursor: "pointer", transition: "all .15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = col + "22"}
                  onMouseLeave={e => e.currentTarget.style.background = col + "11"}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nomeProdotto}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{p.fornitore || "—"} · {p.settore || "—"}</div>
                  </div>
                  <Badge days={days} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {urgent.length === 0 && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Nessuna urgenza!</div>
          <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Tutti i prodotti hanno scadenze lontane.</div>
        </Card>
      )}
    </div>
  );
}

// ─── PRODUCT LIST ─────────────────────────────────────────────────────
function ProductList({ products, categories, onAdd, onEdit, onDelete, onDetail, onDuplicate }) {
  const [search, setSearch] = useState("");
  const [filterSettore, setFilterSettore] = useState("");
  const [filterStato, setFilterStato] = useState("");
  const [sortKey, setSortKey] = useState("dataScadenza");

  const filtered = useMemo(() => {
    let list = [...products];
    if (search) list = list.filter(p =>
      p.nomeProdotto?.toLowerCase().includes(search.toLowerCase()) ||
      p.fornitore?.toLowerCase().includes(search.toLowerCase()) ||
      p.codiceABarre?.includes(search) || p.codiceSKU?.includes(search)
    );
    if (filterSettore) list = list.filter(p => p.settore === filterSettore);
    if (filterStato === "scaduto") list = list.filter(p => daysLeft(p.dataScadenza) < 0);
    if (filterStato === "urgente") list = list.filter(p => { const d = daysLeft(p.dataScadenza); return d >= 0 && d <= 3; });
    if (filterStato === "ok") list = list.filter(p => daysLeft(p.dataScadenza) > 3);
    list.sort((a, b) => {
      if (sortKey === "dataScadenza") return new Date(a.dataScadenza) - new Date(b.dataScadenza);
      if (sortKey === "nome") return a.nomeProdotto.localeCompare(b.nomeProdotto);
      if (sortKey === "fornitore") return (a.fornitore || "").localeCompare(b.fornitore || "");
      return 0;
    });
    return list;
  }, [products, search, filterSettore, filterStato, sortKey]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Prodotti</h1>
        <Btn onClick={onAdd} icon={<Icons.Plus />}>Aggiungi</Btn>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome, codice, fornitore..."
              style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px 9px 36px", color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }}>
              <Icons.Search />
            </div>
          </div>
          <select value={filterSettore} onChange={e => setFilterSettore(e.target.value)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 13, outline: "none" }}>
            <option value="">Tutti i Settori</option>
            {categories.settori.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterStato} onChange={e => setFilterStato(e.target.value)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 13, outline: "none" }}>
            <option value="">Tutti gli stati</option>
            <option value="scaduto">Scaduti</option>
            <option value="urgente">Urgenti (≤3gg)</option>
            <option value="ok">OK</option>
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 13, outline: "none" }}>
            <option value="dataScadenza">Ordina: Scadenza</option>
            <option value="nome">Ordina: Nome</option>
            <option value="fornitore">Ordina: Fornitore</option>
          </select>
        </div>
      </Card>

      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>{filtered.length} prodotti trovati</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ color: COLORS.muted }}>Nessun prodotto trovato</div>
          </Card>
        )}
        {filtered.map(p => {
          const days = daysLeft(p.dataScadenza);
          const col = statusColor(days);
          return (
            <Card key={p.id} style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onDetail(p)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 4, height: 36, background: col, borderRadius: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nomeProdotto}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        {[p.settore, p.famiglia, p.fornitore].filter(Boolean).join(" · ")}
                        {p.codiceABarre && <> · <span style={{ fontFamily: "monospace" }}>{p.codiceABarre}</span></>}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <Badge days={days} />
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{formatDate(p.dataScadenza)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Btn variant="ghost" size="sm" onClick={() => onDuplicate(p)} icon={<Icons.Copy />} style={{ padding: "6px 8px" }} />
                    <Btn variant="ghost" size="sm" onClick={() => onEdit(p)} icon={<Icons.Edit />} style={{ padding: "6px 8px" }} />
                    <Btn variant="ghost" size="sm" onClick={() => { if (confirm("Eliminare?")) onDelete(p.id); }} icon={<Icons.Trash />} style={{ padding: "6px 8px", color: COLORS.red }} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── REPORTS ──────────────────────────────────────────────────────────
function Reports({ products }) {
  const [range, setRange] = useState(7);
  const scaduti = products.filter(p => daysLeft(p.dataScadenza) < 0);
  const inScadenza = products.filter(p => { const d = daysLeft(p.dataScadenza); return d >= 0 && d <= range; });

  function exportCSV(list, name) {
    const headers = ["Nome", "Scadenza", "Fornitore", "Settore", "Famiglia", "SKU", "N°Fattura", "Posizione", "Note"];
    const rows = list.map(p => [
      p.nomeProdotto, p.dataScadenza, p.fornitore, p.settore, p.famiglia,
      p.codiceSKU, p.numeroFattura, p.posizioneInterna, p.note,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click();
  }

  const Section = ({ title, list, color }) => (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, background: color, borderRadius: "50%" }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          <span style={{ background: color + "22", color, fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{list.length}</span>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => exportCSV(list, title)} icon={<Icons.Download />}>CSV</Btn>
      </div>
      {list.length === 0
        ? <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Nessun prodotto</div>
        : list.map(p => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nomeProdotto}</div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>{p.fornitore} {p.numeroFattura ? `· Fatt. ${p.numeroFattura}` : ""}</div>
            </div>
            <Badge days={daysLeft(p.dataScadenza)} />
          </div>
        ))
      }
    </Card>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800 }}>Report Scadenze</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: COLORS.muted }}>Mostra prodotti in scadenza entro:</label>
        <select value={range} onChange={e => setRange(+e.target.value)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none" }}>
          {[1, 3, 7, 14, 30].map(n => <option key={n} value={n}>{n} giorni</option>)}
        </select>
      </div>
      <Section title="Prodotti Scaduti" list={scaduti} color={COLORS.red} />
      <Section title={`In scadenza entro ${range} giorni`} list={inScadenza} color={COLORS.yellow} />
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────
function Settings({ alerts, setAlerts, categories, setCategories, shopName, setShopName }) {
  const [tab, setTab] = useState("alerts");
  const [newSettore, setNewSettore] = useState("");
  const [newFamiglia, setNewFamiglia] = useState({ settore: "", nome: "" });
  const [newSotto, setNewSotto] = useState({ famiglia: "", nome: "" });

  function addAlert() {
    setAlerts(prev => [...prev, { id: uuid(), giorni: 1, ora: "08:00", attivo: true, label: "Nuovo alert" }]);
  }
  function updateAlert(id, key, val) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, [key]: val } : a));
  }
  function removeAlert(id) {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  function addSettore() {
    if (!newSettore.trim()) return;
    setCategories(prev => ({ ...prev, settori: [...prev.settori, newSettore.trim()], famiglie: { ...prev.famiglie, [newSettore.trim()]: [] } }));
    setNewSettore("");
  }
  function removeSettore(s) {
    setCategories(prev => { const { [s]: _, ...rest } = prev.famiglie; return { ...prev, settori: prev.settori.filter(x => x !== s), famiglie: rest }; });
  }
  function addFamiglia() {
    if (!newFamiglia.settore || !newFamiglia.nome.trim()) return;
    setCategories(prev => ({
      ...prev,
      famiglie: { ...prev.famiglie, [newFamiglia.settore]: [...(prev.famiglie[newFamiglia.settore] || []), newFamiglia.nome.trim()] },
      sottofamiglie: { ...prev.sottofamiglie, [newFamiglia.nome.trim()]: [] },
    }));
    setNewFamiglia({ settore: "", nome: "" });
  }
  function addSottofamiglia() {
    if (!newSotto.famiglia || !newSotto.nome.trim()) return;
    setCategories(prev => ({
      ...prev,
      sottofamiglie: { ...prev.sottofamiglie, [newSotto.famiglia]: [...(prev.sottofamiglie[newSotto.famiglia] || []), newSotto.nome.trim()] },
    }));
    setNewSotto({ famiglia: "", nome: "" });
  }

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
      background: tab === id ? COLORS.accent : "transparent",
      color: tab === id ? "#fff" : COLORS.muted, fontWeight: 600, fontSize: 13,
    }}>{label}</button>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800 }}>Impostazioni</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, background: COLORS.surface, padding: 6, borderRadius: 12 }}>
        <TabBtn id="alerts" label="🔔 Alert" />
        <TabBtn id="categories" label="🗂️ Categorie" />
        <TabBtn id="shop" label="🏪 Negozio" />
        <TabBtn id="backup" label="💾 Backup" />
      </div>

      {tab === "alerts" && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 700 }}>Soglie di Allerta</span>
            <Btn size="sm" onClick={addAlert} icon={<Icons.Plus />}>Aggiungi</Btn>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {alerts.map(a => (
              <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", background: COLORS.surface, padding: "10px 14px", borderRadius: 10 }}>
                <input type="checkbox" checked={a.attivo} onChange={e => updateAlert(a.id, "attivo", e.target.checked)} style={{ accentColor: COLORS.accent, width: 18, height: 18 }} />
                <input value={a.label} onChange={e => updateAlert(a.id, "label", e.target.value)} style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 10px", color: COLORS.text, fontSize: 13, outline: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min={0} max={365} value={a.giorni} onChange={e => updateAlert(a.id, "giorni", +e.target.value)} style={{ width: 60, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", color: COLORS.text, fontSize: 13, outline: "none", textAlign: "center" }} />
                  <span style={{ fontSize: 12, color: COLORS.muted }}>gg</span>
                </div>
                <input type="time" value={a.ora} onChange={e => updateAlert(a.id, "ora", e.target.value)} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "6px 8px", color: COLORS.text, fontSize: 13, outline: "none" }} />
                <Btn variant="ghost" size="sm" onClick={() => { playAlert(); alert("🔔 Alert di test!"); }} style={{ padding: "6px 8px" }}>Test</Btn>
                <Btn variant="ghost" size="sm" onClick={() => removeAlert(a.id)} icon={<Icons.Trash />} style={{ padding: "6px 8px", color: COLORS.red }} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "categories" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Settori */}
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Settori</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={newSettore} onChange={e => setNewSettore(e.target.value)} placeholder="Nuovo settore..." style={{ flex: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none" }} />
              <Btn size="sm" onClick={addSettore} icon={<Icons.Plus />}>Aggiungi</Btn>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {categories.settori.map(s => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "5px 12px" }}>
                  <span style={{ fontSize: 13 }}>{s}</span>
                  <button onClick={() => removeSettore(s)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red, padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Famiglie */}
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Famiglie</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select value={newFamiglia.settore} onChange={e => setNewFamiglia(p => ({ ...p, settore: e.target.value }))} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none" }}>
                <option value="">Settore...</option>
                {categories.settori.map(s => <option key={s}>{s}</option>)}
              </select>
              <input value={newFamiglia.nome} onChange={e => setNewFamiglia(p => ({ ...p, nome: e.target.value }))} placeholder="Nome famiglia..." style={{ flex: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none" }} />
              <Btn size="sm" onClick={addFamiglia} icon={<Icons.Plus />}>Aggiungi</Btn>
            </div>
            {Object.entries(categories.famiglie).map(([settore, fams]) => fams.length > 0 && (
              <div key={settore} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: COLORS.accent, fontWeight: 700, marginBottom: 6 }}>{settore}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {fams.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 10px" }}>
                      <span style={{ fontSize: 12 }}>{f}</span>
                      <button onClick={() => setCategories(prev => ({ ...prev, famiglie: { ...prev.famiglie, [settore]: prev.famiglie[settore].filter(x => x !== f) } }))} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.red, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          {/* Sottofamiglie */}
          <Card>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Sottofamiglie</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select value={newSotto.famiglia} onChange={e => setNewSotto(p => ({ ...p, famiglia: e.target.value }))} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none" }}>
                <option value="">Famiglia...</option>
                {Object.values(categories.famiglie).flat().map(f => <option key={f}>{f}</option>)}
              </select>
              <input value={newSotto.nome} onChange={e => setNewSotto(p => ({ ...p, nome: e.target.value }))} placeholder="Nome sottofamiglia..." style={{ flex: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 12px", color: COLORS.text, fontSize: 13, outline: "none" }} />
              <Btn size="sm" onClick={addSottofamiglia} icon={<Icons.Plus />}>Aggiungi</Btn>
            </div>
          </Card>
        </div>
      )}

      {tab === "shop" && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Informazioni Negozio</div>
          <Input label="Nome Negozio" value={shopName} onChange={setShopName} />
          <div style={{ marginTop: 16, padding: 14, background: COLORS.surface, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>💡 Per installare l'app su smartphone:</div>
            <div style={{ fontSize: 13, color: COLORS.text }}>
              <b>Android (Chrome):</b> Menu ⋮ → "Aggiungi a schermata Home"<br />
              <b>iPhone (Safari):</b> Condividi → "Aggiungi a schermata Home"
            </div>
          </div>
        </Card>
      )}

      {tab === "backup" && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Backup & Ripristino</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Btn icon={<Icons.Download />} onClick={() => {
              const data = { products: store.get("products", []), categories: store.get("categories", {}), alerts: store.get("alerts", []) };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `backup-scadenze-${today()}.json`; a.click();
            }}>Esporta backup JSON</Btn>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, color: COLORS.text }}>📂 Importa backup JSON</div>
              <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = ev => {
                  try {
                    const data = JSON.parse(ev.target.result);
                    if (data.products) store.set("products", data.products);
                    if (data.categories) store.set("categories", data.categories);
                    if (data.alerts) store.set("alerts", data.alerts);
                    alert("✅ Backup ripristinato! Ricarica la pagina.");
                  } catch { alert("❌ File non valido."); }
                };
                r.readAsText(file);
              }} />
            </label>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────
export default function App() {
  const [products, setProducts] = useState(() => store.get("products", []));
  const [categories, setCategories] = useState(() => store.get("categories", DEFAULT_CATEGORIES));
  const [alerts, setAlerts] = useState(() => store.get("alerts", DEFAULT_ALERTS));
  const [shopName, setShopName] = useState(() => store.get("shopName", "Deli Manager"));
  const [page, setPage] = useState("dashboard");
  const [editProduct, setEditProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [notification, setNotification] = useState(null);
  const alertCheckRef = useRef(null);

  // Persist
  useEffect(() => { store.set("products", products); }, [products]);
  useEffect(() => { store.set("categories", categories); }, [categories]);
  useEffect(() => { store.set("alerts", alerts); }, [alerts]);
  useEffect(() => { store.set("shopName", shopName); }, [shopName]);

  // Alert checker
  useEffect(() => {
    function checkAlerts() {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      alerts.filter(a => a.attivo && a.ora === hhmm).forEach(a => {
        const urgent = products.filter(p => {
          const d = daysLeft(p.dataScadenza);
          return d === a.giorni;
        });
        if (urgent.length > 0) {
          playAlert();
          setNotification({ text: `⏰ ${a.label}: ${urgent.length} prodotto/i in scadenza!`, type: "warn" });
          setTimeout(() => setNotification(null), 6000);
        }
      });
    }
    alertCheckRef.current = setInterval(checkAlerts, 60000);
    return () => clearInterval(alertCheckRef.current);
  }, [alerts, products]);

  // Notification toast
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  function saveProduct(p) {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
      return [...prev, p];
    });
    setShowForm(false);
    setEditProduct(null);
    setNotification({ text: "✅ Prodotto salvato!", type: "ok" });
    setTimeout(() => setNotification(null), 3000);
  }

  function deleteProduct(id) {
    setProducts(prev => prev.filter(p => p.id !== id));
    setNotification({ text: "🗑️ Prodotto eliminato", type: "warn" });
    setTimeout(() => setNotification(null), 3000);
  }

  function duplicateProduct(p) {
    const dup = { ...p, id: uuid(), dataInserimento: today(), ultimaModifica: today() };
    setProducts(prev => [...prev, dup]);
    setNotification({ text: "📋 Prodotto duplicato", type: "ok" });
    setTimeout(() => setNotification(null), 3000);
  }

  const navItems = [
    { id: "dashboard", label: "Home", icon: <Icons.Home /> },
    { id: "products", label: "Prodotti", icon: <Icons.List /> },
    { id: "reports", label: "Report", icon: <Icons.Chart /> },
    { id: "settings", label: "Impostazioni", icon: <Icons.Settings /> },
  ];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: COLORS.accent, borderRadius: 10, padding: "6px 10px", fontSize: 18 }}>🏪</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>{shopName}</div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 1 }}>GESTIONE SCADENZE</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {products.filter(p => daysLeft(p.dataScadenza) < 0).length > 0 && (
            <div style={{ background: COLORS.red + "22", border: `1px solid ${COLORS.red}`, borderRadius: 20, padding: "3px 10px", fontSize: 12, color: COLORS.red, fontWeight: 700 }}>
              {products.filter(p => daysLeft(p.dataScadenza) < 0).length} scaduti
            </div>
          )}
          <Btn onClick={() => { setEditProduct(null); setShowForm(true); }} icon={<Icons.Plus />} size="sm">Nuovo</Btn>
        </div>
      </div>

      {/* Toast */}
      {notification && (
        <div style={{
          position: "fixed", top: 72, right: 16, zIndex: 2000,
          background: notification.type === "ok" ? COLORS.green + "22" : COLORS.yellow + "22",
          border: `1px solid ${notification.type === "ok" ? COLORS.green : COLORS.yellow}`,
          borderRadius: 10, padding: "10px 18px", color: COLORS.text, fontSize: 14, fontWeight: 600,
          animation: "fadeIn .3s",
        }}>
          {notification.text}
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {page === "dashboard" && <Dashboard products={products} onAdd={() => { setEditProduct(null); setShowForm(true); }} onDetail={setDetailProduct} />}
        {page === "products" && <ProductList products={products} categories={categories} onAdd={() => { setEditProduct(null); setShowForm(true); }} onEdit={p => { setEditProduct(p); setShowForm(true); }} onDelete={deleteProduct} onDetail={setDetailProduct} onDuplicate={duplicateProduct} />}
        {page === "reports" && <Reports products={products} />}
        {page === "settings" && <Settings alerts={alerts} setAlerts={setAlerts} categories={categories} setCategories={setCategories} shopName={shopName} setShopName={setShopName} />}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`,
        display: "flex", justifyContent: "space-around", padding: "8px 0 12px", zIndex: 100,
      }}>
        {navItems.map(n => {
          const active = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer",
              color: active ? COLORS.accent : COLORS.muted, padding: "4px 20px",
              transition: "color .2s",
            }}>
              <div style={{ transform: active ? "scale(1.15)" : "scale(1)", transition: "transform .2s" }}>{n.icon}</div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* Modals */}
      {showForm && (
        <Modal title={editProduct ? "Modifica Prodotto" : "Nuovo Prodotto"} onClose={() => { setShowForm(false); setEditProduct(null); }} wide>
          <ProductForm initial={editProduct} categories={categories} onSave={saveProduct} onClose={() => { setShowForm(false); setEditProduct(null); }} />
        </Modal>
      )}
      {detailProduct && (
        <Modal title="Dettaglio Prodotto" onClose={() => setDetailProduct(null)}>
          <ProductDetail product={detailProduct} onEdit={p => { setEditProduct(p); setShowForm(true); }} onDelete={deleteProduct} onDuplicate={duplicateProduct} onClose={() => setDetailProduct(null)} />
        </Modal>
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2e3350; border-radius: 3px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1); }
        select option { background: #1a1d27; }
      `}</style>
    </div>
  );
}
