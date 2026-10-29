import { useEffect, useState } from 'react';

const SAMPLE_SAGAS = [
  { id: 1, title: 'Untitled', time: 'Just now' },
  { id: 2, title: 'paste.txt', time: '35 minutes ago' },
  { id: 3, title: 'code.c', time: '2 hours ago' },
  { id: 4, title: 'log.txt', time: '1 day ago' },
  { id: 5, title: 'my project.go', time: '2 days ago' },
  { id: 6, title: 'Untitled', time: '3 days ago' },
  { id: 7, title: 'arch_install_instruction.txt', time: '4 days ago' },
  { id: 8, title: 'temp.cpp', time: '5 days ago' },
  { id: 9, title: 'Untitled', time: '6 days ago' },
];

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

const EXPIRATION_NAMES = {
  never: 'Never',
  '10m': '10 minutes',
  '1h': '1 hour',
  '1d': '1 day',
  '1w': '1 week',
};

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

function AppHeader({ onNavigate }) {
  const handleLink = (path) => (event) => {
    event.preventDefault();
    onNavigate(path);
  };

  return (
    <header className="site-header">
      <a href="/" className="brand-logo" onClick={handleLink('/')} title="agas snippetbox">
        <BrandMark />
        <span>agas</span>
      </a>
      <nav className="header-nav" aria-label="Main navigation">
        <a href="/about" className="nav-link" onClick={handleLink('/about')}>About</a>
        <a href="/login" className="btn-pill-bordered" onClick={handleLink('/login')}>Log in</a>
        <a href="/signup" className="btn-pill-white" onClick={handleLink('/signup')}>Sign Up</a>
      </nav>
    </header>
  );
}

function LatestSnippets({ onSelect }) {
  return (
    <aside className="sidebar-sagas" aria-label="Latest public sagas">
      <h2 className="sidebar-heading">Latest public sagas:</h2>
      <ul className="saga-list">
        {SAMPLE_SAGAS.map((saga) => (
          <li key={saga.id} className="saga-item">
            <a
              href={`/view?id=${saga.id}`}
              className="saga-link"
              onClick={(event) => {
                event.preventDefault();
                onSelect(saga);
              }}
            >
              <div className="saga-title">{saga.title}</div>
              <div className="saga-time">{saga.time}</div>
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

function MobileTabs({ currentScreen, mobileTab, onSelect }) {
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
        Latest sagas ({SAMPLE_SAGAS.length})
      </button>
    </nav>
  );
}

function Editor({ code, setCode, title, setTitle, options, onSubmit }) {
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
            <option value="private">Private</option>
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
        <button type="submit" className="btn-tell">Tell</button>
      </footer>
    </form>
  );
}

function SnippetView({ snippet }) {
  const lineCount = Math.max(snippet.code.split('\n').length, 7);

  return (
    <>
      <div className="code-area-container">
        <CodeLines count={lineCount} />
        <pre className="snippet-viewer">
          <code><HighlightedCode code={snippet.code} language={snippet.language} /></code>
        </pre>
      </div>
      <footer className="snippet-meta-bar">
        <span className="meta-item">{snippet.title || 'Untitled'}</span>
        <span className="meta-divider">|</span>
        <span>Type: <strong className="meta-item">{LANGUAGE_NAMES[snippet.language]}</strong></span>
        <span className="meta-divider">|</span>
        <span>Created at: <strong className="meta-item">{snippet.createdAt}</strong></span>
        <span className="meta-divider">|</span>
        <span>By: <strong className="meta-item">Guest</strong></span>
        <span className="meta-divider">|</span>
        <span>Expires at: <strong className="meta-item">{EXPIRATION_NAMES[snippet.expiration]}</strong></span>
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
  onCreate,
  onSelectSnippet,
}) {
  return (
    <>
      <MobileTabs
        currentScreen={currentScreen}
        mobileTab={mobileTab}
        onSelect={setMobileTab}
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
            />
          ) : (
            <SnippetView snippet={snippet} />
          )}
        </main>
        <LatestSnippets onSelect={onSelectSnippet} />
      </div>
    </>
  );
}

function AuthPage({ isSignup, onNavigate }) {
  const handleSubmit = (event) => {
    event.preventDefault();
    onNavigate('/');
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
                autoComplete="username"
                aria-label="Public username"
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
            />
          </div>
          <div className="auth-input-group">
            <input
              type="password"
              className="auth-input"
              placeholder="Password"
              required
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              aria-label="Password"
            />
          </div>
          <button type="submit" className="btn-auth-submit">
            {isSignup ? 'Sign Up' : 'Log in'}
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
        <h1 className="about-heading"><BrandMark />About agas</h1>
        <p className="about-description">
          <strong>agas</strong> is a minimalistic, high-performance snippet and paste sharing service.
          Designed with a dark hacker-terminal aesthetic, inspired by speed and simplicity.
        </p>
        <ul className="about-features">
          <li>Syntax highlighting for popular languages</li>
          <li>Customizable snippet expiration</li>
          <li>Public, unlisted, and private pastes</li>
          <li>Fully responsive across desktop, tablet, and mobile</li>
        </ul>
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
  const [snippet, setSnippet] = useState(() => {
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    const sample = SAMPLE_SAGAS.find((item) => item.id === id);
    return {
      code: DEFAULT_CODE,
      title: sample?.title ?? 'Untitled',
      language: 'c',
      expiration: 'never',
      createdAt: '07.12.2024 12:33',
    };
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentScreen(getScreenFromLocation());
      setMobileTab('main');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentScreen(getScreenFromLocation());
    setMobileTab('main');
  };

  const handleCreate = (event) => {
    event.preventDefault();
    setSnippet({
      code,
      title: title.trim() || 'Untitled',
      language,
      expiration,
      createdAt: new Date().toLocaleString(),
    });
    navigate('/view?id=1');
  };

  const handleSelectSnippet = (saga) => {
    setSnippet((current) => ({ ...current, title: saga.title }));
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
      <AppHeader onNavigate={navigate} />
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
          onCreate={handleCreate}
          onSelectSnippet={handleSelectSnippet}
        />
      ) : currentScreen === 'about' ? (
        <AboutPage onNavigate={navigate} />
      ) : (
        <AuthPage isSignup={currentScreen === 'signup'} onNavigate={navigate} />
      )}
    </div>
  );
}
