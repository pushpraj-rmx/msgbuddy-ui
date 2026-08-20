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
        These terms govern your use of the {merchant.brandName} bread subscription
        service, operated by {merchant.legalName}. By subscribing you agree to them.
      </p>

      <h2>How the subscription works</h2>
      <p>
        You choose a plan (or build your own bundle), the mornings you want delivery,
        and a delivery window. Bread is baked overnight against the confirmed list and
        delivered the following morning within your chosen window.
      </p>
      <p>
        Your order for the next morning locks at <strong>{merchant.cutoffTime}</strong>{" "}
        the evening before, because the dough is mixed for exactly what has been
        confirmed. Changes and skips made before the cutoff are free. After the cutoff
        that delivery is fixed and will be charged.
      </p>

      <h2>Prepaid wallet</h2>
      <p>
        The service is prepaid. You top up a wallet held against your account, and each
        delivery is debited from it at the cutoff. Skipped mornings are not charged, and
        anything already debited for a skipped delivery is credited back to your wallet.
      </p>
      <p>
        Wallet balance is store credit for {merchant.brandName} orders. It is not a
        deposit, earns no interest, and cannot be transferred to another customer.
      </p>
      <p>
        If your balance is too low to cover the next delivery we will notify you. If it
        remains unfunded, that delivery will not be made.
      </p>

      <h2>Pricing</h2>
      <p>
        Prices are shown on the storefront in Indian Rupees and include applicable taxes
        unless stated otherwise. We may change prices; any change applies to deliveries
        after the change and never retroactively to a delivery already locked or paid.
      </p>

      <h2>Skipping, pausing and cancelling</h2>
      <p>
        You may skip any morning before the cutoff, pause deliveries, or cancel your
        subscription at any time, with no fee or notice period. See our{" "}
        <a href="./refund">Cancellation &amp; Refund Policy</a> for what happens to your
        remaining balance.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Give an accurate delivery address and a phone number we can reach you on.</li>
        <li>
          Make the address accessible during your delivery window. Where a delivery
          cannot be completed for reasons outside our control, it is treated as
          delivered.
        </li>
        <li>Tell us about allergies before subscribing — see below.</li>
      </ul>

      <h2>Food, allergens and storage</h2>
      <p>
        Our bread is baked in a kitchen that handles wheat, gluten, and may handle seeds,
        nuts, dairy and sesame. We cannot guarantee any product is free from traces of
        these. If you have a serious allergy, contact us before subscribing.
      </p>
      <p>
        Because the bread contains no preservatives, it is best eaten within a day or two
        of delivery and should be stored appropriately.
      </p>

      <h2>Service availability</h2>
      <p>
        We deliver in {merchant.serviceAreas}. We may occasionally be unable to deliver
        because of weather, public holidays, or events outside our control. Where a
        delivery is missed for a reason on our side, it is not charged, and anything
        already debited is credited back to your wallet.
      </p>

      <h2>Liability</h2>
      <p>
        Our liability in connection with any delivery is limited to the amount you paid
        for that delivery. Nothing in these terms limits liability that cannot be limited
        under Indian law.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts at New Delhi have
        exclusive jurisdiction.
      </p>

      <h2>Contact</h2>
      <ContactBlock merchant={merchant} />
    </>
  );
}
