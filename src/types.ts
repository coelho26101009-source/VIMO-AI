export type MessageSource = 'USER' | 'VUXIO' | 'SYSTEM' | 'ERROR';

export interface SearchSource {
  title: string;
  url: string;
}

export interface LogMessage {
  id: string;
  source: MessageSource;
  text: string;
  timestamp: string;
  sources?: SearchSource[];
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