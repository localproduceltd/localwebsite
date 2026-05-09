import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "Local Produce <onboarding@resend.dev>";

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
  boxDepositPaid?: boolean;
  bottleDepositPaid?: boolean;
  items: Array<{ productName: string; quantity: number; price: number }>;
  total: number;
  isTopUp?: boolean;
}

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  const itemsList = data.items
    .map((item) => `• ${item.productName} x${item.quantity} - £${(item.price * item.quantity).toFixed(2)}`)
    .join("\n");

  const subject = data.isTopUp 
    ? `Items Added to Order #${data.orderNumber}` 
    : `Order Confirmed - #${data.orderNumber}`;
  
  const heading = data.isTopUp
    ? "Items added to your order!"
    : "Thank you for your order!";
  
  const message = data.isTopUp
    ? `The following items have been added to your order <strong>#${data.orderNumber}</strong>.`
    : `Your order <strong>#${data.orderNumber}</strong> has been confirmed.`;

  const deliveryWindowText = data.deliveryWindow === "morning" ? "9am – 1pm" : data.deliveryWindow === "afternoon" ? "1pm – 5pm" : "";
  
  // Build reminders section
  const reminders: string[] = [];
  if (data.boxDepositPaid) {
    reminders.push("🧊 <strong>Cool bag & box:</strong> We'll leave your order in a cool bag and insulated box. Please leave it outside for collection on your next delivery.");
  }
  if (data.bottleDepositPaid === false && data.items.some(i => i.productName.toLowerCase().includes("glass bottle"))) {
    reminders.push("🍼 <strong>Bottle return:</strong> Please leave your empty glass bottles outside for collection when we deliver.");
  }
  if (data.willBeIn === false && data.safePlace) {
    reminders.push(`📍 <strong>Safe place:</strong> ${data.safePlace}`);
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">${heading}</h1>
        <p>Hi ${data.customerName},</p>
        <p>${message}</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Delivery Details</h3>
          <p><strong>Date:</strong> ${data.deliveryDay}${deliveryWindowText ? ` (${deliveryWindowText})` : ""}</p>
          ${data.address ? `<p><strong>Address:</strong> ${data.address}</p>` : ""}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #333;">Items</h4>
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
        
        ${reminders.length > 0 ? `
        <div style="background: #fef3c7; padding: 16px 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h4 style="margin: 0 0 10px 0; color: #92400e;">Reminders</h4>
          ${reminders.map(r => `<p style="margin: 8px 0; color: #78350f;">${r}</p>`).join("")}
        </div>
        ` : ""}
        
        <p>We'll notify you when your order is on its way.</p>
        <p>Thank you for supporting local producers!</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send order confirmation email:", error);
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
    subject: "Your Box Deposit Has Been Refunded",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">💰 Deposit Refunded!</h1>
        <p>Hi${data.customerName ? ` ${data.customerName}` : ""},</p>
        <p>Thanks for returning your cool box! We've refunded your <strong>£10 deposit</strong>.</p>
        <p>The refund should appear in your account within <strong>5-10 business days</strong>, depending on your bank.</p>
        <p>Thanks for shopping with us — we hope to see you again soon!</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
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
    subject: `Refund Processed - Order #${data.orderNumber}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">💰 Refund Processed</h1>
        <p>Hi${data.customerName ? ` ${data.customerName}` : ""},</p>
        <p>We're sorry that things didn't go as planned with your order. We've processed a refund for you.</p>
        
        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Order:</strong> #${data.orderNumber}</p>
          <p style="margin: 0 0 10px 0;"><strong>Item:</strong> ${data.productName} x${data.quantity}</p>
          <p style="margin: 0 0 10px 0;"><strong>Refund Amount:</strong> £${data.refundAmount.toFixed(2)}</p>
          ${data.reason ? `<p style="margin: 0;"><strong>Reason:</strong> ${data.reason}</p>` : ""}
        </div>
        
        <p>The refund should appear in your account within <strong>5-10 business days</strong>, depending on your bank.</p>
        
        <p>We're really sorry for any inconvenience caused. If you have any questions, just reply to this email.</p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
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
  status: "confirmed" | "delivered" | "cancelled";
  deliveryDay: string;
}

const statusMessages = {
  confirmed: {
    subject: "Order Confirmed",
    emoji: "✓",
    color: "#3b82f6",
    heading: "Your order is confirmed!",
    message: "We're preparing your order and it will be delivered on your selected delivery day.",
  },
  delivered: {
    subject: "Order Delivered",
    emoji: "🎉",
    color: "#22c55e",
    heading: "Your order has been delivered!",
    message: "We hope you enjoy your local produce. Don't forget to leave a review!",
  },
  cancelled: {
    subject: "Order Cancelled",
    emoji: "✕",
    color: "#ef4444",
    heading: "Your order has been cancelled",
    message: "If you didn't request this cancellation, please contact us.",
  },
};

export async function sendOrderStatusUpdate(data: OrderStatusUpdateData) {
  const config = statusMessages[data.status];
  
  const feedbackSection = data.status === "delivered" ? `
        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="margin: 0 0 10px 0; color: #92400e;">⭐ How was your order?</h3>
          <p style="margin: 0 0 15px 0; color: #78350f;">We'd love to hear your feedback! Rate your products and help other customers discover great local produce.</p>
          <a href="https://www.localproduce.ltd/account" style="display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
            Rate Your Products
          </a>
        </div>
  ` : "";

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject: `${config.subject} - Order #${data.orderNumber}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: ${config.color};">${config.emoji} ${config.heading}</h1>
        <p>Hi ${data.customerName},</p>
        <p>${config.message}</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Order:</strong> #${data.orderNumber}</p>
          <p style="margin: 8px 0 0 0;"><strong>Delivery Day:</strong> ${data.deliveryDay}</p>
        </div>
        
        ${feedbackSection}
        
        <p>
          <a href="https://www.localproduce.ltd/account" style="display: inline-block; background: #A30E4E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View Order
          </a>
        </p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          — The Local Produce Team
        </p>
      </div>
    `,
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
  stockTotals: Array<{ productName: string; totalQuantity: number }>;
  orders: Array<{
    orderNumber: number;
    items: Array<{ productName: string; quantity: number; price: number }>;
    subtotal: number;
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
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${item.totalQuantity}</td>
      </tr>
    `)
    .join("");

  const ordersHtml = data.orders
    .map((order) => `
      <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <h4 style="margin: 0 0 12px 0; color: #A30E4E;">Order #${order.orderNumber}</h4>
        ${order.items.map((item) => `
          <div style="display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px;">
            <span>${item.productName} x${item.quantity}</span>
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
