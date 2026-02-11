import { FormStatus, FormType } from "../enum/check-value.enum";

export class FormResponseDto {
  id: number;
  formType: FormType;
  status: FormStatus;
  equipmentTool: string;
  createdAt: Date;
  technicianSignatureDate: Date;
  sstSignatureDate: Date;
  userId: number;
  createdBy: number;
}

export class AtsResponseDto {
  id: number;
  workerName: string;
  position: string;
  area: string;
  workToPerform: string;
  location: string;
  startTime: string;
  endTime: string;
  date: Date;
  observations: string;
  selectedRisks: any;
  requiredPpe: any;
  form: FormResponseDto;
}

export class HeightWorkResponseDto {
  id: number;
  workerName: string;
  identification: string;
  position: string;
  workDescription: string;
  location: string;
  estimatedTime: string;
  protectionElements: any;
  physicalCondition: boolean;
  instructionsReceived: boolean;
  fitForHeightWork: boolean;
  authorizerName: string;
  authorizerIdentification: string;
  form: FormResponseDto;
}

export class PreoperationalResponseDto {
  id: number;
  equipmentTool: string;
  checks: any[];
  form: FormResponseDto;
}