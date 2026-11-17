import { useEffect, useState } from 'react';

const DEFAULT_CODE = `#include <stdio.h>

int main(void)
{
    printf("Hello World!");
    return 0;
}`;

const LANGUAGE_NAMES = {
  c: 'C',
  text: 'Plain Text',
  cpp: 'C++',
  go: 'Go',
  python: 'Python',
  js: 'JavaScript',
  rust: 'Rust',
  sh: 'Shell',
};

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Never';
}

function formatRelative(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    const amount = Math.floor(seconds / size);
    if (amount >= 1) return `${amount} ${unit}${amount > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

function getSnippetIdFromLocation() {
  return new URLSearchParams(window.location.search).get('id');
}

const SYNTAX_TOKEN_PATTERN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\()/g;
const SYNTAX_KEYWORDS = new Set(['return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'struct', 'typedef', 'static', 'const']);
const SYNTAX_TYPES = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'unsigned', 'signed', 'bool']);

function getScreenFromLocation() {
  const path = window.location.pathname;
  if (path === '/view') return 'view';
  if (path === '/login') return 'login';
  if (path === '/signup') return 'signup';
  if (path === '/about') return 'about';
  return 'editor';
}

function BrandMark() {
  return (
    <svg className="bolt-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2L3 14h7v8l10-12h-7l3-8z" />
    </svg>
  );
}

function AppHeader({ user, onNavigate, onLogout }) {
  const handleLink = (path) => (event) => {
    event.preventDefault();
    onNavigate(path);
  };

  return (
    <header className="site-header">
      <a href="/" className="brand-logo" onClick={handleLink('/')} title="Sagas snippetbox">
        <BrandMark />
        <span>agas</span>
      </a>
      <nav className="header-nav" aria-label="Main navigation">
        <a href="/about" className="nav-link" onClick={handleLink('/about')}>About</a>
        {user ? (
          <>
            <span className="nav-link nav-user" title={user.email}>@{user.username}</span>
            <button type="button" className="btn-pill-bordered" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            <a href="/login" className="btn-pill-bordered" onClick={handleLink('/login')}>Log in</a>
            <a href="/signup" className="btn-pill-white" onClick={handleLink('/signup')}>Sign Up</a>
          </>
        )}
      </nav>
    </header>
  );
}

const VISIBILITY_BADGES = {
  private: { icon: '🔒', label: 'Private' },
  unlisted: { icon: '🔗', label: 'Unlisted' },
};

function SidebarSnippets({ sagas, mode, onModeChange, showModeSwitch, onSelect }) {
  const heading = mode === 'mine' ? 'My sagas' : 'Latest public sagas';
  return (
    <aside className="sidebar-sagas" aria-label={heading}>
      {showModeSwitch ? (
        <div className="sidebar-switch" role="tablist" aria-label="Sidebar list">
          {[['latest', 'Latest public'], ['mine', 'My sagas']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              className={`sidebar-switch-btn ${mode === value ? 'active' : ''}`}
              onClick={() => onModeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <h2 className="sidebar-heading">{heading}:</h2>
      )}
      {sagas.length === 0 && (
        <p className="sidebar-empty">
          {mode === 'mine' ? "You haven't created any sagas yet." : 'No public sagas yet.'}
        </p>
      )}
      <ul className="saga-list">
        {sagas.map((saga) => (
          <li key={saga.id} className="saga-item">
            <a
              href={`/view?id=${saga.id}`}
              className="saga-link"
              onClick={(event) => {
                event.preventDefault();
                onSelect(saga);
              }}
            >
              <div className="saga-title">
                {VISIBILITY_BADGES[saga.visibility] && (
                  <span
                    className="saga-badge"
                    title={VISIBILITY_BADGES[saga.visibility].label}
                    aria-label={VISIBILITY_BADGES[saga.visibility].label}
                  >
                    {VISIBILITY_BADGES[saga.visibility].icon}
                  </span>
                )}
                {saga.title}
              </div>
              <div className="saga-time">{formatRelative(saga.createdAt)}</div>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function CodeLines({ count }) {
  return (
    <div className="line-numbers-col" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index}>{index + 1}.</span>
      ))}
    </div>
  );
}

function HighlightedCode({ code, language }) {
  if (!['c', 'cpp'].includes(language)) return code;

  const highlighted = [];
  let offset = 0;
  for (const match of code.matchAll(SYNTAX_TOKEN_PATTERN)) {
    const token = match[0];
    const tokenOffset = match.index;
    if (tokenOffset > offset) highlighted.push(code.slice(offset, tokenOffset));

    let className = 'syntax-fn';
    if (token.startsWith('#')) className = 'syntax-dir';
    else if (token.startsWith('//') || token.startsWith('/*')) className = 'syntax-comm';
    else if (token.startsWith('"') || token.startsWith("'")) className = 'syntax-str';
    else if (/^\d/.test(token)) className = 'syntax-num';
    else if (SYNTAX_TYPES.has(token)) className = 'syntax-type';
    else if (SYNTAX_KEYWORDS.has(token)) className = 'syntax-kw';

    highlighted.push(<span className={className} key={tokenOffset}>{token}</span>);
    offset = tokenOffset + token.length;
  }
  if (offset < code.length) highlighted.push(code.slice(offset));
  return highlighted;
}

function MobileTabs({ currentScreen, mobileTab, onSelect, sagaCount, sidebarLabel }) {
  return (
    <nav className="mobile-tab-bar" aria-label="Workspace navigation">
      <button
        type="button"
        className={`mobile-tab-btn ${mobileTab === 'main' ? 'active' : ''}`}
        onClick={() => onSelect('main')}
      >
        {currentScreen === 'editor' ? 'Editor' : 'Snippet'}
      </button>
      <button
        type="button"
        className={`mobile-tab-btn ${mobileTab === 'sidebar' ? 'active' : ''}`}
        onClick={() => onSelect('sidebar')}
      >
        {sidebarLabel} ({sagaCount})
      </button>
    </nav>
  );
}

function Editor({ code, setCode, title, setTitle, options, onSubmit, error, submitting, user }) {
  const lineCount = Math.max(code.split('\n').length, 7);

  return (
    <form className="editor-form" onSubmit={onSubmit}>
      <div className="code-area-container">
        <CodeLines count={lineCount} />
        <textarea
          className="editor-textarea"
          name="content"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          spellCheck="false"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Paste or write your code here..."
          aria-label="Snippet content"
        />
      </div>
      <footer className="editor-toolbar">
        <div className="toolbar-select-wrapper">
          <select
            className="custom-select"
            name="language"
            value={options.language}
            onChange={(event) => options.setLanguage(event.target.value)}
            aria-label="Language"
          >
            <option value="c">C</option>
            <option value="text">Plain Text</option>
            <option value="cpp">C++</option>
            <option value="go">Go</option>
            <option value="python">Python</option>
            <option value="js">JavaScript</option>
            <option value="rust">Rust</option>
            <option value="sh">Shell</option>
          </select>
        </div>
        <div className="toolbar-select-wrapper">
          <select
            className="custom-select"
            name="expires"
            value={options.expiration}
            onChange={(event) => options.setExpiration(event.target.value)}
            aria-label="Expiration"
          >
            <option value="never">Never expire</option>
            <option value="10m">10 minutes</option>
            <option value="1h">1 hour</option>
            <option value="1d">1 day</option>
            <option value="1w">1 week</option>
          </select>
        </div>
        <div className="toolbar-select-wrapper">
          <select
            className="custom-select"
            name="visibility"
            value={options.visibility}
            onChange={(event) => options.setVisibility(event.target.value)}
            aria-label="Visibility"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private" disabled={!user}>Private{user ? '' : ' (log in)'}</option>
          </select>
        </div>
        <input
          type="text"
          className="title-input"
          name="title"
          placeholder="Add title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Snippet title"
        />
        <button type="submit" className="btn-tell" disabled={submitting}>
          {submitting ? '...' : 'Tell'}
        </button>
        {error && <span className="form-error" role="alert">{error}</span>}
      </footer>
    </form>
  );
}

function SnippetView({ snippet, error }) {
  if (error) return <div className="snippet-status" role="alert">{error}</div>;
  if (!snippet) return <div className="snippet-status">Loading...</div>;

  const lineCount = Math.max(snippet.content.split('\n').length, 7);

  return (
    <>
      <div className="code-area-container">
        <CodeLines count={lineCount} />
        <pre className="snippet-viewer">
          <code><HighlightedCode code={snippet.content} language={snippet.language} /></code>
        </pre>
      </div>
      <footer className="snippet-meta-bar">
        <span className="meta-item">{snippet.title || 'Untitled'}</span>
        <span className="meta-divider">|</span>
        <span>Type: <strong className="meta-item">{LANGUAGE_NAMES[snippet.language] ?? snippet.language}</strong></span>
        <span className="meta-divider">|</span>
        <span>Created at: <strong className="meta-item">{formatDate(snippet.createdAt)}</strong></span>
        <span className="meta-divider">|</span>
        <span>By: <strong className="meta-item">{snippet.author ?? 'Guest'}</strong></span>
        <span className="meta-divider">|</span>
        <span>Expires at: <strong className="meta-item">{formatDate(snippet.expiresAt)}</strong></span>
      </footer>
    </>
  );
}

function Workspace({
  currentScreen,
  mobileTab,
  setMobileTab,
  code,
  setCode,
  title,
  setTitle,
  options,
  snippet,
  snippetError,
  createError,
  submitting,
  sagas,
  sidebarMode,
  setSidebarMode,
  user,
  onCreate,
  onSelectSnippet,
}) {
  return (
    <>
      <MobileTabs
        currentScreen={currentScreen}
        mobileTab={mobileTab}
        onSelect={setMobileTab}
        sagaCount={sagas.length}
        sidebarLabel={sidebarMode === 'mine' ? 'My sagas' : 'Latest sagas'}
      />
      <div className={`app-container ${mobileTab === 'sidebar' ? 'mobile-show-sidebar' : ''}`}>
        <main className="workspace-main">
          {currentScreen === 'editor' ? (
            <Editor
              code={code}
              setCode={setCode}
              title={title}
              setTitle={setTitle}
              options={options}
              onSubmit={onCreate}
              error={createError}
              submitting={submitting}
              user={user}
            />
          ) : (
            <SnippetView snippet={snippet} error={snippetError} />
          )}
        </main>
        <SidebarSnippets
          sagas={sagas}
          mode={sidebarMode}
          onModeChange={setSidebarMode}
          showModeSwitch={Boolean(user)}
          onSelect={onSelectSnippet}
        />
      </div>
    </>
  );
}

function AuthPage({ isSignup, onNavigate, onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const user = await api(isSignup ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        body: isSignup ? { username, email, password } : { email, password },
      });
      onAuthenticated(user);
      onNavigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page-container">
      <div className="auth-card">
        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <div className="auth-input-group">
              <input
                type="text"
                className="auth-input"
                placeholder="Public username"
                required
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9_.\-]+"
                title="Letters, digits, _ . -"
                autoComplete="username"
                aria-label="Public username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
          )}
          <div className="auth-input-group">
            <input
              type="email"
              className="auth-input"
              placeholder="E-mail"
              required
              autoComplete="email"
              aria-label="E-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="auth-input-group">
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              required
              minLength={isSignup ? 8 : undefined}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              aria-label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn-auth-submit" disabled={submitting}>
            {submitting ? '...' : isSignup ? 'Sign Up' : 'Log in'}
          </button>
        </form>
        <div className="auth-card-footer">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          <br />
          <a
            href={isSignup ? '/login' : '/signup'}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(isSignup ? '/login' : '/signup');
            }}
          >
            {isSignup ? 'Log In' : 'Sign up'}
          </a>
        </div>
      </div>
    </main>
  );
}

function AboutPage({ onNavigate }) {
  return (
    <main className="auth-page-container">
      <section className="auth-card about-card">
        <h1 className="about-heading"><BrandMark />About Sagas</h1>
        <p className="about-description">
          <strong>Sagas</strong> is a minimalistic, high-performance snippet and paste sharing service.
          Designed with a dark hacker-terminal aesthetic, inspired by speed and simplicity.
        </p>
        <ul className="about-features">
          <li>Syntax highlighting for popular languages</li>
          <li>Customizable snippet expiration</li>
          <li>Public, unlisted, and private pastes</li>
          <li>Fully responsive across desktop, tablet, and mobile</li>
        </ul>
        <p className="about-api">
          Building on top of Sagas? See the{' '}
          <a href="/api/docs" target="_blank" rel="noopener noreferrer">API documentation</a>
          {' '}(Swagger).
        </p>
        <a
          href="/"
          className="btn-auth-submit about-start"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/');
          }}
        >
          Start Snipping
        </a>
      </section>
    </main>
  );
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(getScreenFromLocation);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('c');
  const [expiration, setExpiration] = useState('never');
  const [visibility, setVisibility] = useState('public');
  const [mobileTab, setMobileTab] = useState('main');
  const [snippetId, setSnippetId] = useState(getSnippetIdFromLocation);
  const [snippet, setSnippet] = useState(null);
  const [snippetError, setSnippetError] = useState('');
  const [sagas, setSagas] = useState([]);
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);
  const [mySagas, setMySagas] = useState([]);
  const [sidebarMode, setSidebarMode] = useState('latest');

  useEffect(() => {
    api('/api/auth/me').then(setUser).catch(() => setUser(null));
  }, []);

  const loadLatest = () => {
    api('/api/snippets')
      .then(setSagas)
      .catch((error) => console.error('Cannot load latest snippets:', error));
  };

  useEffect(loadLatest, []);

  const loadMine = () => {
    if (!user) {
      setMySagas([]);
      return;
    }
    api('/api/me/snippets')
      .then(setMySagas)
      .catch((error) => console.error('Cannot load my snippets:', error));
  };

  useEffect(loadMine, [user]);

  useEffect(() => {
    if (currentScreen !== 'view') return undefined;
    let cancelled = false;
    setSnippet(null);
    setSnippetError('');
    api(`/api/snippets/${encodeURIComponent(snippetId ?? '')}`)
      .then((data) => !cancelled && setSnippet(data))
      .catch((error) => !cancelled && setSnippetError(error.message));
    return () => {
      cancelled = true;
    };
  }, [currentScreen, snippetId, user]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentScreen(getScreenFromLocation());
      setSnippetId(getSnippetIdFromLocation());
      setMobileTab('main');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentScreen(getScreenFromLocation());
    setSnippetId(getSnippetIdFromLocation());
    setMobileTab('main');
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setCreateError('');
    try {
      const { id } = await api('/api/snippets', {
        method: 'POST',
        body: { title, content: code, language, visibility, expires: expiration },
      });
      setTitle('');
      loadLatest();
      loadMine();
      navigate(`/view?id=${id}`);
    } catch (error) {
      setCreateError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(null);
    setSidebarMode('latest');
    if (visibility === 'private') setVisibility('public');
  };

  const handleSelectSnippet = (saga) => {
    navigate(`/view?id=${saga.id}`);
  };

  const options = {
    language,
    setLanguage,
    expiration,
    setExpiration,
    visibility,
    setVisibility,
  };

  return (
    <div className="app-shell">
      <AppHeader user={user} onNavigate={navigate} onLogout={handleLogout} />
      {currentScreen === 'editor' || currentScreen === 'view' ? (
        <Workspace
          currentScreen={currentScreen}
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          code={code}
          setCode={setCode}
          title={title}
          setTitle={setTitle}
          options={options}
          snippet={snippet}
          snippetError={snippetError}
          createError={createError}
          submitting={submitting}
          sagas={user && sidebarMode === 'mine' ? mySagas : sagas}
          sidebarMode={user ? sidebarMode : 'latest'}
          setSidebarMode={setSidebarMode}
          user={user}
          onCreate={handleCreate}
          onSelectSnippet={handleSelectSnippet}
        />
      ) : currentScreen === 'about' ? (
        <AboutPage onNavigate={navigate} />
      ) : (
        <AuthPage
          key={currentScreen}
          isSignup={currentScreen === 'signup'}
          onNavigate={navigate}
          onAuthenticated={setUser}
        />
      )}
    </div>
  );
}
