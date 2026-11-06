import { useEffect } from "react";
import { Link } from "wouter";

const EFFECTIVE = "November 6, 2026";
const EMAIL = "lusterent@gmail.com";

type Section = { heading: string; body: string[] };

const PAGES: Record<string, { title: string; intro: string; sections: Section[] }> = {
  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains what Luster Entertainment Inc. (\"Luster Ent\", \"we\") collects on lusterent.com, why, and the choices you have. Each portfolio site linked from lusterent.com is run separately and has its own privacy policy.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Inquiry form: your name, email address and message, which you choose to send us.",
          "Accounts: if you create an account or sign in, your email address and a securely hashed password, plus basic sign-in and security logs.",
          "Chat assistant: the questions you type into the chat widget and its replies, so it can answer you and so we can improve it. Please do not enter passwords, payment details or Social Security numbers in the chat.",
          "Technical data: IP address, browser type and pages requested, collected by our hosting provider and used for security and reliability.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "To reply to your inquiry, operate accounts, keep the site secure and prevent abuse, and meet legal obligations. We do not sell your personal information.",
        ],
      },
      {
        heading: "Advertising and cookies",
        body: [
          "This site may show ads served by Google AdSense. Google and its partners may use cookies to show ads based on your visits to this and other sites. You can manage ad personalization at adssettings.google.com or opt out of personalized advertising at aboutads.info. You can also block cookies in your browser settings.",
        ],
      },
      {
        heading: "Who we share it with",
        body: [
          "Service providers that host the site, send email, run the chat assistant and serve ads, only as needed to provide those services; and authorities where the law requires it.",
        ],
      },
      {
        heading: "Retention and security",
        body: [
          "We keep inquiries and account data only as long as needed for the purposes above or as the law requires. We use reasonable technical safeguards, but no system is completely secure.",
        ],
      },
      {
        heading: "Your choices and rights",
        body: [
          `You can ask us to access, correct or delete your personal information, or to stop contacting you, by emailing ${EMAIL}. Depending on where you live (for example California or the EU/UK) you may have additional rights, and we will honor them as required by law.`,
        ],
      },
      {
        heading: "Children",
        body: ["This site is not directed to children under 13 and we do not knowingly collect their information."],
      },
      {
        heading: "Changes and contact",
        body: [`We may update this policy and will change the effective date above when we do. Questions: ${EMAIL}.`],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    intro:
      "By using lusterent.com you agree to these terms. If you do not agree, please do not use the site.",
    sections: [
      {
        heading: "About this site",
        body: [
          "lusterent.com is the corporate website of Luster Entertainment Inc. It describes our portfolio of ventures. The content is for general information only.",
        ],
      },
      {
        heading: "Not investment, legal or financial advice",
        body: [
          "Nothing on this site is an offer to sell or a solicitation to buy any security, token or financial product, or investment, legal, tax or financial advice. Inquiries submitted through the contact form are requests for conversation only and do not create any obligation. Figures and descriptions may change or be incomplete. Digital assets and gaming, betting and lending products carry risk and are not available in every jurisdiction or to everyone; you are responsible for complying with the laws that apply to you.",
        ],
      },
      {
        heading: "Portfolio sites and third parties",
        body: [
          "Portfolio and affiliate sites are operated under their own terms, privacy policies and refund policies, which govern any purchase or use there. We are not responsible for third-party sites or services.",
        ],
      },
      {
        heading: "LENT Credit",
        body: [
          "LENT Credit is not open. We are not accepting applications, issuing credit or collecting Social Security numbers. Any future launch will be through a licensed lending partner and subject to its own terms and applicable law.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Do not misuse the site: no attempts to break, probe or overload it, scrape it in violation of our robots rules, submit false or unlawful content, or access accounts that are not yours.",
        ],
      },
      {
        heading: "Intellectual property",
        body: ["Site content, logos and branding belong to Luster Entertainment Inc. or its licensors. You may not copy or reuse them without permission."],
      },
      {
        heading: "Disclaimers and liability",
        body: [
          "The site is provided \"as is\" without warranties of any kind. To the fullest extent the law allows, Luster Entertainment Inc. is not liable for indirect or consequential damages arising from your use of the site.",
        ],
      },
      {
        heading: "Changes and contact",
        body: [`We may update these terms; continued use means you accept the updated version. Questions: ${EMAIL}.`],
      },
    ],
  },
  "refund-policy": {
    title: "Refunds & Payments",
    intro:
      "lusterent.com does not sell products or services and does not take payments. This page explains where refunds are handled.",
    sections: [
      {
        heading: "Purchases on portfolio sites",
        body: [
          "If you bought something on one of our portfolio or affiliate sites, that site's own refund and cancellation policy applies. Please contact that site's support first and use the policy shown at its checkout.",
        ],
      },
      {
        heading: "Cryptocurrency and $Pc payments",
        body: [
          "Blockchain transactions are generally irreversible. Where a portfolio site accepts $Pc, other digital assets or payment apps, any refund is at that site's discretion under its policy and may be issued in the same method or another method it chooses.",
        ],
      },
      {
        heading: "Need help?",
        body: [`If you cannot reach a portfolio site's support, email ${EMAIL} with the site name, date and order details and we will point you in the right direction.`],
      },
    ],
  },
};

export default function Legal({ page }: { page: keyof typeof PAGES }) {
  const content = PAGES[page];

  useEffect(() => {
    const previous = document.title;
    document.title = `${content.title} | Luster Entertainment Inc.`;
    window.scrollTo(0, 0);
    return () => {
      document.title = previous;
    };
  }, [content.title]);

  return (
    <div className="min-h-screen bg-black text-white px-6 py-24">
      <main className="max-w-3xl mx-auto">
        <Link href="/" className="text-[#D4AF37] underline text-sm" data-testid="link-legal-home">
          ← Back to Luster Ent
        </Link>
        <h1 className="text-4xl md:text-5xl font-serif text-gold-shiny mt-8 mb-3">{content.title}</h1>
        <p className="text-[#888] text-sm mb-8">Effective {EFFECTIVE}</p>
        <p className="text-[#bbb] leading-relaxed mb-10">{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className="mb-8">
            <h2 className="text-xl font-serif text-[#D4AF37] mb-3">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-[#bbb] leading-relaxed mb-3">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <nav className="mt-12 pt-6 border-t border-[#D4AF37]/20 flex flex-wrap gap-6 text-sm text-[#D4AF37]" aria-label="Legal">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Use</Link>
          <Link href="/refund-policy">Refunds & Payments</Link>
        </nav>
      </main>
    </div>
  );
}
