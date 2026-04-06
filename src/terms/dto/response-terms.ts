import { TermsType } from "../../shared";

export class TermsResponseDto {
  id: number;
  type: TermsType;
  title: string;
  description?: string;
  items: string[];
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}