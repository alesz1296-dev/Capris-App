import { Injectable } from "@nestjs/common";

export interface SendEmailInput {
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export interface SendEmailResult {
  provider: "postmark" | "sendgrid";
  messageId?: string;
}

@Injectable()
export class EmailService {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (process.env.POSTMARK_TOKEN?.trim()) {
      return this.sendWithPostmark(input);
    }

    if (process.env.SENDGRID_API_KEY?.trim()) {
      return this.sendWithSendGrid(input);
    }

    throw new Error("No email provider is configured for consignation delivery.");
  }

  private async sendWithPostmark(input: SendEmailInput): Promise<SendEmailResult> {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": process.env.POSTMARK_TOKEN!.trim()
      },
      body: JSON.stringify({
        From: this.resolveFromAddress(),
        To: input.to.join(","),
        Subject: input.subject,
        TextBody: input.textBody,
        HtmlBody: input.htmlBody
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { ErrorCode?: number; Message?: string; MessageID?: string };
    if (!response.ok) {
      throw new Error(payload.Message || `Postmark send failed with status ${response.status}.`);
    }

    return {
      provider: "postmark",
      messageId: payload.MessageID
    };
  }

  private async sendWithSendGrid(input: SendEmailInput): Promise<SendEmailResult> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY!.trim()}`
      },
      body: JSON.stringify({
        from: {
          email: this.resolveFromAddress()
        },
        personalizations: [
          {
            to: input.to.map((email) => ({ email }))
          }
        ],
        subject: input.subject,
        content: [
          {
            type: "text/plain",
            value: input.textBody
          },
          ...(input.htmlBody
            ? [
                {
                  type: "text/html",
                  value: input.htmlBody
                }
              ]
            : [])
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `SendGrid send failed with status ${response.status}.`);
    }

    return {
      provider: "sendgrid",
      messageId: response.headers.get("x-message-id") ?? undefined
    };
  }

  private resolveFromAddress() {
    return (
      process.env.EMAIL_FROM_ADDRESS?.trim() ||
      process.env.DEFAULT_FROM_EMAIL?.trim() ||
      "noreply@capris.local"
    );
  }
}
