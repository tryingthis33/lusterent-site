import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 465);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: smtpPort,
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : smtpPort === 465,
  auth: {
    user: process.env.EMAIL_USER || "service@lusterent.com",
    pass: process.env.EMAIL_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!process.env.EMAIL_PASSWORD) {
    console.warn("Email password not configured. Email not sent.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Luster Entertainment Inc." <${process.env.EMAIL_USER || "service@lusterent.com"}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function sendInvestmentInquiryNotification(inquiry: {
  name: string;
  email: string;
  amount?: string;
  interest?: string;
  message?: string;
  type?: string;
}): Promise<boolean> {
  const subject = `New ${inquiry.type === 'contact' ? 'Contact' : 'Investment'} Inquiry from ${inquiry.name}`;
  
  const text = `
New inquiry received:

Name: ${inquiry.name}
Email: ${inquiry.email}
Type: ${inquiry.type || 'investment'}
${inquiry.amount ? `Investment Amount: ${inquiry.amount}` : ''}
${inquiry.interest ? `Area of Interest: ${inquiry.interest}` : ''}
${inquiry.message ? `Message:\n${inquiry.message}` : ''}

---
Luster Entertainment Inc.
  `.trim();

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 40px; border: 1px solid rgba(212, 175, 55, 0.2);">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #D4AF37; font-size: 24px; margin: 0;">Luster Entertainment Inc.</h1>
        <p style="color: #666; font-size: 12px; letter-spacing: 3px; text-transform: uppercase;">Executive Inquiry</p>
      </div>
      
      <div style="background: #111; padding: 30px; border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.1);">
        <h2 style="color: #D4AF37; font-size: 18px; margin-bottom: 20px;">New ${inquiry.type === 'contact' ? 'Contact' : 'Investment'} Inquiry</h2>
        
        <table style="width: 100%; color: #999; font-size: 14px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #666;">Name</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #fff;">${inquiry.name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #666;">Email</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #D4AF37;">${inquiry.email}</td>
          </tr>
          ${inquiry.amount ? `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #666;">Investment Amount</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #fff;">${inquiry.amount}</td>
          </tr>
          ` : ''}
          ${inquiry.interest ? `
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #666;">Area of Interest</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #fff;">${inquiry.interest}</td>
          </tr>
          ` : ''}
        </table>
        
        ${inquiry.message ? `
        <div style="margin-top: 20px;">
          <p style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Message</p>
          <p style="color: #ccc; font-size: 14px; line-height: 1.6; background: #0a0a0a; padding: 15px; border-radius: 5px;">${inquiry.message}</p>
        </div>
        ` : ''}
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(212, 175, 55, 0.1);">
        <p style="color: #444; font-size: 11px;">This is an automated notification from Luster Entertainment Inc.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: process.env.EMAIL_USER || "service@lusterent.com",
    subject,
    text,
    html,
  });
}

export async function sendLentCreditApplicationNotification(app: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  requestedTier: string;
  requestedLimitCents: number;
  annualIncome: number;
  primarySpendingBusiness?: string | null;
  city: string;
  state: string;
  status: string;
}): Promise<boolean> {
  const subject = `New LENT Credit Application — ${app.firstName} ${app.lastName} (${app.requestedTier})`;
  const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;
  const text = `
New LENT Credit application:

Application ID: ${app.id}
Applicant: ${app.firstName} ${app.lastName}
Email: ${app.email}
Phone: ${app.phone}
Location: ${app.city}, ${app.state}
Requested Tier: ${app.requestedTier}
Requested Limit: ${usd(app.requestedLimitCents)}
Annual Income: $${app.annualIncome.toLocaleString("en-US")}
Primary Spending Business: ${app.primarySpendingBusiness || "n/a"}
Status: ${app.status}

Note: SSN and full KYC details are stored securely and intentionally omitted from this notification.

---
LENT Credit / Luster Ent Inc.
  `.trim();

  return sendEmail({
    to: process.env.EMAIL_USER || "service@lusterent.com",
    subject,
    text,
  });
}

export async function sendAdverseActionNotice(app: {
  email: string;
  firstName: string;
  reason?: string | null;
}): Promise<boolean> {
  const subject = "Important Notice Regarding Your LENT Credit Application";
  const reason = app.reason?.trim() || "Insufficient information to approve a spendable credit line at this time.";
  const text = `
Dear ${app.firstName},

Thank you for applying for LENT Credit. After review, we are unable to approve your application for a spendable credit line at this time.

Principal reason(s): ${reason}

Notice of Your Rights (Equal Credit Opportunity Act & Fair Credit Reporting Act):
- The federal Equal Credit Opportunity Act prohibits creditors from discriminating against applicants on the basis of race, color, religion, national origin, sex, marital status, age (provided the applicant has the capacity to contract), because all or part of the applicant's income derives from a public assistance program, or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act.
- You have the right to a statement of specific reasons for this action. To obtain it, contact us within 60 days at service@lusterent.com.
- If our decision was based in whole or in part on information from a consumer reporting agency, you have the right to obtain a free copy of your report from that agency within 60 days and to dispute the accuracy or completeness of any information in it.

Alternative: You may qualify for our Credit-Builder Membership, which reports a tradeline to the major bureaus to help you build credit history. Visit your LENT Credit page to learn more.

Sincerely,
LENT Credit / Luster Entertainment Inc.
  `.trim();

  return sendEmail({ to: app.email, subject, text });
}

export async function sendApplicationDecisionEmail(app: {
  email: string;
  firstName: string;
  status: string;
  track?: string;
}): Promise<boolean> {
  if (app.status === "denied") {
    return sendAdverseActionNotice({ email: app.email, firstName: app.firstName });
  }
  const subject = "Your LENT Credit Application Has Been Approved";
  const text = `
Dear ${app.firstName},

Good news — your LENT Credit application has been approved${app.track === "builder" ? " for a Credit-Builder Membership" : " for a spendable credit line"}.

Sign in to your dashboard to view your account details and get started.

Sincerely,
LENT Credit / Luster Entertainment Inc.
  `.trim();
  return sendEmail({ to: app.email, subject, text });
}

export async function sendConfirmationEmail(inquiry: {
  name: string;
  email: string;
  type?: string;
}): Promise<boolean> {
  const subject = "Thank You for Contacting Luster Entertainment Inc.";
  
  const text = `
Dear ${inquiry.name},

Thank you for your interest in Luster Entertainment Inc. We have received your ${inquiry.type === 'contact' ? 'message' : 'investment inquiry'} and our team will review it promptly.

A member of our executive team will be in touch with you within 2-3 business days.

Best regards,
Luster Entertainment Inc.
  `.trim();

  const html = `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 40px; border: 1px solid rgba(212, 175, 55, 0.2);">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #D4AF37; font-size: 28px; margin: 0;">Luster Entertainment Inc.</h1>
        <p style="color: #666; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; margin-top: 10px;">Premium Venture Portfolio</p>
      </div>
      
      <div style="background: #111; padding: 30px; border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.1);">
        <p style="color: #ccc; font-size: 16px; line-height: 1.8;">Dear ${inquiry.name},</p>
        
        <p style="color: #999; font-size: 15px; line-height: 1.8;">
          Thank you for your interest in <span style="color: #D4AF37;">Luster Entertainment Inc.</span> We have received your ${inquiry.type === 'contact' ? 'message' : 'investment inquiry'} and our team will review it promptly.
        </p>
        
        <p style="color: #999; font-size: 15px; line-height: 1.8;">
          A member of our executive team will be in touch with you within <strong style="color: #D4AF37;">2-3 business days</strong>.
        </p>
        
        <p style="color: #ccc; font-size: 15px; line-height: 1.8; margin-top: 30px;">
          Best regards,<br>
          <span style="color: #D4AF37;">Luster Entertainment Inc.</span>
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(212, 175, 55, 0.1);">
        <p style="color: #444; font-size: 11px;">This is an automated confirmation from Luster Entertainment Inc.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: inquiry.email,
    subject,
    text,
    html,
  });
}

/** Reports (without exposing secrets) whether outgoing email is configured and accepted by the mail server. */
export async function checkEmailTransport(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {
    passwordSet: Boolean(process.env.EMAIL_PASSWORD),
    passwordHasStrayWhitespace: process.env.EMAIL_PASSWORD ? process.env.EMAIL_PASSWORD !== process.env.EMAIL_PASSWORD.trim() : false,
    user: process.env.EMAIL_USER || "service@lusterent.com (default)",
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port: smtpPort,
  };
  try {
    await transporter.verify();
    result.smtpLogin = "ok";
  } catch (err: any) {
    result.smtpLogin = "FAILED";
    result.errorCode = err?.code ?? null;
    result.responseCode = err?.responseCode ?? null;
    result.reason = String(err?.response ?? err?.message ?? "").slice(0, 160);
  }
  return result;
}
