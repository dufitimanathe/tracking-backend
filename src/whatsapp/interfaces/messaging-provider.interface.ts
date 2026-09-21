export interface WhatsAppInteractiveButton {
  id: string;
  title: string;
}

export interface WhatsAppSendTextOptions {
  phone: string;
  text: string;
}

export interface WhatsAppSendButtonsOptions {
  phone: string;
  body: string;
  buttons: WhatsAppInteractiveButton[];
}

export interface WhatsAppSendTemplateOptions {
  phone: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
}

export interface MessagingProvider {
  sendText(options: WhatsAppSendTextOptions): Promise<{ messageId?: string }>;
  sendButtons(options: WhatsAppSendButtonsOptions): Promise<{ messageId?: string }>;
  sendTemplate(options: WhatsAppSendTemplateOptions): Promise<{ messageId?: string }>;
}
