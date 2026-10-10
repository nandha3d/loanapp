'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Phone, Calendar, RotateCcw } from 'lucide-react';

interface ActionItem {
  type: 'demo' | 'whatsapp' | 'call' | 'link';
  label: string;
  url?: string;
}

interface MessageItem {
  sender: 'bot' | 'user';
  text: string;
  actions?: ActionItem[];
  suggestions?: string[];
}

const INITIAL_MESSAGES: MessageItem[] = [
  {
    sender: 'bot',
    text: "Hello! 👋 I'm **Zolo Assistant**, your lending software specialist.\n\nI have in-depth knowledge of all our modules — daily microfinance, auto finance, gold loans, chit funds, GPS field tracking, offline sync, and pricing. How can I help your finance business today?",
    suggestions: [
      "What are your pricing plans?",
      "How does GPS doorstep collection work?",
      "Explain Daily & Weekly Microfinance",
      "Do you support Gold Loans & Chit Funds?",
      "How does offline collection work?",
      "Book a live demo"
    ]
  }
];

// 100% Comprehensive Domain Knowledge Base
const KNOWLEDGE_BASE: {
  id: string;
  keywords: string[];
  answer: string;
  actions?: ActionItem[];
  suggestions?: string[];
}[] = [
  {
    id: 'pricing',
    keywords: ['price', 'pricing', 'cost', 'plan', 'plans', 'subscription', 'charge', 'charges', 'rate', 'rates', 'how much', 'fee', 'package', 'starter', 'growth', 'scale', 'enterprise', 'rupee', 'kattanam'],
    answer: "Zolo Funds offers transparent, value-driven pricing tiers with no hidden charges:\n\n" +
            "• **Starter (₹999/mo):** Up to 2 branches, 3 collection agents, daily/weekly microfinance, digital day-book, basic reports.\n" +
            "• **Growth (₹2,999/mo):** Up to 5 branches, 10 collection agents, auto finance & gold loans, GPS geofencing, thermal printer integration.\n" +
            "• **Scale (₹7,999/mo):** Unlimited branches, 25 agents, chit funds, WhatsApp receipts & automated double-entry accounting.\n" +
            "• **Enterprise (Custom):** Dedicated database, custom API integrations, high-volume NBFC scaling & on-site staff training.\n\n" +
            "Every plan starts with an unconditional **14-Day Free Trial** with no credit card required!",
    actions: [
      { type: 'demo', label: 'Start 14-Day Free Trial' },
      { type: 'whatsapp', label: 'WhatsApp Sales' }
    ],
    suggestions: [
      "How does the 14-day free trial work?",
      "What are the payment terms?",
      "Do you provide a mobile app for agents?"
    ]
  },
  {
    id: 'trial',
    keywords: ['trial', 'free trial', 'demo', 'book demo', 'walkthrough', 'testing', 'try', 'test drive', 'sample'],
    answer: "You can test Zolo Funds completely risk-free with our **14-Day Free Trial**:\n\n" +
            "• **Instant Full Access:** Test the superadmin portal, loan origination, day-book, and the Android field agent APK.\n" +
            "• **Zero Financial Commitment:** No credit card or bank details required.\n" +
            "• **Personal Walkthrough:** Our product team will give you a live Google Meet or phone walkthrough and help set up your branches.\n" +
            "• **Data Retention:** Any test loans and customer records created can be kept or reset with one click when you activate.",
    actions: [
      { type: 'demo', label: 'Schedule Live Walkthrough' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "What are your pricing plans?",
      "Can I test on my Android phone?"
    ]
  },
  {
    id: 'microfinance',
    keywords: ['micro', 'microlending', 'daily', 'weekly', 'thandal', 'vaddi', 'kandhu', 'emi', 'flat', 'reducing', 'diminishing', 'collection', 'repayment', 'daily collection', 'instalment', 'schedule', 'foreclosure', 'discount', 'penalty', 'grace period'],
    answer: "Zolo Funds is tailor-made for Indian **Daily & Weekly Microfinance (Thandal / Micro-lending)**:\n\n" +
            "• **Repayment Cadence:** Flexible Daily (e.g. 100 days), Weekly, Bi-weekly, and Monthly schedules.\n" +
            "• **Calculation Models:** Flat EMI or Diminishing (Reducing Balance) with exact day-count interest.\n" +
            "• **Agent Run Sheets:** Line-by-line doorstep collection lists ordered by customer location efficiency.\n" +
            "• **Cash Drawer Handshake:** Collection agents surrender collected cash to the branch cashier with two-way digital signature reconciliation.\n" +
            "• **Automated Penalty Rules:** Configurable grace periods (e.g. 3 days) and linear overdue penalty accrual.\n" +
            "• **Foreclosure Engine:** Early loan payoff calculation with automated interest discount rebates.",
    actions: [
      { type: 'demo', label: 'See Microfinance Demo' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "How does GPS collection work?",
      "Does it support thermal Bluetooth printers?"
    ]
  },
  {
    id: 'autofinance',
    keywords: ['auto', 'vehicle', 'hp', 'hire purchase', 'bike', 'car', 'tractor', 'lorry', 'two wheeler', 'commercial', 'chassis', 'engine', 'hypothecation', 'rto', 'rc', 'repossession', 'seizure', 'insurance', 'vandi loan'],
    answer: "Our **Auto & Vehicle Finance Module** covers complete Hire Purchase (HP) operations:\n\n" +
            "• **Asset Registry:** Vehicle registration number, chassis number, engine number, make, model, and hypothecation status.\n" +
            "• **Document Vault:** Upload RC book copies, insurance policies, and vehicle inspection photos.\n" +
            "• **Co-Applicant & Guarantor:** Capture multiple guarantors with KYC and property backing.\n" +
            "• **Insurance Expiry Tracker:** Automated alerts 30 days and 15 days before policy expiration.\n" +
            "• **Default & Repossession:** Step-by-step default escalation with statutory grace notices and repossession inventory tracking.",
    actions: [
      { type: 'demo', label: 'Explore Auto Finance' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "What about Gold Loans?",
      "Can we print vehicle EMI receipts?"
    ]
  },
  {
    id: 'goldloan',
    keywords: ['gold', 'jewel', 'jewelry', 'pawn', 'pawnbroking', 'giruva', 'giruvas', 'nagai', 'ornament', 'karat', 'purity', 'weight', 'gross weight', 'net weight', 'stone', 'vault', 'safe', 'locker', 'auction', 'bullet'],
    answer: "Our **Gold Loan & Jewel Mortgage Module** offers bank-grade collateral security:\n\n" +
            "• **Detailed Item Appraisal:** Itemize bangles, chains, rings, coins with gross weight, stone deduction, net weight, and karat purity (22K, 18K).\n" +
            "• **Vault Packet Identification:** Assign each loan file to an encrypted safe locker packet ID.\n" +
            "• **Interest Schemes:** Simple monthly interest, compound interest, or Bullet repayment (principal due at end, interest serviced monthly).\n" +
            "• **Market Value Recalculation:** Instant LTV (Loan-To-Value) monitoring against daily Gold Bullion rates.\n" +
            "• **Statutory Auction Register:** Automated registered notice generator complying with Indian pawn-broking laws.",
    actions: [
      { type: 'demo', label: 'Explore Gold Loan Module' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "How do Chit Funds work?",
      "What are the pricing plans?"
    ]
  },
  {
    id: 'chitfunds',
    keywords: ['chit', 'chit fund', 'chitty', 'seettu', 'auction', 'foreman', 'dividend', 'subscriber', 'bid', 'bidding', 'reverse auction', 'passbook', 'registrar', 'act 1982'],
    answer: "Yes! Zolo Funds features a dedicated **Chit Fund Operating Module** compliant with the Chit Funds Act, 1982:\n\n" +
            "• **Group Lifecycle:** Create chit pools (e.g. 20, 25, or 50 members; ₹50,000 to ₹1 Crore pools).\n" +
            "• **Reverse Auction Engine:** Record monthly member bids, calculate discount prize money, and enforce statutory ceiling bids.\n" +
            "• **Foreman Commission:** Automated 5% foreman commission calculation.\n" +
            "• **Dividend Distribution:** Auto-split remaining discount among all non-prized subscribers to reduce next month's call installment.\n" +
            "• **Digital Passbook:** Automated member passbook generation and registrar compliance filings.",
    actions: [
      { type: 'demo', label: 'Explore Chit Fund Module' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "Can agents collect chit installments on mobile?",
      "Book a live demo"
    ]
  },
  {
    id: 'gps',
    keywords: ['gps', 'geofence', 'geofencing', 'location', 'tracking', 'field', 'doorstep', 'route', 'map', 'agent tracking', 'fraud', 'phantom', 'distance', 'radius'],
    answer: "Our **GPS Collection Verification Engine** eliminates phantom collections and employee fraud:\n\n" +
            "• **Live Doorstep Geofence:** When an agent taps 'Collect', the mobile app verifies satellite GPS coordinates against the borrower's registered home or shop.\n" +
            "• **Manager Radius Alerts:** Collections attempted beyond the permissible radius (e.g. 50 meters) are flagged immediately for manager approval.\n" +
            "• **Optimized Route Sheets:** The app organizes the daily collection list geographically to minimize fuel and travel time.\n" +
            "• **Shift-Only Privacy:** GPS tracking runs strictly during active work hours; tracking terminates immediately when the agent clocks out.",
    actions: [
      { type: 'demo', label: 'See Field App Demo' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "How does offline mode work?",
      "Does it support Bluetooth thermal printers?"
    ]
  },
  {
    id: 'offline',
    keywords: ['offline', 'no internet', 'connectivity', 'network', 'sync', 'signal', 'rural', 'basement', 'remote'],
    answer: "Yes! The ZoloFund Android mobile app features an **Offline-First Synchronization Architecture**:\n\n" +
            "• **Zero-Signal Collections:** Agents can collect cash installments in basements, remote villages, or hill stations with zero internet signal.\n" +
            "• **Cryptographic Storage:** Every collection creates a tamper-proof cryptographic receipt stored locally in encrypted device memory.\n" +
            "• **3-Second Auto Sync:** The moment the phone detects 2G, 3G, 4G, or Wi-Fi, all transactions automatically upload and reconcile with the head office ledger in under 3 seconds!",
    actions: [
      { type: 'demo', label: 'Test Android APK' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "Does it print physical paper receipts?",
      "What are the pricing plans?"
    ]
  },
  {
    id: 'receipts',
    keywords: ['receipt', 'printer', 'printing', 'bluetooth', 'thermal', 'thermal printer', 'paper', 'bill', 'slip', 'whatsapp receipt', 'sms', 'ngx', 'bluprint', 'dlt'],
    answer: "Zolo Funds delivers instant proof of payment to eliminate customer disputes:\n\n" +
            "• **Bluetooth Thermal Printers:** Pairs with all standard 2-inch and 3-inch ESC/POS Bluetooth printers (NGX, Bluprint, Pegasus, etc.) for instant doorstep paper slips.\n" +
            "• **Branded WhatsApp Receipts:** Dispatches a formatted, branded WhatsApp payment receipt directly to the customer's phone.\n" +
            "• **DLT-Registered SMS:** Sends an official SMS confirmation with unique receipt ID, amount collected, and updated loan balance.",
    actions: [
      { type: 'demo', label: 'See Receipt Formats' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "How does GPS collection work?",
      "Can we test the Android app?"
    ]
  },
  {
    id: 'accounting',
    keywords: ['accounting', 'ledger', 'daybook', 'day book', 'cashbook', 'cash book', 'double entry', 'p&l', 'profit', 'loss', 'balance sheet', 'journal', 'cash drawer', 'cashier', 'audit', 'tax'],
    answer: "Zolo Funds comes with an automated **Double-Entry Financial Accounting Core**:\n\n" +
            "• **Automated Posting:** Loan disbursals, interest collections, penalties, and fee deductions automatically post corresponding Debit/Credit journal vouchers.\n" +
            "• **Daily Cash-Book & Day-Book:** View opening cash balances, daily inflows, agent handshakes, branch expenses, and closing float.\n" +
            "• **Financial Statements:** Generate real-time Trial Balance, Profit & Loss (P&L) statements, and Balance Sheet with zero manual bookkeeping.\n" +
            "• **Audit Trail:** Every financial alteration is logged with user timestamp, IP address, and supervisor approvals.",
    actions: [
      { type: 'demo', label: 'See Accounting Demo' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "How does RBI NPA classification work?",
      "What are your pricing plans?"
    ]
  },
  {
    id: 'npa_rbi',
    keywords: ['npa', 'rbi', 'provisioning', 'sma', 'sma0', 'sma1', 'sma2', 'substandard', 'doubtful', 'loss asset', 'overdue', 'delinquency', 'defaulter', 'compliance'],
    answer: "Our software has built-in **RBI Asset Classification & NPA Rules**:\n\n" +
            "• **SMA-0 (1 to 30 Days Overdue):** Early delinquency alerts with automated payment reminders.\n" +
            "• **SMA-1 (31 to 60 Days Overdue):** Escalated recovery workflows and supervisor field visits.\n" +
            "• **SMA-2 (61 to 90 Days Overdue):** Pre-NPA legal default notices and guarantor warnings.\n" +
            "• **91+ Days NPA Classification:** Automated transition into Sub-standard, Doubtful (D1, D2, D3), and Loss assets with statutory provisioning reserve calculations (0.40% to 100%).",
    actions: [
      { type: 'demo', label: 'Explore Compliance Tools' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "Explain the Security Architecture",
      "How does loan foreclosure work?"
    ]
  },
  {
    id: 'kyc_borrower',
    keywords: ['kyc', 'borrower', 'customer', 'aadhaar', 'pan', 'voter id', 'ration card', 'document', 'photo', 'camera', 'credit score', 'cibil', 'onboarding'],
    answer: "Comprehensive **Borrower Onboarding & KYC Management**:\n\n" +
            "• **Document Capture:** Live camera photo capture and digital scanning of Aadhaar, PAN card, Voter ID, and Ration cards.\n" +
            "• **Credit Scoring Engine:** Internal credit scoring system (300 to 850 score band) evaluating borrower discipline across past loan cycles.\n" +
            "• **Family & Guarantor Mapping:** Map co-borrowers, relatives, and guarantors to prevent cross-default exposure.\n" +
            "• **Blacklist & Defaulter Registry:** Cross-branch blacklist verification prevents issuing new loans to habitual defaulters.",
    actions: [
      { type: 'demo', label: 'See Onboarding Demo' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "How does Daily Microfinance work?",
      "What are the pricing plans?"
    ]
  },
  {
    id: 'security_dpdp',
    keywords: ['security', 'safe', 'dpdp', 'encryption', 'data', 'cloud', 'backup', 'privacy', 'gdpr', 'playstore', 'delete account'],
    answer: "Zolo Funds is engineered with bank-grade security and statutory compliance:\n\n" +
            "• **Multi-Tenant Logical Isolation:** Your financial records and borrower database are strictly isolated and never shared.\n" +
            "• **Military-Grade Encryption:** TLS 1.3 transit encryption + AES-256 at-rest database storage.\n" +
            "• **Automated Cloud Backups:** Daily encrypted off-site cloud backups with instant point-in-time recovery.\n" +
            "• **DPDP Act 2023 Compliant:** Full compliance with Indian Data Protection laws, user consent registers, and auditability.\n" +
            "• **Play Store Compliant:** Built-in account deletion portal (`/delete-account`) to meet Google Play safety standards.",
    actions: [
      { type: 'demo', label: 'Review Security Setup' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "Where is your office located?",
      "What are your pricing plans?"
    ]
  },
  {
    id: 'contact_office',
    keywords: ['contact', 'phone', 'call', 'number', 'address', 'office', 'support', 'email', 'location', 'erode', 'animazon', 'narayana valasu', 'nasiyanur', 'tamil nadu', 'headquarters', 'helpline'],
    answer: "You can reach the Zolo Funds team directly:\n\n" +
            "• **Direct Helpline & Sales:** [+91 80894 05950](tel:+918089405950)\n" +
            "• **WhatsApp Support:** Instant chat available Monday–Saturday\n" +
            "• **Email Support:** [support@zolofunds.com](mailto:support@zolofunds.com)\n" +
            "• **Corporate Office Address:**\n" +
            "  **155, Animazon, Narayana Valasu, Nasiyanur Road, Erode - 638011, Tamil Nadu, India**\n" +
            "• **Languages Supported:** Tamil, English, Hindi, Telugu, Kannada, Malayalam\n" +
            "• **Support Hours:** Monday–Saturday, 09:30 AM to 06:30 PM IST.",
    actions: [
      { type: 'call', label: 'Call +91 80894 05950' },
      { type: 'whatsapp', label: 'WhatsApp' }
    ],
    suggestions: [
      "What are your pricing plans?",
      "Book a live demo"
    ]
  },
  {
    id: 'multibranch_roles',
    keywords: ['branch', 'multi branch', 'branches', 'roles', 'permission', 'superadmin', 'manager', 'cashier', 'agent', 'auditor', 'access control', 'rbac'],
    answer: "Zolo Funds gives you complete organizational control with **Role-Based Access Control (RBAC)**:\n\n" +
            "• **Multi-Branch Hierarchy:** Manage 2, 10, or 50+ branches from a single superadmin dashboard with consolidated or branch-specific reporting.\n" +
            "• **Staff Roles:** Pre-built roles for Superadmin, Branch Manager, Loan Officer, Field Agent, Cashier, and Auditor.\n" +
            "• **Granular Permissions:** Restrict who can approve loans, release funds, waive overdue penalties, or export Excel reports.\n" +
            "• **Device Binding:** Restrict field agents to specific registered smartphones for heightened security.",
    actions: [
      { type: 'demo', label: 'Explore Multi-Branch Setup' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ],
    suggestions: [
      "What are your pricing plans?",
      "How does offline collection work?"
    ]
  },
  {
    id: 'app_download',
    keywords: ['app', 'mobile app', 'download', 'apk', 'play store', 'android', 'phone', 'install', 'mobile'],
    answer: "Our **Android Field Agent Application** is built for maximum speed and simplicity:\n\n" +
            "• **Lightweight APK:** Operates smoothly on any Android smartphone (Android 8.0 and above).\n" +
            "• **Works Offline:** No internet required for collecting installments at customer doorsteps.\n" +
            "• **Bluetooth Printing:** One-tap thermal receipt generation.\n" +
            "• **Google Play Friendly:** Fully vetted under Google Play Financial App and Lending Policies.\n" +
            "• Would you like us to send you the test APK or grant test portal credentials?",
    actions: [
      { type: 'demo', label: 'Request APK Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp' }
    ],
    suggestions: [
      "How does GPS tracking work?",
      "What are your pricing plans?"
    ]
  },
  {
    id: 'greetings',
    keywords: ['hi', 'hello', 'hey', 'vanakkam', 'namaste', 'good morning', 'good afternoon', 'good evening', 'start', 'help'],
    answer: "Hello and welcome to Zolo Funds! 🙏\n\n" +
            "I'm **Zolo Assistant**. I can help you with anything about our lending platform — daily collections, auto finance, gold loans, chit funds, GPS field tracking, pricing, or getting a 14-day free trial.\n\n" +
            "What type of finance business do you operate?",
    suggestions: [
      "Daily / Weekly Microfinance",
      "Auto & Vehicle Finance",
      "Gold Loans & Jewels",
      "Chit Funds",
      "Pricing Plans",
      "Schedule Live Demo"
    ]
  }
];

// High-Precision NLP Token Matching Engine
function findSmartAnswer(userInput: string) {
  const query = userInput.toLowerCase().trim();
  if (!query) return null;

  if (/^(hi|hello|hey|vanakkam|namaste)$/i.test(query)) {
    return KNOWLEDGE_BASE.find(item => item.id === 'greetings');
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const item of KNOWLEDGE_BASE) {
    if (item.id === 'greetings') continue;
    let score = 0;
    for (const kw of item.keywords) {
      if (query.includes(kw)) {
        score += kw.length * (kw.includes(' ') ? 2.5 : 1.0);
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore > 0) {
    return bestMatch;
  }

  return {
    answer: "Thank you for asking! **Zolo Funds** is an all-in-one lending management system for **Daily & Weekly Microfinance, Auto Finance, Gold Loans, and Chit Funds** with live GPS doorstep verification, offline mobile syncing, and double-entry accounting.\n\n" +
            "I would be delighted to connect you with our product team for a 1-on-1 walkthrough or answer any specific module question!",
    actions: [
      { type: 'demo' as const, label: 'Book Live Walkthrough' },
      { type: 'whatsapp' as const, label: 'WhatsApp' },
      { type: 'call' as const, label: 'Call +91 80894 05950' }
    ],
    suggestions: [
      "What are your pricing plans?",
      "How does GPS collection work?",
      "Explain Daily Microfinance",
      "Do you support Gold Loans?"
    ]
  };
}

interface AiChatWidgetProps {
  onOpenDemo?: () => void;
}

export default function AiChatWidget({ onOpenDemo }: AiChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadCount(0);
    }
  }, [isOpen, messages]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMessage: MessageItem = { sender: 'user', text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const match = findSmartAnswer(text);
      if (match) {
        const botMessage: MessageItem = {
          sender: 'bot',
          text: match.answer,
          actions: match.actions || [],
          suggestions: match.suggestions || []
        };
        setMessages(prev => [...prev, botMessage]);
      }
      setIsTyping(false);
    }, 350);
  };

  const handleActionClick = (action: ActionItem) => {
    if (action.type === 'demo') {
      if (onOpenDemo) {
        onOpenDemo();
      } else {
        window.location.href = '/contact';
      }
      setIsOpen(false);
    } else if (action.type === 'whatsapp') {
      window.open('https://wa.me/918089405950?text=Hi%2C%20I%20have%20an%20inquiry%20about%20Zolo%20Funds', '_blank');
    } else if (action.type === 'call') {
      window.location.href = 'tel:+918089405950';
    } else if (action.type === 'link' && action.url) {
      window.location.href = action.url;
    }
  };

  const handleReset = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              background: '#7D287E',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '999px',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(125, 40, 126, 0.42)',
              fontWeight: 700,
              fontSize: '0.94rem',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: 'pulseGlow 2.5s infinite'
            }}
            aria-label="Open Zolo Assistant"
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Bot size={20} />
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '8px',
                  height: '8px',
                  background: '#22C55E',
                  borderRadius: '50%',
                  border: '1.5px solid #7D287E'
                }}
              />
            </div>
            <span>Zolo Assistant</span>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#F59E0B',
                  color: '#000',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '99px',
                  marginLeft: '2px'
                }}
              >
                1
              </span>
            )}
          </button>
        )}
      </div>

      {/* Expandable Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 100px))',
            background: '#FFFFFF',
            borderRadius: '20px',
            boxShadow: '0 16px 48px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(125, 40, 126, 0.12)',
            zIndex: 1105,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #7D287E 0%, #5A195B 100%)',
              color: '#FFFFFF',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <Bot size={22} color="#FFFFFF" />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '1px',
                    right: '1px',
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    background: '#22C55E',
                    border: '1.5px solid #7D287E'
                  }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#FFFFFF' }}>
                  Zolo Assistant
                </div>
                <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.85)' }}>
                  Instant answers · No waiting
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={handleReset}
                title="Restart Chat"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Chat"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages List Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              background: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '86%',
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.sender === 'user' ? '#7D287E' : '#FFFFFF',
                    color: msg.sender === 'user' ? '#FFFFFF' : '#0F172A',
                    boxShadow: msg.sender === 'user' ? '0 4px 12px rgba(125,40,126,0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
                    fontSize: '0.9rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-line'
                  }}
                >
                  {msg.text.split('\n').map((line, i) => (
                    <span key={i}>
                      {line.includes('**') ? (
                        line.split('**').map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx}>{part}</strong> : part))
                      ) : (
                        line
                      )}
                      <br />
                    </span>
                  ))}
                </div>

                {/* Optional Interactive Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {msg.actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        onClick={() => handleActionClick(act)}
                        style={{
                          background: act.type === 'whatsapp' ? '#25D366' : '#7D287E',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        {act.type === 'demo' && <Calendar size={13} />}
                        {act.type === 'call' && <Phone size={13} />}
                        {act.type === 'whatsapp' && <MessageSquare size={13} />}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Optional Follow-up Suggestion Chips */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {msg.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSend(sug)}
                        style={{
                          background: '#F1F5F9',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          borderRadius: '16px',
                          padding: '5px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#FFFFFF',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 4px',
                  width: 'fit-content',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ width: '7px', height: '7px', background: '#7D287E', borderRadius: '50%', animation: 'bounceDot 1.2s infinite 0s' }} />
                <div style={{ width: '7px', height: '7px', background: '#7D287E', borderRadius: '50%', animation: 'bounceDot 1.2s infinite 0.2s' }} />
                <div style={{ width: '7px', height: '7px', background: '#7D287E', borderRadius: '50%', animation: 'bounceDot 1.2s infinite 0.4s' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Help Strip */}
          <div
            style={{
              padding: '6px 14px',
              background: '#FFFFFF',
              borderTop: '1px solid #F1F5F9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.74rem',
              color: '#64748B'
            }}
          >
            <span>Direct Call: <strong>+91 80894 05950</strong></span>
            <button
              onClick={() => handleActionClick({ type: 'whatsapp', label: '' })}
              style={{
                background: 'none',
                border: 'none',
                color: '#059669',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              WhatsApp →
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '12px 14px',
              background: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              placeholder="Ask about microfinance, gold loans, GPS, pricing..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.9rem',
                outline: 'none',
                color: '#0F172A',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => (e.target.style.borderColor = '#7D287E')}
              onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              style={{
                background: inputValue.trim() ? '#7D287E' : '#E2E8F0',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s'
              }}
              aria-label="Send Message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(125, 40, 126, 0.4); }
          50% { transform: scale(1.03); box-shadow: 0 12px 32px rgba(125, 40, 126, 0.6); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounceDot {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
