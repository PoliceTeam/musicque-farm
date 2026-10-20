// Imports Farm (Postgres) and Musicque (Mongo) accounts into Keycloak with their original password hashes
// (verified by the chibi-legacy provider, rehashed on first login), then links each app account to the
// Keycloak subject. Dry run by default; re-runnable. Never merges by username/email unless a resolution says so.
//
// FARM_DATABASE_URL / MUSICQUE_MONGODB_URI from environment; --farm and/or --musicque
// node import-legacy-users.mjs --musicque [--env .env] [--resolutions file] [--apply]
// Resolutions JSON: { "<username>": "merge:farm" | "merge:musicque" | "rename-farm:<name>" | "rename-musicque:<name>" }
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';
import pg from 'pg';
import { planImport, accountSummary as summary } from './import-plan.mjs';

async function main() {
  const { values: args } = parseArgs({
    options: {
      farm: { type: 'boolean' },
      musicque: { type: 'boolean' },
      apply: { type: 'boolean' },
      env: { type: 'string' },
      resolutions: { type: 'string' },
      report: { type: 'string' },
    },
  });
  if (!args.farm && !args.musicque) throw new Error('Chọn --farm và/hoặc --musicque; URI chỉ đọc từ môi trường.');
  if (args.farm && !process.env.FARM_DATABASE_URL) throw new Error('Thiếu FARM_DATABASE_URL');
  if (args.musicque && !process.env.MUSICQUE_MONGODB_URI) throw new Error('Thiếu MUSICQUE_MONGODB_URI');
  const apply = process.argv.includes('--apply');
  const env = {
    ...Object.fromEntries(
      (await readFile(args.env ?? new URL('.env', import.meta.url), 'utf8'))
        .split('\n')
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    ),
    ...process.env,
  };
  const resolutions = args.resolutions ? JSON.parse(await readFile(args.resolutions, 'utf8')) : {};
  const base = (env.SSO_ADMIN_URL || env.SSO_URL).replace(/\/$/, '');
  const issuer = `${env.SSO_URL.replace(/\/$/, '')}/realms/sso`;

  const token = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: env.SSO_ADMIN_USERNAME,
      password: env.SSO_ADMIN_PASSWORD,
    }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Keycloak admin login failed (${response.status})`);
    return (await response.json()).access_token;
  });

  async function keycloak(path, init = {}) {
    const response = await fetch(`${base}/admin/realms/sso${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (response.status === 409) return { conflict: true };
    if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status})`);
    return response.status === 201 || response.status === 204 ? null : response.json();
  }

  const googleEnabled = await keycloak('/identity-provider/instances')
    .then((list) => list.some((item) => item.alias === 'google' && item.enabled))
    .catch(() => false);

  // ── Read both legacy stores ───────────────────────────────────────────────
  const farmDb = args.farm ? new pg.Client({ connectionString: process.env.FARM_DATABASE_URL }) : undefined;
  const mongo = args.musicque ? new MongoClient(process.env.MUSICQUE_MONGODB_URI) : undefined;
  try {
    await farmDb?.connect();
    const { rows: farmRows } = farmDb
      ? await farmDb.query(
          `select p.id, p.name, p.username, p.email, p.password_hash,
          (select subject from identities i where i.player_id = p.id and i.provider = 'google' limit 1) as google,
          exists(select 1 from identities i where i.player_id = p.id and i.provider = $1) as linked
     from players p where not p.guest`,
          [`sso:${issuer}`],
        )
      : { rows: [] };
    await mongo?.connect();
    const musicqueUsers = mongo?.db().collection('users');
    const musicqueRows = musicqueUsers
      ? await musicqueUsers
          .find({}, { projection: { username: 1, displayName: 1, password: 1, ssoIssuer: 1, ssoSubject: 1, role: 1 } })
          .toArray()
      : [];

    const farm = farmRows.map((row) => ({
      app: 'farm',
      id: row.id,
      username: (row.username ?? `f-${row.id.slice(0, 8)}`).toLowerCase(),
      generatedUsername: !row.username,
      name: row.name,
      email: row.email,
      hash: row.password_hash,
      google: row.google,
      linked: row.linked,
    }));
    const musicque = musicqueRows.map((row) => ({
      app: 'musicque',
      id: String(row._id),
      rawId: row._id,
      username: String(row.username).toLowerCase(),
      name: row.displayName || row.username,
      email: null,
      hash: row.password ?? null,
      google: null,
      linked: row.ssoIssuer === issuer && !!row.ssoSubject,
      foreignLink: !!row.ssoSubject && row.ssoIssuer !== issuer,
      admin: row.role === 'admin',
    }));

    // ── Plan: one Keycloak user per account, collisions only with an explicit resolution ──
    const report = { apply, issuer, created: [], linkedExisting: [], skipped: [], collisions: [], warnings: [] };
    // Include renamed targets when checking existing Keycloak accounts before any write.
    const names = new Set([...farm, ...musicque].map((item) => item.username));
    for (const decision of Object.values(resolutions)) {
      if (/^rename-(farm|musicque):/.test(decision)) names.add(decision.split(':')[1].toLowerCase());
    }
    const existingUsers = (
      await Promise.all([...names].map((name) => keycloak(`/users?username=${encodeURIComponent(name)}&exact=true`)))
    ).flat();
    const { entries: plan, collisions } = planImport([...farm, ...musicque], resolutions, existingUsers);
    report.collisions = collisions;
    // Apply is all-or-nothing at planning time. Fix all collisions before importing any account.
    for (const entry of apply && collisions.length ? [] : plan) {
      const { username, accounts } = entry;
      const passwordSource = entry.passwordFrom ?? accounts[0];
      const google = accounts.find((account) => account.google)?.google;
      if (!passwordSource.hash && !(google && googleEnabled) && !accounts.some((account) => account.email))
        report.warnings.push({ reason: 'không có mật khẩu, Google hay email: chỉ admin đặt mật khẩu được', username });
      if (google && !googleEnabled)
        report.warnings.push({ reason: 'tài khoản Google nhưng Keycloak chưa bật Google', username });
      const email = accounts.find((account) => account.email)?.email ?? undefined;
      const attributes = Object.fromEntries(accounts.map((account) => [`${account.app}UserId`, [account.id]]));

      const existing = entry.existing;
      let subject = existing?.id;
      if (existing) {
        // Explicit merge only adds ownership attributes, never credentials or profile.
        if (apply)
          await keycloak(`/users/${subject}`, {
            method: 'PUT',
            body: {
              attributes: { ...existing.attributes, ...attributes },
            },
          });
        report.linkedExisting.push({ username, accounts: accounts.map(summary) });
      } else {
        const user = {
          username,
          enabled: true,
          firstName: String(accounts.find((account) => account.app === 'farm')?.name ?? accounts[0].name).slice(0, 40),
          ...(email ? { email, emailVerified: false } : {}),
          attributes,
          ...(passwordSource.hash
            ? {
                credentials: [
                  {
                    type: 'password',
                    credentialData: JSON.stringify({
                      hashIterations: 0,
                      algorithm: 'chibi-legacy',
                      additionalParameters: {},
                    }),
                    secretData: JSON.stringify({ value: passwordSource.hash, salt: '', additionalParameters: {} }),
                  },
                ],
              }
            : {}),
          ...(google && googleEnabled
            ? { federatedIdentities: [{ identityProvider: 'google', userId: google, userName: email ?? google }] }
            : {}),
        };
        if (!apply) {
          report.created.push({ username, accounts: accounts.map(summary), dryRun: true });
          continue;
        }
        const result = await keycloak('/users', { method: 'POST', body: user });
        if (result?.conflict) {
          report.skipped.push({ reason: 'trùng username/email trong Keycloak', accounts: accounts.map(summary) });
          continue;
        }
        [{ id: subject }] = await keycloak(`/users?username=${encodeURIComponent(username)}&exact=true`);
        report.created.push({ username, accounts: accounts.map(summary) });
      }
      if (!apply) continue;
      for (const account of accounts) {
        if (account.app === 'farm')
          await farmDb.query(
            'insert into identities (provider, subject, player_id) values ($1, $2, $3) on conflict do nothing',
            [`sso:${issuer}`, subject, account.id],
          );
        else
          await musicqueUsers.updateOne(
            // Old documents may carry ssoSubject: null; never overwrite a real link.
            { _id: account.rawId, $or: [{ ssoSubject: { $exists: false } }, { ssoSubject: null }] },
            { $set: { ssoIssuer: issuer, ssoSubject: subject } },
          );
      }
    }

    const output = args.report ?? 'import-report.json';
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    await chmod(output, 0o600);
    console.log(
      `${apply ? 'Đã import' : 'Chạy thử (thêm --apply để ghi)'}: tạo ${report.created.length}, dùng lại ${report.linkedExisting.length}, ` +
        `bỏ qua ${report.skipped.length}, trùng tên cần quyết định ${report.collisions.length}, cảnh báo ${report.warnings.length}. ` +
        `Chi tiết: ${output}`,
    );

    if (report.collisions.length || report.skipped.length) process.exitCode = 2;
  } finally {
    await Promise.allSettled([farmDb?.end(), mongo?.close()]);
  }
}

main().catch(() => {
  console.error(
    'Import thất bại. Kiểm tra lựa chọn --musicque/--farm, biến URI, env, kết nối và quyền; không in lỗi DB có thể chứa credential. Chạy lại dry-run để đối chiếu trạng thái.',
  );
  process.exitCode = 1;
});
