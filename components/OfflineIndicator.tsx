
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi } from 'lucide-react';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check: if offline, show status
    if (!navigator.onLine) setShowStatus(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {(showStatus || !isOnline) && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-6 right-6 z-[9999]"
        >
          {isOnline ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-full shadow-lg border border-emerald-500/20 backdrop-blur-md">
              <Wifi size={16} />
              <span className="text-xs font-medium font-sans">Back Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-full shadow-lg border border-slate-700/50 backdrop-blur-md">
              <WifiOff size={16} className="text-amber-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold font-sans">Offline Mode</span>
                <span className="text-[10px] opacity-70 font-sans tracking-tight">Your work is kept locally</span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
