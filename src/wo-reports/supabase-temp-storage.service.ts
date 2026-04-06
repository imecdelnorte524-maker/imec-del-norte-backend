import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseTempStorageService {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.bucket = process.env.SUPABASE_TEMP_BUCKET || 'temp-reports';

    if (!url || !key) {
      throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas');
    }

    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  getBucketName() {
    return this.bucket;
  }

  /**
   * Subida genérica: PDF, ZIP, XLSX, etc.
   */
  async uploadFile(params: {
    path: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(params.path, params.buffer, {
        contentType: params.contentType,
        upsert: true,
      });

    if (error) throw new Error(`Supabase upload error: ${error.message}`);
  }

  /**
   * Compatibilidad: sigue existiendo, pero ahora llama a uploadFile()
   */
  async uploadPdf(params: { path: string; buffer: Buffer }): Promise<void> {
    return this.uploadFile({
      path: params.path,
      buffer: params.buffer,
      contentType: 'application/pdf',
    });
  }

  /**
   * Descarga genérica (devuelve Buffer).
   * Nota: Supabase Storage SDK aquí devuelve Blob, no stream.
   */
  async downloadFile(params: { path: string }): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(params.path);

    if (error) throw new Error(`Supabase download error: ${error.message}`);

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Compatibilidad: sigue existiendo, pero ahora llama a downloadFile()
   */
  async downloadPdf(params: { path: string }): Promise<Buffer> {
    return this.downloadFile(params);
  }

  async remove(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.client.storage.from(this.bucket).remove(paths);
    if (error) throw new Error(`Supabase remove error: ${error.message}`);
  }

  async list(prefix: string, limit = 100, offset = 0) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(prefix, {
        limit,
        offset,
        sortBy: { column: 'created_at', order: 'asc' },
      });

    if (error) throw new Error(`Supabase list error: ${error.message}`);
    return data ?? [];
  }
}