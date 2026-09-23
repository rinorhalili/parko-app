function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@parko.app";

export default function PrivacyPolicy() {
  return (
    <div className="screen settings-screen">
      <header className="settings-header">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            goHome();
          }}
        >
          Back
        </a>
        <div>
          <small>Parko</small>
          <h1>Parko Privacy Policy</h1>
          <p>
            <em>Last updated: 23 September 2026</em>
          </p>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <p>
            Parko ("we", "our", "the app") helps you find and report parking
            availability in Prishtina. This policy explains what data we
            collect, why, and how you can control it.
          </p>
          <h2>1. Information we collect</h2>
          <p>
            <strong>Account information.</strong> When you register, we collect
            your name, username, email address, and a password (stored as a
            secure hash — we never store or can see your actual password). You
            can optionally add a profile photo and short bio.
          </p>
          <p>
            <strong>Location data.</strong> To show nearby parking and route you
            there, the app requests your device location. If you report a
            parking spot&apos;s status or use "Parked Here," we store the
            coordinates of that report along with a timestamp, and, if you
            choose to add one, a short note. If you&apos;re signed in, this
            history is tied to your account so you can look it up later.
          </p>
          <p>
            <strong>Community content.</strong> Posts, comments, and reactions
            you choose to publish are stored along with your username and, if
            you attach a photo, the image itself.
          </p>
          <p>
            <strong>Push notifications.</strong> If you enable notifications, we
            store a device token so we can deliver alerts about parking updates,
            replies, and account security events. You can disable this at any
            time in settings.
          </p>
          <p>
            <strong>Technical and security data.</strong> To keep accounts
            secure, we log sign-in sessions with an IP address and
            device/browser identifier (user agent), and we keep an audit trail
            of account and moderation actions. This data is used only for
            security and abuse prevention, not for advertising or profiling.
          </p>
          <p>
            <strong>Diagnostic data.</strong> The app can send basic crash and
            error reports (what happened, what screen, when) to help us fix
            bugs. We deliberately strip anything that looks like a search query,
            note, address, or coordinate before this leaves your device, and —
            as of this build — this reporting isn&apos;t even connected to a
            live endpoint by default.
          </p>

          <h2>2. What we don&apos;t do</h2>
          <ul>
            <li>We don&apos;t use Google Analytics, Meta Pixel, advertising SDKs, or ads.</li>
            <li>We may use a self-hosted, cookie-free Umami service for basic aggregate usage analytics, such as page visits, to improve Parko. It is not used for advertising or profiling.</li>
            <li>We don&apos;t sell or share your data with advertisers.</li>
          </ul>

          <h2>3. Third-party services</h2>
          <p>
            Some features load data from outside services, which — like any map
            or routing service — receive your IP address as part of the
            technical request:
          </p>
          <ul>
            <li>
              <strong>Map tiles</strong> are loaded from OpenStreetMap and
              CARTO, so your device requests map images directly from them.
            </li>
            <li>
              <strong>Walking/driving directions</strong> are calculated using
              OSRM (Open Source Routing Machine), a public routing service.
            </li>
            <li>
              <strong>Address search</strong> may pass through a geocoding
              provider to convert what you type into a location.
            </li>
          </ul>
          <p>
            None of these services receive your Parko account details — only the
            coordinates needed to draw a map or a route.
          </p>

          <h2>4. Why we collect this</h2>
          <ul>
            <li>To show you nearby available parking and give directions.</li>
            <li>To let you track your own parking history.</li>
            <li>
              To power community features (posts, reports, reactions) you opt
              into.
            </li>
            <li>To keep your account secure and prevent abuse.</li>
            <li>To diagnose and fix technical problems.</li>
          </ul>
          <p>
            We don&apos;t collect data we don&apos;t have a use for — for
            example, we don&apos;t ask for your phone number, real address, or
            payment details, because the app doesn&apos;t need them yet.
          </p>

          <h2>5. Your choices and rights</h2>
          <ul>
            <li>
              <strong>Location:</strong> you can deny or revoke location
              permission at any time in your device settings; core map browsing
              still works without it.
            </li>
            <li>
              <strong>Notifications:</strong> toggle push notifications off
              in-app at any time.
            </li>
            <li>
              <strong>Access &amp; correction:</strong> you can view and edit
              your profile information from the app&apos;s Profile screen.
            </li>
            <li>
              <strong>Deletion:</strong> you can permanently delete your account
              from Profile → Account → Delete account, or start the process on
              our <a href="/delete-account">account deletion page</a>.
            </li>
          </ul>

          <h2>6. Data retention</h2>
          <p>
            We keep your account data while your account is active. Parking
            reports expire automatically after a set time (they&apos;re
            time-limited by design, since parking availability changes
            constantly). Session and audit logs are kept only as long as needed
            for security purposes.
          </p>

          <h2>7. Children</h2>
          <p>
            Parko is not directed at children, and we don&apos;t knowingly
            collect data from anyone under 13 (or the minimum age in your
            country).
          </p>

          <h2>8. Changes to this policy</h2>
          <p>
            If this policy changes, we&apos;ll update the date at the top.
            Continued use of the app after a change means you accept the update.
          </p>

          <h2>9. Contact</h2>
          <p>Questions about this policy or your data: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
        </section>
      </main>
    </div>
  );
}
