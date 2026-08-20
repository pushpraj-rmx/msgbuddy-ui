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
      <h2>Where we deliver</h2>
      <p>
        {merchant.serviceAreas}. If you are just outside these areas, contact us — we
        sometimes can, and we would rather tell you than have you subscribe and be
        disappointed.
      </p>

      <h2>When we deliver</h2>
      <p>
        Every day of the week, Sunday included, in the delivery window you choose when
        subscribing. Bread is baked overnight and dispatched before sunrise so it arrives
        in time for breakfast.
      </p>
      <p>
        Your order for the next morning locks at <strong>{merchant.cutoffTime}</strong>{" "}
        the evening before. Anything changed after that applies from the following
        delivery.
      </p>

      <h2>Delivery charges</h2>
      <p>
        Delivery charges, where they apply, are shown on the storefront before you
        subscribe and are included in the per-delivery total you see at checkout. There
        are no charges added afterwards.
      </p>

      <h2>If you are not there</h2>
      <p>
        Our rider will attempt to reach you on the phone number on your subscription. If
        we cannot reach you, the bread is left in the safest available place at the
        address. A delivery attempted in your window is treated as delivered.
      </p>

      <h2>Missed or late deliveries</h2>
      <p>
        If we miss a delivery, or it arrives outside your window, tell us within 24 hours
        and we will credit it back to your wallet in full. See our{" "}
        <a href="./refund">Cancellation &amp; Refund Policy</a>.
      </p>

      <h2>Contact</h2>
      <ContactBlock merchant={merchant} />
    </>
  );
}
