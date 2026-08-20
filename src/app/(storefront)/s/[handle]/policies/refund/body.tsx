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
        {merchant.legalName} runs a prepaid subscription. This page explains when you are
        charged, when you are not, and how money comes back to you.
      </p>

      <h2>Skipping a delivery — free</h2>
      <p>
        You can skip any morning up to <strong>{merchant.cutoffTime}</strong> the evening
        before. A skipped morning is never charged. There is no limit and no fee.
      </p>
      <p>
        After the cutoff the dough for your order has been mixed, so that delivery is
        fixed and will be charged.
      </p>

      <h2>Pausing</h2>
      <p>
        You can pause your subscription — travelling, for example. Deliveries and charges
        stop together for the paused period and resume when you do. Nothing is charged
        while paused.
      </p>

      <h2>Cancelling and getting your balance back</h2>
      <p>
        You can cancel at any time, with no fee and no notice period. Any unused wallet
        balance is refunded <strong>in full</strong>.
      </p>
      <p>
        Refunds are made to the original payment method and are processed within{" "}
        <strong>{merchant.refundDays} working days</strong> of your request. Once we
        initiate it, the time for the money to appear depends on your bank or card issuer
        — typically a further 5–7 working days.
      </p>
      <p>
        We do not charge any fee to return your balance. To request a refund, contact us
        using the details below with the phone number on your subscription.
      </p>

      <h2>Something wrong with a delivery</h2>
      <p>
        If bread arrives damaged, stale, incorrect, or does not arrive at all, tell us
        within <strong>24 hours</strong> of the delivery window. We will credit that
        delivery back to your wallet in full, or replace it on the next delivery —
        whichever you prefer. Photographs help but are not required.
      </p>

      <h2>Deliveries we could not make</h2>
      <p>
        If we cannot deliver for a reason on our side — weather, a kitchen problem, no
        rider — that delivery is not charged, and anything already debited is credited
        back automatically. You do not need to ask.
      </p>
      <p>
        If a delivery could not be completed because nobody was reachable at the address
        during the window, it is treated as delivered and is charged, since the bread was
        baked and dispatched.
      </p>

      <h2>Contact</h2>
      <ContactBlock merchant={merchant} />
    </>
  );
}
