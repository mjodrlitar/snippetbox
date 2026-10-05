import React, { useState } from 'react';

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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('editor'); // 'editor' | 'view' | 'login' | 'signup'
  const [code, setCode] = useState(DEFAULT_CODE);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('c');
  const [expiration, setExpiration] = useState('never');
  const [visibility, setVisibility] = useState('public');
  const [mobileTab, setMobileTab] = useState('main'); // 'main' | 'sidebar'

  // Calculate line numbers
  const linesCount = Math.max(code.split('\n').length, 7);
  const lineNumbers = Array.from({ length: linesCount }, (_, i) => i + 1);

  const handleTell = (e) => {
    e.preventDefault();
    setCurrentScreen('view');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Dev preview bar for easy switching during development */}
      <aside 
        style={{
          background: '#0d0d0d',
          borderBottom: '1px solid #222',
          padding: '5px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#888'
        }}
      >
        <span>Figma Preview Screens:</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'editor', label: '1. Editor' },
            { id: 'view', label: '2. View Snippet' },
            { id: 'login', label: '3. Log In' },
            { id: 'signup', label: '4. Sign Up' },
          ].map((screen) => (
            <button
              key={screen.id}
              onClick={() => setCurrentScreen(screen.id)}
              style={{
                background: currentScreen === screen.id ? '#0ea64e' : '#222',
                color: currentScreen === screen.id ? '#fff' : '#aaa',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '11px',
                fontWeight: currentScreen === screen.id ? '600' : '400'
              }}
            >
              {screen.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Main App Header */}
      <header className="site-header">
        <a 
          href="#home" 
          className="brand-logo" 
          onClick={(e) => { e.preventDefault(); setCurrentScreen('editor'); }}
          title="agas snippetbox"
        >
          <svg className="bolt-icon" viewBox="0 0 24 24">
            <path d="M13 2L3 14h7v8l10-12h-7l3-8z" />
          </svg>
          <span>agas</span>
        </a>

        <nav className="header-nav">
          <a 
            href="#about" 
            className="nav-link" 
            onClick={(e) => { e.preventDefault(); alert('agas - fast & lightweight snippet sharing'); }}
          >
            About
          </a>

          {(currentScreen === 'editor' || currentScreen === 'view') && (
            <>
              <button 
                className="btn-pill-bordered" 
                onClick={() => setCurrentScreen('login')}
              >
                Log in
              </button>
              <button 
                className="btn-pill-white" 
                onClick={() => setCurrentScreen('signup')}
              >
                Sign Up
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Content depending on screen */}
      {(currentScreen === 'editor' || currentScreen === 'view') ? (
        <>
          {/* Mobile Tab Switcher */}
          <nav className="mobile-tab-bar" aria-label="Mobile Navigation">
            <button 
              className={`mobile-tab-btn ${mobileTab === 'main' ? 'active' : ''}`}
              onClick={() => setMobileTab('main')}
            >
              {currentScreen === 'editor' ? 'Editor' : 'Snippet'}
            </button>
            <button 
              className={`mobile-tab-btn ${mobileTab === 'sidebar' ? 'active' : ''}`}
              onClick={() => setMobileTab('sidebar')}
            >
              Latest sagas ({SAMPLE_SAGAS.length})
            </button>
          </nav>

          <div className={`app-container ${mobileTab === 'sidebar' ? 'mobile-show-sidebar' : ''}`}>
            {/* Left: Workspace Area */}
            <main className="workspace-main">
              {currentScreen === 'editor' ? (
                /* Editor View */
                <form 
                  onSubmit={handleTell}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
                >
                  <div className="code-area-container">
                    <div className="line-numbers-col">
                      {lineNumbers.map((num) => (
                        <span key={num}>{num}.</span>
                      ))}
                    </div>

                    <textarea
                      className="editor-textarea"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      spellCheck="false"
                      autoCorrect="off"
                      autoCapitalize="off"
                      placeholder="Paste or write your code here..."
                    />
                  </div>

                  {/* Toolbar */}
                  <footer className="editor-toolbar">
                    <div className="toolbar-select-wrapper">
                      <select 
                        className="custom-select" 
                        value={language} 
                        onChange={(e) => setLanguage(e.target.value)}
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
                        value={expiration} 
                        onChange={(e) => setExpiration(e.target.value)}
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
                        value={visibility} 
                        onChange={(e) => setVisibility(e.target.value)}
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
                      placeholder="Add title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      aria-label="Snippet Title"
                    />

                    <button type="submit" className="btn-tell">Tell</button>
                  </footer>
                </form>
              ) : (
                /* View Snippet */
                <>
                  <div className="code-area-container">
                    <div className="line-numbers-col">
                      <span>1.</span>
                      <span>2.</span>
                      <span>3.</span>
                      <span>4.</span>
                      <span>5.</span>
                      <span>6.</span>
                      <span>7.</span>
                    </div>

                    <pre className="snippet-viewer"><code><span className="syntax-dir">#include &lt;stdio.h&gt;</span>
{'\n\n'}
<span className="syntax-kw">int</span> <span className="syntax-fn">main</span>(<span className="syntax-type">void</span>)
{'\n{\n    '}<span className="syntax-fn">printf</span>(<span className="syntax-str">"Hello World!"</span>);
{'\n    '}<span className="syntax-kw">return</span> <span className="syntax-num">0</span>;
{'\n}'}</code></pre>
                  </div>

                  <footer className="snippet-meta-bar">
                    <span className="meta-item">{title || 'Untitled'}</span>
                    <span className="meta-divider">|</span>
                    <span>Type: <strong className="meta-item">C</strong></span>
                    <span className="meta-divider">|</span>
                    <span>Created at: <strong className="meta-item">07.12.2024 12:33</strong></span>
                    <span className="meta-divider">|</span>
                    <span>By: <strong className="meta-item">Guest</strong></span>
                    <span className="meta-divider">|</span>
                    <span>Expires at: <strong className="meta-item">Never</strong></span>
                  </footer>
                </>
              )}
            </main>

            {/* Right: Latest Public Sagas */}
            <aside className="sidebar-sagas" aria-label="Latest public sagas">
              <h2 className="sidebar-heading">Latest public sagas:</h2>
              <ul className="saga-list">
                {SAMPLE_SAGAS.map((saga) => (
                  <li key={saga.id} className="saga-item">
                    <a 
                      href={`#saga-${saga.id}`} 
                      className="saga-link"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentScreen('view');
                        if (mobileTab === 'sidebar') setMobileTab('main');
                      }}
                    >
                      <div className="saga-title">{saga.title}</div>
                      <div className="saga-time">{saga.time}</div>
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </>
      ) : currentScreen === 'login' ? (
        /* Log In Screen */
        <main className="auth-page-container">
          <div className="auth-card">
            <form 
              className="auth-form" 
              onSubmit={(e) => { e.preventDefault(); setCurrentScreen('editor'); }}
            >
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
                  autoComplete="current-password"
                  aria-label="Password"
                />
              </div>

              <button type="submit" className="btn-auth-submit">Log in</button>
            </form>

            <div className="auth-card-footer">
              Don't have an account?<br />
              <a 
                href="#signup" 
                onClick={(e) => { e.preventDefault(); setCurrentScreen('signup'); }}
              >
                Sign up
              </a>
            </div>
          </div>
        </main>
      ) : (
        /* Sign Up Screen */
        <main className="auth-page-container">
          <div className="auth-card">
            <form 
              className="auth-form" 
              onSubmit={(e) => { e.preventDefault(); setCurrentScreen('editor'); }}
            >
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
                  autoComplete="new-password"
                  aria-label="Password"
                />
              </div>

              <button type="submit" className="btn-auth-submit">Sign Up</button>
            </form>

            <div className="auth-card-footer">
              Already have an account?<br />
              <a 
                href="#login" 
                onClick={(e) => { e.preventDefault(); setCurrentScreen('login'); }}
              >
                Log In
              </a>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
