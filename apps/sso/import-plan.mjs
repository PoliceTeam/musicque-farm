const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,23}$/;

export const accountSummary = ({ app, id, username }) => ({ app, id, username });

/** Pure planning: explicit decisions only; merging an existing subject preserves its password. */
export function planImport(accounts, resolutions = {}, existingUsers = []) {
  const entries = [];
  const collisions = [];
  const grouped = new Map();
  for (const account of accounts.filter((item) => !item.linked)) {
    const group = grouped.get(account.username) ?? [];
    group.push(account);
    grouped.set(account.username, group);
  }
  const candidates = [];
  for (const [username, group] of grouped) {
    if (group.some((item) => item.foreignLink)) {
      collisions.push({ username, reason: 'tài khoản đã liên kết issuer khác', accounts: group.map(accountSummary) });
      continue;
    }
    const resolution = resolutions[username] ?? '';
    if (resolution && !/^(merge:(farm|musicque)|merge-keycloak:[^:]+|rename-(farm|musicque):[^:]+)$/.test(resolution)) {
      collisions.push({ username, reason: 'resolution không hợp lệ', accounts: group.map(accountSummary) });
      continue;
    }
    const [action, value] = resolution.split(':');
    const farm = group.find((item) => item.app === 'farm');
    const musicque = group.find((item) => item.app === 'musicque');
    if (group.length > 1) {
      if (group.length !== 2 || !farm || !musicque) {
        collisions.push({ username, reason: 'trùng tên trong cùng nguồn', accounts: group.map(accountSummary) });
      } else if (action === 'merge' && ['farm', 'musicque'].includes(value)) {
        candidates.push({ username, accounts: group, passwordFrom: value === 'farm' ? farm : musicque });
      } else if (['rename-farm', 'rename-musicque'].includes(action) && value) {
        const renamed = action === 'rename-farm' ? farm : musicque;
        candidates.push({ username, accounts: group.filter((item) => item !== renamed) });
        candidates.push({ username: value.toLowerCase(), accounts: [renamed] });
      } else
        collisions.push({ username, reason: 'cần merge hoặc rename rõ ràng', accounts: group.map(accountSummary) });
    } else {
      candidates.push({
        username: action === `rename-${group[0].app}` && value ? value.toLowerCase() : username,
        accounts: group,
      });
    }
  }
  for (const entry of candidates) {
    const { username, accounts: group } = entry;
    const existing = existingUsers.find((item) => item.username.toLowerCase() === username);
    const decision = resolutions[group[0].username];
    const owned = existing && group.every((item) => existing.attributes?.[`${item.app}UserId`]?.[0] === item.id);
    const conflictingLink =
      existing &&
      group.some((item) => {
        const ids = existing.attributes?.[`${item.app}UserId`];
        return ids?.length && (ids.length !== 1 || ids[0] !== item.id);
      });
    const reason = !usernamePattern.test(username)
      ? 'username không hợp lệ'
      : candidates.filter((item) => item.username === username).length > 1
        ? 'rename tạo trùng tên trong kế hoạch'
        : existing && !owned && (decision !== `merge-keycloak:${existing.id}` || conflictingLink)
          ? 'username đã tồn tại trong Keycloak; cần merge-keycloak:<subject> hoặc rename'
          : undefined;
    if (reason)
      collisions.push({
        username,
        reason,
        ...(existing
          ? {
              keycloakId: existing.id,
              legacyIds: { farm: existing.attributes?.farmUserId, musicque: existing.attributes?.musicqueUserId },
            }
          : {}),
        accounts: group.map(accountSummary),
      });
    else entries.push({ ...entry, existing });
  }
  return { entries, collisions };
}
