export type MessageSource = 'USER' | 'VUXIO' | 'SYSTEM' | 'ERROR';

export interface LogMessage {
  id: string;
  source: MessageSource;
  text: string;
  timestamp: string;
}

export interface Chat {
  id: string;
  title: string;
  isCodeMode?: boolean;
}

export interface Attachment {
  file: File;
  base64: string;
}