// Enforces the app's snippet rules inside the CMS and turns silent no-ops on
// private snippets into explicit errors.
//
// Private snippets are already hidden from the CMS by row-level security in
// PostgreSQL (db/init/004_cms_role.sql). Without this hook, an update/delete of
// a private snippet by id "succeeds" with 204 while touching 0 rows, and making
// a snippet private fails with a raw SQL error (500).

import { createError } from '@directus/errors';

const InvalidSnippetError = createError('INVALID_SNIPPET', ({ reason }) => reason, 400);

const PrivateSnippetError = createError(
  'PRIVATE_SNIPPET',
  'Private snippets are visible to their authors only and cannot be managed from the CMS.',
  403,
);

const TITLE_MAX_LENGTH = 100; // same limit as the app and snippets.title VARCHAR(100)

export default ({ filter }, { database }) => {
  filter('snippets.items.create', async (payload) => {
    await validate(payload, { isCreate: true });
    return payload;
  });

  filter('snippets.items.update', async (payload, { keys }) => {
    await assertAllVisible(keys);
    await validate(payload, { isCreate: false });
    return payload;
  });

  filter('snippets.items.delete', async (keys) => {
    await assertAllVisible(keys);
    return keys;
  });

  async function validate(payload, { isCreate }) {
    if (payload.visibility === 'private') {
      throw new PrivateSnippetError();
    }

    if ('title' in payload || isCreate) {
      const title = (payload.title ?? '').trim();
      if ([...title].length > TITLE_MAX_LENGTH) {
        throw new InvalidSnippetError({ reason: `Title must be at most ${TITLE_MAX_LENGTH} characters.` });
      }
      payload.title = title || 'Untitled'; // same default as the app
    }

    if ('content' in payload || isCreate) {
      if (typeof payload.content !== 'string' || payload.content.trim() === '') {
        throw new InvalidSnippetError({ reason: 'Content must not be empty.' });
      }
    }

    if ('language' in payload || isCreate) {
      const code = typeof payload.language === 'object' ? payload.language?.code : payload.language;
      const exists = code && (await database('languages').where({ code }).first());
      if (!exists) {
        throw new InvalidSnippetError({
          reason: `Unknown language "${code ?? ''}". Add it to Languages first.`,
        });
      }
    }
  }

  // The CMS connects as a DB role that cannot see private rows, so any key that
  // does not come back from this query belongs to a private snippet (or none).
  async function assertAllVisible(keys = []) {
    if (keys.length === 0) return;
    const unique = [...new Set(keys.map(String))];
    const { count } = await database('snippets').whereIn('id', unique).count({ count: '*' }).first();
    if (Number(count) !== unique.length) {
      throw new PrivateSnippetError();
    }
  }
};
