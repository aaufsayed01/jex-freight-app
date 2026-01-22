import { ShipmentStatus } from "@prisma/client";
import { sendMail } from "./mailer";
import { BookingStatus } from "@prisma/client";
import { QuoteStatus } from "@prisma/client"; // add at top with other imports
import nodemailer from "nodemailer";
import { DocumentType } from "@prisma/client";
const OPS_EMAIL = process.env.OPS_EMAIL || "";
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== "false";

export const DAY1_SHIPMENT_EMAIL_STATUSES: ShipmentStatus[] = [
  ShipmentStatus.CONFIRMED,
  ShipmentStatus.READY_FOR_PICKUP,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.DEPARTED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.EXCEPTION,
  ShipmentStatus.ON_HOLD,
  ShipmentStatus.CANCELLED,
];
function safeArr<T>(v: T | null | undefined): T[] {
  return v ? [v] : [];
}

function baseHtml(title: string, body: string) {
  return `
  <div style="font-family:Arial,sans-serif;line-height:1.5">
    <h2>${title}</h2>
    ${body}
    <hr/>
    <p style="color:#666;font-size:12px">JEX Freight</p>
  </div>`;
}

export async function emailShipmentStatusChanged(input: {
  toCustomerEmail?: string | null;
  shipmentRef: string; // or shipmentId if you don’t have a ref
  status: ShipmentStatus;
  description?: string | null;
  location?: string | null;
  eventTime?: Date | null;
}) {
  // only Day-1 milestone statuses
  if (!DAY1_SHIPMENT_EMAIL_STATUSES.includes(input.status)) return;

  const recipients = [
    ...safeArr(input.toCustomerEmail || undefined),
  ].filter(Boolean);

  if (recipients.length === 0) return;

  const subject = `Shipment ${input.shipmentRef} update: ${input.status}`;
  const body = `
    <p>Your shipment status has been updated.</p>
    <ul>
      <li><b>Shipment:</b> ${input.shipmentRef}</li>
      <li><b>Status:</b> ${input.status}</li>
      ${input.location ? `<li><b>Location:</b> ${input.location}</li>` : ""}
      ${input.description ? `<li><b>Details:</b> ${input.description}</li>` : ""}
      ${input.eventTime ? `<li><b>Time:</b> ${input.eventTime.toISOString()}</li>` : ""}
    </ul>
  `;
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({ to: recipients, subject, html: baseHtml("Shipment Update", body) });
}

export async function emailBookingStatus(input: {
  toCustomerEmail?: string | null;
  bookingRef: string;
  status: BookingStatus;
}) {
  
  const ALLOWED_BOOKING_EMAIL_STATUSES: ReadonlySet<BookingStatus> = new Set([
     BookingStatus.CONFIRMED,
     BookingStatus.CANCELLED,
  ]);

  if (!ALLOWED_BOOKING_EMAIL_STATUSES.has(input.status)) return;

  const recipients = [
    ...safeArr(input.toCustomerEmail || undefined),
  ].filter(Boolean);

  if (recipients.length === 0) return;

  const subject = `Booking ${input.bookingRef} ${input.status}`;
  const body = `
    <p>Your booking has been <b>${input.status.toLowerCase()}</b>.</p>
    <ul>
      <li><b>Booking:</b> ${input.bookingRef}</li>
      <li><b>Status:</b> ${input.status}</li>
    </ul>
  `;
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({ to: recipients, subject, html: baseHtml("Booking Update", body) });
}

export async function emailDocumentUploaded(input: {
  toCustomerEmail?: string | null;
  shipmentRef: string;
  fileName: string;
}) {
  const recipientsCustomer = safeArr(input.toCustomerEmail || undefined).filter(Boolean);
  const recipientsOps = OPS_EMAIL ? [OPS_EMAIL] : [];
  
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  // customer email
  if (recipientsCustomer.length > 0) {
    await sendMail({
      to: recipientsCustomer,
      subject: `Shipment ${input.shipmentRef}: document uploaded`,
      html: baseHtml(
        "Shipment Documents Updated",
        `<p>A new document was uploaded.</p>
         <ul>
           <li><b>Shipment:</b> ${input.shipmentRef}</li>
           <li><b>Document:</b> ${input.fileName}</li>
         </ul>`
      ),
    });
  }

  // ops email (optional but useful)
  if (recipientsOps.length > 0) {
    await sendMail({
      to: recipientsOps,
      subject: `Ops: Document uploaded for ${input.shipmentRef}`,
      html: baseHtml(
        "Ops Notification",
        `<p>Document uploaded.</p>
         <ul>
           <li><b>Shipment:</b> ${input.shipmentRef}</li>
           <li><b>Document:</b> ${input.fileName}</li>
         </ul>`
      ),
    });
  }
}

export async function emailQuoteRequestReceived(input: {
  quoteRef: string;
  companyName?: string | null;
  origin: string;
  destination: string;
  shipmentMode: string;
}) {
  const recipientsOps = OPS_EMAIL ? [OPS_EMAIL] : [];
  if (recipientsOps.length === 0) return;

  const subject = `New quote request: ${input.quoteRef}`;
  const body = `
    <p>A new quote request was submitted.</p>
    <ul>
      <li><b>Quote:</b> ${input.quoteRef}</li>
      ${input.companyName ? `<li><b>Company:</b> ${input.companyName}</li>` : ""}
      <li><b>Route:</b> ${input.origin} → ${input.destination}</li>
      <li><b>Mode:</b> ${input.shipmentMode}</li>
    </ul>
  `;
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({ to: recipientsOps, subject, html: baseHtml("New Quote Request", body) });
}

export async function emailShipmentCreated(input: {
  toCustomerEmail?: string | null;
  shipmentRef: string;
  origin: string;
  destination: string;
}) {
  const toCustomer = safeArr(input.toCustomerEmail || undefined).filter(Boolean);
  const toOps = OPS_EMAIL ? [OPS_EMAIL] : [];

  const subjectCustomer = `Shipment created: ${input.shipmentRef}`;
  const htmlCustomer = baseHtml(
    "Shipment Created",
    `<p>Your shipment has been created.</p>
     <ul>
       <li><b>Shipment:</b> ${input.shipmentRef}</li>
       <li><b>Route:</b> ${input.origin} → ${input.destination}</li>
     </ul>`
  );
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  if (toCustomer.length > 0) {
    await sendMail({ to: toCustomer, subject: subjectCustomer, html: htmlCustomer });
  }

  if (toOps.length > 0) {
    await sendMail({
      to: toOps,
      subject: `Ops: Shipment created ${input.shipmentRef}`,
      html: baseHtml(
        "Ops Notification",
        `<p>Shipment created.</p>
         <ul>
           <li><b>Shipment:</b> ${input.shipmentRef}</li>
           <li><b>Route:</b> ${input.origin} → ${input.destination}</li>
         </ul>`
      ),
    });
  }
}

export async function emailAwaitingDocuments(input: {
  toCustomerEmail?: string | null;
  shipmentRef: string;
}) {
  const recipients = safeArr(input.toCustomerEmail || undefined).filter(Boolean);
  if (recipients.length === 0) return;

  const subject = `Shipment ${input.shipmentRef}: documents required`;
  const body = `
    <p>We need documents to proceed with your shipment.</p>
    <ul>
      <li><b>Shipment:</b> ${input.shipmentRef}</li>
      <li>Please upload the required documents in the portal.</li>
    </ul>
  `;
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({ to: recipients, subject, html: baseHtml("Documents Required", body) });
}

export async function emailDocumentVisibilityChanged(input: {
  toCustomerEmail?: string | null;
  shipmentRef: string;
  documentName: string;
}) {
  const recipients = safeArr(input.toCustomerEmail || undefined).filter(Boolean);
  if (recipients.length === 0) return;

  const subject = `Shipment ${input.shipmentRef}: document available`;
  const body = `
    <p>A document is now available for you to view/download.</p>
    <ul>
      <li><b>Shipment:</b> ${input.shipmentRef}</li>
      <li><b>Document:</b> ${input.documentName}</li>
    </ul>
  `;
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({ to: recipients, subject, html: baseHtml("Document Available", body) });
}
export async function emailQuoteSentToCustomer(input: {
  toCustomerEmail?: string | null;
  quoteRef: string;
  origin: string;
  destination: string;

  totalPrice?: number | null;
  currency?: string | null;
  validUntil?: Date | null;

  airFreightDisplay?: string | null;
  thcDisplay?: string | null;
  exworksAmount?: number | null;

  exworksBreakdownApproved?: boolean;
  exworksBreakdown?: Record<string, number>;
}) {
  const recipients = safeArr(input.toCustomerEmail || undefined).filter(Boolean);
  if (recipients.length === 0) return;

  const subject = input.exworksBreakdownApproved
    ? `Quote ${input.quoteRef} – ExWorks Breakdown Approved`
    : `Quote ${input.quoteRef} is ready`;

  const breakdownBlock =
    input.airFreightDisplay || input.thcDisplay || input.exworksAmount != null
      ? `
        <p><b>Quote Summary</b></p>
        <ul>
          ${input.airFreightDisplay ? `<li><b>Air Freight:</b> ${input.airFreightDisplay}</li>` : ""}
          ${input.thcDisplay ? `<li><b>THC:</b> ${input.thcDisplay}</li>` : ""}
          ${
            input.exworksAmount != null && input.currency
              ? `<li><b>ExWorks:</b> ${input.exworksAmount} ${input.currency}</li>`
              : input.exworksAmount != null
              ? `<li><b>ExWorks:</b> ${input.exworksAmount}</li>`
              : ""
          }
        </ul>
      `
      : "";

  // ✅ MOVE THIS ABOVE body
  const breakdownSection =
    input.exworksBreakdownApproved && input.exworksBreakdown
      ? `
        <p><b>ExWorks Breakdown (Approved)</b></p>
        <ul>
          ${Object.entries(input.exworksBreakdown)
            .map(
              ([k, v]) =>
                `<li>${k}: ${v}${input.currency ? ` ${input.currency}` : ""}</li>`
            )
            .join("")}
        </ul>
      `
      : "";

  const body = `
    <p>Your quote is ready.</p>
    <ul>
      <li><b>Quote:</b> ${input.quoteRef}</li>
      <li><b>Route:</b> ${input.origin} → ${input.destination}</li>
      ${
        input.totalPrice != null && input.currency
          ? `<li><b>Total:</b> ${input.totalPrice} ${input.currency}</li>`
          : ""
      }
      ${input.validUntil ? `<li><b>Valid until:</b> ${input.validUntil.toISOString()}</li>` : ""}
    </ul>
    ${breakdownBlock}
    ${breakdownSection}
    <p>Please log in to review and accept.</p>
  `;

  if (!EMAIL_ENABLED) {
    console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
    return;
  }

  await sendMail({ to: recipients, subject, html: baseHtml("Quote Ready", body) });
}

export async function emailQuoteDecisionToOps(input: {
  quoteRef: string;
  decision: QuoteStatus; // ACCEPTED | REJECTED
  customerEmail?: string | null;
  companyName?: string | null;
  origin: string;
  destination: string;
}) {
  const toOps = OPS_EMAIL ? [OPS_EMAIL] : [];
  if (toOps.length === 0) return;

  const subject = `Quote ${input.quoteRef} ${input.decision}`;
  const body = `
    <p>Customer updated quote decision.</p>
    <ul>
      <li><b>Quote:</b> ${input.quoteRef}</li>
      <li><b>Decision:</b> ${input.decision}</li>
      ${input.companyName ? `<li><b>Company:</b> ${input.companyName}</li>` : ""}
      ${input.customerEmail ? `<li><b>Customer:</b> ${input.customerEmail}</li>` : ""}
      <li><b>Route:</b> ${input.origin} → ${input.destination}</li>
    </ul>
  `;
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({ to: toOps, subject, html: baseHtml("Quote Decision", body) });
}

export async function emailQuoteDecisionToCustomer(input: {
  toCustomerEmail?: string | null;
  quoteRef: string;
  decision: QuoteStatus; // ACCEPTED | REJECTED
}) {
  const toCustomer = safeArr(input.toCustomerEmail || undefined).filter(Boolean);
  if (toCustomer.length === 0) return;

  const subject = `Quote ${input.quoteRef} ${input.decision.toLowerCase()}`;
  const body = `
    <p>We received your response for quote <b>${input.quoteRef}</b>.</p>
    <ul>
      <li><b>Status:</b> ${input.decision}</li>
    </ul>
    <p>If you need changes, reply to this email.</p>
  `;
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({ to: toCustomer, subject, html: baseHtml("Quote Update", body) });
}

export async function emailBookingDraftCreated(input: {
  toCustomerEmail?: string | null;
  bookingRef: string;
  quoteRef: string;
}) {
  const toOps = OPS_EMAIL ? [OPS_EMAIL] : [];
  const toCustomer = safeArr(input.toCustomerEmail || undefined).filter(Boolean);
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  // Ops email
  if (toOps.length > 0) {
    await sendMail({
      to: toOps,
      subject: `Ops: Booking draft created ${input.bookingRef} (Quote ${input.quoteRef})`,
      html: baseHtml(
        "Booking Draft Created",
        `<p>A booking draft was created after quote acceptance.</p>
         <ul>
           <li><b>Booking:</b> ${input.bookingRef}</li>
           <li><b>Quote:</b> ${input.quoteRef}</li>
         </ul>`
      ),
    });
  }

  // Customer email (optional but professional)
  if (toCustomer.length > 0) {
    await sendMail({
      to: toCustomer,
      subject: `Booking initiated for Quote ${input.quoteRef}`,
      html: baseHtml(
        "Booking Initiated",
        `<p>Thanks — we received your quote acceptance and initiated a booking.</p>
         <ul>
           <li><b>Booking reference:</b> ${input.bookingRef}</li>
           <li><b>Quote reference:</b> ${input.quoteRef}</li>
         </ul>
         <p>Our team will review and confirm shortly.</p>`
      ),
    });
  }
}

export async function emailVerifyAccount(input: {
  toCustomerEmail: string;
  verifyUrl: string;
}) { 
  if (!EMAIL_ENABLED) {
   console.log("📧 Email disabled (EMAIL_ENABLED=false). Skipping send.");
   return;
  }

  await sendMail({
    to: [input.toCustomerEmail],
    subject: "Verify your email - JEX Freight",
    html: baseHtml(
      "Verify your email",
      `<p>Please verify your email to activate your account.</p>
       <p><a href="${input.verifyUrl}">Verify Email</a></p>
       <p>This link expires in 24 hours.</p>`
    ),
  });
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "127.0.0.1",
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
});

/**
 * Email customer when documents are requested for a shipment
 */
export async function emailDocumentRequestToCustomer(params: {
  to: string[] | string;
  shipmentRef: string;
  requestedDocs: DocumentType[];
}) {
  const { to, shipmentRef, requestedDocs } = params;

  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn("⚠️ emailDocumentRequestToCustomer: no recipients, skipping");
    return;
  }

  const docList = requestedDocs
    .map((d) => `• ${d.replace(/_/g, " ")}`)
    .join("\n");

  const subject = `Documents required for shipment ${shipmentRef}`;

  const text = `
Hello,

JEX Logistics requires the following documents for shipment ${shipmentRef}:

${docList}

Please log in to the portal and upload these documents at your earliest convenience.

Thank you,
JEX Logistics
`;

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || "JEX@yourcompany.com",
      to,
      subject,
      text,
    });

    console.log("📧 Document request email sent:", to);
  } catch (err) {
    console.error("❌ Failed to send document request email:", err);
    if (process.env.NODE_ENV === "production") throw err;
  }
}