function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@parko.app";

export default function Terms() {
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
          <h1>Parko Terms &amp; Conditions</h1>
          <p>
            <em>Last updated: 23 September 2026</em>
          </p>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-section">
          <p>
            These Terms &amp; Conditions govern your use of Parko, a service
            that helps people find parking in Prishtina, Kosovo.
          </p>

          <h2>1. Acceptance of these terms</h2>
          <p>
            By accessing or using Parko, you agree to these Terms. If you do not
            agree, please do not use the service.
          </p>

          <h2>2. The Parko service</h2>
          <p>
            Parko provides parking information, including real-time and
            community-supplied availability reports. It is an informational
            parking-finder service, not a booking, reservation, or payment
            service. We do not guarantee that a parking space will be available,
            lawful to use, or suitable when you arrive.
          </p>

          <h2>3. Accounts and security</h2>
          <p>
            You are responsible for the accuracy of the information you provide
            and for keeping your account credentials confidential. You must tell
            us promptly if you believe your account has been used without
            permission.
          </p>

          <h2>4. Community content</h2>
          <p>
            When you publish a report, photo, post, comment, or other content,
            you are responsible for it. Community content must be accurate,
            lawful, and respectful. Do not submit misleading parking reports,
            abusive material, unsafe content, or content that violates another
            person&apos;s rights. Parko may remove or moderate content that does
            not meet these standards.
          </p>
          <p>
            Prohibited community content includes harassment, hate speech,
            sexual or violent content, threats, spam, fraud, impersonation,
            personal data shared without permission, and deliberately false or
            unsafe parking information. Use the in-app Report and Block controls
            when you encounter abuse. Repeated or serious violations can result
            in content removal or account suspension.
          </p>

          <h2>5. Prohibited uses</h2>
          <p>
            You may not misuse Parko, interfere with the service, attempt
            unauthorized access, scrape or overload the service, impersonate
            another person, submit false information, or use Parko for unlawful
            activity.
          </p>

          <h2>6. Parking decisions</h2>
          <p>
            You remain responsible for checking signs, local rules, payment
            requirements, access restrictions, and the safety of any place you
            choose to park. Parko is not responsible for parking tickets,
            towing, fines, damage, loss, or other consequences of parking
            decisions made using the service.
          </p>

          <h2>7. Disclaimer of warranty</h2>
          <p>
            Parko is provided on an &quot;as is&quot; and &quot;as
            available&quot; basis. To the extent permitted by law, we make no
            warranty that information will be complete, accurate, current,
            uninterrupted, or error-free.
          </p>

          <h2>8. Limitation of liability</h2>
          <p>
            To the extent permitted by law, Parko will not be liable for
            indirect, incidental, special, consequential, or punitive damages
            arising from your use of, or inability to use, the service.
          </p>

          <h2>9. Governing law</h2>
          <p>
            These Terms are governed by the laws of Kosovo. Any dispute related
            to these Terms will be handled by the competent courts of Kosovo.
          </p>

          <h2>10. Changes and contact</h2>
          <p>
            We may update these Terms from time to time. The current version
            will show its publication date above. Questions about these Terms: {" "}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
        </section>
      </main>
    </div>
  );
}
