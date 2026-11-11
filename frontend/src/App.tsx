import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ApiError,
  apiRequest,
  clearToken,
  getToken,
  saveToken,
  type Category,
  type MonthlySummary,
  type Transaction,
  type TransactionPage,
  type TransactionType,
} from './api';

type View = 'overview' | 'transactions' | 'categories';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function money(cents: number): string {
  return currency.format(cents / 100);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

function monthQuery(date: Date): string {
  return `year=${date.getFullYear()}&month=${date.getMonth() + 1}`;
}

function App() {
  const [token, setToken] = useState(getToken());
  const [view, setView] = useState<View>('overview');
  const [month, setMonth] = useState(() => new Date());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const monthParams = monthQuery(month);
      const from = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const to = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const [nextSummary, page, nextCategories] = await Promise.all([
        apiRequest<MonthlySummary>(`/reports/summary?${monthParams}`),
        apiRequest<TransactionPage>(
          `/transactions?from=${from}&to=${to}&limit=100&sort=date&order=desc`,
        ),
        apiRequest<Category[]>('/categories'),
      ]);
      setSummary(nextSummary);
      setTransactions(page.data);
      setCategories(nextCategories);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearToken();
        setToken(null);
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar os dados.',
        );
      }
    } finally {
      setBusy(false);
    }
  }, [month]);

  useEffect(() => {
    if (token) void refresh();
  }, [refresh, token]);

  function signOut() {
    clearToken();
    setToken(null);
    setSummary(null);
    setTransactions([]);
    setCategories([]);
  }

  if (!token) {
    return (
      <AuthScreen
        onAuthenticated={(accessToken) => {
          saveToken(accessToken);
          setToken(accessToken);
        }}
      />
    );
  }

  const recentTransactions = transactions.slice(0, 5);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setView('overview')}>
          <span className="brand-mark">f</span>
          <span>fintrack<span className="brand-dot">.</span></span>
        </a>
        <div className="sidebar-label">MENU</div>
        <nav className="nav-list" aria-label="Navegação principal">
          <NavButton active={view === 'overview'} onClick={() => setView('overview')} icon="◫">
            Visão geral
          </NavButton>
          <NavButton active={view === 'transactions'} onClick={() => setView('transactions')} icon="↕">
            Transações
          </NavButton>
          <NavButton active={view === 'categories'} onClick={() => setView('categories')} icon="◈">
            Categorias
          </NavButton>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-icon">?</span>
            <div><strong>Precisa de ajuda?</strong><small>Veja a documentação da API</small></div>
          </div>
          <button className="profile-button" onClick={signOut}>
            <span className="avatar">F</span>
            <span className="profile-copy"><strong>Minha conta</strong><small>Sair da conta</small></span>
            <span className="profile-arrow">↗</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">Finanças <span>/</span> {viewTitle(view)}</div>
          <div className="topbar-actions">
            <span className="status-dot" /> Seus dados estão seguros
            <span className="topbar-avatar">F</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{monthLabel(month)}</p>
              <h1>{viewTitle(view)}</h1>
              <p className="heading-subtitle">
                {view === 'overview'
                  ? 'Acompanhe sua vida financeira em um só lugar.'
                  : view === 'transactions'
                    ? 'Todas as entradas e saídas da sua conta.'
                    : 'Organize seus gastos do seu jeito.'}
              </p>
            </div>
            <div className="heading-actions">
              <MonthPicker month={month} onChange={setMonth} />
              {view !== 'categories' && (
                <button className="primary-button" onClick={() => setShowTransactionForm(true)}>
                  <span>＋</span> Nova transação
                </button>
              )}
            </div>
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}
          {busy && <div className="loading-bar" aria-label="Carregando" />}

          {view === 'overview' && (
            <Overview
              summary={summary}
              transactions={recentTransactions}
              onSeeAll={() => setView('transactions')}
              onAdd={() => setShowTransactionForm(true)}
            />
          )}
          {view === 'transactions' && (
            <TransactionsView transactions={transactions} />
          )}
          {view === 'categories' && (
            <CategoriesView
              categories={categories}
              onCreated={refresh}
            />
          )}
        </div>
      </main>

      {showTransactionForm && (
        <TransactionDialog
          categories={categories}
          onClose={() => setShowTransactionForm(false)}
          onCreated={async () => {
            setShowTransactionForm(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function viewTitle(view: View): string {
  if (view === 'transactions') return 'Transações';
  if (view === 'categories') return 'Categorias';
  return 'Visão geral';
}

function NavButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: string;
  children: string;
  onClick: () => void;
}) {
  return (
    <button className={`nav-button${active ? ' active' : ''}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span>
      {children}
      {active && <span className="nav-indicator" />}
    </button>
  );
}

function MonthPicker({ month, onChange }: { month: Date; onChange: (date: Date) => void }) {
  function shiftMonth(amount: number) {
    onChange(new Date(month.getFullYear(), month.getMonth() + amount, 1));
  }
  return (
    <div className="month-picker">
      <button aria-label="Mês anterior" onClick={() => shiftMonth(-1)}>‹</button>
      <span>{monthLabel(month)}</span>
      <button aria-label="Próximo mês" onClick={() => shiftMonth(1)}>›</button>
    </div>
  );
}

function Overview({
  summary,
  transactions,
  onSeeAll,
  onAdd,
}: {
  summary: MonthlySummary | null;
  transactions: Transaction[];
  onSeeAll: () => void;
  onAdd: () => void;
}) {
  const cards = [
    { label: 'Saldo do mês', amount: summary?.balanceCents ?? 0, icon: '↗', tone: 'purple', note: 'Receitas menos despesas' },
    { label: 'Receitas', amount: summary?.incomeCents ?? 0, icon: '↓', tone: 'green', note: 'Total recebido no mês' },
    { label: 'Despesas', amount: summary?.expenseCents ?? 0, icon: '↑', tone: 'orange', note: 'Total gasto no mês' },
  ];
  return (
    <>
      <section className="summary-grid" aria-label="Resumo financeiro">
        {cards.map((card) => (
          <article className="summary-card" key={card.label}>
            <div className="summary-card-top">
              <span>{card.label}</span>
              <span className={`summary-icon ${card.tone}`}>{card.icon}</span>
            </div>
            <strong className="summary-amount">{money(card.amount)}</strong>
            <span className="summary-note">{card.note}</span>
          </article>
        ))}
      </section>
      <div className="content-grid">
        <section className="panel transactions-panel">
          <div className="panel-heading">
            <div><h2>Transações recentes</h2><p>Suas movimentações mais recentes</p></div>
            <button className="text-button" onClick={onSeeAll}>Ver todas <span>→</span></button>
          </div>
          <TransactionTable transactions={transactions} compact />
          {transactions.length === 0 && (
            <EmptyState
              title="Tudo começa com um registro"
              description="Adicione sua primeira receita ou despesa para acompanhar seu dinheiro."
              action="Adicionar transação"
              onAction={onAdd}
            />
          )}
        </section>
        <section className="panel insight-panel">
          <div className="insight-top">
            <span className="insight-icon">✳</span>
            <span className="insight-label">DICA FINANCEIRA</span>
          </div>
          <h2>Pequenos passos, grandes conquistas.</h2>
          <p>Registrar cada gasto é o primeiro passo para entender seus hábitos e alcançar seus objetivos.</p>
          <div className="insight-decoration"><span>♡</span><i /><i /><i /></div>
        </section>
      </div>
    </>
  );
}

function TransactionsView({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div><h2>Movimentações</h2><p>{transactions.length} transações no período selecionado</p></div>
      </div>
      {transactions.length ? (
        <TransactionTable transactions={transactions} />
      ) : (
        <EmptyState title="Nenhuma transação por aqui" description="As transações deste mês aparecerão nesta lista." />
      )}
    </section>
  );
}

function TransactionTable({
  transactions,
  compact = false,
}: {
  transactions: Transaction[];
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="transaction-table">
        <thead><tr><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>DATA</th><th className="amount-cell">VALOR</th></tr></thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>
                <div className="transaction-name">
                  <span className={`transaction-type-icon ${transaction.type.toLowerCase()}`}>
                    {transaction.type === 'INCOME' ? '↓' : '↑'}
                  </span>
                  <span><strong>{transaction.description || transaction.category.name}</strong><small>{transaction.type === 'INCOME' ? 'Receita' : 'Despesa'}</small></span>
                </div>
              </td>
              <td><span className="category-chip">{transaction.category.name}</span></td>
              <td className="date-cell">{formatDate(transaction.date)}</td>
              <td className={`amount-cell ${transaction.type === 'INCOME' ? 'positive' : ''}`}>
                {transaction.type === 'INCOME' ? '+' : '−'} {money(transaction.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {compact && transactions.length === 5 && <span className="sr-only">Exibindo as cinco transações mais recentes</span>}
    </div>
  );
}

function CategoriesView({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiRequest<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setName('');
      await onCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a categoria.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-grid category-layout">
      <section className="panel full-panel">
        <div className="panel-heading"><div><h2>Suas categorias</h2><p>Use categorias para entender para onde vai seu dinheiro.</p></div></div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {categories.length ? (
          <div className="category-list">
            {categories.map((category, index) => (
              <div className="category-row" key={category.id}>
                <span className={`category-symbol color-${index % 5}`}>{['◈', '⌂', '✿', '▧', '◉'][index % 5]}</span>
                <strong>{category.name}</strong>
                <span className="category-count">Categoria pessoal</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Crie sua primeira categoria" description="Exemplos: Alimentação, Moradia, Transporte ou Salário." />
        )}
      </section>
      <section className="panel create-category-panel">
        <span className="form-kicker">PERSONALIZE</span>
        <h2>Nova categoria</h2>
        <p>Crie uma categoria para organizar melhor suas movimentações.</p>
        <form onSubmit={createCategory}>
          <label htmlFor="category-name">Nome da categoria</label>
          <input id="category-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Alimentação" maxLength={50} required />
          <button className="primary-button full-button" disabled={saving}>{saving ? 'Salvando...' : 'Criar categoria'}</button>
        </form>
      </section>
    </div>
  );
}

function TransactionDialog({
  categories,
  onClose,
  onCreated,
}: {
  categories: Category[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const amountCents = Math.round(Number(amount.replace(',', '.')) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      setError('Informe um valor válido maior que zero.');
      setSaving(false);
      return;
    }
    try {
      await apiRequest<Transaction>('/transactions', {
        method: 'POST',
        body: JSON.stringify({ amountCents, type, categoryId, description, date }),
      });
      await onCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a transação.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title">
        <button className="modal-close" aria-label="Fechar" onClick={onClose}>×</button>
        <span className="form-kicker">MOVIMENTAÇÃO</span>
        <h2 id="transaction-dialog-title">Nova transação</h2>
        <p>Registre uma receita ou despesa.</p>
        {categories.length === 0 ? (
          <div className="error-banner">Crie uma categoria antes de registrar uma transação.</div>
        ) : (
          <form onSubmit={submit} className="dialog-form">
            <div className="type-switch">
              <button type="button" className={type === 'EXPENSE' ? 'selected expense-selected' : ''} onClick={() => setType('EXPENSE')}>Despesa</button>
              <button type="button" className={type === 'INCOME' ? 'selected income-selected' : ''} onClick={() => setType('INCOME')}>Receita</button>
            </div>
            <label htmlFor="transaction-amount">Valor (R$)</label>
            <input id="transaction-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required />
            <label htmlFor="transaction-description">Descrição</label>
            <input id="transaction-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Compra no mercado" maxLength={255} />
            <div className="form-row">
              <div><label htmlFor="transaction-category">Categoria</label><select id="transaction-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
              <div><label htmlFor="transaction-date">Data</label><input id="transaction-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
            </div>
            {error && <div className="error-banner" role="alert">{error}</div>}
            <button className="primary-button full-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar transação'}</button>
          </form>
        )}
      </section>
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (registering) {
        await apiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
      }
      const result = await apiRequest<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onAuthenticated(result.accessToken);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível autenticar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand auth-brand" href="#"><span className="brand-mark">f</span><span>fintrack<span className="brand-dot">.</span></span></a>
        <div className="auth-story-copy">
          <span className="form-kicker">MAIS CLAREZA. MAIS CONTROLE.</span>
          <h1>Seu dinheiro,<br />no caminho certo.</h1>
          <p>Uma vida financeira mais leve começa com escolhas conscientes. Organize, acompanhe e avance.</p>
          <div className="auth-quote"><span>“</span><div><strong>O segredo para seguir em frente é começar.</strong><small>Um passo de cada vez.</small></div></div>
        </div>
        <span className="auth-footer">FINTRACK · SUAS FINANÇAS EM EQUILÍBRIO</span>
        <div className="auth-decoration decor-one" /><div className="auth-decoration decor-two" />
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="mobile-brand"><span className="brand-mark">f</span> fintrack<span className="brand-dot">.</span></div>
          <span className="form-kicker">{registering ? 'COMECE SUA JORNADA' : 'BEM-VINDO DE VOLTA'}</span>
          <h2>{registering ? 'Crie sua conta' : 'Acesse sua conta'}</h2>
          <p className="auth-subtitle">{registering ? 'É rápido e gratuito. Vamos organizar suas finanças?' : 'Entre para continuar cuidando bem do seu dinheiro.'}</p>
          <form onSubmit={submit} className="auth-form">
            {registering && <div><label htmlFor="auth-name">Nome</label><input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos te chamar?" minLength={2} maxLength={80} required /></div>}
            <div><label htmlFor="auth-email">E-mail</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" required /></div>
            <div><label htmlFor="auth-password">Senha</label><input id="auth-password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" minLength={registering ? 8 : undefined} required /></div>
            {error && <div className="error-banner" role="alert">{error}</div>}
            <button className="primary-button full-button auth-submit" disabled={busy}>{busy ? 'Aguarde...' : registering ? 'Criar conta' : 'Entrar'} <span>→</span></button>
          </form>
          <p className="auth-switch">
            {registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
            <button onClick={() => { setRegistering(!registering); setError(''); }}>
              {registering ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
          <div className="auth-security"><span>◈</span> Seus dados são privados e protegidos.</div>
        </div>
      </section>
    </main>
  );
}

function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">◫</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction && <button className="text-button" onClick={onAction}>{action} <span>→</span></button>}
    </div>
  );
}

export default App;
