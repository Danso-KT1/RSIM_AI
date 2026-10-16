import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { PublicClientApplication, Configuration } from '@azure/msal-browser';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserTemplate, KnowledgeItem, TemplateFormatting, TemplateTone, TemplateDriveSource } from '../types';
import { storage } from './storage';
import { extractTemplateSpecFromDocx, extractTextFromDocxXml, TemplateSpec } from './documentParser';
import { extractTextFromPdf } from './attachmentService';

// Initialize Firebase App instance safely (singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Google Provider with Google Drive scopes
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
// Force Google to prompt for consent so Drive scopes are explicitly granted on sign-in
googleProvider.setCustomParameters({
  prompt: 'consent select_account',
  access_type: 'offline',
});

// Storage keys for persistent sessions across page reloads (sessionStorage only)
const GOOGLE_TOKEN_KEY = 'rsim_google_access_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'rsim_google_token_expiry';
const GOOGLE_USER_CACHE_KEY = 'rsim_google_user_cache';
const ONEDRIVE_TOKEN_KEY = 'rsim_onedrive_access_token';
const ONEDRIVE_USER_KEY = 'rsim_onedrive_user_info';
const ONEDRIVE_CLIENT_ID_KEY = 'rsim_onedrive_client_id';

// Microsoft MSAL Configuration (SPA with PKCE)
export function getMsalConfig(): Configuration {
  const clientId =
    (typeof localStorage !== 'undefined' ? localStorage.getItem(ONEDRIVE_CLIENT_ID_KEY) : null) ||
    'f76d4982-5bfb-4dc8-a8d8-55a53569527e'; // Standard multi-tenant client ID / configured app ID

  return {
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
  };
}

let msalInstance: PublicClientApplication | null = null;
let msalInitialized = false;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(getMsalConfig());
  }
  if (!msalInitialized) {
    try {
      await msalInstance.initialize();
      const redirectRes = await msalInstance.handleRedirectPromise();
      if (redirectRes?.accessToken) {
        cachedOneDriveAccessToken = redirectRes.accessToken;
        sessionStorage.setItem(ONEDRIVE_TOKEN_KEY, redirectRes.accessToken);
        sessionStorage.setItem(
          ONEDRIVE_USER_KEY,
          JSON.stringify({
            displayName: redirectRes.account?.name || 'Microsoft Account',
            email: redirectRes.account?.username || 'user@live.com',
          })
        );
        notifyAuthListeners();
      }
    } catch (e) {
      console.warn('MSAL initialization warning:', e);
    }
    msalInitialized = true;
  }
  return msalInstance;
}

// In-Memory Token Caching with session storage hydration
let cachedGoogleAccessToken: string | null =
  typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(GOOGLE_TOKEN_KEY) : null;
let cachedOneDriveAccessToken: string | null =
  typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ONEDRIVE_TOKEN_KEY) : null;
let isSigningIn = false;

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  modifiedTime?: string;
  createdTime?: string;
  isFolder?: boolean;
  provider?: 'google_drive' | 'onedrive';
}

export interface DriveAuthState {
  isConnected: boolean;
  provider: 'google_drive' | 'onedrive' | 'both' | null;
  // Google details
  googleConnected: boolean;
  googleExpired?: boolean;
  user: User | null;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  // OneDrive details
  oneDriveConnected: boolean;
  oneDriveExpired?: boolean;
  oneDriveAccountName?: string | null;
  oneDriveEmail?: string | null;
}

type AuthCallback = (state: DriveAuthState) => void;
const authListeners: Set<AuthCallback> = new Set();

/**
 * Checks if the stored Google access token has expired (~1 hour)
 */
export function isGoogleTokenExpired(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const expiry = sessionStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY);
  if (!expiry) return false;
  return Date.now() >= parseInt(expiry, 10);
}

export function getDriveAuthState(): DriveAuthState {
  const gToken =
    cachedGoogleAccessToken ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(GOOGLE_TOKEN_KEY) : null);
  const odToken =
    cachedOneDriveAccessToken ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ONEDRIVE_TOKEN_KEY) : null);

  let cachedGUser: any = null;
  try {
    cachedGUser = JSON.parse(sessionStorage.getItem(GOOGLE_USER_CACHE_KEY) || 'null');
  } catch {}

  let cachedOdUser: any = null;
  try {
    cachedOdUser = JSON.parse(sessionStorage.getItem(ONEDRIVE_USER_KEY) || 'null');
  } catch {}

  const gUser = auth.currentUser || cachedGUser;
  const gExpired = Boolean(gToken && isGoogleTokenExpired());
  const isGoogle = Boolean(gToken && !gExpired);
  const isOneDrive = Boolean(odToken);

  let provider: 'google_drive' | 'onedrive' | 'both' | null = null;
  if (isGoogle && isOneDrive) provider = 'both';
  else if (isGoogle) provider = 'google_drive';
  else if (isOneDrive) provider = 'onedrive';

  return {
    isConnected: isGoogle || isOneDrive,
    provider,
    googleConnected: isGoogle,
    googleExpired: gExpired,
    user: auth.currentUser,
    email: gUser?.email || null,
    displayName: gUser?.displayName || null,
    photoURL: gUser?.photoURL || null,
    oneDriveConnected: isOneDrive,
    oneDriveAccountName: cachedOdUser?.displayName || (isOneDrive ? 'Microsoft OneDrive User' : null),
    oneDriveEmail: cachedOdUser?.email || (isOneDrive ? 'user@live.com' : null),
  };
}

function notifyAuthListeners() {
  const state = getDriveAuthState();
  authListeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.warn('Drive auth listener error:', e);
    }
  });
}

/**
 * Maps Firebase authentication errors to user-friendly plain English with exact setup steps
 */
export function mapFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || '';

  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `Firebase Domain Restriction: "${currentDomain}" is not in your authorized domains list.\n\nTo fix this:\n1. Open Firebase Console > Authentication > Settings > Authorized Domains.\n2. Click "Add domain".\n3. Enter "${currentDomain}" (without port or http://) and click Save.`;
  }
  if (code === 'auth/popup-blocked' || msg.includes('popup')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups for this site, or click "Redirect Sign-In".';
  }
  if (code === 'auth/popup-closed-by-user' || msg.includes('closed-by-user')) {
    return 'Google Drive sign-in was cancelled because the popup was closed before completion.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is not enabled in your Firebase project. Go to Firebase Console > Authentication > Sign-in method, enable Google, and save.';
  }
  return err?.message || 'Google Drive authentication failed. Please try again.';
}

// Initialize Auth listener and check redirect result on boot
export function initDriveAuth(onChange?: AuthCallback): () => void {
  if (onChange) {
    authListeners.add(onChange);
    onChange(getDriveAuthState());
  }

  // Handle redirect login result if user was redirected
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedGoogleAccessToken = credential.accessToken;
          sessionStorage.setItem(GOOGLE_TOKEN_KEY, credential.accessToken);
          sessionStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(Date.now() + 3550 * 1000));
          sessionStorage.setItem(
            GOOGLE_USER_CACHE_KEY,
            JSON.stringify({
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
            })
          );
          notifyAuthListeners();
        }
      }
    })
    .catch((err) => {
      console.warn('Redirect auth handler:', err);
    });

  // MSAL redirect check
  getMsalInstance().catch(() => {});

  const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      if (!sessionStorage.getItem(GOOGLE_TOKEN_KEY)) {
        cachedGoogleAccessToken = null;
      }
      notifyAuthListeners();
    } else {
      try {
        sessionStorage.setItem(
          GOOGLE_USER_CACHE_KEY,
          JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          })
        );
      } catch {}
      notifyAuthListeners();
    }
  });

  return () => {
    if (onChange) authListeners.delete(onChange);
    unsubscribe();
  };
}

// ==========================================
// GOOGLE DRIVE AUTHENTICATION
// ==========================================

/**
 * Sign in with Google to access Google Drive via Firebase Popup,
 * falling back automatically to Redirect if popup is blocked or running in installed PWA standalone mode.
 */
export async function signInWithGoogleDrive(useRedirect: boolean = false): Promise<{ user: User | null; accessToken: string }> {
  try {
    isSigningIn = true;
    const isStandalonePWA =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);

    if (useRedirect || isStandalonePWA) {
      await signInWithRedirect(auth, googleProvider);
      return { user: null, accessToken: '' };
    }

    let result;
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (popupErr: any) {
      if (popupErr?.code === 'auth/popup-blocked') {
        console.warn('Popup blocked, falling back to signInWithRedirect...');
        await signInWithRedirect(auth, googleProvider);
        return { user: null, accessToken: '' };
      }
      throw popupErr;
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive access token was not returned from Google authentication.');
    }

    cachedGoogleAccessToken = credential.accessToken;
    sessionStorage.setItem(GOOGLE_TOKEN_KEY, credential.accessToken);
    sessionStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(Date.now() + 3550 * 1000)); // ~1 hour
    sessionStorage.setItem(
      GOOGLE_USER_CACHE_KEY,
      JSON.stringify({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      })
    );

    notifyAuthListeners();
    return { user: result.user, accessToken: cachedGoogleAccessToken };
  } catch (err: any) {
    console.error('Google Drive sign-in error:', err);
    throw new Error(mapFirebaseAuthError(err));
  } finally {
    isSigningIn = false;
  }
}

// Demo preloaded files for instant offline testing & Directorate presentation
export const DEMO_GDRIVE_FILES: DriveFileInfo[] = [
  {
    id: 'demo_gdrive_stakeholder_rep_01',
    name: 'STAKEHOLDER ENGAGEMENT REPORT THE DATA HARMONISATION MEETING 2026.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '52.3 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 1).toISOString(),
    provider: 'google_drive',
  },
  {
    id: 'demo_gdrive_min_01',
    name: 'Executive_Meeting_Minutes_Template_2026.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '42.5 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    provider: 'google_drive',
  },
  {
    id: 'demo_gdrive_rep_02',
    name: 'Directorate_Annual_Performance_Report_Template.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '58.2 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 5).toISOString(),
    provider: 'google_drive',
  },
  {
    id: 'demo_gdrive_let_03',
    name: 'Ministry_Official_Letterhead_Template.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '34.1 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    provider: 'google_drive',
  },
  {
    id: 'demo_gdrive_memo_04',
    name: 'Internal_Directorate_Memorandum_Standard.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '28.8 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 24).toISOString(),
    provider: 'google_drive',
  },
  {
    id: 'demo_gdrive_pdf_05',
    name: 'Civil_Service_Documentation_Standards_2026.pdf',
    mimeType: 'application/pdf',
    size: '124.0 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 48).toISOString(),
    provider: 'google_drive',
  },
];

export const DEMO_ONEDRIVE_FILES: DriveFileInfo[] = [
  {
    id: 'demo_onedrive_min_01',
    name: 'Cabinet_Stakeholder_Consultation_Minutes_Template.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '45.0 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 3).toISOString(),
    provider: 'onedrive',
  },
  {
    id: 'demo_onedrive_rep_02',
    name: 'National_Digital_Transformation_Report_Template.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '62.4 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 8).toISOString(),
    provider: 'onedrive',
  },
  {
    id: 'demo_onedrive_let_03',
    name: 'External_Regulatory_Agency_Letter_Template.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: '31.2 KB',
    modifiedTime: new Date(Date.now() - 3600000 * 15).toISOString(),
    provider: 'onedrive',
  },
];

const DEMO_GDRIVE_STORAGE_KEY = 'rsim_demo_gdrive_files';
const DEMO_ONEDRIVE_STORAGE_KEY = 'rsim_demo_onedrive_files';

function getStoredDemoGDriveFiles(): DriveFileInfo[] {
  try {
    const raw = sessionStorage.getItem(DEMO_GDRIVE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...DEMO_GDRIVE_FILES];
}

function saveStoredDemoGDriveFiles(files: DriveFileInfo[]): void {
  try {
    sessionStorage.setItem(DEMO_GDRIVE_STORAGE_KEY, JSON.stringify(files));
  } catch {}
}

function getStoredDemoOneDriveFiles(): DriveFileInfo[] {
  try {
    const raw = sessionStorage.getItem(DEMO_ONEDRIVE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...DEMO_ONEDRIVE_FILES];
}

function saveStoredDemoOneDriveFiles(files: DriveFileInfo[]): void {
  try {
    sessionStorage.setItem(DEMO_ONEDRIVE_STORAGE_KEY, JSON.stringify(files));
  } catch {}
}

export function getDemoFileSampleContent(fileId: string, fileName: string): string {
  const lower = (fileName || fileId || '').toLowerCase();

  // 1. Stakeholder Engagement Report (Google Drive Template)
  if (lower.includes('stakeholder') || lower.includes('harmonisation') || lower.includes('data harmonis')) {
    return `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
DIRECTORATE OF RESEARCH, STATISTICS AND INFORMATION MANAGEMENT (RSIM)

STAKEHOLDER ENGAGEMENT REPORT: THE DATA HARMONISATION MEETING 2026

1.0 EXECUTIVE SUMMARY & ENGAGEMENT OVERVIEW
The Ministry of Communications and Digitalisation, through the Directorate of Research, Statistics and Information Management (RSIM), convened a high-level Stakeholder Engagement Session on National Data Harmonisation and Inter-Agency Interoperability. The overarching objective of the session was to foster institutional synergy, evaluate ongoing data integration frameworks, address systemic data silos across public regulatory bodies, and establish enforceable data exchange protocols across the sector.

2.0 THEMATIC DELIBERATIONS & REGULATORY POSITIONS
2.1 Overview of Strategic Interventions and Agency Presentations
During the thematic plenary deliberations, key participating institutions and sector regulators presented empirical status updates on their respective digital registers, API frameworks, and statutory reporting mechanisms. Deliberations centered on the imperative for centralized data validation, uniform metadata standards, and real-time synchronization between the Ministry and external agencies.

2.2 Key Issues, Technical Constraints and Regulatory Alignment
Stakeholders critically reviewed operational bottlenecks, including disparities in data classification formats, legacy software incompatibility, intermittent network latency in regional verification units, and compliance obligations under statutory data protection frameworks. Consensus was reached that institutional coordination must be prioritized over bilateral ad-hoc exchanges.

3.0 AGREED ACTION POINTS, RECOMMENDATIONS & WAY FORWARD
Following consultative deliberations, stakeholders unanimously resolved on the following strategic action roadmap:
1. Immediate operationalization of standardized API endpoints and synchronized data definitions across all sector agencies.
2. Formulation of a joint Technical Working Group (TWG) to oversee data quality compliance, verification audit trails, and weekly returns.
3. Submission of finalized regulatory data returns to the RSIM Directorate within the stipulated fourteen (14) working day compliance window.

____________________________________________
Director, RSIM Directorate
Ministry of Communications and Digitalisation`;
  }
  if (lower.includes('minute')) {
    return `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
DIRECTORATE OF RESEARCH, STATISTICS AND INFORMATION MANAGEMENT (RSIM)

## OFFICIAL MINUTES OF PROCEEDINGS

**Meeting Title:** Institutional Steering & Technical Working Group Review
**Date:** ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Time:** 10:00 AM - 12:45 PM GMT
**Venue:** Conference Room A, Ministry Headquarters & Hybrid Video Link
**Chairperson:** Director, RSIM Directorate

---

### 1. ATTENDANCE & OPENING
- **Chair:** Director, Directorate of Research, Statistics & Information Management
- **Present:** Assistant Director (Statistics), Senior IT Officer, Representative from NCA, Representative from NITA, Secretariat
- **Apologies:** Chief Director (Official Assignment)

The Chairperson called the meeting to order at 10:05 AM with an opening prayer and welcomed all participating stakeholders.

### 2. ADOPTION OF AGENDA
The provisional agenda was considered and formally adopted:
1. Review and adoption of previous session minutes
2. Status update on national digital data collection initiatives
3. Interoperability framework and agency compliance
4. Date and venue for next quarterly review

### 3. SUBSTANTIVE PROCEEDINGS & DELIBERATIONS
- **Data Interoperability Standards:** The Secretariat presented the updated baseline metrics across participating agencies. All members agreed on API security specifications.
- **Statutory Deadlines:** Agencies were urged to submit validated returns ahead of the executive deadline.

### 4. ACTION ITEMS & RESOLUTIONS MATRIX
| Item # | Agreed Action Item | Responsible Officer | Target Timeline | Status |
|---|---|---|---|---|
| 01 | Finalize Interoperability Integration Protocol | Senior Technical Architect | 10 Working Days | In Progress |
| 02 | Circulate Draft Validation Survey Guidelines | Assistant Director (Statistics) | 5 Working Days | Pending |
| 03 | Schedule Agency Executive Briefing | Directorate Secretariat | 14 Working Days | Scheduled |

### 5. ADJOURNMENT
There being no other business, the meeting was adjourned at 12:45 PM following a motion moved and seconded.

**Prepared By:** Directorate Secretariat
**Approved By:** Director, RSIM Directorate`;
  }

  if (lower.includes('report')) {
    return `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
DIRECTORATE OF RESEARCH, STATISTICS & INFORMATION MANAGEMENT (RSIM)

## INSTITUTIONAL PERFORMANCE & POLICY EVALUATION REPORT

**Document Ref:** MoCD/RSIM/REP/${new Date().getFullYear()}/04
**Reporting Cycle:** Annual Directorate Performance Review
**Authoring Directorate:** Directorate of Research, Statistics & Information Management (RSIM)

---

## 1. EXECUTIVE SUMMARY
This comprehensive report outlines the operational performance, statistical benchmarking, and policy research initiatives executed by the Directorate of Research, Statistics and Information Management (RSIM) within the reporting period. The findings synthesize empirical data, inter-agency consultations, and digitized workflow metrics.

## 2. STATUTORY MANDATE & STRATEGIC PRIORITIES
Under the Civil Service framework, RSIM serves as the analytical powerhouse of the Ministry, responsible for:
- Formulating data-driven policy recommendations
- Monitoring digital readiness across sector institutions
- Standardizing administrative document and communication workflows

## 3. METHODOLOGY & DATA COLLECTION
Data was compiled using standardized digital returns, stakeholder proceedings transcription, and cross-validation against national statistical baselines.

## 4. KEY FINDINGS & MILESTONE ACHIEVEMENTS
- **Digital Records Transition:** 84% reduction in paperwork cycle time across ministerial directorates.
- **Data Quality Compliance:** 92% verification rate achieved across all statutory returns.
- **Workflow Automation:** Full deployment of executive transcription and minute-writing AI assistants.

## 5. STRATEGIC CHALLENGES & MITIGATION MEASURES
Identified operational constraints include bandwidth variability in regional offices and the need for continuous capacity development.

## 6. RECOMMENDATIONS FOR MINISTERIAL ACTION
1. Ratify the updated Directorate Knowledge Framework.
2. Direct all agencies to synchronize records with the central digital vault.
3. Authorize phase two of the automated workflow integration.

**Submitted to:** The Chief Director, Ministry of Communications and Digitalisation`;
  }

  if (lower.includes('memo') || lower.includes('memorandum')) {
    return `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION

## INTERNAL MEMORANDUM

**TO:** The Chief Director
**THROUGH:** Director, RSIM
**FROM:** Assistant Director, Research & Statistics
**DATE:** ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**SUBJECT:** SUBMISSION OF TECHNICAL WORKING GROUP OUTCOMES AND RECOMMENDATIONS
**REF NO:** MoCD/RSIM/MEMO/${new Date().getFullYear()}/012

---

### 1. PURPOSE
The purpose of this memorandum is to respectfully present the findings of the recent Technical Working Group and seek your formal directive on the proposed implementation roadmap.

### 2. BACKGROUND
In line with the Minister's directive on public sector modernization, the Directorate convened key sector stakeholders to review data standards and reporting harmonization.

### 3. OBSERVATIONS & KEY FINDINGS
- Sector agencies have established readiness to adopt unified reporting templates.
- Automated transcription and report synthesis have demonstrated high efficiency gains.

### 4. PRAYER / RECOMMENDATION
It is respectfully recommended that you:
a) Approve the draft technical guidelines for distribution to all directorates.
b) Direct the convening of an executive briefing on the rollout schedule.

Submitted for your kind consideration and directive, please.

________________________________
Director, RSIM`;
  }

  // Default Letterhead
  return `# REPUBLIC OF GHANA
MINISTRY OF COMMUNICATIONS AND DIGITALISATION
DIRECTORATE OF RESEARCH, STATISTICS & INFORMATION MANAGEMENT (RSIM)

P.O. Box M.38, Ministries, Accra - Ghana
Digital Address: GA-107-5555 | Tel: +233 (0) 302 685 601
Email: rsim@mocd.gov.gh | Website: www.mocd.gov.gh

Our Ref: MoCD/RSIM/CORR/${new Date().getFullYear()}/
Your Ref: 
Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

The Chief Executive Officer
National Communications Authority / Regulatory Agencies
Accra, Ghana

Dear Sir/Madam,

## OFFICIAL CORRESPONDENCE: STATUTORY COMPLIANCE AND DIGITAL DATA REPORTING

1. I have the honour to refer to the statutory reporting framework established under the Ministry of Communications and Digitalisation.

2. In accordance with Section 4 of the Civil Service Guidelines and the operational mandate of the Directorate of Research, Statistics and Information Management (RSIM), all sector institutions are required to submit their quarterly returns.

3. We appreciate your continued cooperation in advancing the national digital transformation agenda.

Please accept the assurances of our highest institutional consideration.

Yours faithfully,

_______________________________
Director, RSIM
for: MINISTER FOR COMMUNICATIONS AND DIGITALISATION`;
}

/**
 * Connect to preloaded Directorate Demo Workspace (Demo Mode)
 */
export function connectDemoGoogleDrive(): void {
  const demoToken = 'demo_gdrive_session';
  cachedGoogleAccessToken = demoToken;
  sessionStorage.setItem(GOOGLE_TOKEN_KEY, demoToken);
  sessionStorage.setItem(
    GOOGLE_USER_CACHE_KEY,
    JSON.stringify({
      email: 'rsim.directorate@mocd.gov.gh',
      displayName: 'RSIM Directorate (Demo Sample Files)',
      isDemo: true,
    })
  );
  notifyAuthListeners();
}

/**
 * Connect to preloaded Directorate Microsoft OneDrive Demo Workspace
 */
export function connectDemoOneDrive(): void {
  const demoToken = 'demo_onedrive_session';
  cachedOneDriveAccessToken = demoToken;
  sessionStorage.setItem(ONEDRIVE_TOKEN_KEY, demoToken);
  sessionStorage.setItem(
    ONEDRIVE_USER_KEY,
    JSON.stringify({
      email: 'directorate.admin@mocd.gov.gh',
      displayName: 'Ministry of Communications (Demo Sample Files)',
      isDemo: true,
    })
  );
  notifyAuthListeners();
}

/**
 * Connect with a direct Google Access Token (Validates live via /about?fields=user)
 */
export async function connectGoogleWithToken(
  token: string,
  email?: string,
  displayName?: string
): Promise<void> {
  if (!token || !token.trim()) {
    throw new Error('Google access token is required.');
  }

  const cleanToken = token.trim();
  const verifyRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${cleanToken}` },
  });

  if (!verifyRes.ok) {
    throw new Error(`Google token validation failed (HTTP ${verifyRes.status}): Token is invalid or expired.`);
  }

  const verifyData = await verifyRes.json();
  const fetchedUser = verifyData?.user;

  cachedGoogleAccessToken = cleanToken;
  sessionStorage.setItem(GOOGLE_TOKEN_KEY, cleanToken);
  sessionStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, String(Date.now() + 3550 * 1000));
  sessionStorage.setItem(
    GOOGLE_USER_CACHE_KEY,
    JSON.stringify({
      email: fetchedUser?.emailAddress || email || 'google-user@gmail.com',
      displayName: fetchedUser?.displayName || displayName || 'Google Drive User',
      photoURL: fetchedUser?.photoLink || null,
    })
  );

  notifyAuthListeners();
}

/**
 * Disconnect Google Drive and clear all cached tokens
 */
export async function disconnectGoogleDrive(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch {}
  cachedGoogleAccessToken = null;
  sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
  sessionStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
  sessionStorage.removeItem(GOOGLE_USER_CACHE_KEY);
  notifyAuthListeners();
}

/**
 * Get current Google Drive cached access token
 */
export async function getAccessToken(): Promise<string | null> {
  if (cachedGoogleAccessToken && !isGoogleTokenExpired()) {
    return cachedGoogleAccessToken;
  }
  const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(GOOGLE_TOKEN_KEY) : null;
  if (stored && !isGoogleTokenExpired()) {
    cachedGoogleAccessToken = stored;
    return stored;
  }
  return null;
}

// ==========================================
// MICROSOFT ONEDRIVE AUTHENTICATION & API
// ==========================================

export function getOneDriveToken(): string | null {
  if (cachedOneDriveAccessToken) return cachedOneDriveAccessToken;
  const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ONEDRIVE_TOKEN_KEY) : null;
  if (stored) {
    cachedOneDriveAccessToken = stored;
    return stored;
  }
  return null;
}

export function setOneDriveToken(token: string | null) {
  if (token) {
    cachedOneDriveAccessToken = token;
    sessionStorage.setItem(ONEDRIVE_TOKEN_KEY, token);
  } else {
    cachedOneDriveAccessToken = null;
    sessionStorage.removeItem(ONEDRIVE_TOKEN_KEY);
    sessionStorage.removeItem(ONEDRIVE_USER_KEY);
  }
  notifyAuthListeners();
}

/**
 * Connect with a direct Microsoft Graph token (Validates live via /v1.0/me)
 */
export async function connectOneDriveWithToken(
  token: string,
  accountName?: string,
  email?: string
): Promise<{ displayName: string; email: string }> {
  if (!token || !token.trim()) {
    throw new Error('OneDrive access token cannot be empty.');
  }

  const cleanToken = token.trim();
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${cleanToken}` },
  });

  if (!res.ok) {
    throw new Error(`OneDrive token validation failed (HTTP ${res.status}): Token is invalid or expired.`);
  }

  const data = await res.json();
  const displayName = data.displayName || accountName || 'Microsoft OneDrive User';
  const userEmail = data.mail || data.userPrincipalName || email || 'onedrive-user@live.com';

  cachedOneDriveAccessToken = cleanToken;
  sessionStorage.setItem(ONEDRIVE_TOKEN_KEY, cleanToken);
  sessionStorage.setItem(
    ONEDRIVE_USER_KEY,
    JSON.stringify({ displayName, email: userEmail })
  );

  notifyAuthListeners();
  return { displayName, email: userEmail };
}

/**
 * Interactive Microsoft OneDrive Sign-In using MSAL PublicClientApplication
 */
export async function signInWithOneDrive(): Promise<void> {
  const msal = await getMsalInstance();
  const request = {
    scopes: ['User.Read', 'Files.Read'],
  };

  try {
    const res = await msal.loginPopup(request);
    if (res?.accessToken) {
      cachedOneDriveAccessToken = res.accessToken;
      sessionStorage.setItem(ONEDRIVE_TOKEN_KEY, res.accessToken);
      sessionStorage.setItem(
        ONEDRIVE_USER_KEY,
        JSON.stringify({
          displayName: res.account?.name || 'Microsoft Account',
          email: res.account?.username || 'user@live.com',
        })
      );
      notifyAuthListeners();
    }
  } catch (popupErr: any) {
    console.warn('MSAL popup failed, falling back to loginRedirect:', popupErr);
    if (popupErr?.errorCode === 'popup_window_error' || popupErr?.message?.includes('popup')) {
      await msal.loginRedirect(request);
    } else {
      throw popupErr;
    }
  }
}

/**
 * Disconnect OneDrive session
 */
export async function disconnectOneDrive(): Promise<void> {
  try {
    const msal = await getMsalInstance();
    const accounts = msal.getAllAccounts();
    if (accounts.length > 0) {
      await msal.logoutPopup({ account: accounts[0] }).catch(() => {});
    }
  } catch {}
  setOneDriveToken(null);
}

// ==========================================
// GOOGLE DRIVE API OPERATIONS
// ==========================================

export async function ensureDriveFolder(folderName = 'Directorate Templates & Knowledge'): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Google Drive. Please connect first.');

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  )}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'RSIM Directorate institutional templates, formatting baselines, and knowledge files',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
  }
  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Lists relevant templates and documents from Google Drive (includes Shared Drives)
 */
export async function listDriveFiles(options?: {
  folderId?: string;
  query?: string;
}): Promise<DriveFileInfo[]> {
  const token = await getAccessToken();
  if (!token) return [];

  if (token === 'demo_gdrive_session') {
    const files = getStoredDemoGDriveFiles();
    if (options?.query && options.query.trim()) {
      const q = options.query.trim().toLowerCase();
      return files.filter((f) => f.name.toLowerCase().includes(q));
    }
    return files;
  }

  let q = 'trashed = false';
  if (options?.folderId) {
    q += ` and '${options.folderId}' in parents`;
  }

  if (options?.query && options.query.trim()) {
    q += ` and name contains '${options.query.trim().replace(/'/g, "\\'")}'`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=nextPageToken,files(id,name,mimeType,webViewLink,size,createdTime,modifiedTime)&orderBy=modifiedTime desc&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let errorDetails = res.statusText;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errorDetails = errJson.error.message;
      }
    } catch {}

    if (res.status === 401 || res.status === 403) {
      console.warn(`Drive API auth/permission error (${res.status}): ${errorDetails}`);
      if (res.status === 401) {
        cachedGoogleAccessToken = null;
        sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
        sessionStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
        notifyAuthListeners();
      }
    }
    throw new Error(`Google Drive API error (${res.status}): ${errorDetails}`);
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    webViewLink: f.webViewLink,
    size: f.size ? `${(parseInt(f.size, 10) / 1024).toFixed(1)} KB` : undefined,
    modifiedTime: f.modifiedTime,
    createdTime: f.createdTime,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    provider: 'google_drive',
  }));
}

/**
 * Upload a template or document directly to Google Drive
 */
export async function uploadFileToDrive(
  file: File | Blob,
  fileName: string,
  options?: {
    folderId?: string;
    description?: string;
    mimeType?: string;
  }
): Promise<DriveFileInfo> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please connect your Google Drive first to upload directly.');
  }

  const mimeType =
    options?.mimeType ||
    (file instanceof File ? file.type : 'application/octet-stream') ||
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (token === 'demo_gdrive_session') {
    const newFile: DriveFileInfo = {
      id: `demo_upload_${Date.now()}`,
      name: fileName,
      mimeType,
      size: `${((file instanceof File ? file.size : 1024) / 1024).toFixed(1)} KB`,
      modifiedTime: new Date().toISOString(),
      provider: 'google_drive',
    };
    const files = getStoredDemoGDriveFiles();
    files.unshift(newFile);
    saveStoredDemoGDriveFiles(files);
    return newFile;
  }

  let folderId = options?.folderId;
  if (!folderId) {
    try {
      folderId = await ensureDriveFolder();
    } catch (e) {
      console.warn('Could not create folder, uploading to root:', e);
    }
  }

  const metadata = {
    name: fileName,
    mimeType,
    description: options?.description || 'Directorate template uploaded directly from RSIM Studio',
    parents: folderId ? [folderId] : undefined,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  const fileArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const metadataString = JSON.stringify(metadata);
  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadataString}\r\n`;
  const fileHeader = `${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

  const metaEncoder = new TextEncoder();
  const metaBytes = metaEncoder.encode(metadataPart);
  const fileHeaderBytes = metaEncoder.encode(fileHeader);
  const closeBytes = metaEncoder.encode(closeDelimiter);

  const fullPayload = new Uint8Array(
    metaBytes.byteLength + fileHeaderBytes.byteLength + fileArrayBuffer.byteLength + closeBytes.byteLength
  );

  let offset = 0;
  fullPayload.set(metaBytes, offset);
  offset += metaBytes.byteLength;
  fullPayload.set(fileHeaderBytes, offset);
  offset += fileHeaderBytes.byteLength;
  fullPayload.set(new Uint8Array(fileArrayBuffer), offset);
  offset += fileArrayBuffer.byteLength;
  fullPayload.set(closeBytes, offset);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size,modifiedTime&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  );

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Google Drive upload failed: ${uploadRes.status} ${errorText}`);
  }

  const result = await uploadRes.json();
  return {
    id: result.id,
    name: result.name,
    mimeType: result.mimeType,
    webViewLink: result.webViewLink,
    size: result.size ? `${(parseInt(result.size, 10) / 1024).toFixed(1)} KB` : undefined,
    modifiedTime: result.modifiedTime,
    provider: 'google_drive',
  };
}

/**
 * Download a file's binary or text content from Google Drive
 */
export async function downloadDriveFileContent(
  fileId: string,
  mimeType?: string
): Promise<{ text: string; arrayBuffer?: ArrayBuffer; isDocx: boolean; templateSpec?: TemplateSpec }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google Drive access token missing.');

  if (token === 'demo_gdrive_session' || fileId.startsWith('demo_')) {
    const text = getDemoFileSampleContent(fileId, fileId);
    return { text, isDocx: false };
  }

  // If mimeType wasn't provided, fetch it from Drive API
  let actualMime = mimeType;
  let fileName = 'DriveFile';
  if (!actualMime) {
    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        actualMime = meta.mimeType;
        fileName = meta.name || fileName;
      }
    } catch {}
  }

  // Google Docs: Export as .docx
  if (actualMime === 'application/vnd.google-apps.document') {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document&supportsAllDrives=true`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const templateSpec = await extractTemplateSpecFromDocx(arrayBuffer, `${fileName}.docx`);
      return { text: templateSpec.rawText, arrayBuffer, isDocx: true, templateSpec };
    }
  }

  // Google Spreadsheets: Export as .csv
  if (actualMime === 'application/vnd.google-apps.spreadsheet') {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv&supportsAllDrives=true`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const text = await res.text();
      return { text, isDocx: false };
    }
  }

  // Regular download via alt=media
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let errorDetails = res.statusText;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) errorDetails = errJson.error.message;
    } catch {}
    throw new Error(`Failed to download file from Google Drive (${res.status}): ${errorDetails}`);
  }

  const isDocx = Boolean(actualMime?.includes('word') || actualMime?.includes('officedocument') || fileName.endsWith('.docx'));
  const isPdf = Boolean(actualMime?.includes('pdf') || fileName.endsWith('.pdf'));

  if (isDocx) {
    const arrayBuffer = await res.arrayBuffer();
    const templateSpec = await extractTemplateSpecFromDocx(arrayBuffer, fileName);
    return { text: templateSpec.rawText, arrayBuffer, isDocx: true, templateSpec };
  }

  if (isPdf) {
    const arrayBuffer = await res.arrayBuffer();
    const pdfRes = await extractTextFromPdf(arrayBuffer);
    return { text: pdfRes.text, arrayBuffer, isDocx: false };
  }

  const text = await res.text();
  return { text, isDocx: false };
}

/**
 * Export Google Doc file to ArrayBuffer (.docx or .pdf)
 */
export async function exportDriveFile(
  fileId: string,
  format: 'docx' | 'pdf' | 'txt' = 'docx'
): Promise<ArrayBuffer> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Google Drive.');
  const mimeMap = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
    txt: 'text/plain',
  };
  const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${mimeMap[format]}&supportsAllDrives=true`;
  const res = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Doc export failed (${res.status}): ${res.statusText}`);
  return res.arrayBuffer();
}

/**
 * Delete file from Google Drive
 */
export async function deleteDriveFile(fileId: string, fileName: string): Promise<boolean> {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${fileName}" from your Google Drive? This action cannot be undone.`
  );
  if (!confirmed) return false;

  const token = await getAccessToken();
  if (!token) throw new Error('Not connected to Google Drive.');

  if (token === 'demo_gdrive_session' || fileId.startsWith('demo_')) {
    const files = getStoredDemoGDriveFiles().filter((f) => f.id !== fileId);
    saveStoredDemoGDriveFiles(files);
    return true;
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete file from Google Drive: ${res.statusText}`);
  }

  return true;
}

// ==========================================
// MICROSOFT ONEDRIVE FILE OPERATIONS
// ==========================================

/**
 * List files from Microsoft OneDrive using Microsoft Graph API
 */
export async function listOneDriveFiles(query?: string): Promise<DriveFileInfo[]> {
  const token = getOneDriveToken();
  if (!token) return [];

  if (token === 'demo_onedrive_session') {
    const files = getStoredDemoOneDriveFiles();
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      return files.filter((f) => f.name.toLowerCase().includes(q));
    }
    return files;
  }

  let url = 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=50&$orderby=lastModifiedDateTime desc';
  if (query && query.trim()) {
    url = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query.trim())}')?$top=50`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      disconnectOneDrive();
    }
    throw new Error(`OneDrive API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const items = data.value || [];

  return items
    .filter((f: any) => !f.deleted)
    .map((f: any) => {
      const isFolder = Boolean(f.folder);
      const mime = f.file?.mimeType || (isFolder ? 'folder' : 'application/octet-stream');
      return {
        id: f.id,
        name: f.name,
        mimeType: mime,
        webViewLink: f.webUrl,
        size: f.size ? `${(f.size / 1024).toFixed(1)} KB` : undefined,
        modifiedTime: f.lastModifiedDateTime,
        createdTime: f.createdDateTime,
        isFolder,
        provider: 'onedrive',
      };
    });
}

/**
 * Upload a file directly to Microsoft OneDrive
 */
export async function uploadFileToOneDrive(
  file: File | Blob,
  fileName: string
): Promise<DriveFileInfo> {
  const token = getOneDriveToken();
  if (!token) {
    throw new Error('Please connect your Microsoft OneDrive first.');
  }

  if (token === 'demo_onedrive_session') {
    const newFile: DriveFileInfo = {
      id: `demo_od_upload_${Date.now()}`,
      name: fileName,
      mimeType: file instanceof File ? file.type : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: `${((file instanceof File ? file.size : 1024) / 1024).toFixed(1)} KB`,
      modifiedTime: new Date().toISOString(),
      provider: 'onedrive',
    };
    const files = getStoredDemoOneDriveFiles();
    files.unshift(newFile);
    saveStoredDemoOneDriveFiles(files);
    return newFile;
  }

  const folderName = 'RSIM Directorate Templates';
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(
    folderName
  )}/${encodeURIComponent(fileName)}:/content`;

  const reader = new FileReader();
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': file instanceof File ? file.type : 'application/octet-stream',
    },
    body: arrayBuffer,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OneDrive upload failed: ${res.status} ${errorText}`);
  }

  const result = await res.json();
  return {
    id: result.id,
    name: result.name,
    mimeType: result.file?.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    webViewLink: result.webUrl,
    size: result.size ? `${(result.size / 1024).toFixed(1)} KB` : undefined,
    modifiedTime: result.lastModifiedDateTime,
    provider: 'onedrive',
  };
}

/**
 * Download file content from Microsoft OneDrive
 */
export async function downloadOneDriveFileContent(
  fileId: string,
  mimeType?: string
): Promise<{ text: string; arrayBuffer?: ArrayBuffer; isDocx: boolean; templateSpec?: TemplateSpec }> {
  const token = getOneDriveToken();
  if (!token) throw new Error('OneDrive access token is missing.');

  if (token === 'demo_onedrive_session' || fileId.startsWith('demo_')) {
    const text = getDemoFileSampleContent(fileId, fileId);
    return { text, isDocx: false };
  }

  const downloadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from OneDrive: ${res.statusText}`);
  }

  const isDocx = Boolean(mimeType?.includes('word') || mimeType?.includes('officedocument'));
  const isPdf = Boolean(mimeType?.includes('pdf'));

  if (isDocx) {
    const arrayBuffer = await res.arrayBuffer();
    const templateSpec = await extractTemplateSpecFromDocx(arrayBuffer, 'OneDriveTemplate.docx');
    return { text: templateSpec.rawText, arrayBuffer, isDocx: true, templateSpec };
  }

  if (isPdf) {
    const arrayBuffer = await res.arrayBuffer();
    const pdfRes = await extractTextFromPdf(arrayBuffer);
    return { text: pdfRes.text, arrayBuffer, isDocx: false };
  }

  const text = await res.text();
  return { text, isDocx: false };
}

/**
 * Delete file from Microsoft OneDrive
 */
export async function deleteOneDriveFile(fileId: string, fileName: string): Promise<boolean> {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${fileName}" from your Microsoft OneDrive?`
  );
  if (!confirmed) return false;

  const token = getOneDriveToken();
  if (!token) throw new Error('Not connected to OneDrive.');

  if (token === 'demo_onedrive_session' || fileId.startsWith('demo_')) {
    const files = getStoredDemoOneDriveFiles().filter((f) => f.id !== fileId);
    saveStoredDemoOneDriveFiles(files);
    return true;
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete file from OneDrive: ${res.statusText}`);
  }

  return true;
}

// ==========================================
// EXACT TEMPLATE LEARNING ENGINE (CLIENT-SIDE)
// ==========================================

export interface LearnedTemplateAnalysis {
  title: string;
  documentType: 'Letter' | 'Memo' | 'Minutes' | 'Report';
  extractedText: string;
  formatting: TemplateFormatting;
  toneProfile: TemplateTone;
  blueprint: string;
  fields: string[];
}

/**
 * Client-side heuristic extractor for typography, tone, and layout
 */
export function extractClientSideFormattingAndTone(
  text: string,
  fileName: string,
  docTypeHint?: 'Letter' | 'Memo' | 'Minutes' | 'Report'
): LearnedTemplateAnalysis {
  const lower = text.toLowerCase();

  let detectedType: 'Letter' | 'Memo' | 'Minutes' | 'Report' = docTypeHint || 'Letter';
  if (lower.includes('memorandum') || lower.includes('memo to:') || lower.includes('internal memo')) {
    detectedType = 'Memo';
  } else if (lower.includes('minutes of') || lower.includes('matters arising') || lower.includes('attendance:')) {
    detectedType = 'Minutes';
  } else if (
    lower.includes('annual report') ||
    lower.includes('executive report') ||
    lower.includes('terms of reference') ||
    lower.includes('executive summary')
  ) {
    detectedType = 'Report';
  } else if (lower.includes('dear') || lower.includes('yours faithfully') || lower.includes('the chief director')) {
    detectedType = 'Letter';
  }

  let detectedFont = 'Calibri';
  if (lower.includes('times new roman') || lower.includes('times') || text.includes('I have the honour to')) {
    detectedFont = 'Times New Roman';
  } else if (lower.includes('arial')) {
    detectedFont = 'Arial';
  } else if (lower.includes('aptos')) {
    detectedFont = 'Aptos';
  } else if (lower.includes('georgia')) {
    detectedFont = 'Georgia';
  }

  const titleFontSize = detectedType === 'Letter' ? '16pt bold' : '18pt bold';
  const headingFontSize = '13pt bold';
  const bodyFontSize = detectedFont === 'Times New Roman' ? '12pt' : '11pt';
  const lineSpacing = detectedType === 'Letter' ? '1.15' : '1.5';
  const alignment: 'left' | 'justified' | 'center' = detectedType === 'Letter' ? 'justified' : 'left';

  let formality: TemplateTone['formality'] = 'Strict Civil Service';
  if (detectedType === 'Memo') {
    formality = 'Standard Administrative';
  } else if (detectedType === 'Report') {
    formality = 'Technical Rigorous';
  }

  const openings: string[] = [];
  if (lower.includes('i have the honour')) openings.push('I have the honour to refer to...');
  if (lower.includes('with reference to')) openings.push('With reference to your communication dated...');
  if (lower.includes('kindly find attached')) openings.push('Kindly find attached the finalized documentation...');
  if (openings.length === 0) {
    openings.push(detectedType === 'Letter' ? 'I write to respectfully invite your attention to...' : 'Please be informed that...');
  }

  const closings: string[] = [];
  if (lower.includes('yours faithfully')) closings.push('Yours faithfully,');
  if (lower.includes('yours sincerely')) closings.push('Yours sincerely,');
  if (lower.includes('respectfully submitted')) closings.push('Respectfully submitted,');
  if (closings.length === 0) {
    closings.push(detectedType === 'Letter' ? 'Yours faithfully,' : 'Submitted for your necessary action.');
  }

  const vocabCandidates = [
    'RSIM Directorate',
    'Policy Framework',
    'Executive Directive',
    'Stakeholder Consultation',
    'Statutory Compliance',
    'Implementation Matrix',
    'Memorandum of Understanding',
  ];
  const detectedVocab = vocabCandidates.filter((v) => lower.includes(v.toLowerCase()));
  const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

  const fields: string[] = [];
  if (detectedType === 'Letter') {
    fields.push('Recipient Name', 'Recipient Title', 'Organization', 'Reference Number', 'Date', 'Subject', 'Salutation', 'Signatory');
  } else if (detectedType === 'Memo') {
    fields.push('To', 'From', 'Date', 'Reference Number', 'Subject', 'Action Required');
  } else if (detectedType === 'Minutes') {
    fields.push('Meeting Title', 'Date & Time', 'Venue', 'Chairperson', 'Attendance', 'Matters Arising', 'Decisions');
  } else {
    fields.push('Report Title', 'Executive Summary', 'Key Findings', 'Strategic Recommendations', 'Timeline');
  }

  return {
    title: cleanTitle,
    documentType: detectedType,
    extractedText: text,
    formatting: {
      fontFamily: detectedFont,
      titleFontSize,
      headingFontSize,
      subheadingFontSize: '12pt bold',
      bodyFontSize,
      lineSpacing,
      paragraphSpacing: '6pt',
      margins: '1 inch (standard)',
      alignment,
    },
    toneProfile: {
      formality,
      voice: 'Passive Institutional',
      openings,
      closings,
      vocabulary: detectedVocab.length > 0 ? detectedVocab : ['Directorate standards', 'Institutional compliance', 'Official communication'],
      structuralNotes: `Learned from exact template "${fileName}". Applies ${detectedFont} font (${bodyFontSize} body), ${lineSpacing} line spacing, ${alignment} alignment, and authentic civil service tone.`,
    },
    blueprint: text,
    fields,
  };
}

/**
 * Deeply analyzes a document text/XML to learn formatting, tone, and blueprint
 */
export async function learnTemplateFromContent(
  text: string,
  fileName: string,
  docTypeHint?: 'Letter' | 'Memo' | 'Minutes' | 'Report',
  _xmlSnippet?: string
): Promise<LearnedTemplateAnalysis> {
  return extractClientSideFormattingAndTone(text, fileName, docTypeHint);
}

/**
 * Learn template from a Google Drive file, save to storage, and return template
 */
export async function syncAndLearnTemplateFromDrive(
  fileInfo: DriveFileInfo,
  docTypeHint?: 'Letter' | 'Memo' | 'Minutes' | 'Report'
): Promise<UserTemplate> {
  const downloaded = await downloadDriveFileContent(fileInfo.id, fileInfo.mimeType);

  let rawText = downloaded.text;
  let templateSpec = downloaded.templateSpec;

  if (downloaded.isDocx && downloaded.arrayBuffer && !templateSpec) {
    try {
      templateSpec = await extractTemplateSpecFromDocx(downloaded.arrayBuffer, fileInfo.name);
      rawText = templateSpec.rawText;
    } catch (e) {
      console.warn('Error reading docx from drive:', e);
    }
  }

  if (!rawText || rawText.trim().length === 0) {
    rawText = `[Learned Template from ${fileInfo.name}]\n\nContent could not be converted to plain text. Using document container.`;
  }

  const analysis = await learnTemplateFromContent(rawText, fileInfo.name, docTypeHint);

  const driveSource: TemplateDriveSource = {
    provider: 'google_drive',
    fileId: fileInfo.id,
    fileName: fileInfo.name,
    webViewLink: fileInfo.webViewLink,
    mimeType: fileInfo.mimeType,
    syncedAt: new Date().toISOString(),
  };

  const newTemplate: UserTemplate = {
    id: `tpl_drive_${fileInfo.id.substring(0, 12)}`,
    title: analysis.title || fileInfo.name,
    documentType: analysis.documentType,
    category: `${analysis.documentType.toLowerCase()}s` as any,
    source: 'google_drive',
    content: analysis.blueprint,
    description: `Directly synced from Google Drive file: ${fileInfo.name}. ${templateSpec?.summaryPreview || ''}`,
    fields: analysis.fields,
    learnedKnowledge: {
      tone: analysis.toneProfile.formality,
      referenceFormat: analysis.documentType === 'Letter' ? 'RSIM/DIR/OFFICIAL/2026' : undefined,
      keySections: templateSpec ? templateSpec.sections.map((s) => s.title) : analysis.fields,
      learnedAt: new Date().toISOString(),
    },
    driveSource,
    formatting: templateSpec ? templateSpec.formatting : analysis.formatting,
    tone: analysis.toneProfile,
    isInstitutionalDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  storage.saveTemplate(newTemplate);
  return newTemplate;
}

/**
 * Learn template from a Microsoft OneDrive file
 */
export async function syncAndLearnTemplateFromOneDrive(
  fileInfo: DriveFileInfo,
  docTypeHint?: 'Letter' | 'Memo' | 'Minutes' | 'Report'
): Promise<UserTemplate> {
  const downloaded = await downloadOneDriveFileContent(fileInfo.id, fileInfo.mimeType);

  let rawText = downloaded.text;
  let templateSpec = downloaded.templateSpec;

  if (downloaded.isDocx && downloaded.arrayBuffer && !templateSpec) {
    try {
      templateSpec = await extractTemplateSpecFromDocx(downloaded.arrayBuffer, fileInfo.name);
      rawText = templateSpec.rawText;
    } catch (e) {
      console.warn('Error reading docx from onedrive:', e);
    }
  }

  if (!rawText || rawText.trim().length === 0) {
    rawText = `[Learned Template from ${fileInfo.name}]\n\nContent could not be converted to plain text.`;
  }

  const analysis = await learnTemplateFromContent(rawText, fileInfo.name, docTypeHint);

  const driveSource: TemplateDriveSource = {
    provider: 'onedrive',
    fileId: fileInfo.id,
    fileName: fileInfo.name,
    webViewLink: fileInfo.webViewLink,
    mimeType: fileInfo.mimeType,
    syncedAt: new Date().toISOString(),
  };

  const newTemplate: UserTemplate = {
    id: `tpl_onedrive_${fileInfo.id.substring(0, 12)}`,
    title: analysis.title || fileInfo.name,
    documentType: analysis.documentType,
    category: `${analysis.documentType.toLowerCase()}s` as any,
    source: 'onedrive',
    content: analysis.blueprint,
    description: `Directly synced from OneDrive file: ${fileInfo.name}. ${templateSpec?.summaryPreview || ''}`,
    fields: analysis.fields,
    learnedKnowledge: {
      tone: analysis.toneProfile.formality,
      referenceFormat: analysis.documentType === 'Letter' ? 'MoCD/RSIM/2026/OD' : undefined,
      keySections: templateSpec ? templateSpec.sections.map((s) => s.title) : analysis.fields,
      learnedAt: new Date().toISOString(),
    },
    driveSource,
    formatting: templateSpec ? templateSpec.formatting : analysis.formatting,
    tone: analysis.toneProfile,
    isInstitutionalDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  storage.saveTemplate(newTemplate);
  return newTemplate;
}

/**
 * Learn knowledge item from Google Drive file
 */
export async function syncAndLearnKnowledgeFromDrive(
  fileInfo: DriveFileInfo,
  category: KnowledgeItem['category'] = 'Directorate Information'
): Promise<KnowledgeItem> {
  const downloaded = await downloadDriveFileContent(fileInfo.id, fileInfo.mimeType);

  const newKnowledge: KnowledgeItem = {
    id: `know_drive_${fileInfo.id.substring(0, 12)}`,
    title: fileInfo.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
    category,
    content: downloaded.text,
    summary: `Synchronized from Google Drive file ${fileInfo.name}. Synced on ${new Date().toLocaleDateString('en-GB')}.`,
    source: 'Google Drive',
    owner: 'Directorate Knowledge Hub',
    version: '1.0',
    accessLevel: 'Directorate Only',
    approvalStatus: 'Approved',
    tags: ['Google Drive', 'Synced', category],
    effectiveDate: new Date().toISOString().split('T')[0],
    driveSource: {
      provider: 'google_drive',
      fileId: fileInfo.id,
      fileName: fileInfo.name,
      mimeType: fileInfo.mimeType,
      syncedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  storage.saveKnowledge(newKnowledge);
  return newKnowledge;
}

/**
 * Learn knowledge item from OneDrive file
 */
export async function syncAndLearnKnowledgeFromOneDrive(
  fileInfo: DriveFileInfo,
  category: KnowledgeItem['category'] = 'Directorate Information'
): Promise<KnowledgeItem> {
  const downloaded = await downloadOneDriveFileContent(fileInfo.id, fileInfo.mimeType);

  const newKnowledge: KnowledgeItem = {
    id: `know_onedrive_${fileInfo.id.substring(0, 12)}`,
    title: fileInfo.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
    category,
    content: downloaded.text,
    summary: `Synchronized from Microsoft OneDrive file ${fileInfo.name}. Synced on ${new Date().toLocaleDateString('en-GB')}.`,
    source: 'Microsoft OneDrive',
    owner: 'Directorate Knowledge Hub',
    version: '1.0',
    accessLevel: 'Directorate Only',
    approvalStatus: 'Approved',
    tags: ['Microsoft OneDrive', 'Synced', category],
    effectiveDate: new Date().toISOString().split('T')[0],
    driveSource: {
      provider: 'onedrive',
      fileId: fileInfo.id,
      fileName: fileInfo.name,
      mimeType: fileInfo.mimeType,
      syncedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  storage.saveKnowledge(newKnowledge);
  return newKnowledge;
}

/**
 * Resolves a cloud share link (Google Drive or OneDrive) to download preview content
 */
export async function resolveCloudShareLink(url: string): Promise<{
  provider: 'google_drive' | 'onedrive';
  fileId: string;
  fileName: string;
  text: string;
  isDocx?: boolean;
  arrayBuffer?: ArrayBuffer;
}> {
  const trimmed = url.trim();
  const gdriveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (gdriveMatch || trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const fileId = gdriveMatch ? gdriveMatch[1] : '';
    if (!fileId) throw new Error('Could not extract Google Drive file ID from the link.');
    const downloaded = await downloadDriveFileContent(fileId);
    return {
      provider: 'google_drive',
      fileId,
      fileName: downloaded.templateSpec?.title || 'Shared Google Drive File',
      text: downloaded.text,
      isDocx: downloaded.isDocx,
      arrayBuffer: downloaded.arrayBuffer,
    };
  }

  if (trimmed.includes('1drv.ms') || trimmed.includes('sharepoint.com') || trimmed.includes('onedrive.live.com')) {
    throw new Error('Please select this file directly using the OneDrive browser picker.');
  }

  throw new Error('Unrecognized cloud share link. Please provide a valid Google Drive or OneDrive link.');
}

