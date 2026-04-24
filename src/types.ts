export type MessageSource = 'USER' | 'VIMO' | 'SYSTEM' | 'ERROR';

export interface LogMessage {
  id: string;
  source: MessageSource;
  text: string;
  timestamp: string;
}

export interface Chat {
  id: string;
  title: string;
  updatedAt?: Date;
}

export interface Attachment {
  file: File;
  base64: string;
}