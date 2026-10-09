'use client';

import React, { useEffect, useState, useCallback } from 'react';
import ScrollingAnnouncementBar, { AnnouncementItem } from './ScrollingAnnouncementBar';
import AnnouncementPopupModal from './AnnouncementPopupModal';

export default function AnnouncementProvider() {
  const [scrollingList, setScrollingList] = useState<AnnouncementItem[]>([]);
  const [popupQueue, setPopupQueue] = useState<AnnouncementItem[]>([]);
  const [activeModalItem, setActiveModalItem] = useState<AnnouncementItem | null>(null);

  const fetchActiveAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/announcements/active', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data) {
        const { scrollingAnnouncements, popupAnnouncements } = json.data;
        setScrollingList(scrollingAnnouncements || []);
        setPopupQueue(popupAnnouncements || []);

        // If there's an undismissed popup announcement and none currently open, show first
        if (popupAnnouncements && popupAnnouncements.length > 0) {
          setActiveModalItem(popupAnnouncements[0]);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchActiveAnnouncements();
    // Re-check periodically every 60 seconds
    const interval = setInterval(fetchActiveAnnouncements, 60000);
    return () => clearInterval(interval);
  }, [fetchActiveAnnouncements]);

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/v1/announcements/${id}/dismiss`, { method: 'POST' });
      // Remove from queues
      setScrollingList((prev) => prev.filter((a) => a.id !== id));
      setPopupQueue((prev) => prev.filter((a) => a.id !== id));
      setActiveModalItem(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseModal = () => {
    setActiveModalItem(null);
    // If there is another popup in the queue, show next
    if (popupQueue.length > 1) {
      const remaining = popupQueue.slice(1);
      setPopupQueue(remaining);
      setActiveModalItem(remaining[0]);
    }
  };

  return (
    <>
      <ScrollingAnnouncementBar
        announcements={scrollingList}
        onOpenDetails={(item) => setActiveModalItem(item)}
      />
      <AnnouncementPopupModal
        announcement={activeModalItem}
        onClose={handleCloseModal}
        onDismiss={handleDismiss}
      />
    </>
  );
}
