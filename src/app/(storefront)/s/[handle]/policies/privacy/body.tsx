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
        This policy explains what {merchant.legalName} collects when you subscribe to{" "}
        {merchant.brandName}, why, and what we do not do with it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your phone number</strong> — it identifies your subscription and is how
          we send delivery reminders and confirmations.
        </li>
        <li>
          <strong>Your name and delivery address</strong> — to bake for and deliver to you.
        </li>
        <li>
          <strong>Your order history and wallet ledger</strong> — what was delivered,
          skipped, charged and credited.
        </li>
      </ul>

      <h2>Payment information</h2>
      <p>
        We do <strong>not</strong> collect or store your card, UPI or bank details.
        Payments are processed by Razorpay, and card data is handled entirely on their
        PCI-DSS compliant systems. We receive only a payment reference and its status.
      </p>

      <h2>How we use it</h2>
      <p>
        Solely to run your subscription: baking the right quantity, delivering to the
        right address, charging the right amount, and messaging you about your own
        deliveries. We do not use your data for advertising.
      </p>

      <h2>Who we share it with</h2>
      <p>We share the minimum necessary with:</p>
      <ul>
        <li><strong>Razorpay</strong> — to take payments and issue refunds.</li>
        <li>
          <strong>Our delivery staff</strong> — your name, address and phone number for
          the delivery being made.
        </li>
        <li>
          <strong>Our software provider</strong> — the subscription platform that stores
          this data on our behalf, under instruction.
        </li>
      </ul>
      <p>
        We do not sell your data, and we do not share it with anyone else except where
        required by law.
      </p>

      <h2>Messaging</h2>
      <p>
        We message you about your own deliveries: the evening reminder, confirmations,
        and low-balance notices. You can stop these at any time by replying STOP or
        telling us. Stopping notifications does not cancel your subscription.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as you have a subscription, and afterwards only as long as needed for
        tax and accounting obligations. You can ask us to delete your data at any time
        and we will do so, except records we are legally required to retain.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of your data, correct anything wrong, or have it
        deleted. Write to the address below and we will respond within 30 days.
      </p>

      <h2>Contact</h2>
      <ContactBlock merchant={merchant} />
    </>
  );
}
