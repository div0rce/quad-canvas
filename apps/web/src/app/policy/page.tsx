import Link from 'next/link';

// apps/web — content policy, available in-app to moderators (LG-2). Mirrors docs/CONTENT_POLICY.md;
// the repository doc is authoritative. Static page (no data), linked from the moderator console.

export const metadata = { title: 'Content policy' };

export default function PolicyPage(): React.ReactElement {
  return (
    <main style={{ padding: '1rem', maxWidth: 720, lineHeight: 1.5 }}>
      <p>
        <Link href="/moderation">← Moderator console</Link>
      </p>
      <h1>Content policy</h1>
      <p>
        What is allowed on a canvas, what is prohibited, and how moderators respond — proportionately and
        accountably. This is the platform baseline; a tenant may add stricter rules but never weaken these
        prohibitions. Viewing is public; placing requires an eligible, authenticated account, so every
        placement is attributable.
      </p>

      <h2>Prohibited content</h2>
      <ul>
        <li><strong>Hate &amp; harassment</strong> — attacks based on a protected characteristic; targeted harassment or incitement.</li>
        <li><strong>Sexual &amp; explicit content</strong> — pornographic imagery; any sexualization of minors is reported and permanently banned.</li>
        <li><strong>Violence &amp; threats</strong> — threats, incitement, or glorification of violence or terrorism.</li>
        <li><strong>Illegal content</strong> — unlawful content or content facilitating illegal activity.</li>
        <li><strong>Private information</strong> — personal/identifying information about anyone without consent (doxxing).</li>
        <li><strong>Impersonation &amp; deception</strong> — impersonating a person or institution; coordinated deception.</li>
        <li><strong>Spam &amp; system abuse</strong> — automation to evade the cooldown, rate-limit abuse, or mass defacement.</li>
      </ul>
      <p>Content that is prohibited only <em>in aggregate</em> (e.g. a slur spelled across many cells) is governed by the aggregate.</p>

      <h2>How moderators respond</h2>
      <p>Choose the least severe action that addresses the violation. Every action is recorded in the audit log (actor, action, target, reason, time) — nothing is silent.</p>
      <p><strong>On content:</strong> revert a placement (pixel rollback) or a region (region rollback). Reverted content is removed from public history.</p>
      <p><strong>On member conduct (escalating):</strong></p>
      <ol>
        <li>Resolve or dismiss a report (triage; dismiss non-violations).</li>
        <li>Suspend — temporary removal of placement rights; active sessions revoked at once.</li>
        <li>Ban — permanent removal for egregious violations or persistent abuse.</li>
        <li>Reinstate — restore a suspended/banned member (e.g. on a successful appeal).</li>
      </ol>
      <p><strong>Emergency:</strong> an administrator may freeze the active canvas during an incident (placement stops, viewing continues).</p>

      <h2>Due process, reversal &amp; appeals</h2>
      <ul>
        <li><strong>Attribution, not surveillance</strong> — act on content and conduct using only the public handle; private data (email) is never exposed.</li>
        <li><strong>Reversibility</strong> — content rollbacks are audited compensating actions; member actions can be undone by reinstating.</li>
        <li><strong>Appeals</strong> — a suspended/banned member may appeal to the tenant&apos;s moderation team; a successful appeal leads to reinstatement.</li>
        <li><strong>Consistency</strong> — apply the policy evenly; act on violations, not on content you merely dislike.</li>
      </ul>

      <p style={{ color: '#666' }}>The repository document <code>docs/CONTENT_POLICY.md</code> is authoritative.</p>
    </main>
  );
}
