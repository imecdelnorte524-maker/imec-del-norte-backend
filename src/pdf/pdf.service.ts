// src/pdf/pdf.service.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { WKHTMLTOPDF_CONFIG } from './constants/wkhtmltopdf.config';
import { GeneratePdfDto } from './dto/generate-pdf.dto';
import { PdfDiagnoseResponse } from './interfaces/pdf-config.interface';

@Injectable()
export class PdfService implements OnModuleInit {
  private readonly logger = new Logger(PdfService.name);

  private templatesDir: string;
  private tempDir: string;
  private pdfsDir: string;

  constructor(private configService: ConfigService) {
    // Usar rutas absolutas desde la raíz del proyecto
    this.templatesDir = path.resolve(process.cwd(), 'templates', 'pdf');
    this.tempDir = path.resolve(process.cwd(), 'temp', 'pdf');
    this.pdfsDir = path.resolve(process.cwd(), 'generated', 'pdfs');
  }

  async onModuleInit() {
    await this.ensureDirectories();
    await this.checkWkhtmltopdf();
  }

  private async ensureDirectories() {
    try {
      await fs.mkdir(this.templatesDir, { recursive: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.pdfsDir, { recursive: true });
      this.logger.log('✅ Directorios PDF creados/verificados');
    } catch (error) {
      this.logger.error(`❌ Error creando directorios: ${error.message}`);
    }
  }

  private async checkWkhtmltopdf(): Promise<void> {
    return new Promise((resolve) => {
      const process = spawn(WKHTMLTOPDF_CONFIG.command, ['--version']);

      process.on('error', () => {
        this.logger.error('❌ wkhtmltopdf no está instalado o no es accesible');
        resolve();
      });

      process.on('exit', (code) => {
        if (code === 0) {
          this.logger.log('✅ wkhtmltopdf verificado correctamente');
        } else {
          this.logger.error('❌ wkhtmltopdf no responde correctamente');
        }
        resolve();
      });
    });
  }

  async generatePdf(generatePdfDto: GeneratePdfDto): Promise<Buffer> {
    const { templateName, params = {} } = generatePdfDto;
    const fileId = randomUUID();

    let htmlPath: string | null = null;
    let pdfPath: string | null = null;

    try {
      this.logger.log(`📄 Generando PDF: ${templateName} - ${fileId}`);

      // Generar HTML
      htmlPath = await this.generateHtmlFile(templateName, params, fileId);

      // Ruta del PDF
      pdfPath = path.join(this.pdfsDir, `${fileId}.pdf`);

      // Ejecutar wkhtmltopdf
      await this.executeWkhtmltopdf(htmlPath, pdfPath);

      // Leer el PDF generado
      const pdfBuffer = await fs.readFile(pdfPath);

      this.logger.log(
        `✅ PDF generado: ${fileId}.pdf (${pdfBuffer.length} bytes)`,
      );

      return pdfBuffer;
    } catch (error) {
      this.logger.error(`❌ Error generando PDF: ${error.message}`);
      throw new InternalServerErrorException(
        `Error generando PDF: ${error.message}`,
      );
    } finally {
      // Limpiar archivos temporales
      await this.cleanupFiles(htmlPath, pdfPath);
    }
  }

  private async generateHtmlFile(
    templateName: string,
    params: Record<string, any>,
    fileId: string,
  ): Promise<string> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`);

      // Verificar que el template existe
      try {
        await fs.access(templatePath);
      } catch {
        throw new NotFoundException(`Template no encontrado: ${templateName}`);
      }

      // Leer template
      let html = await fs.readFile(templatePath, 'utf8');

      // Reemplazar variables (igual que en tu código original)
      Object.entries(params).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key.toUpperCase()}}}`, 'g');
        html = html.replace(regex, String(value));
      });

      // Guardar HTML temporal
      const htmlPath = path.join(this.tempDir, `${fileId}.html`);
      await fs.writeFile(htmlPath, html);

      return htmlPath;
    } catch (error) {
      this.logger.error(`Error generando HTML: ${error.message}`);
      throw error;
    }
  }

  private executeWkhtmltopdf(htmlPath: string, pdfPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [...WKHTMLTOPDF_CONFIG.options, htmlPath, pdfPath];
      let errorMessage = '';

      const process = spawn(WKHTMLTOPDF_CONFIG.command, args);

      process.stderr.on('data', (data) => {
        errorMessage += data.toString();
        this.logger.debug(`wkhtmltopdf: ${data}`);
      });

      process.on('error', (error) => {
        this.logger.error(`Error en proceso wkhtmltopdf: ${error.message}`);
        reject(new Error(`Error ejecutando wkhtmltopdf: ${error.message}`));
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error(`wkhtmltopdf exit con código ${code}`);
          reject(
            new Error(
              `wkhtmltopdf terminó con código ${code}. ${errorMessage}`,
            ),
          );
        }
      });
    });
  }

  private async cleanupFiles(...files: (string | null)[]): Promise<void> {
    for (const file of files) {
      if (file) {
        try {
          await fs.unlink(file);
          this.logger.debug(
            `Archivo temporal eliminado: ${path.basename(file)}`,
          );
        } catch (error) {
          // Solo log en debug, no error
          this.logger.debug(`No se pudo eliminar ${file}: ${error.message}`);
        }
      }
    }
  }

  // Método útil para diagnóstico
  async diagnose(): Promise<any> {
    const status: PdfDiagnoseResponse = {
      directories: {
        templates: { exists: false, path: this.templatesDir },
        temp: { exists: false, path: this.tempDir },
        pdfs: { exists: false, path: this.pdfsDir },
      },
      wkhtmltopdf: { installed: false, version: null },
      templates: [] as string[],
    };

    // Verificar directorios
    for (const [key, dir] of Object.entries(status.directories)) {
      try {
        await fs.access(dir.path);
        status.directories[key].exists = true;
      } catch {}
    }

    // Verificar wkhtmltopdf
    await new Promise((resolve) => {
      const process = spawn(WKHTMLTOPDF_CONFIG.command, ['--version']);
      let versionOutput = '';

      process.stdout.on('data', (data) => {
        versionOutput += data.toString();
      });

      process.on('exit', (code) => {
        status.wkhtmltopdf.installed = code === 0;
        status.wkhtmltopdf.version = versionOutput.trim() || null;
        resolve(null);
      });
    });

    // Listar templates
    try {
      const files = await fs.readdir(this.templatesDir);
      status.templates = files.filter((f) => f.endsWith('.html'));
    } catch {}

    return status;
  }
}
