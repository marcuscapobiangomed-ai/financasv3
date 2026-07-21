"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BellRing,
  CalendarClock,
  Check,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  Gauge,
  Goal,
  HandCoins,
  History,
  LayoutDashboard,
  ListTodo,
  Menu,
  Plus,
  Pencil,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
  Wifi,
  Cloud,
  CloudOff,
  CloudLightning,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import { initialFinanceState } from "@/lib/seed";
import { brl, commitmentsByMonth, formatDate, getSummary, monthSeries, parseCsv, spendingByCategory, isEntryInPeriod, monthLabel, getSafeToSpend, getRecommendations, getGoalScenarios, getFinancialHealth } from "@/lib/finance";
import type { FinanceEntry, FinanceState, ViewKey, DataQuality, EntryStatus } from "@/lib/types";
import type { Recommendation } from "@/lib/finance";
import { PanelSkeleton, StatCardSkeleton, TableSkeleton, HeroSkeleton } from "@/components/skeleton";
import { logger, type LogCategory, type LogLevel } from "@/lib/logger";
import { validateFile, sanitizeString, checkRateLimit, RATE_LIMIT } from "@/lib/security";
import { exportCSV, exportJSON, exportFullBackup, createBackup, loadBackupList, restoreFromBackup, importFromJSON, type BackupMeta } from "@/lib/backup";
import { saveFormDraft, loadFormDraft, clearFormDraft, saveImportChunk, loadImportChunk, clearImportChunk, isOnline, getConnectionStatus, type ConnectionStatus } from "@/lib/fault-tolerance";
import { analytics } from "@/lib/analytics";
import { getMonthClose, saveChecklist, closeMonth, reopenMonth, getAllCloses, type MonthClose, type ClosingChecklist } from "@/lib/closing";
import { recordAudit, getAuditTrail, getAuditStats, getAllAuditEntries, type AuditEntry } from "@/lib/audit";
import { trashEntry, restoreFromTrash, getTrashItems, getTrashCount, emptyTrash, type TrashItem } from "@/lib/trash";

import { LogViewerPage } from "@/components/LogViewerPage";
import { ToolsPage } from "@/components/ToolsPage";
import { CorrectionCenter } from "@/components/CorrectionCenter";
import { RecoveryDiagnostics } from "@/components/RecoveryDiagnostics";
import { AllEntries } from "@/components/AllEntries";
import { financeCommandService } from "@/lib/storage/finance-command-service";
import { CalculationMemoryModal } from "@/components/CalculationMemoryModal";
import { CalculationAudit } from "@/components/CalculationAudit";
import { supabase } from "@/lib/supabase";
import { SupabaseFinanceRepository } from "@/lib/storage/supabase-repository";
import { LocalStorageRepository } from "@/lib/storage/local-storage-repository";
import { AuthPage } from "@/components/AuthPage";
import { MigrationWizard } from "@/components/MigrationWizard";

const STORAGE_KEY = "meu-financeiro-v3";
const LEGACY_STORAGE_KEY = "meu-financeiro-v2";
const CHART_COLORS = ["#ff7a18", "#ff9a44", "#ffc174", "#c96a26", "#855031", "#f2c094"];

type ToastType = "success" | "danger" | "info" | "neutral";
interface Toast { id: string; message: string; type: ToastType; onUndo?: () => void; }

const NAV_GROUPS = [
  { label: "Visão financeira", items: [
    { key: "overview" as ViewKey, label: "Visão geral", icon: LayoutDashboard },
    { key: "spending" as ViewKey, label: "Gastos", icon: ReceiptText },
    { key: "receivables" as ViewKey, label: "A receber", icon: HandCoins },
  ]},
  { label: "Compromissos", items: [
    { key: "cards" as ViewKey, label: "Cartões e parcelas", icon: CreditCard },
  ]},
  { label: "Patrimônio", items: [
    { key: "goal" as ViewKey, label: "Meta R$ 10 mil", icon: Goal },
  ]},
  { label: "Sistema", items: [
    { key: "imports" as ViewKey, label: "Importar", icon: Upload },
    { key: "tools" as ViewKey, label: "Exportar e backup", icon: Database },
    { key: "logs" as ViewKey, label: "Monitoramento", icon: ListTodo },
    { key: "quality" as ViewKey, label: "Qualidade", icon: Gauge },
    { key: "corrections" as ViewKey, label: "Central Correções", icon: ClipboardList },
    { key: "calculation_audit" as ViewKey, label: "Auditoria de Cálculos", icon: ShieldCheck },
  ]},
];

const BOTTOM_NAV = [
  { key: "overview" as ViewKey, label: "Início", icon: LayoutDashboard },
  { key: "spending" as ViewKey, label: "Gastos", icon: ReceiptText },
  { key: "cards" as ViewKey, label: "Cartões", icon: CreditCard },
  { key: "receivables" as ViewKey, label: "Receber", icon: HandCoins },
  { key: "more" as any, label: "Mais", icon: Menu },
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusLabel(entry: FinanceEntry, today: string) {
  if (entry.status === "recebido") return "Recebido";
  if (entry.status === "realizado") return "Pago";
  if (entry.dueDate < today && (entry.status === "a_pagar" || entry.status === "a_receber_confirmado")) return "Atrasado";
  if (entry.status === "projetado" || entry.status === "a_receber_incerto") return "Previsto";
  return "Pendente";
}

function statusClass(entry: FinanceEntry, today: string) {
  if (entry.status === "recebido" || entry.status === "realizado") return "success";
  if (entry.dueDate < today && (entry.status === "a_pagar" || entry.status === "a_receber_confirmado")) return "danger";
  if (entry.status === "projetado" || entry.status === "a_receber_incerto") return "neutral";
  return "warning";
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  onClick,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  tone?: "default" | "positive" | "warning";
  onClick?: () => void;
  tooltip?: string;
}) {
  return (
    <article 
      className={classNames("stat-card", tone !== "default" && `stat-card-${tone}`, onClick && "stat-card-clickable")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-card-heading">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{title}</span>
          {tooltip && (
            <div className="tooltip-wrap" style={{ position: "relative", display: "inline-flex" }}>
              <span className="tooltip-icon" aria-label={`Informação sobre ${title}`}>?</span>
              <div className="tooltip-pop" role="tooltip">{tooltip}</div>
            </div>
          )}
        </div>
        <div className="stat-icon"><Icon size={18} /></div>
      </div>
      <strong>{value}</strong>
      <small>{subtitle}</small>
    </article>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: { label: string; onClick: () => void; secondary?: { label: string; onClick: () => void } } }) {
  return (
    <div className="empty-state">
      <Sparkles size={28} />
      <strong>{title}</strong>
      <span>{description}</span>
      {action && (
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
          <button className="primary-button compact" onClick={action.onClick}><Plus size={15} />{action.label}</button>
          {action.secondary && <button className="secondary-button" style={{ height: "32px", fontSize: "12px", padding: "0 12px" }} onClick={action.secondary.onClick}>{action.secondary.label}</button>}
        </div>
      )}
    </div>
  );
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-msg">{t.message}</span>
          <div className="toast-actions">
            {t.onUndo && <button className="toast-undo" onClick={() => { t.onUndo!(); dismiss(t.id); }}>Desfazer</button>}
            <button className="toast-close" aria-label="Fechar notificação" onClick={() => dismiss(t.id)}><X size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}export function FinanceDashboard() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [view, setView] = useState<ViewKey>("overview");
  const [hydrated, setHydrated] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [importPreview, setImportPreview] = useState<Array<Partial<FinanceEntry>>>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [todayStr, setTodayStr] = useState("2026-07-19");
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [safetyMargin, setSafetyMargin] = useState(100);
  const [safeToSpendModalOpen, setSafeToSpendModalOpen] = useState(false);
  const [calculationMemoryMetric, setCalculationMemoryMetric] = useState<"patrimony" | "reserve" | "receivables" | "safeToSpend" | "expenses" | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("online");
  const [user, setUser] = useState<any>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "pending" | "offline">("synced");
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreJson, setRestoreJson] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [feedbackModal, setFeedbackModal] = useState<{ action: string; category: string } | null>(null);
  const [historyModalEntry, setHistoryModalEntry] = useState<FinanceEntry | null>(null);
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const importFileRef = useRef<HTMLInputElement>(null);

  function pushToast(message: string, type: ToastType = "success", onUndo?: () => void, duration = 5000) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, onUndo }]);
    setTimeout(() => dismissToast(id), duration);
  }
  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    const today = new Date().toLocaleDateString("sv-SE");
    setTodayStr(today);
    setSelectedPeriod(today.slice(0, 7));

    // 1. Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        const repo = new SupabaseFinanceRepository(session.user.id);
        repo.loadState().then((remoteData) => {
          setState(remoteData);
          setHydrated(true);
        });
      } else {
        loadLocalData();
      }
    });

    // 2. Ouvir mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        const repo = new SupabaseFinanceRepository(session.user.id);
        const remoteData = await repo.loadState();
        
        // Se o banco remoto estiver vazio mas houver dados locais, ativa o Wizard
        const localRaw = window.localStorage.getItem(STORAGE_KEY);
        if (localRaw) {
          const localParsed = JSON.parse(localRaw) as FinanceState;
          if (remoteData.entries.length === 0 && localParsed.entries.length > 0) {
            setShowMigrationWizard(true);
            return;
          }
        }
        setState(remoteData);
        setHydrated(true);
      } else {
        setUser(null);
        loadLocalData();
      }
    });

    function loadLocalData() {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as FinanceState;
          parsed.entries = parsed.entries.map((entry) => {
            const isCard = entry.account === "Nubank" || entry.account === "Unicred";
            return {
              ...entry,
              dataQuality: entry.dataQuality || (isCard ? (entry.status === "projetado" ? "estimado" : "parcial") : "completo"),
              isOfficial: entry.isOfficial ?? !isCard,
            };
          });
          setState(parsed);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setHydrated(true);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    async function persist() {
      setSyncStatus("syncing");
      try {
        if (user) {
          const repo = new SupabaseFinanceRepository(user.id);
          await repo.saveState(state);
        } else {
          const repo = new LocalStorageRepository();
          await repo.saveState(state);
        }
        setSyncStatus("synced");
      } catch (err) {
        console.error("Sync error:", err);
        setSyncStatus("pending");
      }
    }
    persist();
  }, [state, hydrated, user]);

  // Track connection status
  useEffect(() => {
    function handleOnline() { setConnectionStatus("online"); pushToast("Conexão restaurada.", "success"); }
    function handleOffline() { setConnectionStatus("offline"); pushToast("Você está offline. As alterações serão salvas localmente.", "neutral"); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  // Auto-create backup every 5 minutes
  useEffect(() => {
    if (!hydrated) return;
    const interval = setInterval(() => {
      try { createBackup(state, `Backup automático ${new Date().toLocaleString("pt-BR")}`); } catch { /* silent */ }
    }, 300000);
    return () => clearInterval(interval);
  }, [hydrated, state]);

  // Synchronize state from URL on mount/hydration
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get("view") as ViewKey;
    const urlPeriod = params.get("period");
    const urlSearch = params.get("search");

    if (urlView && (["overview", "receivables", "cards", "spending", "goal", "imports", "tools", "logs", "quality", "corrections", "recovery_diagnostics", "all_entries", "calculation_audit"] as string[]).includes(urlView)) {
      setView(urlView);
    }
    if (urlPeriod) {
      setSelectedPeriod(urlPeriod);
    }
    if (urlSearch) {
      setSearch(urlSearch);
    }

    function handlePopState(event: PopStateEvent) {
      if (event.state) {
        const { view: sView, selectedPeriod: sPeriod, search: sSearch } = event.state;
        if (sView) setView(sView);
        if (sPeriod) setSelectedPeriod(sPeriod);
        if (sSearch !== undefined) setSearch(sSearch);
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hydrated]);

  // Synchronize state to URL on change
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const currentView = params.get("view");
    const currentPeriod = params.get("period");
    const currentSearch = params.get("search");

    const changed = currentView !== view || currentPeriod !== selectedPeriod || currentSearch !== search;
    if (changed) {
      const newParams = new URLSearchParams();
      newParams.set("view", view);
      if (selectedPeriod) newParams.set("period", selectedPeriod);
      if (search) newParams.set("search", search);

      const newUrl = `${window.location.pathname}?${newParams.toString()}`;
      if (currentView !== view || currentPeriod !== selectedPeriod) {
        window.history.pushState({ view, selectedPeriod, search }, "", newUrl);
      } else {
        window.history.replaceState({ view, selectedPeriod, search }, "", newUrl);
      }
    }
  }, [view, selectedPeriod, search, hydrated]);

  // Track page views
  useEffect(() => {
    if (!hydrated) return;
    analytics.pageView(view);
  }, [view, hydrated]);

  const periods = useMemo(() => {
    const months = new Set<string>();
    const todayMonth = todayStr.slice(0, 7);
    months.add(todayMonth);
    state.entries.forEach((e) => {
      months.add(e.dueDate.slice(0, 7));
      if (e.invoiceMonth) months.add(e.invoiceMonth);
    });
    return Array.from(months).sort();
  }, [state.entries, todayStr]);

  const summary = useMemo(() => getSummary(state, selectedPeriod), [state, selectedPeriod]);
  const cashflow = useMemo(() => monthSeries(state.entries), [state.entries]);

  const entriesInPeriod = useMemo(() => {
    return state.entries.filter((e) => isEntryInPeriod(e, selectedPeriod));
  }, [state.entries, selectedPeriod]);

  const categorySpend = useMemo(() => spendingByCategory(entriesInPeriod), [entriesInPeriod]);
  const commitments = useMemo(() => commitmentsByMonth(state.entries), [state.entries]);

  const entriesFiltered = useMemo(() => {
    const normalized = search.toLowerCase().trim();
    if (!normalized) return entriesInPeriod;
    return entriesInPeriod.filter((entry) => [entry.title, entry.category, entry.source, entry.account].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [search, entriesInPeriod]);

  const currentIncome = useMemo(() => {
    return state.entries
      .filter((entry) => entry.kind === "income" && entry.dueDate.slice(0, 7) === selectedPeriod)
      .reduce((sum, entry) => sum + entry.amount, 0);
  }, [state.entries, selectedPeriod]);

  const currentExpenses = useMemo(() => {
    return state.entries
      .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && isEntryInPeriod(entry, selectedPeriod))
      .reduce((sum, entry) => sum + entry.amount, 0);
  }, [state.entries, selectedPeriod]);

  const freeNow = Math.max(0, summary.availableCash + summary.pendingIncome - summary.pendingExpenses);
  const goalGap = Math.max(0, state.goal - summary.patrimony);
  const safeToSpendData = getSafeToSpend(state, todayStr, safetyMargin);
  const recommendations = getRecommendations(state, todayStr, safeToSpendData.safeToSpend, safetyMargin);
  const health = getFinancialHealth(state, todayStr, safeToSpendData.safeToSpend);

  function resetData() {
    if (!window.confirm("Restaurar todos os dados iniciais? As alterações feitas neste navegador serão apagadas.")) return;
    setState(initialFinanceState);
    setImportPreview([]);
    setUploadedFiles([]);
  }

  function settleEntry(entry: FinanceEntry) {
    if (entry.status === "recebido" || entry.status === "realizado") return;
    analytics.task("settle_entry", { kind: entry.kind, amount: entry.amount });
    try {
      financeCommandService.settleEntry(state, entry.id, setState);
      setFeedbackModal({ action: "Dar baixa", category: "settle" });
    } catch (err: any) {
      pushToast(err.message, "danger");
    }
  }

  function removeEntry(id: string) {
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return;
    analytics.task("remove_entry", { kind: entry.kind });
    try {
      financeCommandService.removeEntry(state, id, setState);
      const restored = { ...entry };
      const timeout = setTimeout(() => { pendingDeletes.current.delete(id); }, 5000);
      pendingDeletes.current.set(id, timeout);
      pushToast(
        `"${entry.title}" movido para a lixeira.`,
        "danger",
        () => {
          clearTimeout(pendingDeletes.current.get(id));
          pendingDeletes.current.delete(id);
          try {
            financeCommandService.restoreEntry(state, restored, setState);
          } catch (err: any) {
            pushToast(err.message, "danger");
          }
        }
      );
    } catch (err: any) {
      pushToast(err.message, "danger");
    }
  }

  function addEntry(entry: Omit<FinanceEntry, "id"> | Omit<FinanceEntry, "id">[]) {
    const list = Array.isArray(entry) ? entry : [entry];
    const listWithOrigin = list.map(e => ({ ...e, origin: e.origin || "manual" as const }));
    try {
      const created = financeCommandService.createEntries(state, listWithOrigin, setState);
      setEntryModalOpen(false);
      analytics.task("add_entry", { count: created.length });
      pushToast(
        created.length > 1
          ? `${created.length} parcelas adicionadas com sucesso.`
          : `"${created[0].title}" adicionado com sucesso.`,
        "success"
      );
      setFeedbackModal({ action: "Registrar lançamento", category: "add_entry" });
    } catch (err: any) {
      pushToast(err.message, "danger");
    }
  }

  function updateEntry(id: string, updated: Omit<FinanceEntry, "id">) {
    try {
      const origin = updated.origin || state.entries.find(e => e.id === id)?.origin || ("manual" as const);
      const updatedWithOrigin = { ...updated, origin };
      financeCommandService.updateEntry(state, id, updatedWithOrigin, setState);
      analytics.task("update_entry", { kind: updated.kind });
      pushToast(`Lançamento atualizado.`, "info");
      setEditingEntry(null);
      setFeedbackModal({ action: "Editar lançamento", category: "edit_entry" });
    } catch (err: any) {
      pushToast(err.message, "danger");
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    if (!checkRateLimit("import", RATE_LIMIT.maxImportsPerMinute)) {
      pushToast("Muitas importações em sequência. Aguarde um minuto.", "danger");
      return;
    }
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) { pushToast(validation.error!, "danger"); continue; }
    }
    setUploadedFiles((current) => [...files.map((file) => file.name), ...current]);
    const csv = files.find((file) => file.name.toLowerCase().endsWith(".csv"));
    if (csv) {
      const text = await csv.text();
      const preview = parseCsv(text);
      setImportPreview(preview);
      saveImportChunk(preview);
      logger.info("import", "CSV parsed for review", { rows: preview.length, file: csv.name });
    }
    event.target.value = "";
  }

  function confirmImport() {
    if (!checkRateLimit("import_confirm", RATE_LIMIT.maxImportsPerMinute)) {
      pushToast("Aguarde um momento antes de confirmar outra importação.", "danger");
      return;
    }
    const entries = importPreview.filter((entry) => entry.title && entry.amount).map((entry) => {
      const kind = entry.kind ?? "expense";
      return {
        title: sanitizeString(entry.title ?? "Lançamento importado"),
        amount: Number(entry.amount ?? 0),
        kind,
        dueDate: normalizeImportedDate(entry.dueDate ?? todayStr, todayStr),
        status: entry.status ?? (kind === "income" ? "a_receber_confirmado" : "a_pagar"),
        category: sanitizeString(entry.category ?? "Outros"),
        account: sanitizeString(entry.account ?? "Importado"),
        paidBy: entry.paidBy ?? "me",
        source: entry.source ? sanitizeString(entry.source) : undefined,
        note: "Importado via CSV; revisar contra a fonte",
        dataQuality: "completo" as DataQuality,
        isOfficial: true,
        origin: "csv" as const,
      };
    });
    if (entries.length > RATE_LIMIT.maxEntriesPerImport) {
      pushToast(`Máximo de ${RATE_LIMIT.maxEntriesPerImport} lançamentos por importação.`, "danger");
      return;
    }
    createBackup(state, `Antes da importação de ${entries.length} lançamentos`);
    try {
      financeCommandService.createEntries(state, entries, setState);
      logger.info("import", "Import confirmed", { entries: entries.length });
      analytics.task("confirm_import", { count: entries.length });
      setImportPreview([]);
      clearImportChunk();
      setFeedbackModal({ action: "Importar", category: "import" });
    } catch (err: any) {
      pushToast(err.message, "danger");
    }
  }

  if (!hydrated) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "#8c9199", fontSize: "1.1rem" }}>Carregando...</div>;
  }

  const title = NAV_GROUPS.flatMap((g) => g.items).find((item) => item.key === view)?.label ?? "Visão geral";

  return (
    <div className="app-shell">
      <aside className={classNames("sidebar", mobileNavOpen && "sidebar-open")} aria-label="Navegação principal">
        <div className="brand">
          <div className="brand-mark"><CircleDollarSign size={24} /></div>
          <div><strong>Meu Financeiro</strong><span>decisão antes do gráfico</span></div>
        </div>
        <nav>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="nav-section-label">{group.label}</div>
              {group.items.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className={classNames("nav-button", view === key && "nav-button-active")}
                  aria-current={view === key ? "page" : undefined}
                  onClick={() => { setView(key); setMobileNavOpen(false); }}
                >
                  <Icon size={18} /><span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-card">
          <span>Meta principal</span>
          <strong>{brl.format(state.goal)}</strong>
          <div className="mini-progress"><span style={{ width: `${summary.goalProgress}%` }} /></div>
          <small>{summary.goalProgress.toFixed(1).replace(".", ",")}% alcançado</small>
        </div>
        <button className="reset-button" aria-label="Restaurar dados iniciais" onClick={resetData}><RotateCcw size={16} /> Restaurar dados iniciais</button>
      </aside>
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Abrir menu" onClick={() => setMobileNavOpen(true)}><Menu /></button>
          <div className="page-heading"><span>Dashboard pessoal</span><h1>{title}</h1></div>
          <div className="topbar-actions">
            {/* Supabase Connection State and Auth */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginRight: "12px" }}>
              {user ? (
                <>
                  <div 
                    style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", color: "var(--success)", padding: "6px 12px", borderRadius: "var(--r-sm)" }}
                    title={`Conectado como ${user.email}`}
                  >
                    {syncStatus === "syncing" ? (
                      <RefreshCw size={14} className="spin" />
                    ) : syncStatus === "pending" ? (
                      <CloudLightning size={14} style={{ color: "var(--warning)" }} />
                    ) : (
                      <Cloud size={14} />
                    )}
                    <span style={{ fontWeight: 600 }}>Nuvem ativa</span>
                  </div>
                  <button 
                    className="secondary-button compact" 
                    title="Desconectar da conta"
                    style={{ height: "32px", padding: "0 10px" }}
                    onClick={async () => {
                      await supabase.auth.signOut();
                    }}
                  >
                    <LogOut size={14} />
                  </button>
                </>
              ) : (
                <button 
                  className="secondary-button compact" 
                  style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px" }}
                  onClick={() => setAuthOpen(true)}
                >
                  <CloudOff size={14} />
                  <span>Conectar nuvem</span>
                </button>
              )}
            </div>

            <select
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value)}
              className="period-select"
            >
              {periods.map((period) => (
                <option key={period} value={period}>
                  {monthLabel(period)}
                </option>
              ))}
            </select>
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lançamento" />
              {search && (
                <button 
                  className="icon-button" 
                  aria-label="Limpar busca" 
                  onClick={() => setSearch("")} 
                  style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "var(--muted)" }}
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <button className="primary-button" aria-label="Novo lançamento" onClick={() => setEntryModalOpen(true)}><Plus size={18} /><span>Novo lançamento</span></button>
          </div>
        </header>

        <div className="content-wrap">
          {view === "overview" && (
            <Overview
              state={state}
              summary={summary}
              cashflow={cashflow}
              freeNow={freeNow}
              currentIncome={currentIncome}
              currentExpenses={currentExpenses}
              settleEntry={settleEntry}
              selectedPeriod={selectedPeriod}
              safeToSpendData={safeToSpendData}
              recommendations={recommendations}
              health={health}
              onOpenSafeToSpendDetails={() => setCalculationMemoryMetric("safeToSpend")}
              onOpenCalculationMemory={(metric) => setCalculationMemoryMetric(metric)}
              safetyMargin={safetyMargin}
              currentClose={getMonthClose(selectedPeriod)}
              onNavigateQuality={() => setView("quality")}
            />
          )}
          {view === "receivables" && <Receivables entries={entriesFiltered.filter((entry) => entry.kind === "income")} settleEntry={settleEntry} removeEntry={removeEntry} onEdit={setEditingEntry} today={todayStr} onAddEntry={() => setEntryModalOpen(true)} updateEntry={updateEntry} setHistoryModalEntry={setHistoryModalEntry} />}
          {view === "cards" && <CardsPage entries={entriesFiltered.filter((entry) => entry.kind === "expense")} commitments={commitments} />}
          {view === "spending" && <SpendingPage entries={entriesFiltered.filter((entry) => entry.kind === "expense")} categorySpend={categorySpend} settleEntry={settleEntry} removeEntry={removeEntry} onEdit={setEditingEntry} today={todayStr} updateEntry={updateEntry} setHistoryModalEntry={setHistoryModalEntry} />}
          {view === "goal" && <GoalPage state={state} summary={summary} goalGap={goalGap} cashflow={cashflow} setState={setState} today={todayStr} />}
          {view === "imports" && (
            <ImportPage
              uploadedFiles={uploadedFiles}
              importPreview={importPreview}
              setImportPreview={setImportPreview}
              handleFile={handleFile}
              confirmImport={confirmImport}
              today={todayStr}
            />
          )}
          {view === "tools" && <ToolsPage state={state} setState={setState} pushToast={pushToast} onRestoreModal={() => setRestoreModalOpen(true)} />}
          {view === "logs" && <LogViewerPage />}
          {view === "quality" && <QualityPage state={state} selectedPeriod={selectedPeriod} pushToast={pushToast} />}
          {view === "corrections" && <CorrectionCenter state={state} selectedPeriod={selectedPeriod} entriesInPeriod={entriesFiltered} updateEntry={updateEntry} pushToast={pushToast} setState={setState} />}
          {view === "recovery_diagnostics" && (
            <RecoveryDiagnostics
              state={state}
              setState={setState}
              pushToast={pushToast}
            />
          )}
          {view === "all_entries" && (
            <AllEntries
              state={state}
              setState={setState}
              pushToast={pushToast}
              onEdit={setEditingEntry}
              setHistoryModalEntry={setHistoryModalEntry}
              removeEntry={removeEntry}
              today={todayStr}
            />
          )}
          {view === "calculation_audit" && (
            <CalculationAudit
              state={state}
              selectedPeriod={selectedPeriod}
            />
          )}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav" aria-label="Navegação mobile">
        {BOTTOM_NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={classNames("bottom-nav-item", view === key && "bottom-nav-active")}
            aria-current={view === key ? "page" : undefined}
            onClick={() => {
              if (key === "more") {
                setMobileNavOpen(true);
              } else {
                setView(key);
                setMobileNavOpen(false);
              }
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {entryModalOpen && <EntryModal onClose={() => setEntryModalOpen(false)} onSubmit={addEntry} today={todayStr} />}
      {editingEntry && <EntryModal onClose={() => setEditingEntry(null)} onSubmit={(entry) => { if (!Array.isArray(entry)) updateEntry(editingEntry.id, entry); }} initialEntry={editingEntry} today={todayStr} setHistoryModalEntry={setHistoryModalEntry} />}
      {calculationMemoryMetric && (
        <CalculationMemoryModal
          metric={calculationMemoryMetric}
          state={state}
          selectedPeriod={selectedPeriod}
          onClose={() => setCalculationMemoryMetric(null)}
        />
      )}
      {authOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}>
          <AuthPage onAuthSuccess={() => setAuthOpen(false)} />
        </div>
      )}
      {showMigrationWizard && user && (
        <MigrationWizard
          localState={state}
          userId={user.id}
          onComplete={() => { setShowMigrationWizard(false); setHydrated(true); }}
          onClose={() => setShowMigrationWizard(false)}
        />
      )}
      {connectionStatus === "offline" && <div className="offline-banner" role="alert">Você está offline. As alterações são salvas localmente.</div>}
      <ToastContainer toasts={toasts} dismiss={dismissToast} />
      {feedbackModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setFeedbackModal(null); }}>
          <div className="modal-card" style={{ maxWidth: "400px" }}>
            <div className="modal-heading">
              <div><span>Feedback rápido</span><h2>{feedbackModal.action}</h2></div>
              <button className="icon-button" onClick={() => setFeedbackModal(null)}><X size={20} /></button>
            </div>
            <div className="entry-form" style={{ gap: "16px", alignItems: "center", textAlign: "center" }}>
              <p style={{ fontSize: "14px", color: "var(--text-2)" }}>Isso foi fácil?</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                {["Muito fácil", "Fácil", "Confuso", "Difícil"].map((label) => (
                  <button key={label} className="secondary-button" onClick={() => {
                    analytics.track({ type: "feedback", category: feedbackModal.category, action: feedbackModal.action, metadata: { rating: label } });
                    setFeedbackModal(null);
                  }} style={{ minWidth: "100px" }}>{label}</button>
                ))}
              </div>
              <div className="modal-actions" style={{ borderTop: "none", paddingTop: 0, width: "100%", justifyContent: "center" }}>
                <button className="primary-button compact" onClick={() => setFeedbackModal(null)}>Pular</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {restoreModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setRestoreModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: "500px" }}>
            <div className="modal-heading">
              <div><span>Restaurar</span><h2>Restaurar dados de backup</h2></div>
              <button className="icon-button" onClick={() => setRestoreModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="entry-form">
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>Cole o conteúdo JSON de um backup completo ou faça upload do arquivo.</p>
              <textarea
                rows={8}
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                placeholder='{"exportedAt":"...","state":{"accounts":[...],"entries":[...]}}'
                style={{ fontFamily: "monospace", fontSize: "12px" }}
              />
              <input
                type="file" accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) { setRestoreJson(await file.text()); }
                  e.target.value = "";
                }}
              />
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setRestoreModalOpen(false)}>Cancelar</button>
                <button className="primary-button" onClick={() => {
                  const restored = importFromJSON(restoreJson);
                  if (restored) {
                    createBackup(state, "Antes da restauração");
                    setState(restored);
                    pushToast("Dados restaurados com sucesso.", "success");
                    setRestoreModalOpen(false);
                    setRestoreJson("");
                  } else {
                    pushToast("Arquivo inválido. Verifique o formato.", "danger");
                  }
                }}><Check size={16} />Restaurar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {historyModalEntry && (
        <EditHistoryModal entry={historyModalEntry} onClose={() => setHistoryModalEntry(null)} />
      )}
    </div>
  );
}

function EditHistoryModal({ entry, onClose }: { entry: FinanceEntry; onClose: () => void }) {
  const [auditHistory, setAuditHistory] = useState<AuditEntry[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAuditHistory(getAuditTrail(entry.id));
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [entry.id, onClose]);

  return (
    <div className="modal-backdrop" ref={backdropRef} role="dialog" aria-modal="true" onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: "600px" }}>
        <div className="modal-heading">
          <div>
            <span>Histórico de alterações</span>
            <h2>{entry.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="entry-form" style={{ gap: "12px", maxHeight: "60vh", overflowY: "auto" }}>
          {auditHistory.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "24px" }}>
              Nenhuma alteração registrada para este lançamento.
            </p>
          ) : (
            auditHistory.map((audit) => (
              <div key={audit.id} style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span className="status-badge" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>
                    {audit.action === "created" ? "Criado" : audit.action === "updated" ? "Editado" : audit.action === "deleted" ? "Excluído" : audit.action === "settled" ? "Baixa" : audit.action === "restored" ? "Restaurado" : audit.action === "reopened" ? "Reaberto" : audit.action}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: "11px" }}>{new Date(audit.timestamp).toLocaleString("pt-BR")}</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>v{audit.version}</div>
                {audit.changes.length > 0 && (
                  <div style={{ marginTop: "6px", display: "grid", gap: "4px" }}>
                    {audit.changes.map((c, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", alignItems: "baseline", fontSize: "11px" }}>
                        <strong style={{ minWidth: "80px", color: "var(--text-2)" }}>{fieldLabel(c.field)}</strong>
                        <span style={{ color: "var(--danger)", textDecoration: "line-through" }}>{String(c.oldValue ?? "vazio")}</span>
                        <span style={{ color: "var(--muted)" }}>→</span>
                        <span style={{ color: "var(--success)" }}>{String(c.newValue ?? "vazio")}</span>
                      </div>
                    ))}
                  </div>
                )}
                {audit.reason && <div style={{ marginTop: "4px", fontStyle: "italic", color: "var(--muted)", fontSize: "11px" }}>Motivo: {audit.reason}</div>}
              </div>
            ))
          )}
          <div className="modal-actions">
            <button className="primary-button" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    title: "Descrição",
    amount: "Valor",
    dueDate: "Vencimento",
    status: "Status",
    category: "Categoria",
    account: "Conta",
    paidBy: "Pagador",
    source: "Origem",
    note: "Obs.",
    paymentDate: "Data pagamento",
    installment: "Parcela",
    deleted: "Excluído",
    created: "Criação",
  };
  return map[field] ?? field;
}

function Overview({
  state,
  summary,
  cashflow,
  freeNow,
  currentIncome,
  currentExpenses,
  settleEntry,
  selectedPeriod,
  safeToSpendData,
  recommendations,
  health,
  onOpenSafeToSpendDetails,
  onOpenCalculationMemory,
  safetyMargin,
  currentClose,
  onNavigateQuality,
}: {
  state: FinanceState;
  summary: ReturnType<typeof getSummary>;
  cashflow: ReturnType<typeof monthSeries>;
  freeNow: number;
  currentIncome: number;
  currentExpenses: number;
  settleEntry: (entry: FinanceEntry) => void;
  selectedPeriod: string;
  safeToSpendData: ReturnType<typeof getSafeToSpend>;
  recommendations: Recommendation[];
  health: ReturnType<typeof getFinancialHealth>;
  onOpenSafeToSpendDetails: () => void;
  onOpenCalculationMemory: (metric: "patrimony" | "reserve" | "receivables" | "safeToSpend" | "expenses") => void;
  safetyMargin: number;
  currentClose?: MonthClose;
  onNavigateQuality?: () => void;
}) {
  const upcoming = state.entries
    .filter((entry) => entry.status !== "recebido" && entry.status !== "realizado" && isEntryInPeriod(entry, selectedPeriod))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  const hasUnicred = state.entries.some((entry) => entry.account?.toLowerCase() === "unicred");
  const hasNubank = state.entries.some((entry) => entry.account?.toLowerCase() === "nubank");
  const incomplete = !(hasUnicred && hasNubank);
  const pendingCards = [!hasNubank && "Nubank", !hasUnicred && "Unicred"].filter(Boolean).join(" e ");
  return (
    <>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px" }}>
        <div>
          <span className="eyebrow"><Gauge size={16} /> Decisão financeira de {monthLabel(selectedPeriod)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Quanto posso gastar com segurança hoje?</h2>
            <strong style={{ fontSize: "38px", fontWeight: 800, color: "var(--text)", display: "block", margin: "6px 0", letterSpacing: "-0.02em" }}>{brl.format(safeToSpendData.safeToSpend)}</strong>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.4" }}>
              Valor livre seguro até <strong>{formatDate(safeToSpendData.nextIncomeDate)}</strong>, considerando faturas, recebimentos confirmados e margem de segurança de {brl.format(safetyMargin)}.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button className="primary-button" style={{ height: "42px", padding: "0 18px", fontSize: "13px" }} onClick={onOpenSafeToSpendDetails}>Detalhamento do caixa</button>
            <button className="secondary-button" style={{ height: "42px", padding: "0 18px", fontSize: "13px" }} onClick={onNavigateQuality}>
              <Check size={16} /> {currentClose?.status === "closed" ? "Mês fechado" : "Fechar mês"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: "12px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", width: "100%", color: "var(--text-2)" }}>
          💡 <strong>Integrações:</strong> {incomplete ? `Falta importar faturas do ${pendingCards} para este período.` : "Nubank e Unicred totalmente importados e consolidados."}
        </div>
      </section>

      <section className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <StatCard
          title="Livre para gastar"
          value={brl.format(safeToSpendData.safeToSpend)}
          subtitle={`Seguro até ${formatDate(safeToSpendData.nextIncomeDate)}`}
          icon={CircleDollarSign}
          tone={safeToSpendData.safeToSpend >= 0 ? "positive" : "warning"}
          onClick={onOpenSafeToSpendDetails}
          tooltip="Caixa disponível + recebimentos confirmados até a data limite − contas e faturas − margem de segurança."
        />
        <StatCard 
          title="Patrimônio" 
          value={brl.format(summary.patrimony)} 
          subtitle="reserva + caixa disponível" 
          icon={WalletCards} 
          onClick={() => onOpenCalculationMemory("patrimony")}
          tooltip="Soma total do Caixa disponível e da Reserva guardada. Clique para ver a memória de cálculo."
        />
        <StatCard 
          title="Reserva" 
          value={brl.format(summary.reserve)} 
          subtitle="protegida, fora do consumo" 
          icon={ShieldCheck} 
          onClick={() => onOpenCalculationMemory("reserve")}
          tooltip="Dinheiro guardado e protegido, separado do caixa de consumo mensal. Clique para ver a memória de cálculo."
        />
        <StatCard 
          title="A receber" 
          value={brl.format(summary.pendingIncome)} 
          subtitle="confirmado e previsto" 
          icon={ArrowUpRight} 
          tone="positive" 
          onClick={() => onOpenCalculationMemory("receivables")}
          tooltip="Soma de recebimentos confirmados e previstos no período. Clique para ver a memória de cálculo."
        />
      </section>

      <section className="dashboard-grid dashboard-grid-primary">
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Fluxo projetado</span><h3>Entradas, compromissos e saldo mensal</h3></div><span className="soft-badge">Jul/26 — Jan/27</span></div>
          <div className="chart-wrap chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflow} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff7a18" stopOpacity={0.4}/><stop offset="95%" stopColor="#ff7a18" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid stroke="#2a2d31" vertical={false} />
                <XAxis dataKey="month" stroke="#8c9199" tickLine={false} axisLine={false} />
                <YAxis stroke="#8c9199" tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="income" name="Entradas" stroke="#ff7a18" fill="url(#incomeGradient)" strokeWidth={3} />
                <Line type="monotone" dataKey="expense" name="Compromissos" stroke="#d0d3d8" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: "16px", padding: "4px 16px 0", fontSize: "12px", color: "var(--muted)", flexWrap: "wrap" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "3px", background: "#ff7a18", borderRadius: "2px", display: "inline-block" }} />Entradas</span><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "3px", background: "#d0d3d8", borderRadius: "2px", display: "inline-block" }} />Compromissos</span></div>
          <div className="chart-note"><TrendingUp size={16} /><span>A projeção usa somente dados cadastrados. Nubank e Unicred já foram importados a partir dos lançamentos visíveis.</span></div>
        </article>

        <article className="panel goal-panel">
          <div className="panel-heading"><div><span>Meta principal</span><h3>R$ 10 mil</h3></div><Target size={22} /></div>
          <div className="goal-ring" style={{ "--progress": `${summary.goalProgress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{summary.goalProgress.toFixed(1).replace(".", ",")}%</strong><span>concluído</span></div>
          </div>
          <div className="goal-values"><span><small>Atual</small><strong>{brl.format(summary.patrimony)}</strong></span><span><small>Falta</small><strong>{brl.format(Math.max(0, state.goal - summary.patrimony))}</strong></span></div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><span>Próximos movimentos</span><h3>Agenda financeira</h3></div><CalendarClock size={20} /></div>
          <div className="timeline-list">
            {upcoming.map((entry) => (
              <div className="timeline-item" key={entry.id}>
                <div className={classNames("timeline-icon", entry.kind === "income" ? "income" : "expense")}>{entry.kind === "income" ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</div>
                <div><strong>{entry.title}</strong><span>{formatDate(entry.dueDate)} · {entry.category}{entry.installment ? ` · ${entry.installment}` : ""}</span></div>
                <div className="timeline-value"><strong>{entry.kind === "income" ? "+" : "−"}{brl.format(entry.amount)}</strong><button onClick={() => settleEntry(entry)} title="Dar baixa"><Check size={15} /></button></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading"><div><span>{monthLabel(selectedPeriod)}</span><h3>Resumo conhecido</h3></div><Banknote size={20} /></div>
          <div className="summary-bars">
            <div><span>Entradas previstas</span><strong>{brl.format(currentIncome)}</strong><div><i style={{ width: `${Math.min(100, (currentIncome / Math.max(currentIncome, currentExpenses, 1)) * 100)}%` }} /></div></div>
            <div><span>Compromissos conhecidos</span><strong>{brl.format(currentExpenses)}</strong><div><i className="bar-muted" style={{ width: `${Math.min(100, (currentExpenses / Math.max(currentIncome, currentExpenses, 1)) * 100)}%` }} /></div></div>
          </div>
          <div className="decision-box"><span>Resultado provisório</span><strong>{brl.format(currentIncome - currentExpenses)}</strong><small>antes de gastos cotidianos ainda não cadastrados</small></div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-primary" style={{ marginTop: "24px" }}>
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Motor de decisão</span><h3>Recomendações e alertas inteligentes</h3></div><Gauge size={20} /></div>
          {recommendations.length > 0 ? (
            <div className="recommendations-panel">
              {recommendations.map((rec) => (
                <div key={rec.id} className={`recommendation-card rec-${rec.category}`}>
                  <h4>💡 {rec.title}</h4>
                  <p>{rec.subtitle}</p>
                  <div className="data-note">{rec.dataDetails}</div>
                  <div className="action-box">🎯 Ação: {rec.action}</div>
                  <div className="impact-box">✨ Impacto: {rec.expectedImpact}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma recomendação no momento" description="Seu fluxo de caixa está equilibrado e sem riscos operacionais detectados. Continue monitorando regularmente." />
          )}
        </article>

        <article className="panel">
          <div className="panel-heading"><div><span>Diagnóstico</span><h3>Saúde financeira</h3></div><ShieldCheck size={20} /></div>
          <div className="health-box">
            <div className="health-header">
              <span className="health-title">Status Geral</span>
              <strong className="health-score" style={{ color: health.score >= 70 ? "var(--success)" : health.score >= 45 ? "var(--warning)" : "var(--danger)" }}>{health.score}/100</strong>
            </div>
            <div className="health-desc" style={{ borderLeftColor: health.score >= 70 ? "var(--success)" : health.score >= 45 ? "var(--warning)" : "var(--danger)" }}>
              <strong>{health.label}:</strong> {health.diagnostico}
            </div>
            <div className="health-dimensions">
              <div className="health-dim-item">
                <div className={`health-dim-dot ${health.liquidez}`} />
                <span>Liquidez</span>
              </div>
              <div className="health-dim-item">
                <div className={`health-dim-dot ${health.comprometimento}`} />
                <span>Comprometimento</span>
              </div>
              <div className="health-dim-item">
                <div className={`health-dim-dot ${health.previsibilidade}`} />
                <span>Previsibilidade</span>
              </div>
              <div className="health-dim-item">
                <div className={`health-dim-dot ${health.acumulacao}`} />
                <span>Meta</span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

function Receivables({ entries, settleEntry, removeEntry, onEdit, today, onAddEntry, updateEntry, setHistoryModalEntry }: {
  entries: FinanceEntry[];
  settleEntry: (entry: FinanceEntry) => void;
  removeEntry: (id: string) => void;
  onEdit: (entry: FinanceEntry) => void;
  today: string;
  onAddEntry: () => void;
  updateEntry?: (id: string, updated: Omit<FinanceEntry, "id">) => void;
  setHistoryModalEntry?: (entry: FinanceEntry) => void;
}) {
  const pending = entries.filter((entry) => entry.status !== "recebido");
  const overdue = pending.filter((entry) => entry.dueDate < today);
  const total = pending.reduce((sum, entry) => sum + entry.amount, 0);
  const bySource = [...new Map(entries.map((entry) => [entry.source ?? entry.title, 0])).keys()].map((source) => ({ source, amount: entries.filter((entry) => (entry.source ?? entry.title) === source).reduce((sum, entry) => sum + entry.amount, 0) })).sort((a, b) => b.amount - a.amount);
  return (
    <>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px", marginBottom: "24px" }}>
        <span className="eyebrow"><HandCoins size={16} /> Fluxo de Receitas</span>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Quanto tenho a receber no total?</h2>
        <strong style={{ fontSize: "38px", fontWeight: 800, color: "var(--text)", display: "block", margin: "6px 0", letterSpacing: "-0.02em" }}>{brl.format(total)}</strong>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.4" }}>
          Existem <strong>{pending.length}</strong> recebimentos pendentes neste período. Desses, <strong>{overdue.length}</strong> estão com a data de vencimento atrasada.
        </p>
      </section>

      <section className="stat-grid stat-grid-three">
        <StatCard 
          title="A receber" 
          value={brl.format(total)} 
          subtitle={`${pending.length} em aberto`} 
          icon={HandCoins} 
          tone="positive" 
          tooltip="Soma de recebimentos ainda não realizados neste período."
        />
        <StatCard 
          title="Atrasados" 
          value={brl.format(overdue.reduce((sum, entry) => sum + entry.amount, 0))} 
          subtitle={`${overdue.length} vencidos`} 
          icon={BellRing} 
          tone={overdue.length ? "warning" : "default"} 
          tooltip="Recebimentos cuja data de vencimento é anterior a hoje e que ainda não foram marcados como recebidos."
        />
        <StatCard 
          title="Fontes ativas" 
          value={String(bySource.length)} 
          subtitle="origens cadastradas" 
          icon={CircleDollarSign} 
          tooltip="Quantidade de clientes ou origens diferentes registradas."
        />
      </section>
      <section className="dashboard-grid dashboard-grid-primary">
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Calendário de recebimentos</span><h3>Quem paga, quanto e quando</h3></div><span className="soft-badge">Somente valores cadastrados</span></div>
          {entries.length === 0
            ? <EmptyState title="Nenhum recebimento registrado neste período" description="Adicione entradas para acompanhar o que está por vir." action={{ label: "Adicionar entrada", onClick: onAddEntry }} />
            : <EntryTable entries={entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate))} settleEntry={settleEntry} removeEntry={removeEntry} onEdit={onEdit} today={today} updateEntry={updateEntry} setHistoryModalEntry={setHistoryModalEntry} />}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span>Concentração</span><h3>Receita por origem</h3></div></div>
          {bySource.length === 0
            ? <EmptyState title="Sem origens cadastradas" description="As fontes de receita aparecem aqui quando você adicionar entradas." />
            : <div className="rank-list">{bySource.map((item, index) => <div key={item.source}><span><i>{index + 1}</i>{item.source}</span><strong>{brl.format(item.amount)}</strong></div>)}</div>}
        </article>
      </section>
    </>
  );
}

function CardsPage({ entries, commitments }: { entries: FinanceEntry[]; commitments: Array<{ month: string; value: number }> }) {
  const installments = entries.filter((entry) => entry.installment);
  const remaining = installments.filter((entry) => entry.status !== "realizado").reduce((sum, entry) => sum + entry.amount, 0);
  const macbook = entries.filter((entry) => entry.title === "MacBook" && entry.status !== "realizado").reduce((sum, entry) => sum + entry.amount, 0);
  const unicredEntries = entries.filter((entry) => entry.account?.toLowerCase() === "unicred");
  const nubankEntries = entries.filter((entry) => entry.account?.toLowerCase() === "nubank");
  const unicredOpen = unicredEntries.filter((entry) => entry.dueDate === "2026-08-11").reduce((sum, entry) => sum + entry.amount, 0);
  const nubankOpen = nubankEntries.filter((entry) => entry.dueDate === "2026-08-10").reduce((sum, entry) => sum + entry.amount, 0);
  const cardsOpen = unicredOpen + nubankOpen;
  const importedCount = Number(unicredEntries.length > 0) + Number(nubankEntries.length > 0);
  return (
    <>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px" }}>
        <span className="eyebrow"><CreditCard size={16} /> Faturas e Parcelas</span>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Qual é o valor total de faturas em aberto?</h2>
            <strong style={{ fontSize: "38px", fontWeight: 800, color: "var(--text)", display: "block", margin: "6px 0", letterSpacing: "-0.02em" }}>{brl.format(cardsOpen)}</strong>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.4" }}>
              Nubank e Unicred importados a partir de extratos. O pagamento Nubank de R$ 482,12 foi desconsiderado de acordo com a sua diretriz.
            </p>
          </div>
          <div className="card-stack" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div className="credit-card nubank" style={{ padding: "8px 16px", borderRadius: "var(--r-md)", background: "#1a1324", border: "1px solid rgba(130,76,246,0.2)" }}><small style={{ color: "rgba(130,76,246,0.8)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>Nubank</small><strong style={{ display: "block", fontSize: "16px", margin: "2px 0" }}>{brl.format(nubankOpen)}</strong><span style={{ fontSize: "10px", color: "var(--muted)" }}>Fecha 31 · Vence 10/08</span></div>
            <div className="credit-card unicred" style={{ padding: "8px 16px", borderRadius: "var(--r-md)", background: "#0c181a", border: "1px solid rgba(0,180,216,0.2)" }}><small style={{ color: "rgba(0,180,216,0.8)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>Unicred</small><strong style={{ display: "block", fontSize: "16px", margin: "2px 0" }}>{brl.format(unicredOpen)}</strong><span style={{ fontSize: "10px", color: "var(--muted)" }}>Fecha 01 · Vence 11/08</span></div>
          </div>
        </div>
      </section>

      <section className="stat-grid stat-grid-three">
        <StatCard 
          title="Comprometido futuro" 
          value={brl.format(remaining)} 
          subtitle="valor futuro parcelado" 
          icon={WalletCards} 
          tone="warning" 
          tooltip="Total de parcelas futuras cadastradas."
        />
        <StatCard 
          title="MacBook restante" 
          value={brl.format(macbook)} 
          subtitle={macbook > 0 ? `${entries.filter((e) => e.title === "MacBook" && e.status !== "realizado").length} parcelas restantes` : "Quitado"} 
          icon={CreditCard} 
          tooltip="Saldo devedor restante estimado para a compra do MacBook."
        />
        <StatCard 
          title="Faturas importadas" 
          value={`${importedCount} de 2`} 
          subtitle={importedCount === 1 ? "1 de 2 no período" : "Nubank e Unicred"} 
          icon={FileSpreadsheet} 
          tone={importedCount < 2 ? "warning" : "positive"} 
          tooltip="Faturas do Nubank e Unicred importadas no período atual."
        />
      </section>
      <section className="dashboard-grid dashboard-grid-primary">
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Calendário futuro</span><h3>Quanto já está comprometido por mês</h3></div></div>
          <div className="chart-wrap chart-large"><ResponsiveContainer width="100%" height="100%"><BarChart data={commitments} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}><CartesianGrid stroke="#2a2d31" vertical={false}/><XAxis dataKey="month" stroke="#8c9199" tickLine={false} axisLine={false}/><YAxis stroke="#8c9199" tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`}/><Tooltip content={<ChartTooltip />} /><Bar dataKey="value" name="Comprometido" fill="#ff7a18" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span>Parcelas</span><h3>Compromissos ativos</h3></div></div>
          <div className="compact-list">{installments.slice(0, 10).map((entry) => <div key={entry.id}><span><strong>{entry.title}</strong><small>{formatDate(entry.dueDate)} · {entry.installment}</small></span><b>{brl.format(entry.amount)}</b></div>)}</div>
        </article>
      </section>
    </>
  );
}

function SpendingPage({ entries, categorySpend, settleEntry, removeEntry, onEdit, today, updateEntry, setHistoryModalEntry }: {
  entries: FinanceEntry[];
  categorySpend: Array<{ name: string; value: number }>;
  settleEntry: (entry: FinanceEntry) => void;
  removeEntry: (id: string) => void;
  onEdit: (entry: FinanceEntry) => void;
  today: string;
  updateEntry?: (id: string, updated: Omit<FinanceEntry, "id">) => void;
  setHistoryModalEntry?: (entry: FinanceEntry) => void;
}) {
  const total = entries.filter((entry) => entry.paidBy !== "father").reduce((sum, entry) => sum + entry.amount, 0);
  const paidByFather = entries.filter((entry) => entry.paidBy === "father").reduce((sum, entry) => sum + entry.amount, 0);
  const sorted = [...categorySpend].sort((a, b) => b.value - a.value);
  const maxVal = sorted[0]?.value ?? 1;
  return (
    <>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px", marginBottom: "24px" }}>
        <span className="eyebrow"><ReceiptText size={16} /> Análise de Despesas</span>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Quanto foi comprometido este mês?</h2>
        <strong style={{ fontSize: "38px", fontWeight: 800, color: "var(--text)", display: "block", margin: "6px 0", letterSpacing: "-0.02em" }}>{brl.format(total)}</strong>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.4" }}>
          Total acumulado de despesas e parcelas no período de caixa atual, excluindo pagamentos financiados por terceiros.
        </p>
      </section>

      <section className="stat-grid stat-grid-three">
        <StatCard 
          title="Comprometido" 
          value={brl.format(total)} 
          subtitle="atuais e futuros" 
          icon={ReceiptText} 
          tone="warning" 
          tooltip="Total de despesas e parcelas vencendo neste período."
        />
        <StatCard 
          title="Pago por você" 
          value={brl.format(total)} 
          subtitle="caixa operacional" 
          icon={ArrowDownRight} 
          tooltip="Despesas pagas ou a pagar diretamente pelo seu caixa."
        />
        <StatCard 
          title="Pago pelo seu pai" 
          value={brl.format(paidByFather)} 
          subtitle="sem impacto no caixa" 
          icon={ShieldCheck} 
          tooltip="Despesas de custo de vida custeadas pelo seu pai (sem impacto no seu caixa)."
        />
      </section>
      <section className="dashboard-grid dashboard-grid-primary">
        <article className="panel">
          <div className="panel-heading"><div><span>Composição</span><h3>Gastos por categoria</h3></div><span className="soft-badge">{sorted.length} categorias</span></div>
          <div className="hbar-list">
            {sorted.map((item, index) => (
              <div className="hbar-item" key={item.name}>
                <div className="hbar-header">
                  <span>{item.name}</span>
                  <div>
                    <strong>{brl.format(item.value)}</strong>
                    <span className="hbar-pct">({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)</span>
                  </div>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(item.value / maxVal) * 100}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Lançamentos</span><h3>Despesas e responsáveis</h3></div></div>
          <EntryTable entries={entries.sort((a, b) => a.dueDate.localeCompare(b.dueDate))} settleEntry={settleEntry} removeEntry={removeEntry} onEdit={onEdit} today={today} updateEntry={updateEntry} setHistoryModalEntry={setHistoryModalEntry} />
        </article>
      </section>
    </>
  );
}

function GoalPage({ state, summary, goalGap, cashflow, setState, today }: { state: FinanceState; summary: ReturnType<typeof getSummary>; goalGap: number; cashflow: ReturnType<typeof monthSeries>; setState: React.Dispatch<React.SetStateAction<FinanceState>>; today: string }) {
  const [monthlySaving, setMonthlySaving] = useState(500);
  const months = monthlySaving > 0 ? Math.ceil(goalGap / monthlySaving) : 0;
  const scenarios = getGoalScenarios(state, today);

  function buildScenarioData(rate: number) {
    const rows: Array<{ month: string; value: number }> = [];
    let running = summary.patrimony;
    const [year, month] = today.split("-").map(Number);
    for (let i = 0; i < 24 && running < state.goal; i++) {
      const d = new Date(year, month - 1 + i, 1);
      const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d);
      running = Math.min(state.goal, running + rate);
      rows.push({ month: label, value: running });
    }
    return rows;
  }

  const consData = buildScenarioData(scenarios[0]?.savingsRate ?? 100);
  const probData = buildScenarioData(scenarios[1]?.savingsRate ?? 250);
  const otimData = buildScenarioData(scenarios[2]?.savingsRate ?? 400);

  const maxMonths = Math.max(consData.length, probData.length, otimData.length);
  const chartData: Array<{ month: string; conservador?: number; provavel?: number; otimista?: number }> = [];
  for (let i = 0; i < maxMonths; i++) {
    chartData.push({
      month: consData[i]?.month || probData[i]?.month || otimData[i]?.month || "",
      conservador: consData[i]?.value,
      provavel: probData[i]?.value,
      otimista: otimData[i]?.value,
    });
  }

  return (
    <>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px" }}>
        <span className="eyebrow"><Target size={16} /> Construção de Patrimônio</span>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Quanto falta para atingir a meta principal?</h2>
            <strong style={{ fontSize: "38px", fontWeight: 800, color: "var(--text)", display: "block", margin: "6px 0", letterSpacing: "-0.02em" }}>{brl.format(goalGap)}</strong>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.4" }}>
              Faltam {brl.format(goalGap)} para atingir sua meta de {brl.format(state.goal)}. Você já completou {summary.goalProgress.toFixed(1).replace(".", ",")}% do caminho.
            </p>
          </div>
          <div className="goal-number" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
            <small style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Patrimônio atual</small>
            <strong style={{ fontSize: "24px", color: "var(--text)" }}>{brl.format(summary.patrimony)}</strong>
          </div>
        </div>
      </section>
      <section className="dashboard-grid dashboard-grid-primary">
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Trajetória</span><h3>Projeção por cenário até R$ {(state.goal / 1000).toFixed(0)}k</h3></div><span className="soft-badge">3 cenários</span></div>
          <div className="chart-wrap chart-large"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}><defs><linearGradient id="goalGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/><stop offset="95%" stopColor="#f97316" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#1c1f27" vertical={false}/><XAxis dataKey="month" stroke="#5a5f6d" tickLine={false} axisLine={false} tick={{ fontSize: 11 }}/><YAxis stroke="#5a5f6d" tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }}/><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey="otimista" name="Otimista" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="6 3" connectNulls /><Line type="monotone" dataKey="provavel" name="Provável" stroke="#f97316" strokeWidth={2.5} dot={false} connectNulls /><Line type="monotone" dataKey="conservador" name="Conservador" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="3 3" connectNulls /></LineChart></ResponsiveContainer></div>
          <div style={{ display: "flex", gap: "16px", padding: "8px 16px", fontSize: "12px", color: "var(--muted)", flexWrap: "wrap" }}><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "3px", background: "#ef4444", borderRadius: "2px", display: "inline-block" }} />Conservador</span><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "3px", background: "#f97316", borderRadius: "2px", display: "inline-block" }} />Provável</span><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "3px", background: "#22c55e", borderRadius: "2px", display: "inline-block" }} />Otimista</span></div>
          <div className="chart-note"><TrendingUp size={15} /><span>Cada cenário usa uma premissa de aporte mensal diferente. Use o simulador ao lado para ajustar o prazo.</span></div>
        </article>
        <article className="panel simulator-panel">
          <div className="panel-heading"><div><span>Simulador</span><h3>Quanto guardar por mês?</h3></div></div>
          <label className="range-label"><span>Aporte mensal</span><strong>{brl.format(monthlySaving)}</strong></label>
          <input className="range" type="range" min="100" max="2000" step="50" value={monthlySaving} onChange={(event) => setMonthlySaving(Number(event.target.value))} />
          <div className="simulation-result"><small>Prazo aproximado</small><strong>{months} {months === 1 ? "mês" : "meses"}</strong><span>sem considerar rendimento ou mudanças de renda</span></div>
          <label className="goal-input"><span>Editar meta</span><input type="number" min="1" value={state.goal} onChange={(event) => setState((previous) => ({ ...previous, goal: Number(event.target.value) || 0 }))} /></label>
        </article>
      </section>

      <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr", marginTop: "24px" }}>
        <article className="panel">
          <div className="panel-heading"><div><span>Cenários de Alcance</span><h3>Previsão realista para a meta de {brl.format(state.goal)}</h3></div><Target size={20} /></div>
          <div className="scenarios-grid">
            {scenarios.map((sc) => (
              <div key={sc.scenario} className={`scenario-card ${sc.scenario}`}>
                <div className="scenario-header">
                  <span className="scenario-title">{sc.scenario}</span>
                  <span className="scenario-badge">{sc.scenario}</span>
                </div>
                <div className="scenario-value">{sc.targetMonth}</div>
                <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                  Aporte: {brl.format(sc.savingsRate)}/mês ({sc.monthsCount} {sc.monthsCount === 1 ? "mês" : "meses"})
                </div>
                <p className="scenario-desc">{sc.premissa}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function ImportPage({ uploadedFiles, importPreview, setImportPreview, handleFile, confirmImport, today }: {
  uploadedFiles: string[];
  importPreview: Array<Partial<FinanceEntry>>;
  setImportPreview: React.Dispatch<React.SetStateAction<Array<Partial<FinanceEntry>>>>;
  handleFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  confirmImport: () => void;
  today: string;
}) {
  return (
    <>
      <section className="decision-hero compact-hero">
        <div><span className="eyebrow"><Upload size={16} /> Entrada de dados</span><h2>Importe o arquivo, revise os lançamentos e só então confirme.</h2><p>CSV é lido diretamente nesta versão. PDFs e prints são armazenados apenas na sessão para conferência manual; a extração automática será a próxima camada.</p></div>
        <label className="upload-button"><Upload size={22} /><span>Selecionar arquivos</span><small>CSV, PDF, PNG ou JPG</small><input type="file" multiple accept=".csv,.pdf,.png,.jpg,.jpeg" onChange={handleFile} /></label>
      </section>
      <section className="dashboard-grid dashboard-grid-primary">
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Pré-visualização</span><h3>Revise antes de importar</h3></div>{importPreview.length > 0 && <button className="primary-button compact" onClick={confirmImport}><Check size={16} />Confirmar {importPreview.length}</button>}</div>
          {importPreview.length ? (
            <div className="import-table-wrap"><table className="data-table"><thead><tr><th>Descrição</th><th>Data</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th /></tr></thead><tbody>{importPreview.map((entry, index) => <tr key={index}><td><input value={entry.title ?? ""} onChange={(event) => setImportPreview((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} /></td><td><input type="date" value={normalizeImportedDate(entry.dueDate ?? today, today)} onChange={(event) => setImportPreview((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, dueDate: event.target.value } : row))} /></td><td><select value={entry.kind ?? "expense"} onChange={(event) => setImportPreview((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, kind: event.target.value as FinanceEntry["kind"] } : row))}><option value="expense">Despesa</option><option value="income">Entrada</option></select></td><td><input value={entry.category ?? "Outros"} onChange={(event) => setImportPreview((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, category: event.target.value } : row))} /></td><td><input type="number" step="0.01" value={entry.amount ?? 0} onChange={(event) => setImportPreview((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, amount: Number(event.target.value) } : row))} /></td><td><button className="icon-button danger-icon" onClick={() => setImportPreview((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
          ) : <EmptyState title="Nenhum CSV em revisão" description="Envie um CSV com colunas como data, descrição, valor, tipo e categoria." />}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span>Arquivos enviados</span><h3>Sessão atual</h3></div><FileSpreadsheet size={20} /></div>
          {uploadedFiles.length ? <div className="file-list">{uploadedFiles.map((file, index) => <div key={`${file}-${index}`}><FileSpreadsheet size={17}/><span>{file}</span></div>)}</div> : <EmptyState title="Nenhum arquivo" description="Os nomes dos arquivos enviados aparecerão aqui." />}
          <div className="privacy-note"><ShieldCheck size={18}/><div><strong>Privacidade da V1</strong><span>Os dados ficam no armazenamento local deste navegador. Não há envio para um servidor.</span></div></div>
        </article>
      </section>
    </>
  );
}

function EntryTable({ entries, settleEntry, removeEntry, onEdit, today, setHistoryModalEntry, updateEntry }: {
  entries: FinanceEntry[];
  settleEntry: (entry: FinanceEntry) => void;
  removeEntry: (id: string) => void;
  onEdit: (entry: FinanceEntry) => void;
  today: string;
  setHistoryModalEntry?: (entry: FinanceEntry) => void;
  updateEntry?: (id: string, updated: Omit<FinanceEntry, "id">) => void;
}) {
  const [page, setPage] = useState(0);
  const [editingCell, setEditingCell] = useState<{ id: string; field: "category" | "status" | "paidBy" } | null>(null);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = entries.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  if (!entries.length) return <EmptyState title="Nenhum lançamento encontrado" description="Tente remover o filtro de busca ou adicionar um novo lançamento." />;

  function handleInlineUpdate(id: string, field: string, value: string) {
    if (!updateEntry) return;
    const original = entries.find((e) => e.id === id);
    if (!original) return;
    updateEntry(id, { ...original, [field]: value });
    setEditingCell(null);
  }

  const CATEGORIES = ["Alimentação", "Tecnologia/IA", "Educação", "Saúde", "Transporte", "Lazer", "Mercado", "Streaming", "Seguros", "Outros"];

  return (
    <div>
      <div className="table-wrap">
        <table className="data-table" role="table" aria-label="Lista de lançamentos">
          <thead><tr><th scope="col">Descrição</th><th scope="col">Vencimento</th><th scope="col">Categoria</th><th scope="col">Confiança</th><th scope="col">Status</th><th scope="col">Valor</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>
            {paginated.map((entry) => (
              <tr key={entry.id}>
                <td><div className="table-title"><span className={classNames("entry-dot", entry.kind)} /><div><strong>{entry.title}</strong><small>{entry.installment ?? entry.source ?? entry.account ?? "Lançamento"}{entry.estimatedDate ? " · data estimada" : ""}</small></div></div></td>
                <td>{formatDate(entry.dueDate)}</td>
                <td>
                  {editingCell?.id === entry.id && editingCell?.field === "category" ? (
                    <select
                      value={entry.category}
                      onChange={(e) => handleInlineUpdate(entry.id, "category", e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      autoFocus
                      style={{ fontSize: "12px", padding: "2px 4px", maxWidth: "120px" }}
                    >
                      {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  ) : (
                    <span style={{ cursor: updateEntry ? "pointer" : undefined }} onClick={() => updateEntry && setEditingCell({ id: entry.id, field: "category" })} title="Clique para editar">
                      {entry.category}
                    </span>
                  )}
                </td>
                <td><div style={{ display: "flex", gap: "6px" }}>{entry.dataQuality && <span className={classNames("quality-badge", entry.dataQuality)}>{entry.dataQuality}</span>}{entry.isOfficial && <span className="official-badge">Oficial</span>}</div></td>
                <td>
                  {editingCell?.id === entry.id && editingCell?.field === "status" ? (
                    <select
                      value={entry.status}
                      onChange={(e) => handleInlineUpdate(entry.id, "status", e.target.value)}
                      onBlur={() => setEditingCell(null)}
                      autoFocus
                      style={{ fontSize: "12px", padding: "2px 4px" }}
                    >
                      {entry.kind === "income" ? (
                        <>
                          <option value="a_receber_confirmado">Confirmado</option>
                          <option value="a_receber_incerto">Previsto</option>
                          <option value="recebido">Recebido</option>
                        </>
                      ) : (
                        <>
                          <option value="a_pagar">Pendente</option>
                          <option value="projetado">Previsto</option>
                          <option value="realizado">Pago</option>
                        </>
                      )}
                    </select>
                  ) : (
                    <span className={classNames("status-badge", statusClass(entry, today))} style={{ cursor: updateEntry ? "pointer" : undefined }} onClick={() => updateEntry && setEditingCell({ id: entry.id, field: "status" })} title="Clique para editar">
                      {statusLabel(entry, today)}
                    </span>
                  )}
                </td>
                <td className={entry.kind === "income" ? "positive-text" : "negative-text"}>{entry.kind === "income" ? "+" : "−"}{brl.format(entry.amount)}</td>
                <td>
                  <div className="row-actions">
                    {(entry.status !== "recebido" && entry.status !== "realizado") && <button className="icon-button" aria-label={`Confirmar ${entry.kind === "income" ? "recebimento" : "pagamento"} de ${entry.title}`} onClick={() => settleEntry(entry)}><Check size={16}/></button>}
                    <button className="icon-button" aria-label={`Editar ${entry.title}`} onClick={() => onEdit(entry)}><Pencil size={15}/></button>
                    {setHistoryModalEntry && <button className="icon-button" aria-label={`Histórico de ${entry.title}`} onClick={() => setHistoryModalEntry(entry)}><History size={15}/></button>}
                    <button className="icon-button danger-icon" aria-label={`Excluir ${entry.title}`} onClick={() => removeEntry(entry.id)}><Trash2 size={15}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length > pageSize && (
        <div className="pagination">
          <span className="pagination-info">{entries.length} lançamentos · Página {currentPage + 1} de {totalPages}</span>
          <button disabled={currentPage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
            const p = start + i;
            return <button key={p} className={p === currentPage ? "active" : ""} onClick={() => setPage(p)}>{p + 1}</button>;
          })}
          <button disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Próximo</button>
        </div>
      )}
    </div>
  );
}

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1 + months, 1);
  const maxDays = new Date(y, m + months, 0).getDate();
  const targetDay = Math.min(d, maxDays);
  const targetMonth = String(date.getMonth() + 1).padStart(2, "0");
  const targetYear = date.getFullYear();
  return `${targetYear}-${targetMonth}-${String(targetDay).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const targetMonth = String(date.getMonth() + 1).padStart(2, "0");
  const targetYear = date.getFullYear();
  const targetDay = String(date.getDate()).padStart(2, "0");
  return `${targetYear}-${targetMonth}-${targetDay}`;
}

function EntryModal({ onClose, onSubmit, initialEntry, today, setHistoryModalEntry }: {
  onClose: () => void;
  onSubmit: (entry: Omit<FinanceEntry, "id"> | Omit<FinanceEntry, "id">[]) => void;
  initialEntry?: FinanceEntry;
  today: string;
  setHistoryModalEntry?: (entry: FinanceEntry) => void;
}) {
  const [kind, setKind] = useState<FinanceEntry["kind"]>(initialEntry?.kind ?? "expense");
  const [showAdvanced, setShowAdvanced] = useState(!!initialEntry?.installment || !!initialEntry?.note);
  const [repeatType, setRepeatType] = useState<"single" | "installment" | "recurring">("single");
  const [amount, setAmount] = useState<string>(initialEntry?.amount ? String(initialEntry.amount) : "");
  const [installmentsCount, setInstallmentsCount] = useState(12);
  const [currentInstallment, setCurrentInstallment] = useState(1);
  const [totalAmount, setTotalAmount] = useState<number | "">("");

  const backdropRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstFocusRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sync Amount and Total Amount logic
  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (repeatType === "installment" && val !== "") {
      const parsed = Number(val);
      if (!isNaN(parsed)) {
        setTotalAmount(Number((parsed * installmentsCount).toFixed(2)));
      }
    }
  };

  const handleTotalAmountChange = (val: number | "") => {
    setTotalAmount(val);
    if (typeof val === "number" && installmentsCount > 0) {
      setAmount(String(Number((val / installmentsCount).toFixed(2))));
    }
  };

  const handleInstallmentsCountChange = (count: number) => {
    setInstallmentsCount(count);
    if (totalAmount && count > 0) {
      setAmount(String(Number((Number(totalAmount) / count).toFixed(2))));
    } else if (amount && count > 0) {
      const parsed = Number(amount);
      if (!isNaN(parsed)) {
        setTotalAmount(Number((parsed * count).toFixed(2)));
      }
    }
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const titleVal = String(form.get("title") || "Novo lançamento");
    const amountVal = Number(amount || 0);
    const dateVal = String(form.get("date") || today);
    const categoryVal = String(form.get("category") || "Outros");
    const sourceVal = kind === "income" ? String(form.get("source") || "") : undefined;
    const accountVal = String(form.get("account") || "Pix / carteira");
    const paidByVal = kind === "expense" ? (String(form.get("paidBy") || "me") as FinanceEntry["paidBy"]) : undefined;
    const noteVal = String(form.get("note") || "") || undefined;

    const baseEntry = {
      title: titleVal,
      amount: amountVal,
      kind,
      category: categoryVal,
      source: sourceVal,
      account: accountVal,
      paidBy: paidByVal,
      note: noteVal,
      dataQuality: initialEntry ? initialEntry.dataQuality : "completo" as DataQuality,
      isOfficial: initialEntry ? initialEntry.isOfficial : true
    };

    if (initialEntry) {
      onSubmit({
        ...baseEntry,
        dueDate: dateVal,
        status: form.get("status") as EntryStatus,
        installment: String(form.get("installment") || "") || undefined
      });
      return;
    }

    if (repeatType === "installment") {
      const generated: Omit<FinanceEntry, "id">[] = [];
      for (let i = currentInstallment; i <= installmentsCount; i++) {
        const dueDate = addMonths(dateVal, i - currentInstallment);
        generated.push({
          ...baseEntry,
          title: `${titleVal} ${i}/${installmentsCount}`,
          dueDate,
          installment: `${i}/${installmentsCount}`,
          status: kind === "income" ? "a_receber_confirmado" : "a_pagar"
        });
      }
      onSubmit(generated);
    } else if (repeatType === "recurring") {
      const generated: Omit<FinanceEntry, "id">[] = [];
      const endDate = String(form.get("endDate"));
      const frequency = String(form.get("frequency"));
      
      let currentDate = dateVal;
      let count = 1;
      while (currentDate <= endDate) {
        generated.push({
          ...baseEntry,
          title: `${titleVal} (Recorrente)`,
          dueDate: currentDate,
          note: `Recorrente #${count}. ${baseEntry.note || ""}`.trim(),
          status: kind === "income" ? "a_receber_confirmado" : "a_pagar"
        });
        currentDate = frequency === "weekly" ? addDays(currentDate, 7) : addMonths(currentDate, 1);
        count++;
        if (count > 100) break; // Safety limit
      }
      onSubmit(generated);
    } else {
      onSubmit({
        ...baseEntry,
        dueDate: dateVal,
        status: kind === "income" ? "a_receber_confirmado" : "a_pagar",
        installment: String(form.get("installment") || "") || undefined
      });
    }
  }

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="modal-card">
        <div className="modal-heading">
          <div>
            <span>{initialEntry ? "Editar lançamento" : "Novo lançamento"}</span>
            <h2 id="modal-title">{initialEntry ? "Ajuste os dados conforme necessário" : "Registre antes de esquecer"}</h2>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {initialEntry && setHistoryModalEntry && (
              <button type="button" className="secondary-button" style={{ height: "32px", fontSize: "11px" }} onClick={() => setHistoryModalEntry(initialEntry)}><History size={14} /> Histórico</button>
            )}
            <button ref={firstFocusRef} className="icon-button" aria-label="Fechar" onClick={onClose}><X size={20}/></button>
          </div>
        </div>
        <div className="type-toggle" role="group" aria-label="Tipo de lançamento">
          <button type="button" className={kind === "income" ? "active" : ""} aria-pressed={kind === "income"} onClick={() => setKind("income")}><ArrowUpRight size={17}/>Entrada</button>
          <button type="button" className={kind === "expense" ? "active" : ""} aria-pressed={kind === "expense"} onClick={() => setKind("expense")}><ArrowDownRight size={17}/>Despesa</button>
        </div>
        <form onSubmit={submit} className="entry-form">
          <label htmlFor="field-title">
            <span>Descrição</span>
            <input id="field-title" name="title" required defaultValue={initialEntry?.title} placeholder={kind === "income" ? "Ex.: Pagamento de artigo" : "Ex.: Parcela do notebook"}/>
          </label>
          <div className="form-row">
            <label htmlFor="field-amount">
              <span>{repeatType === "installment" ? "Valor da Parcela (R$)" : "Valor (R$)"}</span>
              <input id="field-amount" name="amount" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => handleAmountChange(e.target.value)} placeholder="0,00" />
            </label>
            <label htmlFor="field-date">
              <span>Data</span>
              <input id="field-date" name="date" type="date" defaultValue={initialEntry?.dueDate ?? today} required />
            </label>
          </div>
          <div className="form-row">
            <label htmlFor="field-category">
              <span>Categoria</span>
              <input id="field-category" name="category" defaultValue={initialEntry?.category} placeholder={kind === "income" ? "Artigos" : "Tecnologia"}/>
            </label>
            <label htmlFor="field-account">
              <span>{kind === "income" ? "Pagador/origem" : "Conta/cartão"}</span>
              <input id="field-account" name={kind === "income" ? "source" : "account"} defaultValue={kind === "income" ? (initialEntry?.source ?? "") : (initialEntry?.account ?? "")} placeholder={kind === "income" ? "Ex.: Cliente" : "Ex.: Nubank"}/>
            </label>
          </div>
          {initialEntry && (
            <label htmlFor="field-status">
              <span>Status</span>
              <select id="field-status" name="status" defaultValue={initialEntry.status}>
                {kind === "income" ? (
                  <>
                    <option value="a_receber_confirmado">Pendente / Confirmado</option>
                    <option value="a_receber_incerto">Previsto / Incerto</option>
                    <option value="recebido">Recebido</option>
                  </>
                ) : (
                  <>
                    <option value="a_pagar">Pendente</option>
                    <option value="projetado">Previsto</option>
                    <option value="realizado">Pago</option>
                  </>
                )}
              </select>
            </label>
          )}

          {/* Repeat Options (only on create mode) */}
          {!initialEntry && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)" }}>Repetição</span>
              <div className="type-toggle" role="group" aria-label="Tipo de repetição" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "2px", height: "36px" }}>
                <button type="button" className={repeatType === "single" ? "active" : ""} onClick={() => setRepeatType("single")} style={{ height: "30px", fontSize: "11px" }}>Único</button>
                <button type="button" className={repeatType === "installment" ? "active" : ""} onClick={() => setRepeatType("installment")} style={{ height: "30px", fontSize: "11px" }}>Parcelado</button>
                <button type="button" className={repeatType === "recurring" ? "active" : ""} onClick={() => setRepeatType("recurring")} style={{ height: "30px", fontSize: "11px" }}>Recorrente</button>
              </div>
            </div>
          )}

          {/* Collapsible Installments Inputs */}
          {repeatType === "installment" && !initialEntry && (
            <div className="form-advanced-section" style={{ display: "grid", gap: "var(--sp-3)", padding: "var(--sp-4)", border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", borderRadius: "var(--r-md)", marginTop: "8px" }}>
              <div className="form-row">
                <label htmlFor="field-installments-count">
                  <span>Qtd de parcelas</span>
                  <input 
                    id="field-installments-count" 
                    type="number" 
                    min="2" 
                    max="72" 
                    value={installmentsCount} 
                    onChange={(e) => handleInstallmentsCountChange(Number(e.target.value))} 
                  />
                </label>
                <label htmlFor="field-current-installment">
                  <span>Parcela atual</span>
                  <input 
                    id="field-current-installment" 
                    type="number" 
                    min="1" 
                    max={installmentsCount} 
                    value={currentInstallment} 
                    onChange={(e) => setCurrentInstallment(Number(e.target.value))} 
                  />
                </label>
              </div>
              <div className="form-row">
                <label htmlFor="field-total-amount">
                  <span>Valor total da compra (R$)</span>
                  <input 
                    id="field-total-amount" 
                    type="number" 
                    step="0.01" 
                    placeholder="Valor total" 
                    value={totalAmount} 
                    onChange={(e) => handleTotalAmountChange(e.target.value === "" ? "" : Number(e.target.value))} 
                  />
                </label>
              </div>
            </div>
          )}

          {/* Collapsible Recurring Inputs */}
          {repeatType === "recurring" && !initialEntry && (
            <div className="form-advanced-section" style={{ display: "grid", gap: "var(--sp-3)", padding: "var(--sp-4)", border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", borderRadius: "var(--r-md)", marginTop: "8px" }}>
              <div className="form-row">
                <label htmlFor="field-frequency">
                  <span>Frequência</span>
                  <select id="field-frequency" name="frequency" defaultValue="monthly">
                    <option value="monthly">Mensal</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </label>
                <label htmlFor="field-end-date">
                  <span>Data final limite</span>
                  <input id="field-end-date" name="endDate" type="date" required defaultValue={addMonths(today, 6)} />
                </label>
              </div>
            </div>
          )}

          {/* Protected month warning */}
          {initialEntry && (() => {
            const period = initialEntry.dueDate.slice(0, 7);
            const mc = getMonthClose(period);
            if (mc.status !== "closed") return null;
            return (
              <div style={{ padding: "10px 12px", background: "rgba(255,183,74,0.1)", border: "1px solid rgba(255,183,74,0.3)", borderRadius: "var(--r-sm)", fontSize: "12px", color: "var(--warning)" }}>
                <strong>⚠ Mês fechado:</strong> {monthLabel(period)} já foi fechado. Alterações podem modificar o saldo final e os relatórios do período.
              </div>
            );
          })()}

          {/* Origin section for editing */}
          {initialEntry && (
            <div className="form-advanced-section" style={{ display: "grid", gap: "var(--sp-3)", padding: "var(--sp-4)", border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", borderRadius: "var(--r-md)", marginTop: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Origem do dado</span>
              <div style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--text-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fonte</span><strong>{initialEntry.source ?? "Manual"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Qualidade</span><strong>{initialEntry.dataQuality ?? "completo"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Oficial</span><strong>{initialEntry.isOfficial ? "Sim" : "Não"}</strong></div>
                {initialEntry.estimatedDate && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Data estimada</span><strong>Sim</strong></div>}
                {initialEntry.installment && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Parcela</span><strong>{initialEntry.installment}</strong></div>}
              </div>
            </div>
          )}

          {/* Installment scope editing */}
          {initialEntry && initialEntry.installment && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)" }}>Alcance da edição</span>
              <div className="type-toggle" role="group" aria-label="Alcance da edição" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "2px", height: "36px" }}>
                <button type="button" className="active" style={{ height: "30px", fontSize: "11px" }}>Apenas esta</button>
                <button type="button" style={{ height: "30px", fontSize: "11px" }}>Esta e próximas</button>
                <button type="button" style={{ height: "30px", fontSize: "11px" }}>Toda compra</button>
              </div>
            </div>
          )}

          {/* Advanced section toggle */}
          <button
            type="button"
            className="form-advanced-toggle"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <span>{showAdvanced ? "Menos opções" : "Mais opções"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 160ms" }}><path d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
          </button>
          {showAdvanced && (
            <div className="form-advanced-section">
              {kind === "expense" && (
                <label htmlFor="field-paidby">
                  <span>Quem paga?</span>
                  <select id="field-paidby" name="paidBy" defaultValue={initialEntry?.paidBy ?? "me"}>
                    <option value="me">Eu</option>
                    <option value="father">Meu pai</option>
                    <option value="shared">Compartilhado</option>
                    <option value="reimbursable">Aguardando reembolso</option>
                  </select>
                </label>
              )}
              {initialEntry && (
                <label htmlFor="field-installment">
                  <span>Parcela / recorrência</span>
                  <input id="field-installment" name="installment" defaultValue={initialEntry?.installment} placeholder="Ex.: 2/6 ou mensal"/>
                </label>
              )}
              <label htmlFor="field-note">
                <span>Observação</span>
                <textarea id="field-note" name="note" defaultValue={initialEntry?.note} rows={2} placeholder="Opcional"/>
              </label>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button className="primary-button" type="submit">
              {initialEntry ? <Check size={17}/> : <Plus size={17}/>}
              <span>{initialEntry ? "Salvar alterações" : "Adicionar"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// LogViewerPage importado de @/components/LogViewerPage
// ToolsPage importado de @/components/ToolsPage

function QualityPage({ state, selectedPeriod, pushToast }: { state: FinanceState; selectedPeriod: string; pushToast: (message: string, type: ToastType) => void }) {
  const [stats, setStats] = useState(analytics.getStats());
  const [closes, setCloses] = useState<MonthClose[]>([]);
  const [currentClose, setCurrentClose] = useState<MonthClose | null>(null);

  useEffect(() => {
    setStats(analytics.getStats());
    setCloses(getAllCloses());
    setCurrentClose(getMonthClose(selectedPeriod));
  }, [selectedPeriod]);

  const refresh = () => {
    setStats(analytics.getStats());
    setCloses(getAllCloses());
    setCurrentClose(getMonthClose(selectedPeriod));
  };

  return (
    <>
      <section className="decision-hero compact-hero" style={{ marginBottom: "24px" }}>
        <div>
          <span className="eyebrow"><Gauge size={16} /> Qualidade do produto</span>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>Métricas de uso e validação</h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            {stats.last30d} eventos de uso nos últimos 30 dias · {stats.taskCompletionRate * 100}% conclusão · {stats.errorCount} erros
          </p>
        </div>
        <button className="secondary-button" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={refresh}>Atualizar</button>
      </section>

      <section className="dashboard-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <article className="panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Taxa conclusão</span>
          <strong style={{ fontSize: "28px" }}>{(stats.taskCompletionRate * 100).toFixed(0)}%</strong>
          <small style={{ fontSize: "11px", color: "var(--muted)" }}>{stats.last30d} tarefas · {stats.errorCount} erros</small>
        </article>
        <article className="panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Fechamentos</span>
          <strong style={{ fontSize: "28px" }}>{stats.monthClosings}</strong>
          <small style={{ fontSize: "11px", color: "var(--muted)" }}>{closes.filter((c) => c.status === "closed").length} meses fechados</small>
        </article>
        <article className="panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>Feedback</span>
          <strong style={{ fontSize: "28px" }}>{stats.feedbackCount}</strong>
          <small style={{ fontSize: "11px", color: "var(--muted)" }}>respostas coletadas</small>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-primary" style={{ marginTop: "24px" }}>
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Fechamento mensal</span><h3>{currentClose?.period || selectedPeriod}</h3></div></div>
          {currentClose && (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`status-badge ${currentClose.status === "closed" ? "success" : currentClose.status === "in_review" ? "warning" : "neutral"}`}>
                  {currentClose.status === "closed" ? "Fechado" : currentClose.status === "in_review" ? "Em revisão" : "Aberto"}
                </span>
                {currentClose.closedAt && <span style={{ fontSize: "11px", color: "var(--muted)" }}>Fechado em {new Date(currentClose.closedAt).toLocaleString("pt-BR")}</span>}
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                {[
                  { key: "invoicesImported" as const, label: "Faturas importadas" },
                  { key: "balancesVerified" as const, label: "Saldos conferidos" },
                  { key: "reconciled" as const, label: "Conciliação realizada" },
                  { key: "savingsRecorded" as const, label: "Aporte registrado" },
                  { key: "spendingReviewed" as const, label: "Gastos revisados" },
                  { key: "alertsReviewed" as const, label: "Alertas revisados" },
                ].map((item) => (
                  <label key={item.key} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={currentClose.checklist[item.key]}
                      onChange={() => {
                        const updated = { ...currentClose, checklist: { ...currentClose.checklist, [item.key]: !currentClose.checklist[item.key] } };
                        setCurrentClose(updated);
                        saveChecklist(selectedPeriod, updated.checklist);
                      }}
                      disabled={currentClose.status === "closed"}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                {currentClose.status !== "closed" ? (
                  <button className="primary-button compact" onClick={() => {
                    closeMonth(selectedPeriod);
                    setCurrentClose(getMonthClose(selectedPeriod));
                    analytics.track({ type: "close_month", category: "closing", action: "close", metadata: { period: selectedPeriod } });
                    pushToast("Mês fechado com sucesso.", "success");
                  }}>
                    <Check size={15} />Fechar mês
                  </button>
                ) : (
                  <button className="secondary-button" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => {
                    reopenMonth(selectedPeriod);
                    setCurrentClose(getMonthClose(selectedPeriod));
                    pushToast("Mês reaberto.", "info");
                  }}>
                    Reabrir mês
                  </button>
                )}
              </div>
            </div>
          )}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span>Tarefas</span><h3>Mais lentas (top 10)</h3></div></div>
          <div className="compact-list">
            {stats.topSlowTasks.length === 0 ? (
              <div className="empty-state"><span>Nenhuma tarefa registrada ainda.</span></div>
            ) : stats.topSlowTasks.slice(0, 5).map((t, i) => (
              <div key={t.id} style={{ fontSize: "12px", padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
                <strong style={{ display: "block" }}>{t.action}</strong>
                <span style={{ color: "var(--muted)", fontSize: "11px" }}>{t.category} · {(t.duration ?? 0).toFixed(0)}ms</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr", marginTop: "24px" }}>
        <article className="panel panel-wide">
          <div className="panel-heading"><div><span>Navegação</span><h3>Páginas mais visitadas</h3></div></div>
          <div className="rank-list">
            {stats.pageViews.length === 0 ? (
              <div className="empty-state"><span>Navegue pelas páginas do app para gerar dados de uso.</span></div>
            ) : stats.pageViews.map(([key, count], i) => {
              const viewLabelMap: Record<string, string> = { overview: "Visão geral", spending: "Gastos", receivables: "A receber", cards: "Cartões e parcelas", goal: "Meta", imports: "Importar", tools: "Exportar e backup", logs: "Monitoramento", quality: "Qualidade", corrections: "Central Correções", calculation_audit: "Auditoria de Cálculos", recovery_diagnostics: "Diagnósticos", all_entries: "Todos lançamentos" };
              const cleanKey = key.replace("page:", "");
              return <div key={key}><span><i>{i + 1}</i>{viewLabelMap[cleanKey] ?? cleanKey}</span><strong>{count} visitas</strong></div>;
            })}
          </div>
        </article>
      </section>
    </>
  );
}

// CorrectionCenter importado de @/components/CorrectionCenter

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <span key={item.name}><i style={{ background: item.color ?? "#ff7a18" }}/>{item.name}: <b>{brl.format(item.value)}</b></span>)}</div>;
}

function normalizeImportedDate(value: string, fallbackDate: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return fallbackDate;
  const [, day, month, rawYear] = match;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function SafeToSpendDetailsModal({
  onClose,
  data,
  margin,
  setMargin,
}: {
  onClose: () => void;
  data: ReturnType<typeof getSafeToSpend>;
  margin: number;
  setMargin: (margin: number) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: "600px" }}>
        <div className="modal-heading">
          <div>
            <span>Detalhamento de Caixa</span>
            <h2>Valor Seguro para Gastar</h2>
          </div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="entry-form" style={{ gap: "20px" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
            Projeção calculada considerando entradas e saídas programadas até a próxima renda confirmada em: <strong>{formatDate(data.nextIncomeDate)}</strong>.
          </p>

          <div className="safe-details-grid">
            <div className="safe-details-row plus">
              <span>Saldo em caixa (imediato)</span>
              <strong>{brl.format(data.availableCash)}</strong>
            </div>

            <div className="safe-details-row plus" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>(+) Receitas confirmadas até {formatDate(data.nextIncomeDate)}</span>
                <strong>{brl.format(data.incomesUntilNext)}</strong>
              </div>
              {data.consideredIncomes.length > 0 && (
                <div style={{ paddingLeft: "8px", display: "grid", gap: "4px", borderLeft: "1px solid var(--border)" }}>
                  {data.consideredIncomes.map((inc) => (
                    <div key={inc.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                      <span>· {inc.title} ({formatDate(inc.dueDate)})</span>
                      <span>{brl.format(inc.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="safe-details-row minus" style={{ flexDirection: "column", alignItems: "stretch", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>(−) Despesas / Compromissos previstos</span>
                <strong>{brl.format(data.expensesUntilNext)}</strong>
              </div>
              {data.consideredExpenses.length > 0 && (
                <div style={{ paddingLeft: "8px", display: "grid", gap: "4px", borderLeft: "1px solid var(--border)" }}>
                  {data.consideredExpenses.map((exp) => (
                    <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)" }}>
                      <span>· {exp.title} ({formatDate(exp.dueDate)})</span>
                      <span>{brl.format(exp.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="safe-details-row margin">
              <span>(−) Margem de segurança configurada</span>
              <strong style={{ color: "var(--warning)" }}>{brl.format(margin)}</strong>
            </div>

            <div className="safe-details-row result">
              <strong>(=) Valor seguro para gastar</strong>
              <strong style={{ color: data.safeToSpend >= 0 ? "var(--success)" : "var(--danger)" }}>{brl.format(data.safeToSpend)}</strong>
            </div>
          </div>

          <div className="margin-slider-box">
            <div className="margin-slider-header">
              <span>Ajustar margem de segurança</span>
              <strong>{brl.format(margin)}</strong>
            </div>
            <input 
              type="range" 
              min="0" 
              max="500" 
              step="20" 
              value={margin} 
              className="range" 
              onChange={(e) => setMargin(Number(e.target.value))} 
            />
            <span className="margin-slider-desc">
              Esta reserva operacional impede que pequenos desvios consumam todo o seu caixa operacional imediato.
            </span>
          </div>

          <div className="modal-actions" style={{ marginTop: "10px" }}>
            <button className="primary-button" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
