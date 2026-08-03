import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "Local Produce <onboarding@resend.dev>";

// ─── Shared bits (voice + layout) ─────────────────────────────────────────────

const BRAND = "#A30E4E";
const GREEN = "#3b6d11";

// Greeting: first name only, falls back to "there" when we don't have a real name.
function firstName(name?: string | null): string {
  const t = (name || "").trim();
  if (!t || t.toLowerCase() === "customer") return "there";
  return t.split(/\s+/)[0];
}

// For subject lines: ", Clare" or "" when we have no name.
function subjectName(name?: string | null): string {
  const f = firstName(name);
  return f === "there" ? "" : `, ${f}`;
}

// Josie sign-off used at the bottom of every customer email.
const SIGNOFF = `
  <p style="margin: 16px 0 2px;">Josie</p>
  <p style="margin: 0; font-size: 13px; color: #888;">Local Produce Limited</p>
  <p style="margin: 6px 0 0; font-size: 13px;">
    <a href="https://www.localproduce.ltd" style="color: ${BRAND}; text-decoration: none;">www.localproduce.ltd</a>
    &nbsp;·&nbsp;
    <a href="https://www.instagram.com/localproduceltd" style="color: ${BRAND}; text-decoration: none;">@localproduceltd</a>
  </p>
`;

// Turns a 24h time string like "18:00" into friendly "6pm" / "6.30pm".
function formatTime(t?: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  if (isNaN(h)) return "";
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h}${ampm}` : `${h}.${m.toString().padStart(2, "0")}${ampm}`;
}

// Wraps the email body in the standard container.
function shell(inner: string): string {
  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #3a3a3a; line-height: 1.55;">${inner}</div>`;
}

// Turns the chosen delivery option into a plain-English "here's what to do" note.
function deliveryInstruction(option?: string | null, safePlace?: string | null): { title: string; body: string } | null {
  const place = safePlace && safePlace.trim() ? ` (${safePlace.trim()})` : "";
  switch (option) {
    case "in":
      return { title: "You'll be in", body: "We'll knock and hand your box straight to you." };
    case "own_coolbag":
      return { title: "Your own cool bag or box", body: `You've asked us not to knock - please leave your own cool bag or box out${place} with a couple of ice packs in, and we'll fill it. Bring it inside as soon as you can.` };
    case "local_coolbox":
      return { title: "You're borrowing a Local cool box", body: `We'll leave everything in one of our cool boxes, packed with ice packs, in your safe place${place}. Bring it in when you're back, and pop the empty box out next Friday and we'll swap or collect it.` };
    default:
      return null;
  }
}

// A short one-liner version for the "on its way" emails.
function deliveryReminderLine(option?: string | null, safePlace?: string | null): string {
  const place = safePlace && safePlace.trim() ? ` (${safePlace.trim()})` : "";
  switch (option) {
    case "in":
      return "You've asked us to knock and hand it straight to you - see you at the door.";
    case "own_coolbag":
      return `You've asked us not to knock - please have your own cool bag or box out${place} with a couple of ice packs in, and we'll fill it. 💚`;
    case "local_coolbox":
      return `We'll leave it all in a Local cool box, packed with ice packs, in your safe place${place}.`;
    default:
      return "";
  }
}

// The fuller delivery-option paragraph. Shared by the Thursday-morning slot email
// (sendSlotEmail) and the Thursday-evening "coming tomorrow" prepped email
// (sendOrderStatusUpdate) so the two stay word-for-word in step and never drift.
function deliveryOptionLine(option?: string | null, safePlace?: string | null): string {
  const place = safePlace && safePlace.trim() ? ` (${safePlace.trim()})` : "";
  switch (option) {
    case "in":
      return "You said you'll be in, so we'll see you at the door. If for whatever reason you now won't be in, just leave a cool bag and some ice packs out and we'll drop your order there.";
    case "own_coolbag":
      return `You've asked us not to knock - the driver will fill your own cool bag or box${place}, so please have it out with a couple of ice packs in. 💚`;
    case "local_coolbox":
      return `You're borrowing a Local cool box - the driver will leave everything in one of our boxes, packed with ice packs${place}.`;
    default:
      return "";
  }
}

// ─── Customer Emails ─────────────────────────────────────────────────────────

interface OrderConfirmationData {
  customerEmail: string;
  customerName: string;
  orderNumber: number;
  deliveryDay: string;
  deliveryWindow?: "morning" | "afternoon" | "any";
  address?: string;
  willBeIn?: boolean;
  safePlace?: string;
  deliveryOption?: string;
  boxDepositPaid?: boolean;
  bottleDepositPaid?: boolean;
  deliveryFee?: number;
  items: Array<{ productName: string; quantity: number; price: number; supplierName?: string }>;
  total: number;
  isTopUp?: boolean;
  cutoffDay?: string;
  cutoffTime?: string;
  // Promo code applied on Stripe's checkout page. total is the pre-discount
  // total from the cart; the email shows the discount line and charges total
  // minus discountAmount, matching what actually went on the card.
  discountCode?: string;
  couponName?: string;
  discountAmount?: number;
}

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  const name = firstName(data.customerName);
  const subject = data.isTopUp
    ? `Added to your box${subjectName(data.customerName)} 🥕`
    : `That's your box booked in${subjectName(data.customerName)} 🥕`;

  const heading = data.isTopUp
    ? `Added to your box${name === "there" ? "" : `, ${name}`}`
    : `Thank you${name === "there" ? "" : `, ${name}`} - your box is booked in`;

  const intro = data.isTopUp
    ? `Good news - we've added those to your box for delivery. Here's everything that's coming and who it's from.`
    : `Lovely to have your order. We're still small and new, so every single box matters - thank you for giving us a go.`;

  // "any" customers don't have a window yet - they get their slot the day before.
  const arrivalSuffix =
    data.deliveryWindow === "morning" ? `, between <strong>9am and 1pm</strong>`
    : data.deliveryWindow === "afternoon" ? `, between <strong>1pm and 5pm</strong>`
    : data.deliveryWindow === "any" ? ` - we'll confirm your time the day before`
    : "";

  // Group items by producer so the people behind the food come first.
  const groups = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const key = (item.supplierName && item.supplierName.trim()) || "Your producers";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const producerBlocks = Array.from(groups.entries()).map(([producer, items]) => `
        <div style="margin: 12px 0;">
          <p style="margin: 0 0 4px; font-weight: bold; color: ${GREEN};">${producer}</p>
          ${items.map((item) => `
            <div style="display: flex; justify-content: space-between; margin: 3px 0 3px 14px; font-size: 14px;">
              <span>${item.productName} × ${item.quantity}</span>
              <span>£${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join("")}
        </div>
      `).join("");

  const cutoffTimeText = data.cutoffTime ? ` at ${formatTime(data.cutoffTime)}` : "";
  const instruction = deliveryInstruction(data.deliveryOption, data.safePlace);
  const bottleReturn = data.bottleDepositPaid === false && data.items.some(i => i.productName.toLowerCase().includes("glass bottle"));

  // Show the code the customer typed; referral rewards applied without a code
  // fall back to the coupon's name. Total is what actually went on the card.
  const discountAmount = data.discountAmount ?? 0;
  const discountLabel = data.discountCode || data.couponName || "";
  const chargedTotal = data.total - discountAmount;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject,
    html: shell(`
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">${heading}</h1>
        <p style="margin: 0 0 12px;">Hi ${name},</p>
        <p style="margin: 0 0 12px;">${intro}</p>

        ${!data.isTopUp && data.cutoffDay ? `
        <p style="margin: 14px 0 8px; font-size: 14px; background: #f4f9fd; border-radius: 8px; padding: 12px 16px; color: #0369a1;">💡 Want to add anything to your order? You can keep adding to your box right up until <strong>${data.cutoffDay}${cutoffTimeText}</strong> - just head to your account and tap <a href="https://www.localproduce.ltd/account" style="color: ${BRAND}; font-weight: bold;">Add to your order</a>.</p>
        <p style="margin: 8px 0 14px;">The day before your delivery we'll email to confirm your box, and you'll get another email when we're about an hour away - so you'll always know we're on our way.</p>
        ` : ""}

        ${!data.isTopUp ? `<p style="margin: 0 0 12px;">Here's what's coming and who it's from.</p>` : ""}

        <div style="background: #fbf3f6; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 15px;"><strong style="color: ${BRAND};">Arriving ${data.deliveryDay}</strong>${arrivalSuffix}</p>
          ${data.address ? `<p style="margin: 6px 0 0; font-size: 14px; color: #6b6b6b;">${data.address}</p>` : ""}
        </div>

        <h3 style="font-size: 15px; color: #333; margin: 18px 0 8px;">Who you're supporting this week</h3>
        ${producerBlocks}

        <div style="border-top: 1px solid #eee; margin: 14px 0; padding-top: 10px;">
          ${data.deliveryFee ? `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #777; font-size: 14px;"><span>Delivery</span><span>£${data.deliveryFee.toFixed(2)}</span></div>` : ""}
          ${data.boxDepositPaid ? `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #777; font-size: 14px;"><span>Cool box deposit (you get this back)</span><span>£10.00</span></div>` : ""}
          ${data.bottleDepositPaid ? `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #777; font-size: 14px;"><span>Bottle deposit (you get this back)</span><span>£1.00</span></div>` : ""}
          ${discountAmount > 0 ? `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: ${GREEN}; font-size: 14px; font-weight: bold;"><span>Discount${discountLabel ? ` (${discountLabel})` : ""}</span><span>-£${discountAmount.toFixed(2)}</span></div>` : ""}
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 17px; margin-top: 6px;"><span>Total</span><span>£${chargedTotal.toFixed(2)}</span></div>
        </div>

        ${instruction ? `
        <div style="background: #eef6e8; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
          <p style="margin: 0 0 4px; font-weight: bold; color: ${GREEN};">📍 ${instruction.title}</p>
          <p style="margin: 0; font-size: 14px; color: #4a4a4a;">${instruction.body}</p>
        </div>
        ` : ""}

        ${bottleReturn ? `<p style="margin: 12px 0; font-size: 14px; color: #4a4a4a;">🍼 You've got glass bottles this week - please leave the empties out for us to collect on your next delivery.</p>` : ""}

        <p style="margin: 16px 0 4px;">If anything about ordering could be better, tap the 🥕 carrot on the website and tell us - it really helps.</p>
        <p style="margin: 4px 0 2px;">Speak soon,</p>
        ${SIGNOFF}
    `),
  });

  if (error) {
    console.error("Failed to send order confirmation email:", error);
    throw error;
  }
}

// ─── Saved basket reminder ───────────────────────────────────────────────────

interface SavedBasketReminderData {
  customerEmail: string;
  // Full name from their most recent order (baskets themselves only store an
  // email) - the greeting falls back to "there" when we don't have one.
  customerName?: string | null;
  items: Array<{ productName: string; quantity: number; price: number; supplierName?: string }>;
  total: number;
}

// A gentle "you left a basket, come check out" nudge, sent by the Wednesday
// basket-reminder cron and the admin Saved Baskets page. The cut-off line
// names Wednesday explicitly so it reads correctly whichever day it's sent.
export async function sendSavedBasketReminder(data: SavedBasketReminderData) {
  const subject = "Your basket's waiting - check out by Wednesday 7pm 💚";

  // Group items by producer, same as the order confirmation.
  const groups = new Map<string, typeof data.items>();
  for (const item of data.items) {
    const key = (item.supplierName && item.supplierName.trim()) || "Your producers";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const producerBlocks = Array.from(groups.entries()).map(([producer, items]) => `
        <div style="margin: 10px 0;">
          <p style="margin: 0 0 4px; font-weight: bold; color: ${GREEN};">${producer}</p>
          ${items.map((item) => `
            <div style="display: flex; justify-content: space-between; margin: 3px 0 3px 14px; font-size: 14px;">
              <span>${item.productName} × ${item.quantity}</span>
              <span>£${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join("")}
        </div>
      `).join("");

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject,
    html: shell(`
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">Your basket's still here</h1>
        <p style="margin: 0 0 12px;">Hi ${firstName(data.customerName)},</p>
        <p style="margin: 0 0 12px;">You saved a basket with Local but haven't checked out yet 🛒</p>

        <div style="background: #fbf3f6; border-radius: 8px; padding: 6px 16px 12px; margin: 16px 0;">
          ${producerBlocks}
          <div style="border-top: 1px solid #f0dbe5; margin: 8px 0 0; padding-top: 10px; display: flex; justify-content: space-between; font-weight: bold; font-size: 17px;"><span>Total</span><span>£${data.total.toFixed(2)}</span></div>
        </div>

        <p style="margin: 0 0 16px;">Click the link below to check out, and the Local team will get it packed and delivered on Friday.</p>

        <div style="text-align: center; margin: 22px 0;">
          <a href="https://www.localproduce.ltd/cart" style="display: inline-block; background: ${BRAND}; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 12px 30px; border-radius: 8px;">Check out now</a>
        </div>

        <p style="margin: 0 0 12px;">Fancy adding anything? Have a browse of all the suppliers <a href="https://www.localproduce.ltd/products" style="color: ${BRAND}; font-weight: bold;">here</a>.</p>

        <p style="margin: 14px 0; font-size: 14px; background: #f4f9fd; border-radius: 8px; padding: 12px 16px; color: #0369a1;">⏰ Order cut-off is <strong>7pm on Wednesday</strong> for Friday delivery.</p>

        ${SIGNOFF}

        <p style="margin: 16px 0 0; font-size: 13px; color: #777;">PS - if anything would put you off checking out, would you mind filling out our quick <a href="https://form.jotform.com/261642255276055" style="color: ${BRAND}; font-weight: bold;">anonymous survey</a>? Whether it's delivery days, prices, anything at all - it'll really help us continue to shape Local 💚</p>
    `),
  });

  if (error) {
    console.error("Failed to send saved basket reminder email:", error);
    throw error;
  }
}

// ─── Admin Emails ─────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "orders@localproduce.ltd";

interface SupplierFlagAlertData {
  supplierName: string;
  productName: string;
  quantityUnavailable: number | null; // null = whole line unavailable
  deliveryDay: string; // "YYYY-MM-DD"
  affectedCount: number;
  affectedOrderNumbers: number[];
}

// Heads-up to Josie when a supplier flags a product won't arrive - sent by
// POST /api/supplier-product-flag at flag time. Goes to josie@ (not orders@)
// so it lands where the refund decision gets made.
export async function sendSupplierFlagAlert(data: SupplierFlagAlertData) {
  const adminEmail = process.env.ADMIN_EMAIL || "josie@localproduce.ltd";

  const formattedDate = new Date(data.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: adminEmail,
    subject: `⚠️ ${data.supplierName} flagged ${data.productName} won't arrive`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Supplier Product Unavailable</h2>

        <p><strong>${data.supplierName}</strong> has flagged that <strong>${data.quantityUnavailable !== null ? `${data.quantityUnavailable}x ` : ""}${data.productName}</strong> won't arrive for the <strong>${formattedDate}</strong> delivery.</p>

        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>${data.affectedCount} customer${data.affectedCount !== 1 ? "s" : ""}</strong> ordered this product and may need refunds.
          </p>
        </div>

        <p>
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://www.localproduce.ltd"}/admin/stock"
             style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Review on Stock Tab
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="color: #6b7280; font-size: 14px;">
          Affected orders: ${data.affectedOrderNumbers.map((n) => `#${n}`).join(", ") || "None"}
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send supplier flag alert email:", error);
    throw error;
  }
}

// ─── Supplier Emails ─────────────────────────────────────────────────────────

interface ProductApprovalData {
  supplierEmail: string;
  supplierName: string;
  productName: string;
}

export async function sendProductApproved(data: ProductApprovalData) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject: `Product Approved: ${data.productName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">✓ Product Approved!</h1>
        <p>Hi ${data.supplierName},</p>
        <p>Great news! Your product <strong>${data.productName}</strong> has been approved and is now live on the marketplace.</p>
        <p>Customers can now find and purchase your product.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send product approved email:", error);
    throw error;
  }
}

interface BoxDepositRefundData {
  customerEmail: string;
  customerName: string;
}

export async function sendBoxDepositRefund(data: BoxDepositRefundData) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject: "Got the box back - £10 on its way 🥕",
    html: shell(`
        <h1 style="color: ${GREEN}; font-size: 21px; margin: 0 0 14px;">Got your box back - thank you!</h1>
        <p style="margin: 0 0 12px;">Hi ${firstName(data.customerName)},</p>
        <p style="margin: 0 0 12px;">Thanks for leaving your cool box out - we've got it. Your <strong>£10 deposit</strong> is on its way back to your card, and should land within <strong>5-10 days</strong> depending on your bank.</p>
        <p style="margin: 0 0 12px;">Returning the box keeps us low-waste and local, so thank you - it genuinely helps a little outfit like ours.</p>
        ${SIGNOFF}
    `),
  });

  if (error) {
    console.error("Failed to send box deposit refund email:", error);
    throw error;
  }
}

interface OrderItemRefundData {
  customerEmail: string;
  customerName: string;
  orderNumber: number;
  productName: string;
  supplierName?: string; // shown alongside the product so the customer knows whose it was
  quantity: number;
  refundAmount: number;
  reasonLabel?: string; // e.g. "Didn't arrive" - the picked reason type
  reason: string | null; // optional note, shown to the customer verbatim
}

// The reason line as the customer sees it - built in one place so the
// supplier's copy can quote exactly what the customer was told.
export function refundReasonLine(reasonLabel: string | undefined, reason: string | null): string {
  // "Other" isn't a customer-facing reason - fall back to just the note.
  const label = reasonLabel && reasonLabel !== "Other" ? reasonLabel : "";
  if (label && reason) return `${label} - ${reason}`;
  return label || reason || "";
}

export async function sendOrderItemRefund(data: OrderItemRefundData) {
  const reasonLine = refundReasonLine(data.reasonLabel, data.reason);
  const productLine = data.supplierName ? `${data.productName} from ${data.supplierName}` : data.productName;
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject: `A refund on order #${data.orderNumber}`,
    html: shell(`
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">A refund on order #${data.orderNumber}</h1>
        <p style="margin: 0 0 12px;">Hi ${firstName(data.customerName)},</p>
        <p style="margin: 0 0 12px;">Really sorry to let you know we've had to process a refund for part of your order this week.</p>

        <div style="background: #f7f7f5; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>Refunded:</strong> ${productLine} × ${data.quantity} · £${data.refundAmount.toFixed(2)} back to your card (5-10 days)</p>
          ${reasonLine ? `<p style="margin: 10px 0 0; font-size: 14px;"><strong>Refund reason:</strong> ${reasonLine}</p>` : ""}
        </div>

        <p style="margin: 0 0 12px;">We're still new and learning! If you have any feedback, please email us or add it to your order feedback in <a href="https://www.localproduce.ltd/account" style="color: ${BRAND};">my account</a>. 💚</p>
        ${SIGNOFF}
    `),
  });

  if (error) {
    console.error("Failed to send order item refund email:", error);
    throw error;
  }
}

interface SupplierRefundNoticeData {
  supplierEmail: string;
  supplierName: string;
  orderNumber: number;
  productName: string;
  quantity: number;
  refundAmount: number;
  reasonLabel: string;
  reason: string | null;
  paidBy: "local" | "supplier" | "50-50";
  itemArrived: boolean;
}

// Heads-up to the supplier when a refund on their product costs them
// something - sent at refund time so Friday's payout email is never a
// surprise. Local-pays refunds don't trigger this.
export async function sendSupplierRefundNotice(data: SupplierRefundNoticeData) {
  const reasonLine = refundReasonLine(data.reasonLabel, data.reason);

  let payoutImpact: string;
  if (!data.itemArrived) {
    payoutImpact = `These units weren't checked in as arrived, so they simply won't be included in this week's payout - there's no separate deduction.`;
  } else if (data.paidBy === "supplier") {
    payoutImpact = `£${data.refundAmount.toFixed(2)} will be deducted from this week's payout - it'll be itemised on your payout email so everything matches up.`;
  } else {
    payoutImpact = `We're splitting this one 50-50, so £${(data.refundAmount / 2).toFixed(2)} will be deducted from this week's payout - it'll be itemised on your payout email so everything matches up.`;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject: `Customer refund on order #${data.orderNumber} - ${data.productName}`,
    html: shell(`
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">Customer refund - ${data.productName}</h1>
        <p style="margin: 0 0 12px;">Hi ${firstName(data.supplierName)},</p>
        <p style="margin: 0 0 12px;">Just to let you know we've refunded a customer for part of their order this week:</p>

        <div style="background: #f7f7f5; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>Refunded:</strong> ${data.productName} × ${data.quantity} · £${data.refundAmount.toFixed(2)} (order #${data.orderNumber})</p>
        </div>

        <p style="margin: 0 0 12px;">${payoutImpact}</p>

        <p style="margin: 0 0 6px; font-size: 13px; color: #888;">What the customer's email said:</p>
        <div style="border-left: 3px solid #e5e5e5; padding: 2px 0 2px 14px; margin: 0 0 16px; color: #666; font-size: 14px; font-style: italic;">
          <p style="margin: 0 0 8px;">Really sorry to let you know we've had to process a refund for part of your order this week.</p>
          <p style="margin: 0;">Refunded: ${data.productName} from ${data.supplierName} × ${data.quantity} · £${data.refundAmount.toFixed(2)} back to your card (5-10 days)${reasonLine ? `<br>Refund reason: ${reasonLine}` : ""}</p>
        </div>

        <p style="margin: 0 0 12px;">The customer has already been refunded and told the reason above, this is just an FYI for you. Any questions, let me know.</p>
        ${SIGNOFF}
    `),
  });

  if (error) {
    console.error("Failed to send supplier refund notice email:", error);
    throw error;
  }
}

interface ProductRejectionData {
  supplierEmail: string;
  supplierName: string;
  productName: string;
  reason: string;
}

export async function sendProductRejected(data: ProductRejectionData) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject: `Product Not Approved: ${data.productName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444;">Product Not Approved</h1>
        <p>Hi ${data.supplierName},</p>
        <p>Unfortunately, your product <strong>${data.productName}</strong> was not approved at this time.</p>
        
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <strong>Reason:</strong><br>
          ${data.reason}
        </div>
        
        <p>Please update your product and resubmit for approval. If you have questions, please get in touch.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send product rejected email:", error);
    throw error;
  }
}

interface NewOrderData {
  supplierEmail: string;
  supplierName: string;
  orderNumber: number;
  deliveryDay: string;
  items: Array<{ productName: string; quantity: number; price: number }>;
  subtotal: number;
  isTopUp?: boolean;
}

export async function sendSupplierNewOrder(data: NewOrderData) {
  const subject = data.isTopUp
    ? `Items Added to Order #${data.orderNumber}`
    : `New Order Received - #${data.orderNumber}`;
  
  const heading = data.isTopUp ? "📦 Items Added to Order!" : "🎉 New Order!";
  const message = data.isTopUp
    ? "Additional items have been added to an existing order."
    : "You've received a new order for your products.";

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">${heading}</h1>
        <p>Hi ${data.supplierName},</p>
        <p>${message}</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Order #${data.orderNumber}</h3>
          <p><strong>Delivery Day:</strong> ${data.deliveryDay}</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
          ${data.items.map((item) => `
            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
              <span>${item.productName} x${item.quantity}</span>
              <span>£${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join("")}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Your Subtotal</span>
            <span>£${data.subtotal.toFixed(2)}</span>
          </div>
        </div>
        
        <p>Please log in to your supplier portal to manage this order.</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send supplier new order email:", error);
    throw error;
  }
}

// ─── Thursday Slot Email ("any" customers) ───────────────────────────────────

interface SlotEmailData {
  customerEmail: string;
  customerName: string;
  deliveryDay: string; // e.g. "17 July" - slotted into "this Friday (17 July)"
  leg: "morning" | "afternoon";
  stopPosition: number;
  legSize: number;
  etaBand?: string; // e.g. "9-10am"
  deliveryOption?: string;
  safePlace?: string;
}

// Sent on Thursday (after Josie approves the route) to customers who picked
// "I don't mind" at checkout, telling them their worked-out slot. Fixed
// morning/afternoon customers already know theirs, so they're not sent this -
// everyone gets the fuller "prepped + your time" email in the evening.
// Wording is Josie's original Gmail-draft template - keep it.
export async function sendSlotEmail(data: SlotEmailData) {
  const name = firstName(data.customerName);
  const legName = data.leg === "morning" ? "morning" : "afternoon";
  const legWindow = data.leg === "morning" ? "9am-1pm" : "1pm-5pm";

  // Last line reflects what they chose at checkout - never the generic version.
  // Shared with the prepped email so the wording stays identical.
  const optionLine = deliveryOptionLine(data.deliveryOption, data.safePlace);

  const roughTime = data.etaBand
    ? `, so we should be with you roughly <strong>${data.etaBand}</strong>`
    : "";

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject: `Your Friday delivery (${data.deliveryDay}) will be in the ${legName.toUpperCase()}`,
    html: shell(`
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">You're on the ${legName} run 💚</h1>
        <p style="margin: 0 0 12px;">Hi ${name},</p>
        <p style="margin: 0 0 12px;">You put "I don't mind" for your delivery slot this Friday (${data.deliveryDay}) - thanks for being easy about the timing.</p>
        <p style="margin: 0 0 12px;">I've planned the route now, and you're on the <strong>${legName}</strong> run (<strong>${legWindow}</strong>). You're stop ${data.stopPosition} of ${data.legSize}${roughTime}.</p>
        <p style="margin: 0 0 12px;">As always, you'll get an email when we're just one stop away.</p>
        ${optionLine ? `<p style="margin: 0 0 12px;">${optionLine}</p>` : ""}
        <p style="margin: 12px 0 4px;">See you Friday!</p>
        ${SIGNOFF}`),
  });

  if (error) {
    console.error("Failed to send slot email:", error);
    throw error;
  }
}

// ─── Order Status Update Emails ──────────────────────────────────────────────

interface OrderStatusUpdateData {
  customerEmail: string;
  customerName: string;
  orderNumber: number;
  status: "prepped" | "next_hour" | "delivered" | "cancelled";
  deliveryDay: string;
  deliveryWindow?: "morning" | "afternoon" | "any";
  deliveryOption?: string;
  safePlace?: string;
  // Route info for prepped emails - resolved slot and position
  routeLeg?: "morning" | "afternoon";
  routePosition?: number;
  legSize?: number;
  // Rough hour arrival band from the route build (delivery_routes.eta_band), e.g. "9-10am"
  etaBand?: string;
  // For "on our way" emails: how many stops are ahead of this one when notified
  // (0 = you're next, 1 = one stop before you, 2 = two stops before you)
  stopsAhead?: number;
}

export async function sendOrderStatusUpdate(data: OrderStatusUpdateData) {
  const name = firstName(data.customerName);
  const nm = name === "there" ? "" : `, ${name}`;
  const reminder = deliveryReminderLine(data.deliveryOption, data.safePlace);

  // Resolve delivery slot: use routeLeg from delivery_routes if available, else fall back to order's deliveryWindow
  const resolvedSlot = data.routeLeg ?? data.deliveryWindow;
  const deliveryWindowText = resolvedSlot === "morning" ? "9am - 1pm" : resolvedSlot === "afternoon" ? "1pm - 5pm" : "";

  // Build position phrase if we have route info. Doesn't restate morning/afternoon -
  // the time window already says that; this just gives the rough place in the run.
  let positionPhrase = "";
  if (data.routeLeg && data.routePosition && data.legSize) {
    const ratio = data.routePosition / data.legSize;
    positionPhrase =
      ratio <= 0.33
        ? "You're towards the start of our run."
        : ratio <= 0.66
        ? "You're around the middle of our run."
        : "You're towards the end of our run.";
  }

  let subject: string;
  let body: string;

  if (data.status === "prepped") {
    subject = `Confirming your delivery tomorrow${nm} 🥕`;
    const legName = resolvedSlot === "morning" ? "morning" : resolvedSlot === "afternoon" ? "afternoon" : "";
    const openingLine = `Hi ${name}, just confirming your delivery is booked in for tomorrow, <strong>${data.deliveryDay}</strong>${deliveryWindowText ? `, between <strong>${deliveryWindowText}</strong>` : ""}.`;
    // Give the exact place in the run plus the rough hour band in one sentence,
    // matching the Thursday-morning slot email. Only fall back to the fuzzy
    // start/middle/end phrase (or a band-only line) when there's no route row.
    const bandClause = data.etaBand
      ? `, so we should be with you <strong>roughly ${data.etaBand}</strong> - that can drift a little either way depending on how the run goes`
      : "";
    let timingLine: string;
    if (data.routeLeg && data.routePosition && data.legSize) {
      timingLine = `You're stop <strong>${data.routePosition} of ${data.legSize}</strong>${legName ? ` on the ${legName} run` : ""}${bandClause}.`;
    } else if (data.etaBand) {
      timingLine = `Looking at the route, we should be with you at <strong>roughly ${data.etaBand}</strong> - that can drift a little either way depending on how the run goes.`;
    } else {
      timingLine = positionPhrase;
    }
    const oneStopLine = "As always, you'll get an email when we're just one stop away.";
    // Fuller checkout-option paragraph, shared with the slot email.
    const optionLine = deliveryOptionLine(data.deliveryOption, data.safePlace);
    body = `
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">Confirming your delivery${nm} 💚</h1>
        <p style="margin: 0 0 12px;">${openingLine}</p>
        <p style="margin: 0 0 12px;">${timingLine ? `${timingLine} ${oneStopLine}` : oneStopLine}</p>
        ${optionLine ? `<p style="margin: 0 0 12px;">${optionLine}</p>` : ""}
        <p style="margin: 12px 0 4px;">Our driver will see you tomorrow,</p>
        ${SIGNOFF}`;
  } else if (data.status === "next_hour") {
    subject = `We're on our way${nm} 🚚`;
    const stops = data.stopsAhead;
    let positionLine: string;
    if (stops === 0) {
      positionLine = "You're our first stop of the run, so we're heading straight to you.";
    } else if (typeof stops === "number") {
      positionLine = "We've got one stop to make before yours, so we should be with you in around 30 minutes to an hour, depending on distances.";
    } else {
      positionLine = "Your box is on the van and should be with you within the hour.";
    }
    body = `
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">🚚 We're on our way</h1>
        <p style="margin: 0 0 12px;">Hi ${name}, your box is on the van and we're out on the road. ${positionLine}</p>
        ${reminder ? `<p style="margin: 0 0 12px;">${reminder}</p>` : ""}
        ${SIGNOFF}`;
  } else if (data.status === "delivered") {
    subject = `Your box has landed${nm} 🥕`;
    body = `
        <h1 style="color: ${GREEN}; font-size: 21px; margin: 0 0 14px;">That's delivered - enjoy${nm}!</h1>
        <p style="margin: 0 0 12px;">Hi ${name}, your box from order <strong>#${data.orderNumber}</strong> is on your doorstep.</p>
        <div style="background: #fbf3f6; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
          <p style="margin: 0 0 4px; font-weight: bold; color: ${BRAND}; font-size: 15px;">⭐ Got any feedback? Good or bad, we want to hear it!</p>
          <p style="margin: 0 0 12px; font-size: 14px; color: #5a5a5a;">Every product review goes directly to the producers - and anything about the service comes straight to both me and the producers. It's how we get better!</p>
          <a href="https://www.localproduce.ltd/account" style="display: inline-block; background: ${BRAND}; color: #fff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Leave a quick review</a>
        </div>
        <p style="margin: 12px 0 4px;">And if you enjoyed your Local Produce, please help us spread the word - a mention to a friend or neighbour does more for us at Local than any advert could. 💚</p>
        ${SIGNOFF}`;
  } else {
    subject = `Your order's been cancelled - #${data.orderNumber}`;
    body = `
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">Order #${data.orderNumber} cancelled</h1>
        <p style="margin: 0 0 12px;">Hi ${name}, just confirming order #${data.orderNumber} has been cancelled and anything paid will be refunded within 5-10 days.</p>
        <p style="margin: 0 0 12px;">If this wasn't you, or something went wrong, just reply and I'll sort it straight away. Sorry for the hassle.</p>
        ${SIGNOFF}`;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject,
    html: shell(body),
  });

  if (error) {
    console.error("Failed to send order status update email:", error);
    throw error;
  }
}

// ─── Supplier Order Summary Email ─────────────────────────────────────────────

interface SupplierOrderSummaryData {
  supplierEmail: string;
  supplierName: string;
  deliveryDate: string;
  stockTotals: Array<{ productName: string; unit: string; totalQuantity: number }>;
  orders: Array<{
    orderNumber: number;
    boxNumber?: number | null;
    items: Array<{ productName: string; unit: string; quantity: number; price: number }>;
    subtotal: number;
    hasTopUp?: boolean;
  }>;
  grandTotal: number;
}

export async function sendSupplierOrderSummary(data: SupplierOrderSummaryData) {
  const formattedDate = new Date(data.deliveryDate + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const stockSummaryHtml = data.stockTotals
    .map((item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.productName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${item.totalQuantity}${item.unit ? ` × ${item.unit}` : ''}</td>
      </tr>
    `)
    .join("");

  const ordersHtml = data.orders
    .map((order) => `
      <div style="background: #fff; border: 1px solid ${order.hasTopUp ? '#f59e0b' : '#e5e5e5'}; border-radius: 8px; padding: 16px; margin-bottom: 12px;${order.hasTopUp ? ' border-width: 2px;' : ''}">
        <h4 style="margin: 0 0 12px 0; color: #A30E4E;">${order.boxNumber != null ? `Box ${order.boxNumber} <span style="font-weight: normal; font-size: 13px; color: #888;">(Order #${order.orderNumber})</span>` : `Order #${order.orderNumber}`}</h4>
        ${order.hasTopUp ? `
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 8px 12px; margin-bottom: 12px; font-size: 13px; color: #92400e;">
          <strong>⚠️ NOTE:</strong> This order has been added to since it was first placed. Please check the details carefully.
        </div>
        ` : ''}
        ${order.items.map((item) => `
          <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px;">
            <span>${item.productName}${item.unit ? ` — ${item.unit}` : ''} × ${item.quantity}</span>
            <span>£${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join("")}
        <hr style="border: none; border-top: 1px solid #eee; margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Order Subtotal</span>
          <span>£${order.subtotal.toFixed(2)}</span>
        </div>
      </div>
    `)
    .join("");

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject: `Order Summary for ${formattedDate}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">📦 Your Order Summary</h1>
        <p>Hi ${data.supplierName},</p>
        <p>Here's your order summary for <strong>${formattedDate}</strong>. Please make sure you package this into individual customer orders and then drop it at the depot.</p>
        <p>
          <a href="https://www.localproduce.ltd/sign-in" style="display: inline-block; background: #A30E4E; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            Log in to Supplier Portal
          </a>
        </p>
        
        <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h2 style="margin: 0 0 16px 0; color: #166534; font-size: 18px;">📊 Stock Totals</h2>
          <p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">Total quantities needed for this delivery:</p>
          <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #166534; color: white;">
                <th style="padding: 10px 12px; text-align: left;">Product</th>
                <th style="padding: 10px 12px; text-align: center;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${stockSummaryHtml}
            </tbody>
          </table>
        </div>
        
        <h2 style="color: #333; font-size: 18px; margin-top: 32px;">📋 Individual Orders</h2>
        ${ordersHtml}
        
        <div style="background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px 20px; margin-top: 24px;">
          <div style="display: flex; justify-content: space-between; font-size: 16px; margin-bottom: 8px;">
            <span>Your Grand Total</span>
            <span>£${data.grandTotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; color: #666; margin-bottom: 8px;">
            <span>Commission (20%)</span>
            <span>-£${(data.grandTotal * 0.2).toFixed(2)}</span>
          </div>
          <hr style="border: none; border-top: 2px solid #A30E4E; margin: 12px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #A30E4E;">
            <span>Your Payout</span>
            <span>£${(data.grandTotal * 0.8).toFixed(2)}</span>
          </div>
          <p style="margin: 10px 0 0; font-size: 13px; color: #666;">Payout shown assumes everything arrives as ordered - your payout email after delivery reflects what's checked in at the depot (and any refunds), so the final figure can differ.</p>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send supplier order summary email:", error);
    throw error;
  }
}

// ─── Supplier Payout Email ───────────────────────────────────────────────────

interface SupplierPayoutData {
  supplierEmail: string;
  supplierName: string;
  deliveryDate: string;
  items: Array<{
    productName: string;
    ordered: number;
    arrived: number | null;
    unitPrice: number;
    orderedValue: number;
    arrivedValue: number;
  }>;
  refunds: Array<{
    productName: string;
    amount: number;
    paidBy: string;
    reason: string | null;
    deduction: number;
  }>;
  orderedTotal: number;
  arrivedTotal: number;
  supplierRefundDeduction: number;
  finalPayout: number;
}

// Rendered separately from the send so the exact email can be previewed and
// checked without emailing anyone.
export function renderSupplierPayoutEmail(data: Omit<SupplierPayoutData, "supplierEmail">): { subject: string; html: string } {
  const formattedDate = new Date(data.deliveryDate + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const itemsHtml = data.items
    .map((item) => {
      // Arrivals default to 0 until checked in (zero-default check-in), so an
      // unrecorded arrival reads as 0 and highlights amber - same as the
      // payouts modal, and same as what the maths pays out on.
      const arrived = item.arrived ?? 0;
      const isShort = arrived < item.ordered;
      return `
        <tr style="${isShort ? 'background: #fef3c7;' : ''}">
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.productName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${item.ordered}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold; ${isShort ? 'color: #d97706;' : 'color: #16a34a;'}">${arrived}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">£${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">£${item.arrivedValue.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  // Only show refunds that affect the supplier (supplier pays or 50-50)
  const supplierRefunds = data.refunds.filter(r => r.deduction > 0);
  const refundsHtml = supplierRefunds.length > 0
    ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <h3 style="margin: 0 0 12px 0; color: #dc2626; font-size: 14px;">⚠️ Refunds Deducted From Your Payout</h3>
        ${supplierRefunds.map((r) => `
          <div style="font-size: 14px; margin: 8px 0; padding: 8px; background: white; border-radius: 4px;">
            <strong>${r.productName}</strong>: £${r.amount.toFixed(2)} refund
            (${r.paidBy === 'supplier' ? 'You pay full amount' : '50-50 split'})
            ${r.reason ? `<br><span style="color: #666;">Reason: ${r.reason}</span>` : ''}
            <br><span style="color: #dc2626; font-weight: bold;">Deducted: -£${r.deduction.toFixed(2)}</span>
          </div>
        `).join("")}
      </div>
    `
    : "";

  // Calculate totals. Floored at zero to match the payouts modal - refund
  // deductions can never take a payout negative.
  const subtotalBeforeCommission = Math.max(0, data.arrivedTotal - data.supplierRefundDeduction);
  const commission = subtotalBeforeCommission * 0.2;
  const payout = subtotalBeforeCommission * 0.8;

  return {
    subject: `Payout Summary for ${formattedDate}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">💰 Your Payout Summary</h1>
        <p>Hi ${data.supplierName},</p>
        <p>Thanks for this week's produce - here's your payout breakdown for <strong>${formattedDate}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px 12px; text-align: left; font-size: 13px;">Product</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px;">Ordered</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 13px;">Arrived</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 13px;">Unit</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 13px;">Value</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        ${refundsHtml}
        
        <div style="background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px 20px; margin-top: 24px;">
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
            <span>Ordered Total</span>
            <span>£${data.orderedTotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
            <span>Arrived at Depot Total</span>
            <span>£${data.arrivedTotal.toFixed(2)}</span>
          </div>
          ${data.supplierRefundDeduction > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 14px; color: #dc2626; margin-bottom: 8px;">
              <span>Refunded by Supplier</span>
              <span>-£${data.supplierRefundDeduction.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; font-weight: 600;">
            <span>Total Before Commission</span>
            <span>£${subtotalBeforeCommission.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; color: #666; margin-bottom: 8px;">
            <span>Commission (20%)</span>
            <span>-£${commission.toFixed(2)}</span>
          </div>
          <hr style="border: none; border-top: 2px solid #A30E4E; margin: 12px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #16a34a;">
            <span>Your Payout</span>
            <span>£${payout.toFixed(2)}</span>
          </div>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 24px;">
          Payment will be sent by bank transfer within 7 days. If anything here doesn't look right, just reply to this email.
        </p>

        ${SIGNOFF}
      </div>
    `,
  };
}

export async function sendSupplierPayout(data: SupplierPayoutData) {
  const { subject, html } = renderSupplierPayoutEmail(data);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject,
    html,
  });

  if (error) {
    console.error("Failed to send supplier payout email:", error);
    throw error;
  }
}

// ─── Admin Payout Run Sheet ───────────────────────────────────────────────────

interface PayoutSupplier {
  supplierId: string;
  supplierName: string;
  items: Array<{
    productName: string;
    ordered: number;
    arrived: number | null;
    unitPrice: number;
    orderedValue: number;
    arrivedValue: number;
  }>;
  refunds: Array<{
    productName: string;
    amount: number;
    paidBy: string;
    reason: string | null;
    deduction: number;
  }>;
  orderedTotal: number;
  arrivedTotal: number;
  supplierRefundDeduction: number;
  finalPayout: number;
}

interface PayoutResult {
  supplierId: string;
  supplierName: string;
  supplierEmail?: string;
  success: boolean;
  error?: string;
}

interface PayoutRunSheetData {
  deliveryDate: string;
  suppliers: PayoutSupplier[];
  results: PayoutResult[];
}

export async function sendPayoutRunSheet(data: PayoutRunSheetData) {
  const formattedDate = new Date(data.deliveryDate + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Calculate grand total
  const totalPayout = data.suppliers.reduce((sum, s) => sum + s.finalPayout, 0);

  // Build a map of results by supplierId for easy lookup
  const resultMap = new Map(data.results.map(r => [r.supplierId, r]));

  // Sort suppliers alphabetically by name
  const sortedSuppliers = [...data.suppliers].sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName)
  );

  // Build table rows
  const tableRowsHtml = sortedSuppliers
    .map((supplier) => {
      const result = resultMap.get(supplier.supplierId);
      const success = result?.success ?? false;
      const hasEmail = !result?.error?.includes("No email");
      const errorMsg = result?.error || "";
      
      // Flag rows that need attention (no email or send failed)
      const needsAttention = !success;
      const rowStyle = needsAttention
        ? 'background: #fef2f2;'
        : '';
      
      const statusHtml = success
        ? '<span style="color: #16a34a;">✅ Sent</span>'
        : `<span style="color: #dc2626;">❌ Failed — ${errorMsg}</span>`;

      return `
        <tr style="${rowStyle}">
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; font-weight: 500;">${supplier.supplierName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5;">${result?.supplierEmail || '<span style="color: #dc2626;">—</span>'}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: bold;">£${supplier.finalPayout.toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e5e5;">${statusHtml}</td>
        </tr>
      `;
    })
    .join("");

  // Grand total row
  const totalRowHtml = `
    <tr style="background: #f3f4f6; font-weight: bold;">
      <td style="padding: 12px; border-top: 2px solid #A30E4E;" colspan="2">Grand Total</td>
      <td style="padding: 12px; border-top: 2px solid #A30E4E; text-align: right; color: #A30E4E; font-size: 16px;">£${totalPayout.toFixed(2)}</td>
      <td style="padding: 12px; border-top: 2px solid #A30E4E;"></td>
    </tr>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Payout run sheet — ${formattedDate} — £${totalPayout.toFixed(2)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">💳 Payout Run Sheet</h1>
        <p><strong>Delivery Date:</strong> ${formattedDate}</p>
        
        <table style="width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; margin: 20px 0;">
          <thead>
            <tr style="background: #A30E4E; color: white;">
              <th style="padding: 12px; text-align: left;">Supplier</th>
              <th style="padding: 12px; text-align: left;">Email</th>
              <th style="padding: 12px; text-align: right;">Final Payout (£)</th>
              <th style="padding: 12px; text-align: left;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
            ${totalRowHtml}
          </tbody>
        </table>
        
        <div style="background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
          <p style="margin: 0; color: #0369a1;">
            <strong>What to do:</strong> Pay each supplier the amount shown above. Bank details are in your supplier records.
          </p>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — Local Produce Automated Payouts
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send payout run sheet email:", error);
    throw error;
  }
}
