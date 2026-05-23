import https from 'https';
import { createHash } from 'crypto';

export interface BureauQueryInput {
  name: string;
  phone?: string | null;
  dob?: Date | string | null;
  pan?: string | null;
  aadhar?: string | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;
}

export interface ParsedBureauResponse {
  bureauRequestId: string;
  status: 'success' | 'no_match' | 'error';
  creditScore: number | null;
  scoreModel: string | null;
  totalAccounts: number;
  activeAccounts: number;
  overdueAccounts: number;
  totalOverdueAmt: number;
  enquiryCount90d: number;
  activeMFILoans: number;
  activeMFILoanAmt: number;
  writtenOffAccounts: number;
  suitFiledAccounts: number;
  responseHash: string;
}

export class CRIFClient {
  private apiKey: string;
  private memberId: string;
  private agent: https.Agent | any;
  private environment: string;

  constructor(
    credentials: { apiKey: string; memberId: string; environment: string },
    agent: https.Agent | any
  ) {
    this.apiKey = credentials.apiKey;
    this.memberId = credentials.memberId;
    this.environment = credentials.environment;
    this.agent = agent;
  }

  async fetchReport(input: BureauQueryInput): Promise<string> {
    const isSandbox = this.environment === 'sandbox';
    const baseUrl = isSandbox 
      ? 'https://sandbox.crifhighmark.com/mfi/v2/report' 
      : 'https://api.crifhighmark.com/mfi/v2/report';

    const dobFormatted = input.dob 
      ? new Date(input.dob).toISOString().split('T')[0] 
      : undefined;

    const payload = {
      InquiryRequestInfo: {
        InquiryPurpose: '35', // 35 = Loan origination
        TransactionID: `TXN${Date.now()}`,
        InquiryMemberInfo: {
          MemberRefNo: this.memberId,
          MemberUserId: this.apiKey,
        },
        Applicant: {
          Names: [{ Name: input.name }],
          PhoneNumbers: input.phone ? [{ Number: input.phone, Type: '01' }] : [],
          IDs: [
            input.pan ? { ID: input.pan, IDType: '01' } : null,
            input.aadhar ? { ID: input.aadhar, IDType: '07' } : null,
          ].filter(Boolean),
          Addresses: [{
            FirstLine: input.address || '',
            City: input.city || '',
            PIN: input.pincode || '',
            State: '',
            AddressType: '01', // 01 = Permanent
          }],
          DateOfBirth: dobFormatted,
        }
      }
    };

    const fetchOptions: any = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'x-member-id': this.memberId,
      },
      body: JSON.stringify(payload),
    };

    if (this.agent) {
      fetchOptions.agent = this.agent;
    }

    const response = await fetch(baseUrl, fetchOptions);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`CRIF API error ${response.status}: ${errBody}`);
    }

    return response.text();
  }

  parseResponse(rawJson: string): ParsedBureauResponse {
    const responseHash = createHash('sha256').update(rawJson).digest('hex');
    let data;
    try {
      data = JSON.parse(rawJson);
    } catch {
      throw new Error('INVALID_BUREAU_JSON: Failed to parse CRIF response.');
    }

    const responseInfo = data?.InquiryResponseInfo;
    const status = responseInfo?.Status === 'N' || !responseInfo ? 'no_match' : 'success';

    if (status === 'no_match') {
      return {
        bureauRequestId: responseInfo?.SubjectReturnCode ?? 'NOMATCH',
        status: 'no_match',
        creditScore: null,
        scoreModel: null,
        totalAccounts: 0,
        activeAccounts: 0,
        overdueAccounts: 0,
        totalOverdueAmt: 0,
        enquiryCount90d: 0,
        activeMFILoans: 0,
        activeMFILoanAmt: 0,
        writtenOffAccounts: 0,
        suitFiledAccounts: 0,
        responseHash,
      };
    }

    const scores = responseInfo?.Scores?.Score ?? [];
    const crifScoreObj = scores.find((s: any) => s.Type === 'CRIF_HIGHMARK_PERSONAL_LOAN_SCORE' || s.Type === 'CRIF_HIGHMARK_MFI_SCORE');
    const creditScore = crifScoreObj ? parseInt(crifScoreObj.Value) : null;
    const scoreModel = crifScoreObj?.Type ?? 'CRIF MFI Score';

    const accounts = responseInfo?.Tradelines?.Tradeline ?? [];
    const activeAccounts = accounts.filter((a: any) => a.AccountStatus === '11').length; // 11 = Active
    const overdueAccounts = accounts.filter((a: any) => Number(a.OverdueAmount ?? 0) > 0).length;
    const totalOverdueAmt = accounts.reduce((sum: number, a: any) => sum + Number(a.OverdueAmount ?? 0), 0);

    const mfiAccounts = accounts.filter((a: any) => a.AccountType === '10'); // 10 = MFI Loan
    const activeMFILoans = mfiAccounts.filter((a: any) => a.AccountStatus === '11').length;
    const activeMFILoanAmt = mfiAccounts
      .filter((a: any) => a.AccountStatus === '11')
      .reduce((sum: number, a: any) => sum + Number(a.CurrentBalance ?? 0), 0);

    const enquiries = responseInfo?.Enquiries?.Enquiry ?? [];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const enquiryCount90d = enquiries.filter((e: any) => e.Date && new Date(e.Date) >= ninetyDaysAgo).length;

    const writtenOffAccounts = accounts.filter((a: any) => a.AccountStatus === '13').length; // 13 = Written-off
    const suitFiledAccounts = accounts.filter((a: any) => a.SuitFiled === 'Y' || a.SuitFiled === 'Yes').length;

    return {
      bureauRequestId: responseInfo?.UniqueResponseID ?? `REQ-${Date.now()}`,
      status: 'success',
      creditScore,
      scoreModel,
      totalAccounts: accounts.length,
      activeAccounts,
      overdueAccounts,
      totalOverdueAmt,
      enquiryCount90d,
      activeMFILoans,
      activeMFILoanAmt,
      writtenOffAccounts,
      suitFiledAccounts,
      responseHash,
    };
  }
}
