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
  <p style="margin: 0; font-size: 13px; color: #888;">Local Produce · Bradley, Derbyshire</p>
`;

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
    case "in_no_disturb":
      return { title: "In, but don't disturb", body: `You've asked us not to disturb you - please leave a box or large bag outside${place} and we'll pop everything in it. Just bring it inside as soon as you can.` };
    case "out_need_coolbag":
      return { title: "You're out - we'll leave it safe", body: `You won't be in, so we'll leave everything in one of our cool boxes in your safe place${place}. Bring it in when you're back, and pop the empty cool box out next Friday and we'll collect it.` };
    case "out_own_coolbag":
      return { title: "You're out - your own cool bag", body: `You won't be in, so please leave your own cool bag or box out${place} and we'll fill it up. Bring it inside as soon as you're back.` };
    default:
      return null;
  }
}

// A short one-liner version for the "coming tomorrow" / "on its way" emails.
function deliveryReminderLine(option?: string | null, safePlace?: string | null): string {
  const place = safePlace && safePlace.trim() ? ` (${safePlace.trim()})` : "";
  switch (option) {
    case "in":
      return "You've asked us to knock and hand it straight to you - see you at the door.";
    case "in_no_disturb":
      return `You've asked us not to disturb you, so if you could leave a box or bag outside${place} we'll pop everything in it.`;
    case "out_need_coolbag":
      return `You're out, so we'll leave it all in a cool box in your safe place${place}.`;
    case "out_own_coolbag":
      return `You're out, so please have your own cool bag or box out${place} and we'll fill it.`;
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
  deliveryWindow?: "morning" | "afternoon";
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
    : `Lovely to have your order. We're only a few weeks old, so every single box matters round here - thank you for giving us a go. Here's what's coming and who it's from.`;

  const deliveryWindowText = data.deliveryWindow === "morning" ? "9am – 1pm" : data.deliveryWindow === "afternoon" ? "1pm – 5pm" : "";

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
              <span>${item.productName} ×${item.quantity}</span>
              <span>£${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join("")}
        </div>
      `).join("");

  const instruction = deliveryInstruction(data.deliveryOption, data.safePlace);
  const bottleReturn = data.bottleDepositPaid === false && data.items.some(i => i.productName.toLowerCase().includes("glass bottle"));

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject,
    html: shell(`
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">${heading}</h1>
        <p style="margin: 0 0 12px;">Hi ${name},</p>
        <p style="margin: 0 0 12px;">${intro}</p>

        <div style="background: #fbf3f6; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 15px;"><strong style="color: ${BRAND};">Arriving ${data.deliveryDay}</strong>${deliveryWindowText ? `, between <strong>${deliveryWindowText}</strong>` : ""}</p>
          ${data.address ? `<p style="margin: 6px 0 0; font-size: 14px; color: #6b6b6b;">${data.address}</p>` : ""}
        </div>

        <h3 style="font-size: 15px; color: #333; margin: 18px 0 8px;">Who you're supporting this week</h3>
        ${producerBlocks}

        <div style="border-top: 1px solid #eee; margin: 14px 0; padding-top: 10px;">
          ${data.deliveryFee ? `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #777; font-size: 14px;"><span>Delivery</span><span>£${data.deliveryFee.toFixed(2)}</span></div>` : ""}
          ${data.boxDepositPaid ? `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #777; font-size: 14px;"><span>Cool box deposit (you get this back)</span><span>£10.00</span></div>` : ""}
          ${data.bottleDepositPaid ? `<div style="display: flex; justify-content: space-between; margin: 4px 0; color: #777; font-size: 14px;"><span>Bottle deposit (you get this back)</span><span>£1.00</span></div>` : ""}
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 17px; margin-top: 6px;"><span>Total</span><span>£${data.total.toFixed(2)}</span></div>
        </div>

        ${instruction ? `
        <div style="background: #eef6e8; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
          <p style="margin: 0 0 4px; font-weight: bold; color: ${GREEN};">📍 ${instruction.title}</p>
          <p style="margin: 0; font-size: 14px; color: #4a4a4a;">${instruction.body}</p>
        </div>
        ` : ""}

        ${bottleReturn ? `<p style="margin: 12px 0; font-size: 14px; color: #4a4a4a;">🍼 You've got glass bottles this week - please leave the empties out for us to collect on your next delivery.</p>` : ""}

        ${!data.isTopUp && data.cutoffDay ? `
        <p style="margin: 14px 0; font-size: 14px; background: #f4f9fd; border-radius: 8px; padding: 12px 16px; color: #0369a1;">💡 Forgotten something? You can keep adding to this box right up to <strong>${data.cutoffDay}</strong> - just head to your account and tap "Add to this order".</p>
        ` : ""}

        <p style="margin: 16px 0 4px;">Any questions at all, just hit reply - it comes straight to me.</p>
        <p style="margin: 4px 0 2px;">Thanks again,</p>
        ${SIGNOFF}
    `),
  });

  if (error) {
    console.error("Failed to send order confirmation email:", error);
    throw error;
  }

  // Also send admin notification
  await sendAdminOrderNotification(data);
}

// ─── Admin Emails ─────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "orders@localproduce.ltd";

async function sendAdminOrderNotification(data: OrderConfirmationData) {
  const subject = data.isTopUp 
    ? `🛒 Top-up Added - Order #${data.orderNumber}` 
    : `🛒 New Order #${data.orderNumber} - £${data.total.toFixed(2)}`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">${data.isTopUp ? "Top-up Added" : "New Order"} 🎉</h1>
        <p><strong>Order #${data.orderNumber}</strong></p>
        <p><strong>Customer:</strong> ${data.customerEmail}</p>
        <p><strong>Delivery:</strong> ${data.deliveryDay}</p>
        ${data.address ? `<p><strong>Address:</strong> ${data.address}</p>` : ""}
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Items</h3>
          ${data.items.map((item) => `
            <div style="display: flex; justify-content: space-between; margin: 8px 0;">
              <span>${item.productName} x${item.quantity}</span>
              <span>£${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join("")}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px;">
            <span>Total</span>
            <span>£${data.total.toFixed(2)}</span>
          </div>
        </div>
        
        <p><a href="https://localproduce.ltd/admin/orders" style="background: #A30E4E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">View in Admin</a></p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send admin order notification:", error);
    // Don't throw - admin notification failure shouldn't break the order flow
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
  quantity: number;
  refundAmount: number;
  reason: string | null;
}

export async function sendOrderItemRefund(data: OrderItemRefundData) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject: `A refund on your order - #${data.orderNumber}`,
    html: shell(`
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">A refund on order #${data.orderNumber}</h1>
        <p style="margin: 0 0 12px;">Hi ${firstName(data.customerName)},</p>
        <p style="margin: 0 0 12px;">Sometimes a producer comes up short, or the quality isn't good enough to send - when that happens I'd rather refund you than put something in your box I wouldn't want in mine.</p>

        <div style="background: #f7f7f5; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 14px;">Refunded: <strong>${data.productName} ×${data.quantity}</strong> · <strong>£${data.refundAmount.toFixed(2)}</strong> back to your card (5-10 days)</p>
          ${data.reason ? `<p style="margin: 8px 0 0; font-size: 14px; color: #6b6b6b;">${data.reason}</p>` : ""}
        </div>

        <p style="margin: 0 0 12px;">Really sorry for the gap in your box this week. Any questions, just reply and it comes straight to me.</p>
        ${SIGNOFF}
    `),
  });

  if (error) {
    console.error("Failed to send order item refund email:", error);
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

// ─── Order Status Update Emails ──────────────────────────────────────────────

interface OrderStatusUpdateData {
  customerEmail: string;
  customerName: string;
  orderNumber: number;
  status: "prepped" | "next_hour" | "delivered" | "cancelled";
  deliveryDay: string;
  deliveryWindow?: "morning" | "afternoon";
  deliveryOption?: string;
  safePlace?: string;
}

export async function sendOrderStatusUpdate(data: OrderStatusUpdateData) {
  const name = firstName(data.customerName);
  const nm = name === "there" ? "" : `, ${name}`;
  const deliveryWindowText = data.deliveryWindow === "morning" ? "9am – 1pm" : data.deliveryWindow === "afternoon" ? "1pm – 5pm" : "";
  const reminder = deliveryReminderLine(data.deliveryOption, data.safePlace);

  let subject: string;
  let body: string;

  if (data.status === "prepped") {
    subject = `Your box is coming tomorrow${nm} 🥕`;
    body = `
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">🥕 See you tomorrow${nm}</h1>
        <p style="margin: 0 0 12px;">Hi ${name}, quick heads up - your box is packed and heading out tomorrow, <strong>${data.deliveryDay}</strong>${deliveryWindowText ? `, between <strong>${deliveryWindowText}</strong>` : ""}.</p>
        ${reminder ? `<p style="margin: 0 0 12px;">${reminder}</p>` : ""}
        <p style="margin: 12px 0 4px;">See you then,</p>
        ${SIGNOFF}`;
  } else if (data.status === "next_hour") {
    subject = `We're on our way${nm} 🚚`;
    body = `
        <h1 style="color: ${BRAND}; font-size: 21px; margin: 0 0 14px;">🚚 Nearly with you</h1>
        <p style="margin: 0 0 12px;">Hi ${name}, your box is on the van and should be with you within the hour.</p>
        ${reminder ? `<p style="margin: 0 0 12px;">${reminder}</p>` : ""}
        ${SIGNOFF}`;
  } else if (data.status === "delivered") {
    subject = `Your box has landed${nm} 🥕`;
    body = `
        <h1 style="color: ${GREEN}; font-size: 21px; margin: 0 0 14px;">That's delivered - enjoy${nm}!</h1>
        <p style="margin: 0 0 12px;">Hi ${name}, your box from order <strong>#${data.orderNumber}</strong> is on your doorstep. Hope it all looks lovely.</p>
        <div style="background: #fbf3f6; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
          <p style="margin: 0 0 4px; font-weight: bold; color: ${BRAND}; font-size: 15px;">⭐ How did we do?</p>
          <p style="margin: 0 0 12px; font-size: 14px; color: #5a5a5a;">We're tiny and still learning - a quick word on what you loved (or didn't) genuinely shapes what we do next.</p>
          <a href="https://www.localproduce.ltd/account" style="display: inline-block; background: ${BRAND}; color: #fff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Leave a quick review</a>
        </div>
        <p style="margin: 12px 0 4px;">Thank you for shopping this way - it means the world to the growers and to me.</p>
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
        <h4 style="margin: 0 0 12px 0; color: #A30E4E;">Order #${order.orderNumber}</h4>
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

export async function sendSupplierPayout(data: SupplierPayoutData) {
  const formattedDate = new Date(data.deliveryDate + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const itemsHtml = data.items
    .map((item) => {
      const isShort = item.arrived !== null && item.arrived < item.ordered;
      return `
        <tr style="${isShort ? 'background: #fef3c7;' : ''}">
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.productName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${item.ordered}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold; ${isShort ? 'color: #d97706;' : 'color: #16a34a;'}">${item.arrived ?? '—'}</td>
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

  // Calculate totals
  const subtotalBeforeCommission = data.arrivedTotal - data.supplierRefundDeduction;
  const commission = subtotalBeforeCommission * 0.2;
  const payout = subtotalBeforeCommission * 0.8;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject: `Payout Summary for ${formattedDate}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">💰 Your Payout Summary</h1>
        <p>Hi ${data.supplierName},</p>
        <p>Here's your payout breakdown for <strong>${formattedDate}</strong>.</p>
        
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
          Payment will be sent within 7 days. If you have any questions about this payout, please reply to this email.
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
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
