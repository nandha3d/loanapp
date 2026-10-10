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
    text: "Hello! 👋 I'm **Zolo AI**, your instant lending assistant. Ask me anything about our software modules, daily field collections, pricing, or book a live demo!",
    suggestions: [
      "What are your pricing plans?",
      "How does GPS collection work?",
      "Do you support Gold Loans & Chit Funds?",
      "How does the 14-day free trial work?",
      "Book a live demo"
    ]
  }
];

// Rich Zero-Cost Client-Side Knowledge Base Engine (Zero API Cost)
const KNOWLEDGE_BASE: {
  keywords: string[];
  answer: string;
  actions?: ActionItem[];
  suggestions?: string[];
}[] = [
  {
    keywords: ['price', 'pricing', 'cost', 'plan', 'subscription', 'charge', 'rate', 'how much'],
    answer: "Zolo Funds offers transparent, value-driven pricing tiers with no hidden charges:\n\n" +
            "• **Starter (₹999/mo):** Up to 2 branches, 3 collection agents, daily/weekly microfinance.\n" +
            "• **Growth (₹2,999/mo):** Up to 5 branches, 10 collection agents, auto finance & gold loans, GPS geofencing.\n" +
            "• **Scale (₹7,999/mo):** Unlimited branches, 25 agents, chit funds, WhatsApp receipts & double-entry accounting.\n" +
            "• **Enterprise (Custom):** Dedicated database, custom API integrations & on-site training.\n\n" +
            "Every plan includes an unconditional **14-Day Free Trial** with zero card commitment!",
    actions: [
      { type: 'demo', label: 'Start 14-Day Free Trial' },
      { type: 'whatsapp', label: 'Ask Sales on WhatsApp' }
    ]
  },
  {
    keywords: ['trial', 'free trial', 'free', 'demo', 'book demo', 'walkthrough'],
    answer: "You can test Zolo Funds completely risk-free!\n\n" +
            "• **14-Day Full-Feature Free Trial:** No credit card or bank details required.\n" +
            "• Includes the Android field agent APK, web superadmin portal, loan origination, and day-book ledgers.\n" +
            "• Need a personal walkthrough? Our team can give you a live Google Meet or phone demo today!",
    actions: [
      { type: 'demo', label: 'Schedule Live Walkthrough' },
      { type: 'whatsapp', label: 'WhatsApp +91 80894 05950' }
    ]
  },
  {
    keywords: ['gps', 'geofence', 'location', 'field', 'agent', 'tracking', 'route', 'map'],
    answer: "Our **GPS Collection Verification** prevents phantom collections and protects your money:\n\n" +
            "• **Live Doorstep Geofence:** When your agent taps 'Collect', the mobile app automatically verifies their satellite GPS coordinates against the borrower's registered home or shop.\n" +
            "• **Anti-Fraud Flagging:** Collections attempted outside the designated radius are flagged instantly for manager review.\n" +
            "• **Route Run Sheets:** Agents get an optimized daily doorstep collection list sorted by route efficiency.\n" +
            "• **Shift-Only Tracking:** Location is tracked strictly while on-duty; stops automatically upon clock-out.",
    actions: [
      { type: 'demo', label: 'See Field App Demo' }
    ]
  },
  {
    keywords: ['offline', 'no internet', 'connectivity', 'network', 'sync'],
    answer: "Yes! The ZoloFund Android application has a built-in **Offline-First Sync Engine**:\n\n" +
            "• Field collection agents can collect installments in rural or basements with **zero internet connection**.\n" +
            "• Receipts and cryptographic tokens are generated and stored locally in encrypted device memory.\n" +
            "• As soon as the smartphone detects 2G/3G/4G/WiFi, all collections sync automatically to the head office ledger in under 3 seconds!",
    actions: [
      { type: 'demo', label: 'Request APK Demo' }
    ]
  },
  {
    keywords: ['micro', 'microlending', 'daily', 'weekly', 'emi', 'flat', 'reducing', 'interest', 'daily collection'],
    answer: "Zolo Funds is specifically built for Indian daily and weekly micro-lenders:\n\n" +
            "• **Flexible Cadence:** Daily, weekly, bi-weekly, and monthly repayment schedules.\n" +
            "• **Calculation Modes:** Flat EMI or Reducing Balance (Diminishing) with exact day-count conventions.\n" +
            "• **Automated Penalty Engine:** Configurable grace periods (e.g. 3 days) and linear overdue penalty calculation.\n" +
            "• **Cash Pool Handshakes:** Field agents reconcile their physical cash bags with branch cashiers in one tap.",
    actions: [
      { type: 'demo', label: 'Explore Microfinance Module' }
    ]
  },
  {
    keywords: ['auto', 'vehicle', 'hp', 'hire purchase', 'bike', 'car', 'tractor', 'chassis'],
    answer: "Our **Auto & Vehicle Finance Module** handles complete Hire Purchase (HP) lifecycles:\n\n" +
            "• Vehicle chassis & engine number registers with hypothecation tracking.\n" +
            "• Co-applicant, guarantor and collateral photo documentation.\n" +
            "• Insurance policy expiry notifications and repossession status workflows.\n" +
            "• Automated legal default notices with statutory grace intervals.",
    actions: [
      { type: 'demo', label: 'Book Auto Finance Demo' }
    ]
  },
  {
    keywords: ['gold', 'jewel', 'pawn', 'karat', 'ornament', 'weight', 'vault'],
    answer: "Our **Gold Loan & Jewel Mortgage Module** provides bank-grade collateral safety:\n\n" +
            "• **Detailed Appraisal:** Itemized ornament logs (bangles, chains, rings) with gross weight, stone deduction, net weight, and karat purity (22K, 18K).\n" +
            "• **Vault Packet Allocation:** Secure safe locker packet identifiers for each loan file.\n" +
            "• **Bullet & Monthly Interest:** Simple or compound monthly interest accrual with bullet principal closure.\n" +
            "• **Statutory Auction Register:** Automated overdue auction notice generators complying with Indian regulations.",
    actions: [
      { type: 'demo', label: 'Explore Gold Loan Module' }
    ]
  },
  {
    keywords: ['chit', 'chit fund', 'auction', 'foreman', 'dividend', 'ticket'],
    answer: "Yes, Zolo Funds includes a dedicated **Chit Fund Operating Module** compliant with the Chit Funds Act, 1982:\n\n" +
            "• Chit group formation (e.g., 20 or 25 members, ₹1 Lakh to ₹50 Lakh groups).\n" +
            "• Monthly auction reverse-bidding logs and prize money calculations.\n" +
            "• Automated Foreman Commission deduction (5%) and non-prized subscriber dividend sharing.\n" +
            "• Statutory registrar compliance reporting and passbook printing.",
    actions: [
      { type: 'demo', label: 'Explore Chit Fund Module' }
    ]
  },
  {
    keywords: ['receipt', 'printer', 'bluetooth', 'whatsapp', 'sms'],
    answer: "Every collection creates instant customer proof:\n\n" +
            "• **Bluetooth Thermal Printer:** Print physical 2-inch or 3-inch paper receipts immediately at the customer's doorstep.\n" +
            "• **Instant WhatsApp Receipt:** Send a branded WhatsApp payment confirmation directly to the borrower's phone.\n" +
            "• **DLT-Registered SMS:** Automated SMS dispatch with unique transaction ID and remaining balance.\n" +
            "• Eliminates collection disputes and builds customer trust!",
    actions: [
      { type: 'whatsapp', label: 'Message Us on WhatsApp' }
    ]
  },
  {
    keywords: ['contact', 'phone', 'call', 'number', 'address', 'office', 'support', 'email', 'location', 'erode'],
    answer: "You can reach the Zolo Funds team directly:\n\n" +
            "• **Helpline & Sales:** [+91 80894 05950](tel:+918089405950)\n" +
            "• **Email Support:** [support@zolofunds.com](mailto:support@zolofunds.com)\n" +
            "• **Corporate Office:** 155, Animazon, Narayana Valasu, Nasiyanur Road, Erode - 638011, Tamil Nadu, India\n" +
            "• **Operating Hours:** Monday–Saturday, 09:30 AM to 06:30 PM IST (Available in English, Tamil, Hindi, Telugu, Kannada, Malayalam).",
    actions: [
      { type: 'call', label: 'Call +91 80894 05950' },
      { type: 'whatsapp', label: 'Chat on WhatsApp' }
    ]
  },
  {
    keywords: ['security', 'safe', 'rbi', 'npa', 'dpdp', 'encryption', 'data'],
    answer: "Zolo Funds is engineered for bank-grade security and statutory compliance:\n\n" +
            "• **Multi-Tenant Logical Isolation:** Your financial records and borrower accounts are completely partitioned and inaccessible to anyone else.\n" +
            "• **Encryption:** TLS 1.3 transit encryption + AES-256 at-rest database storage.\n" +
            "• **RBI NPA Norms:** Automated SMA-0 (1-30 days), SMA-1 (31-60 days), SMA-2 (61-90 days), and 90+ day NPA classification.\n" +
            "• **DPDP Act 2023 Compliant:** Full Data Principal rights, grievance redressal, and account deletion portal.",
    actions: [
      { type: 'link', label: 'View Security Architecture', url: '/security' }
    ]
  },
  {
    keywords: ['delete', 'deletion', 'erase', 'remove account', 'privacy'],
    answer: "In compliance with Google Play Store policies and the DPDP Act 2023, you have full control over your data:\n\n" +
            "• You can submit a deletion request anytime via our public portal at `/delete-account` or directly in the Android app under Settings.\n" +
            "• User credentials and personal identifiers are purged within 7 business days.\n" +
            "• Historical financial ledgers are preserved in anonymized form for statutory tax compliance.",
    actions: [
      { type: 'link', label: 'Open Data Deletion Portal', url: '/delete-account' }
    ]
  },
  {
    keywords: ['hi', 'hello', 'hey', 'vanakkam', 'namaste', 'good morning', 'good afternoon', 'good evening'],
    answer: "Hello and welcome to Zolo Funds! 🙏\n\n" +
            "I'm here to help you discover how Zolo Funds can streamline your daily collections, reduce overdue accounts, and manage your loan portfolio.\n\n" +
            "What type of finance business do you operate?",
    suggestions: [
      "Daily Microfinance",
      "Auto & Vehicle Finance",
      "Gold Loans",
      "Chit Funds",
      "Software Pricing"
    ]
  }
];

function findSmartAnswer(userInput: string) {
  const query = userInput.toLowerCase().trim();
  if (!query) return null;

  let bestMatch = null;
  let highestScore = 0;

  for (const item of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of item.keywords) {
      if (query.includes(kw)) {
        score += kw.length;
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
    answer: "Thank you for asking! Zolo Funds provides an end-to-end cloud platform for **Daily Microfinance, Auto Finance, Gold Loans, and Chit Funds** with live GPS field tracking and offline sync.\n\n" +
            "Would you like to speak directly with our product specialist or schedule a quick 1-on-1 walkthrough?",
    actions: [
      { type: 'demo' as const, label: 'Book Live Walkthrough' },
      { type: 'whatsapp' as const, label: 'Chat on WhatsApp (+91 80894 05950)' },
      { type: 'call' as const, label: 'Call +91 80894 05950' }
    ],
    suggestions: [
      "What are your pricing plans?",
      "How does GPS collection work?",
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
    }, 380);
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
            aria-label="Open AI Assistant"
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
            <span>Ask Zolo AI</span>
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
                <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Zolo AI Assistant</span>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.22)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    100% FREE
                  </span>
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
                        line.split('**').map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx}>{part}</strong> : part)
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
              placeholder="Ask a question or type a topic..."
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
