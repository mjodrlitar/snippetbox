// Configures Directus for Sagas: collection/field metadata on top of the
// existing app tables, the theme and plugins, a Moderator role, content added
// through the CMS and an Insights dashboard.
// Idempotent: safe to run on every `docker compose up`.

import { readFile } from 'node:fs/promises';

const URL = process.env.DIRECTUS_URL ?? 'http://cms:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MODERATOR_EMAIL = process.env.MODERATOR_EMAIL ?? 'moderator@example.com';
const MODERATOR_PASSWORD = process.env.MODERATOR_PASSWORD ?? 'moderator12345';

let token;

async function api(method, path, body) {
  const res = await fetch(URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.data;
}

const q = (filter) => `filter=${encodeURIComponent(JSON.stringify(filter))}`;

async function findOne(collectionPath, filter) {
  const rows = await api('GET', `${collectionPath}?${q(filter)}&limit=1`);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

const collections = {
  snippets: {
    icon: 'code',
    note: 'Public and unlisted snippets ("sagas"). Private ones are visible to their authors only.',
    display_template: '{{title}}',
    sort: 1,
  },
  users: {
    icon: 'group',
    note: 'Users of the Sagas app (not CMS accounts). New users sign up in the app.',
    display_template: '{{username}}',
    sort: 2,
    translations: [
      { language: 'en-US', translation: 'App users', singular: 'App user', plural: 'App users' },
    ],
  },
  languages: {
    icon: 'translate',
    note: 'Languages available in the snippet editor',
    display_template: '{{name}}',
    sort: 3,
  },
  // The CMS DB role has no access to sessions; just keep the table out of the menu.
  sessions: { hidden: true, note: 'Not accessible from the CMS', sort: 4 },
};

const visibilityChoices = [
  {
    text: 'Public',
    value: 'public',
    icon: 'public',
    description: 'Shown in the feed',
    foreground: '#FFFFFF',
    background: '#0EA64E',
  },
  {
    text: 'Unlisted',
    value: 'unlisted',
    icon: 'link',
    description: 'Reachable by link only',
    foreground: '#FFFFFF',
    background: '#2F80ED',
  },
];
// "private" is intentionally absent: private snippets are hidden from the CMS by
// row-level security in PostgreSQL (db/init/004_cms_role.sql).

const fields = {
  snippets: {
    id: { readonly: true, width: 'half', sort: 1 },
    title: { interface: 'input', required: true, width: 'half', sort: 2 },
    content: {
      interface: 'input-code',
      options: { lineNumber: true, lineWrapping: false },
      display: 'code-preview', // our own display extension (cms/extensions/sagas)
      display_options: { lines: 1 },
      required: true,
      width: 'full',
      sort: 3,
    },
    language: {
      special: ['m2o'],
      interface: 'select-dropdown-m2o',
      options: { template: '{{name}}' },
      display: 'related-values',
      display_options: { template: '{{name}}' },
      required: true,
      width: 'half',
      sort: 4,
    },
    visibility: {
      // Card picker from the @directus-labs/card-select-interfaces plugin.
      interface: 'radio-cards-interface',
      options: {
        gridSize: 2,
        choices: visibilityChoices.map(({ text, value, icon, description }) => ({
          text,
          value,
          description,
          icon_type: 'icon',
          icon,
        })),
      },
      display: 'labels',
      display_options: { showAsDot: false, choices: visibilityChoices },
      required: true,
      width: 'half',
      sort: 5,
    },
    user_id: {
      special: ['m2o'],
      interface: 'select-dropdown-m2o',
      options: { template: '{{username}}' },
      display: 'related-values',
      display_options: { template: '{{username}}' },
      note: 'Author. Empty = guest',
      width: 'half',
      sort: 6,
    },
    created_at: {
      interface: 'datetime',
      display: 'datetime',
      display_options: { relative: true },
      readonly: true,
      width: 'half',
      sort: 7,
    },
    expires_at: {
      interface: 'datetime',
      display: 'datetime',
      note: 'Empty = never expires',
      width: 'half',
      sort: 8,
    },
  },
  users: {
    id: { readonly: true, width: 'half', sort: 1 },
    username: { interface: 'input', required: true, width: 'half', sort: 2 },
    email: { interface: 'input', required: true, width: 'half', sort: 3 },
    created_at: {
      interface: 'datetime',
      display: 'datetime',
      display_options: { relative: true },
      readonly: true,
      width: 'half',
      sort: 4,
    },
    // The CMS DB role has no SELECT on this column, but Directus still sees it
    // in the catalog; hide the empty field from the form.
    password_hash: { hidden: true, readonly: true, sort: 99 },
  },
  languages: {
    code: { interface: 'input', note: 'Short id used by the app, e.g. "go"', width: 'half', sort: 1 },
    name: { interface: 'input', required: true, width: 'half', sort: 2 },
  },
};

// Virtual one-to-many fields: a user's snippets, a language's snippets.
const aliases = [
  { collection: 'users', field: 'snippets', fk: 'user_id', template: '{{title}} · {{visibility}}', sort: 5 },
  { collection: 'languages', field: 'snippets', fk: 'language', template: '{{title}}', sort: 3 },
];

async function configureDataModel() {
  for (const [name, meta] of Object.entries(collections)) {
    await api('PATCH', `/collections/${name}`, { meta });
  }

  for (const [collection, byField] of Object.entries(fields)) {
    for (const [field, meta] of Object.entries(byField)) {
      await api('PATCH', `/fields/${collection}/${field}`, { meta });
    }
  }

  const existing = new Set(
    (await api('GET', '/fields')).map((f) => `${f.collection}.${f.field}`),
  );
  for (const a of aliases) {
    const meta = {
      special: ['o2m'],
      interface: 'list-o2m',
      options: { template: a.template, enableCreate: false, enableSelect: false },
      display: 'related-values',
      display_options: { template: a.template },
      readonly: true,
      sort: a.sort,
    };
    if (existing.has(`${a.collection}.${a.field}`)) {
      await api('PATCH', `/fields/${a.collection}/${a.field}`, { meta });
    } else {
      await api('POST', `/fields/${a.collection}`, { field: a.field, type: 'alias', meta });
    }
    await api('PATCH', `/relations/snippets/${a.fk}`, {
      meta: { one_field: a.field, one_deselect_action: 'nullify' },
    });
  }
}

// ---------------------------------------------------------------------------
// Moderator role
// ---------------------------------------------------------------------------

// The free Directus edition only allows whole-collection permissions
// (fields: ['*'], no custom rules), so access is limited per action instead:
// moderators cannot edit app users, so they never touch password hashes.
const moderatorPermissions = [
  ['snippets', 'read'],
  ['snippets', 'update'],
  ['snippets', 'delete'],
  ['users', 'read'],
  ['users', 'delete'],
  ['languages', 'read'],
  ['languages', 'create'],
  ['languages', 'update'],
  // Read-only access to the "Sagas overview" Insights dashboard.
  ['directus_dashboards', 'read'],
  ['directus_panels', 'read'],
].map(([collection, action]) => ({ collection, action, fields: ['*'] }));

async function configureModerator() {
  let policy = await findOne('/policies', { name: { _eq: 'Moderator' } });
  if (!policy) {
    policy = await api('POST', '/policies', {
      name: 'Moderator',
      icon: 'shield_person',
      description: 'Moderates snippets and app users; manages languages',
      app_access: true,
      admin_access: false,
    });
  }

  // Replace the policy's permissions with the list above.
  const old = await api('GET', `/permissions?${q({ policy: { _eq: policy.id } })}&limit=-1&fields=id`);
  if (old.length) await api('DELETE', '/permissions', old.map((p) => p.id));
  await api(
    'POST',
    '/permissions',
    moderatorPermissions.map((p) => ({ ...p, policy: policy.id })),
  );

  let role = await findOne('/roles', { name: { _eq: 'Moderator' } });
  if (!role) {
    role = await api('POST', '/roles', {
      name: 'Moderator',
      icon: 'shield_person',
      description: 'Content moderators of Sagas',
    });
  }
  const link = await findOne('/access', { role: { _eq: role.id }, policy: { _eq: policy.id } });
  if (!link) await api('POST', '/access', { role: role.id, policy: policy.id });

  const user = await findOne('/users', { email: { _eq: MODERATOR_EMAIL } });
  if (!user) {
    await api('POST', '/users', {
      email: MODERATOR_EMAIL,
      password: MODERATOR_PASSWORD,
      first_name: 'Sagas',
      last_name: 'Moderator',
      role: role.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Content added through the CMS
// ---------------------------------------------------------------------------

const newLanguages = [
  { code: 'ts', name: 'TypeScript' },
  { code: 'sql', name: 'SQL' },
  { code: 'java', name: 'Java' },
  { code: 'yaml', name: 'YAML' },
];

const newSnippets = [
  {
    title: 'schema.sql',
    language: 'sql',
    author: 'n3cr0l0rd',
    content: [
      'SELECT s.title, u.username, s.created_at',
      'FROM snippets s',
      'LEFT JOIN users u ON u.id = s.user_id',
      "WHERE s.visibility = 'public'",
      '  AND (s.expires_at IS NULL OR s.expires_at > now())',
      'ORDER BY s.created_at DESC',
      'LIMIT 10;',
    ].join('\n'),
  },
  {
    title: 'useFetch.ts',
    language: 'ts',
    author: 'alice',
    content: [
      "import { useEffect, useState } from 'react';",
      '',
      'export function useFetch<T>(url: string) {',
      '  const [data, setData] = useState<T | null>(null);',
      '  useEffect(() => {',
      '    fetch(url).then((r) => r.json()).then(setData);',
      '  }, [url]);',
      '  return data;',
      '}',
    ].join('\n'),
  },
  {
    title: 'Main.java',
    language: 'java',
    author: 'bob',
    content: [
      'public class Main {',
      '    public static void main(String[] args) {',
      '        System.out.println("Hello from Sagas!");',
      '    }',
      '}',
    ].join('\n'),
  },
  {
    title: 'compose.yaml',
    language: 'yaml',
    author: null,
    content: [
      'services:',
      '  db:',
      '    image: postgres:17-alpine',
      '  cms:',
      '    image: directus/directus:12.6.1',
      '    ports:',
      '      - "8055:8055"',
    ].join('\n'),
  },
];

async function addContent() {
  for (const lang of newLanguages) {
    if (!(await findOne('/items/languages', { code: { _eq: lang.code } }))) {
      await api('POST', '/items/languages', lang);
    }
  }

  const users = await api('GET', '/items/users?fields=id,username&limit=-1');
  const userId = Object.fromEntries(users.map((u) => [u.username, u.id]));

  for (const { author, ...snippet } of newSnippets) {
    if (await findOne('/items/snippets', { title: { _eq: snippet.title } })) continue;
    await api('POST', '/items/snippets', {
      ...snippet,
      visibility: 'public',
      user_id: author ? userId[author] ?? null : null,
    });
  }
}

// ---------------------------------------------------------------------------
// Look & feel: theme, logo, module bar, default layouts
// ---------------------------------------------------------------------------

const DEFAULT_MODULE_BAR = [
  { type: 'module', id: 'content', enabled: true },
  { type: 'module', id: 'visual', enabled: false },
  { type: 'module', id: 'users', enabled: true },
  { type: 'module', id: 'files', enabled: true },
  { type: 'module', id: 'insights', enabled: true },
  { type: 'module', id: 'flows', enabled: true },
  { type: 'module', id: 'deployments', enabled: false },
  // Command palette (Cmd/Ctrl+K) from @directus-labs/command-palette-module.
  { type: 'module', id: 'global-search', enabled: true },
  {
    type: 'link',
    id: 'sagas-site',
    enabled: true,
    name: 'Open Sagas',
    icon: 'bolt',
    url: 'http://localhost:1223',
  },
  { type: 'module', id: 'settings', enabled: true, locked: true },
];

async function uploadLogo() {
  const existing = await findOne('/files', { filename_download: { _eq: 'sagas-logo.svg' } });
  if (existing) return existing.id;

  const svg = await readFile(new globalThis.URL('./assets/sagas-logo.svg', import.meta.url));
  const form = new FormData();
  form.append('title', 'Sagas logo');
  form.append('file', new Blob([svg], { type: 'image/svg+xml' }), 'sagas-logo.svg');
  const res = await fetch(`${URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`POST /files -> ${res.status}: ${await res.text()}`);
  return (await res.json()).data.id;
}

async function upsertGlobalPreset(collection, preset) {
  const existing = await findOne('/presets', {
    collection: { _eq: collection },
    bookmark: { _null: true },
    user: { _null: true },
    role: { _null: true },
  });
  if (existing) await api('PATCH', `/presets/${existing.id}`, preset);
  else await api('POST', '/presets', { collection, ...preset });
}

async function configureLook() {
  await api('PATCH', '/settings', {
    project_name: 'Sagas',
    project_descriptor: 'Moderation',
    project_color: '#0EA64E',
    project_logo: await uploadLogo(),
    public_note: 'Moderation panel of Sagas. Private snippets are not accessible here.',
    // Theme from the @directus-labs/dark-terminal-theme plugin, matching the
    // site's "dark hacker-terminal" look.
    default_appearance: 'dark',
    default_theme_dark: 'dark-terminal',
    module_bar: DEFAULT_MODULE_BAR,
  });

  await upsertGlobalPreset('snippets', {
    layout: 'tabular',
    layout_query: {
      tabular: {
        fields: ['title', 'content', 'language', 'visibility', 'user_id', 'created_at'],
        sort: ['-created_at'],
        limit: 50,
      },
    },
    layout_options: {
      tabular: {
        widths: { title: 180, content: 320, language: 120, visibility: 120, user_id: 120 },
        spacing: 'comfortable',
      },
    },
  });

  // Languages are a small lookup table: edit them inline like a spreadsheet
  // (@directus-labs/spreadsheet-layout plugin).
  await upsertGlobalPreset('languages', {
    layout: 'directus-labs-spreadsheet-layout',
    layout_query: { 'directus-labs-spreadsheet-layout': { fields: ['code', 'name'], sort: ['name'] } },
  });
}

// ---------------------------------------------------------------------------
// Insights dashboard (built-in panels)
// ---------------------------------------------------------------------------

const dashboardPanels = [
  {
    name: 'Snippets',
    icon: 'code',
    type: 'metric',
    position_x: 1, position_y: 1, width: 12, height: 6,
    options: { collection: 'snippets', field: 'id', function: 'count' },
  },
  {
    name: 'App users',
    icon: 'group',
    type: 'metric',
    position_x: 13, position_y: 1, width: 12, height: 6,
    options: { collection: 'users', field: 'id', function: 'count' },
  },
  {
    name: 'Languages',
    icon: 'translate',
    type: 'metric',
    position_x: 25, position_y: 1, width: 12, height: 6,
    options: { collection: 'languages', field: 'code', function: 'count' },
  },
  {
    name: 'By visibility',
    icon: 'visibility',
    type: 'pie-chart',
    position_x: 1, position_y: 7, width: 16, height: 18,
    options: {
      collection: 'snippets',
      column: 'visibility',
      function: 'count',
      donut: true,
      showLabels: true,
      legend: 'bottom',
    },
  },
  {
    name: 'Snippets per language',
    icon: 'bar_chart',
    type: 'bar-chart',
    position_x: 17, position_y: 7, width: 20, height: 18,
    options: {
      collection: 'snippets',
      xAxis: 'language',
      yAxis: 'id',
      function: 'count',
      showAxisLabels: 'both',
      showDataLabel: true,
      color: '#0EA64E',
    },
  },
  {
    name: 'Latest snippets',
    icon: 'schedule',
    type: 'list',
    position_x: 1, position_y: 25, width: 36, height: 12,
    options: {
      collection: 'snippets',
      limit: 8,
      sortField: 'created_at',
      sortDirection: 'desc',
      displayTemplate: '{{title}} · {{language.name}} · {{user_id.username}}',
      linkToItem: true,
    },
  },
];

async function configureDashboard() {
  let dashboard = await findOne('/dashboards', { name: { _eq: 'Sagas overview' } });
  if (!dashboard) {
    dashboard = await api('POST', '/dashboards', {
      name: 'Sagas overview',
      icon: 'bolt',
      color: '#0EA64E',
      note: 'Public and unlisted snippets, users and languages',
    });
  }
  // Recreate panels so the layout always matches this file.
  const old = await api('GET', `/panels?${q({ dashboard: { _eq: dashboard.id } })}&limit=-1&fields=id`);
  if (old.length) await api('DELETE', '/panels', old.map((p) => p.id));
  await api(
    'POST',
    '/panels',
    dashboardPanels.map((panel) => ({ ...panel, dashboard: dashboard.id, show_header: true })),
  );
}

// ---------------------------------------------------------------------------

async function main() {
  ({ access_token: token } = await api('POST', '/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  }));

  await configureLook();
  console.log('theme, logo and layouts configured');
  await configureDataModel();
  console.log('data model configured');
  await configureModerator();
  console.log(`moderator role ready (${MODERATOR_EMAIL})`);
  await addContent();
  console.log('content added');
  await configureDashboard();
  console.log('dashboard configured');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
