import { db } from './db.js';

const RATES = {
  PushEvent:          () => Number(process.env.COINS_PER_COMMIT || 1),
  PullRequestEvent:   (e) => e.payload?.action === 'opened'
                              ? Number(process.env.COINS_PER_PR_OPENED || 5)
                              : (e.payload?.pull_request?.merged
                                  ? Number(process.env.COINS_PER_PR_MERGED || 20) : 0),
  IssuesEvent:        (e) => e.payload?.action === 'closed'
                              ? Number(process.env.COINS_PER_ISSUE_CLOSED || 10) : 0,
  WatchEvent:         () => Number(process.env.COINS_PER_STAR || 15),
};

export async function syncGithubActivity(profile) {
  const res = await fetch(
    `https://api.github.com/users/${profile.github_login}/events/public?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'githotel',
      },
    }
  );
  if (!res.ok) return { credited: 0, newCursor: profile.last_event_id, error: res.status };

  const events = await res.json();
  if (!Array.isArray(events) || events.length === 0)
    return { credited: 0, newCursor: profile.last_event_id };

  let credited = 0;
  let commitCount = 0;
  const cap = Number(process.env.DAILY_COMMIT_CAP || 50);
  const txRows = [];

  for (const ev of events) {
    if (ev.id === profile.last_event_id) break;
    const rate = RATES[ev.type];
    if (!rate) continue;

    let amount = rate(ev);
    if (ev.type === 'PushEvent') {
      const commits = ev.payload?.commits?.length || 1;
      const allowed = Math.max(0, cap - commitCount);
      const counted = Math.min(commits, allowed);
      commitCount += counted;
      amount = counted * Number(process.env.COINS_PER_COMMIT || 1);
    }
    if (amount <= 0) continue;

    credited += amount;
    txRows.push({
      user_id: profile.id,
      amount,
      reason: ev.type.toLowerCase(),
      meta: { event_id: ev.id, repo: ev.repo?.name },
    });
  }

  const newCursor = events[0].id;

  if (credited > 0) {
    await db.from('transactions').insert(txRows);
    await db.rpc('increment_coins', { p_user: profile.id, p_amount: credited })
      .then(null, async () => {
        await db.from('profiles')
          .update({ coins: (profile.coins || 0) + credited })
          .eq('id', profile.id);
      });
  }

  await db.from('profiles')
    .update({ last_event_id: newCursor, last_synced_at: new Date().toISOString() })
    .eq('id', profile.id);

  return { credited, newCursor };
}
