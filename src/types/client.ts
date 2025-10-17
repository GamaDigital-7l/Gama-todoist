export interface Client {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string | null;
  description?: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Moodboard {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisualReferenceElement {
  id: string;
  moodboard_id: string; // Alterado de client_id
  user_id: string;
  element_type: 'image' | 'text';
  content: string; // URL para imagem, texto real para nota de texto
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  rotation?: number | null;
  opacity?: number | null;
  z_index?: number | null;
  metadata?: {
    fontSize?: string;
    fontColor?: string;
    backgroundColor?: string;
    [key: string]: any;
  } | null;
  created_at: string;
  updated_at: string;
}