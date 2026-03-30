import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import Link from "next/link";

export default async function TermsPage() {
  return (
    <MarketingPageShell>
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary badge-outline">Legal</span>
                <span className="badge badge-ghost">
                  Last Updated: 28/03/2026
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Terms of Service
              </h1>
              <p className="max-w-3xl text-base-content/70">
                These Terms govern your access to and use of the MsgBuddy
                service.
              </p>
            </div>

            <div className="rounded-box border border-base-300 bg-base-200 p-5 sm:p-8">
              <div className="space-y-4 text-base-content/80">
                <p className="leading-relaxed">
                  These Terms of Service ("Terms") govern your access to and use
                  of MsgBuddy ("Company", "we", "our", "us") services, including
                  our website, applications, and messaging platform
                  (collectively, the "Service").
                </p>
                <p className="leading-relaxed">
                  By using the Service, you agree to these Terms. If you do not
                  agree, do not use the Service.
                </p>
              </div>

              <div className="divider my-7">Sections</div>

              <article className="space-y-7">
                <section id="eligibility" className="space-y-3">
                  <h2 className="text-xl font-semibold">1. Eligibility</h2>
                  <p className="leading-relaxed text-base-content/80">
                    You must be at least 18 years old and capable of forming a
                    binding contract under applicable law.
                  </p>
                  <p className="text-base-content/80">
                    By using the Service, you represent and warrant that:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>You meet all eligibility requirements</li>
                    <li>You have the authority to enter into these Terms</li>
                  </ul>
                </section>

                <section id="account-registration" className="space-y-3">
                  <h2 className="text-xl font-semibold">2. Account Registration</h2>
                  <p className="text-base-content/80">
                    To access certain features, you must create an account.
                  </p>
                  <p className="text-base-content/80">You agree to:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Provide accurate, current, and complete information</li>
                    <li>Maintain the confidentiality of your credentials</li>
                    <li>
                      Accept responsibility for all activities under your
                      account
                    </li>
                  </ul>
                  <p className="text-base-content/80">
                    We are not liable for any loss resulting from unauthorized
                    use of your account.
                  </p>
                </section>

                <section id="acceptable-use" className="space-y-3">
                  <h2 className="text-xl font-semibold">3. Acceptable Use</h2>
                  <p className="text-base-content/80">
                    You agree to use the Service only for lawful and authorized
                    purposes.
                  </p>
                  <p className="text-base-content/80">You must NOT:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Violate any applicable laws or regulations</li>
                    <li>
                      Send spam, unsolicited, deceptive, or abusive
                      communications
                    </li>
                    <li>Use the Service for fraudulent or misleading activities</li>
                    <li>Attempt unauthorized access to systems or data</li>
                    <li>Interfere with or disrupt the Service</li>
                  </ul>
                </section>

                <section id="messaging-compliance" className="space-y-3">
                  <h2 className="text-xl font-semibold">
                    4. Messaging Compliance &amp; User Obligations
                  </h2>
                  <p className="text-base-content/80">
                    If you use messaging features (including integrations with
                    platforms such as WhatsApp):
                  </p>
                  <p className="text-base-content/80">You agree that:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>
                      You will obtain{" "}
                      <span className="font-semibold">
                        clear, verifiable, and explicit opt-in consent
                      </span>{" "}
                      from recipients before sending any messages
                    </li>
                    <li>Consent must be freely given, informed, and specific</li>
                    <li>You will maintain records of such consent</li>
                    <li>
                      You will provide a{" "}
                      <span className="font-semibold">
                        clear and functional opt-out mechanism
                      </span>{" "}
                      in all communications
                    </li>
                    <li>You will honor opt-out requests immediately</li>
                  </ul>
                  <p className="text-base-content/80">You will NOT:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Use purchased, scraped, or third-party contact lists</li>
                    <li>Send unsolicited bulk messages</li>
                    <li>Send misleading, harmful, or prohibited content</li>
                  </ul>
                  <p className="text-base-content/80">
                    You will comply with all applicable platform policies,
                    including those of Meta Platforms and the WhatsApp Business
                    API.
                  </p>
                  <p className="text-base-content/80">We reserve the right to:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Monitor messaging activity for compliance</li>
                    <li>
                      Restrict, suspend, or terminate accounts violating these
                      rules
                    </li>
                  </ul>
                </section>

                <section id="data-responsibility" className="space-y-3">
                  <h2 className="text-xl font-semibold">5. Data Responsibility</h2>
                  <p className="text-base-content/80">
                    You are solely responsible for:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>The legality of data you collect and process</li>
                    <li>
                      Ensuring compliance with applicable data protection laws
                      (e.g., GDPR, local regulations)
                    </li>
                    <li>Maintaining appropriate security measures</li>
                  </ul>
                  <p className="text-base-content/80">
                    We do not verify the legality of your data.
                  </p>
                </section>

                <section id="intellectual-property" className="space-y-3">
                  <h2 className="text-xl font-semibold">6. Intellectual Property</h2>
                  <p className="text-base-content/80">
                    All rights, title, and interest in the Service, including
                    software, design, and content, are owned by the Company or
                    its licensors.
                  </p>
                  <p className="text-base-content/80">You may not:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Copy, modify, distribute, or reverse engineer the Service</li>
                    <li>Use our branding without permission</li>
                  </ul>
                </section>

                <section id="user-content" className="space-y-3">
                  <h2 className="text-xl font-semibold">7. User Content</h2>
                  <p className="text-base-content/80">
                    You retain ownership of content you upload or send using the
                    Service.
                  </p>
                  <p className="text-base-content/80">
                    By using the Service, you grant us a limited, non-exclusive
                    license to:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Store, process, and transmit your content</li>
                    <li>Use it solely to operate and improve the Service</li>
                  </ul>
                  <p className="text-base-content/80">
                    You are solely responsible for your content and its
                    consequences.
                  </p>
                </section>

                <section id="payments" className="space-y-3">
                  <h2 className="text-xl font-semibold">8. Payments &amp; Subscriptions</h2>
                  <p className="text-base-content/80">If you use paid features:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Fees are billed according to your selected plan</li>
                    <li>Payments are non-refundable unless stated otherwise</li>
                    <li>We may modify pricing with prior notice</li>
                    <li>Failure to pay may result in suspension or termination</li>
                  </ul>
                </section>

                <section id="availability" className="space-y-3">
                  <h2 className="text-xl font-semibold">9. Service Availability</h2>
                  <p className="text-base-content/80">
                    We aim to provide reliable service but do not guarantee
                    uninterrupted access.
                  </p>
                  <p className="text-base-content/80">We may:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Modify or discontinue features</li>
                    <li>Perform maintenance that may affect availability</li>
                  </ul>
                </section>

                <section id="third-party" className="space-y-3">
                  <h2 className="text-xl font-semibold">10. Third-Party Services</h2>
                  <p className="text-base-content/80">
                    The Service may integrate with third-party platforms.
                  </p>
                  <p className="text-base-content/80">We are not responsible for:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Their availability or reliability</li>
                    <li>Their data practices or policies</li>
                  </ul>
                  <p className="text-base-content/80">
                    Your use of third-party services is governed by their terms.
                  </p>
                </section>

                <section id="termination" className="space-y-3">
                  <h2 className="text-xl font-semibold">11. Termination</h2>
                  <p className="text-base-content/80">
                    We may suspend or terminate your account if:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>You violate these Terms</li>
                    <li>You misuse the Service</li>
                    <li>Required by law or regulatory authorities</li>
                  </ul>
                  <p className="text-base-content/80">
                    You may stop using the Service at any time.
                  </p>
                </section>

                <section id="liability" className="space-y-3">
                  <h2 className="text-xl font-semibold">12. Limitation of Liability</h2>
                  <p className="text-base-content/80">
                    To the maximum extent permitted by law:
                  </p>
                  <p className="text-base-content/80">We shall not be liable for:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Indirect, incidental, or consequential damages</li>
                    <li>Loss of data, revenue, or business</li>
                    <li>Issues caused by third-party services</li>
                  </ul>
                  <p className="text-base-content/80">
                    Your use of the Service is at your own risk.
                  </p>
                </section>

                <section id="indemnification" className="space-y-3">
                  <h2 className="text-xl font-semibold">13. Indemnification</h2>
                  <p className="text-base-content/80">
                    You agree to indemnify and hold harmless the Company from any
                    claims, damages, or liabilities arising from:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Your use of the Service</li>
                    <li>Your violation of these Terms</li>
                    <li>Your violation of laws or third-party rights</li>
                  </ul>
                </section>

                <section id="privacy" className="space-y-3">
                  <h2 className="text-xl font-semibold">14. Privacy</h2>
                  <p className="text-base-content/80">
                    Your use of the Service is also governed by our{" "}
                    <Link href="/privacy" className="link link-hover">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </section>

                <section id="changes" className="space-y-3">
                  <h2 className="text-xl font-semibold">15. Changes to Terms</h2>
                  <p className="text-base-content/80">
                    We may update these Terms from time to time.
                  </p>
                  <p className="text-base-content/80">
                    Continued use of the Service constitutes acceptance of
                    updated Terms.
                  </p>
                </section>

                <section id="governing-law" className="space-y-3">
                  <h2 className="text-xl font-semibold">16. Governing Law</h2>
                  <p className="text-base-content/80">
                    These Terms are governed by the laws of [Your Country/State].
                  </p>
                </section>

                <section id="contact" className="space-y-3">
                  <h2 className="text-xl font-semibold">17. Contact Information</h2>
                  <div className="rounded-box border border-base-300 bg-base-100 p-4">
                    <p className="text-sm text-base-content/80">
                      <span className="font-medium">Email:</span>{" "}
                      support@msgbuddy.com
                    </p>
                    <p className="mt-1 text-sm text-base-content/80">
                      <span className="font-medium">Address:</span> 
                      Basement , Street No 3,
          Plot No 14, Opposite
           Saraswati ITI, MBR Enclave,
           Pochanpur, Dwarka Sec 23,
           Delhi, 110077, India 
                    </p>
                  </div>
                </section>

                <div className="divider" />
                <p className="text-sm text-base-content/70">
                  By using the Service, you acknowledge that you have read,
                  understood, and agreed to these Terms of Service.
                </p>
              </article>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-3">
              <div className="rounded-box border border-base-300 bg-base-200 p-4">
                <p className="text-sm font-semibold">On this page</p>
                <ul className="menu mt-2 w-full p-0 text-sm">
                  <li>
                    <a href="#eligibility">1. Eligibility</a>
                  </li>
                  <li>
                    <a href="#account-registration">2. Account Registration</a>
                  </li>
                  <li>
                    <a href="#acceptable-use">3. Acceptable Use</a>
                  </li>
                  <li>
                    <a href="#messaging-compliance">
                      4. Messaging Compliance &amp; User Obligations
                    </a>
                  </li>
                  <li>
                    <a href="#data-responsibility">5. Data Responsibility</a>
                  </li>
                  <li>
                    <a href="#intellectual-property">6. Intellectual Property</a>
                  </li>
                  <li>
                    <a href="#user-content">7. User Content</a>
                  </li>
                  <li>
                    <a href="#payments">8. Payments &amp; Subscriptions</a>
                  </li>
                  <li>
                    <a href="#availability">9. Service Availability</a>
                  </li>
                  <li>
                    <a href="#third-party">10. Third-Party Services</a>
                  </li>
                  <li>
                    <a href="#termination">11. Termination</a>
                  </li>
                  <li>
                    <a href="#liability">12. Limitation of Liability</a>
                  </li>
                  <li>
                    <a href="#indemnification">13. Indemnification</a>
                  </li>
                  <li>
                    <a href="#privacy">14. Privacy</a>
                  </li>
                  <li>
                    <a href="#changes">15. Changes to Terms</a>
                  </li>
                  <li>
                    <a href="#governing-law">16. Governing Law</a>
                  </li>
                  <li>
                    <a href="#contact">17. Contact Information</a>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </MarketingPageShell>
  );
}
