export enum CheckValue {
  GOOD = 'GOOD',
  BAD = 'BAD',
  REGULAR = 'REGULAR',

  YES = 'YES',
  NO = 'NO',
}

export enum PreoperationalParameterCategory {
  SAFETY = 'safety',
  FUNCTIONAL = 'functional',
  VISUAL = 'visual',
  OPERATIONAL = 'operational',
  ELECTRICAL = 'electrical',
}

export enum FormType {
  ATS = 'ATS',
  HEIGHT_WORK = 'HEIGHT_WORK',
  PREOPERATIONAL = 'PREOPERATIONAL',
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  PENDING_SST = 'PENDING_SST',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED', 
}

export enum SignatureType {
  TECHNICIAN = 'TECHNICIAN',
  SST = 'SST',
}

export enum AtsPpeItemType {
  PPE = 'PPE',
  TOOL = 'TOOL',
}

export enum TermsType {
  DATA_PRIVACY = 'dataprivacy',
  ATS = 'ats',
  HEIGHT_WORK = 'height_work',
  PREOPERATIONAL_FORM = 'preoperational_form',
  SECURITY = 'security',
}