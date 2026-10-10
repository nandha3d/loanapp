'use client';

import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import Verticals from './Verticals';
import Features from './Features';
import GpsExplainer from './GpsExplainer';
import LoanCalculator from './LoanCalculator';
import MobileApp from './MobileApp';
import WorkflowExplorer from './WorkflowExplorer';
import Pricing from './Pricing';
import Testimonials from './Testimonials';
import Faq from './Faq';
import DemoModal from './DemoModal';
import Footer from './Footer';
import AiChatWidget from './AiChatWidget';
import './zolofunds.css';

export default function ZoloFundsLanding() {
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    // Force clean, high-contrast light theme for marketing presentation
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  return (
    <div className="zolofunds-root app-root">
      <Navbar onOpenDemo={() => setDemoOpen(true)} />

      <main>
        <Hero onOpenDemo={() => setDemoOpen(true)} />
        <Verticals onOpenDemo={() => setDemoOpen(true)} />
        <Features onOpenDemo={() => setDemoOpen(true)} />
        <GpsExplainer onOpenDemo={() => setDemoOpen(true)} />
        <LoanCalculator onOpenDemo={() => setDemoOpen(true)} />
        <MobileApp onOpenDemo={() => setDemoOpen(true)} />
        <WorkflowExplorer onOpenDemo={() => setDemoOpen(true)} />
        <Pricing onOpenDemo={() => setDemoOpen(true)} />
        <Testimonials />
        <Faq />
      </main>

      <Footer onOpenDemo={() => setDemoOpen(true)} />

      <AiChatWidget onOpenDemo={() => setDemoOpen(true)} />

      <DemoModal
        isOpen={demoOpen}
        onClose={() => setDemoOpen(false)}
      />
    </div>
  );
}
