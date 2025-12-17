import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Form } from './form.entity';

@Entity('generated_pdfs')
export class GeneratedPdf {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  formId: number;

  @Column({ type: 'bytea', nullable: true })
  pdfData: Buffer;

  @Column()
  fileName: string;

  @Column({ nullable: true })
  filePath: string;

  @Column()
  fileSize: number;

  @CreateDateColumn()
  generatedAt: Date;

  // Relation
  @ManyToOne(() => Form, form => form.generatedPdfs)
  @JoinColumn({ name: 'formId' })
  form: Form;
}