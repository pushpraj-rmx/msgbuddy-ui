import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import Link from "next/link";

export default async function PrivacyPolicyPage() {
  return (
    <MarketingPageShell>
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary badge-outline">Legal</span>
                <span className="badge badge-ghost">
                  Last Updated: 27/03/2026
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Privacy Policy
              </h1>
              <p className="max-w-3xl text-base-content/70">
                This Privacy Policy describes how we collect, use, and protect
                your information when you use the Service.
              </p>
            </div>

            <div className="rounded-box border border-base-300 bg-base-200 p-5 sm:p-8">
              <div className="space-y-4 text-base-content/80">
                <p className="leading-relaxed">
                  This Privacy Policy describes how [Your Company Name]
                  ("Company", "we", "our", "us") collects, uses, and protects
                  your information when you use our services (the "Service").
                </p>
                <p className="leading-relaxed">
                  By using the Service, you agree to the collection and use of
                  information in accordance with this policy.
                </p>
              </div>

              <div className="divider my-7">Sections</div>

              <article className="space-y-7">
                <section id="information-we-collect" className="space-y-3">
                  <h2 className="text-xl font-semibold">1. Information We Collect</h2>

                  <div className="space-y-4">
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <h3 className="font-semibold">1.1 Information You Provide</h3>
                      <p className="mt-2 text-sm text-base-content/80">
                        We collect information you provide directly, including:
                      </p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                        <li>Name, email address, phone number</li>
                        <li>Account credentials</li>
                        <li>Business information</li>
                        <li>Contact lists and customer data you upload</li>
                      </ul>
                    </div>

                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <h3 className="font-semibold">1.2 Messaging Data</h3>
                      <p className="mt-2 text-sm text-base-content/80">
                        When you use messaging features (e.g., WhatsApp
                        integrations), we may process:
                      </p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                        <li>Message content</li>
                        <li>
                          Message metadata (timestamps, status, delivery info)
                        </li>
                        <li>Recipient contact details</li>
                      </ul>
                    </div>

                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <h3 className="font-semibold">
                        1.3 Automatically Collected Information
                      </h3>
                      <p className="mt-2 text-sm text-base-content/80">
                        We may automatically collect:
                      </p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                        <li>IP address</li>
                        <li>Browser type and device information</li>
                        <li>Usage data and logs</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section id="how-we-use" className="space-y-3">
                  <h2 className="text-xl font-semibold">2. How We Use Information</h2>
                  <p className="text-base-content/80">
                    We use your information to:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Provide, operate, and maintain the Service</li>
                    <li>Process and deliver messages</li>
                    <li>Improve performance and user experience</li>
                    <li>Monitor usage and prevent abuse</li>
                    <li>Communicate with you (updates, support, alerts)</li>
                  </ul>
                </section>

                <section id="messaging-data" className="space-y-3">
                  <h2 className="text-xl font-semibold">
                    3. Messaging &amp; Communication Data
                  </h2>
                  <p className="text-base-content/80">
                    We process messaging data solely to:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>
                      Deliver messages through integrated platforms such as
                      WhatsApp Business API
                    </li>
                    <li>Provide analytics and delivery insights</li>
                  </ul>
                  <div className="alert alert-info alert-soft mt-3">
                    <span className="text-sm">
                      We do not use message content for advertising purposes.
                    </span>
                  </div>
                </section>

                <section id="user-responsibility" className="space-y-3">
                  <h2 className="text-xl font-semibold">
                    4. User Responsibility for Data
                  </h2>
                  <p className="text-base-content/80">You are responsible for:</p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>
                      Ensuring you have lawful grounds to collect and use
                      customer data
                    </li>
                    <li>Obtaining valid consent before messaging users</li>
                    <li>Complying with applicable data protection laws</li>
                  </ul>
                  <p className="text-base-content/80">
                    We act as a service provider (processor) for data you upload.
                  </p>
                </section>

                <section id="sharing" className="space-y-3">
                  <h2 className="text-xl font-semibold">5. Sharing of Information</h2>
                  <p className="text-base-content/80">
                    We may share information with:
                  </p>

                  <div className="space-y-4">
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <h3 className="font-semibold">5.1 Service Providers</h3>
                      <p className="mt-2 text-sm text-base-content/80">
                        Third-party vendors who help us operate the Service
                        (hosting, analytics, payments).
                      </p>
                    </div>

                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <h3 className="font-semibold">5.2 Platform Integrations</h3>
                      <p className="mt-2 text-sm text-base-content/80">
                        When you use integrations (e.g., WhatsApp), data is
                        shared with relevant platforms, including Meta
                        Platforms.
                      </p>
                    </div>

                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <h3 className="font-semibold">5.3 Legal Requirements</h3>
                      <p className="mt-2 text-sm text-base-content/80">
                        We may disclose information if required by law or in
                        response to valid legal requests.
                      </p>
                    </div>
                  </div>
                </section>

                <section id="retention" className="space-y-3">
                  <h2 className="text-xl font-semibold">6. Data Retention</h2>
                  <p className="text-base-content/80">
                    We retain information only as long as necessary to:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Provide the Service</li>
                    <li>Comply with legal obligations</li>
                    <li>Resolve disputes and enforce agreements</li>
                  </ul>
                  <p className="text-base-content/80">
                    You may request deletion of your data, subject to legal and
                    operational requirements.
                  </p>
                </section>

                <section id="security" className="space-y-3">
                  <h2 className="text-xl font-semibold">7. Data Security</h2>
                  <p className="text-base-content/80">
                    We implement reasonable technical and organizational measures
                    to protect your data.
                  </p>
                  <p className="text-base-content/80">
                    However, no system is completely secure, and we cannot
                    guarantee absolute security.
                  </p>
                </section>

                <section id="your-rights" className="space-y-3">
                  <h2 className="text-xl font-semibold">8. Your Rights</h2>
                  <p className="text-base-content/80">
                    Depending on your jurisdiction, you may have rights to:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Access your data</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion</li>
                    <li>Restrict or object to processing</li>
                  </ul>
                  <p className="text-base-content/80">
                    To exercise these rights, contact us using the details
                    below.
                  </p>
                </section>

                <section id="cookies" className="space-y-3">
                  <h2 className="text-xl font-semibold">9. Cookies &amp; Tracking</h2>
                  <p className="text-base-content/80">
                    We may use cookies and similar technologies to:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base-content/80">
                    <li>Improve functionality</li>
                    <li>Analyze usage</li>
                    <li>Enhance user experience</li>
                  </ul>
                  <p className="text-base-content/80">
                    You can control cookies through your browser settings.
                  </p>
                </section>

                <section id="international-transfers" className="space-y-3">
                  <h2 className="text-xl font-semibold">
                    10. International Data Transfers
                  </h2>
                  <p className="text-base-content/80">
                    Your data may be processed and stored in countries outside
                    your jurisdiction.
                  </p>
                  <p className="text-base-content/80">
                    We take appropriate measures to ensure data protection
                    standards are maintained.
                  </p>
                </section>

                <section id="third-party-links" className="space-y-3">
                  <h2 className="text-xl font-semibold">11. Third-Party Links</h2>
                  <p className="text-base-content/80">
                    Our Service may contain links to third-party websites.
                  </p>
                  <p className="text-base-content/80">
                    We are not responsible for their privacy practices or
                    content.
                  </p>
                </section>

                <section id="children" className="space-y-3">
                  <h2 className="text-xl font-semibold">12. Children’s Privacy</h2>
                  <p className="text-base-content/80">
                    The Service is not intended for individuals under 18.
                  </p>
                  <p className="text-base-content/80">
                    We do not knowingly collect personal data from children.
                  </p>
                </section>

                <section id="changes" className="space-y-3">
                  <h2 className="text-xl font-semibold">13. Changes to This Policy</h2>
                  <p className="text-base-content/80">
                    We may update this Privacy Policy from time to time.
                  </p>
                  <p className="text-base-content/80">
                    Continued use of the Service after changes constitutes
                    acceptance of the updated policy.
                  </p>
                </section>

                <section id="contact" className="space-y-3">
                  <h2 className="text-xl font-semibold">14. Contact Information</h2>
                  <div className="rounded-box border border-base-300 bg-base-100 p-4">
                    <p className="text-sm text-base-content/80">
                      <span className="font-medium">Email:</span>{" "}
                      support@msgbuddy.com
                    </p>
                    <p className="mt-1 text-sm text-base-content/80">
                      <span className="font-medium">Address:</span> Basement , Street No 3,
           Plot No 14, Opposite
           Saraswati ITI, MBR Enclave,
           Pochanpur, Dwarka Sec 23,
           Delhi, 110077, India 
                    </p>
                  </div>
                  <p className="text-sm text-base-content/70">
                    Your use of the Service is also governed by our{" "}
                    <Link href="/terms" className="link link-hover">
                      Terms of Service
                    </Link>
                    .
                  </p>
                </section>

                <div className="divider" />
                <p className="text-sm text-base-content/70">
                  By using the Service, you acknowledge that you have read and
                  understood this Privacy Policy.
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
                    <a href="#information-we-collect">1. Information We Collect</a>
                  </li>
                  <li>
                    <a href="#how-we-use">2. How We Use Information</a>
                  </li>
                  <li>
                    <a href="#messaging-data">3. Messaging &amp; Communication Data</a>
                  </li>
                  <li>
                    <a href="#user-responsibility">4. User Responsibility for Data</a>
                  </li>
                  <li>
                    <a href="#sharing">5. Sharing of Information</a>
                  </li>
                  <li>
                    <a href="#retention">6. Data Retention</a>
                  </li>
                  <li>
                    <a href="#security">7. Data Security</a>
                  </li>
                  <li>
                    <a href="#your-rights">8. Your Rights</a>
                  </li>
                  <li>
                    <a href="#cookies">9. Cookies &amp; Tracking</a>
                  </li>
                  <li>
                    <a href="#international-transfers">
                      10. International Data Transfers
                    </a>
                  </li>
                  <li>
                    <a href="#third-party-links">11. Third-Party Links</a>
                  </li>
                  <li>
                    <a href="#children">12. Children’s Privacy</a>
                  </li>
                  <li>
                    <a href="#changes">13. Changes to This Policy</a>
                  </li>
                  <li>
                    <a href="#contact">14. Contact Information</a>
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
