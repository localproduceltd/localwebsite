import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "Local Produce <onboarding@resend.dev>";

// ─── Customer Emails ─────────────────────────────────────────────────────────

interface OrderConfirmationData {
  customerEmail: string;
  customerName: string;
  orderNumber: number;
  deliveryDay: string;
  items: Array<{ productName: string; quantity: number; price: number }>;
  total: number;
}

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  const itemsList = data.items
    .map((item) => `• ${item.productName} x${item.quantity} - £${(item.price * item.quantity).toFixed(2)}`)
    .join("\n");

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.customerEmail,
    subject: `Order Confirmed - #${data.orderNumber}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">Thank you for your order!</h1>
        <p>Hi ${data.customerName},</p>
        <p>Your order <strong>#${data.orderNumber}</strong> has been confirmed.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Order Details</h3>
          <p><strong>Delivery Day:</strong> ${data.deliveryDay}</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
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
}

export async function sendSupplierNewOrder(data: NewOrderData) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: data.supplierEmail,
    subject: `New Order Received - #${data.orderNumber}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #A30E4E;">🎉 New Order!</h1>
        <p>Hi ${data.supplierName},</p>
        <p>You've received a new order for your products.</p>
        
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
        
        <p>
          <a href="https://localproduce.ltd/account" style="display: inline-block; background: #A30E4E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
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
