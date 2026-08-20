import type { MerchantPolicy } from "../merchant-policies";

export default function Body({
  merchant,
  ContactBlock,
}: {
  merchant: MerchantPolicy;
  ContactBlock: (p: { merchant: MerchantPolicy }) => React.ReactNode;
}) {
  return (
    <>
      <p>
        We would rather hear from you than have you wonder. Whether it is a missed
        delivery, a refund, or a question before you subscribe, reach us here.
      </p>

      <h2>Get in touch</h2>
      <ContactBlock merchant={merchant} />

      <h2>When we reply</h2>
      <p>
        Within one working day. For anything about tomorrow&apos;s delivery, message us
        before <strong>{merchant.cutoffTime}</strong> — after that the dough is already
        mixed.
      </p>

      <h2>Deliveries</h2>
      <p>We deliver across {merchant.serviceAreas}.</p>

      <h2>Refunds and cancellations</h2>
      <p>
        Cancel any time with no fee; unused wallet balance is returned in full within{" "}
        {merchant.refundDays} working days. The full detail is in our{" "}
        <a href="./refund">Cancellation &amp; Refund Policy</a>.
      </p>
    </>
  );
}
