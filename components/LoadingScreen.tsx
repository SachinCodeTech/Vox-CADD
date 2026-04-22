
import React, { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VoxIcon from './VoxIcon';

const LoadingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => setShow(false), 500);
          setTimeout(onComplete, 1000);
          return 100;
        }
        return prev + (Math.random() * 15);
      });
    }, 150);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-[#050507] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Animated Matrix-like Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent" />
             <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#22d3ee 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
          </div>

          <div className="relative flex flex-col items-center">
            {/* Logo Animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative mb-12"
            >
              <div className="w-24 h-24 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)]">
                <motion.div
                  animate={{ 
                    rotate: [0, 90, 180, 270, 360],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                  className="absolute inset-0 border-2 border-dashed border-cyan-500/20 rounded-3xl scale-150"
                />
                <VoxIcon size={64} className="relative z-10" />
              </div>
              
              <motion.div 
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1"
              >
                <Zap size={10} className="text-cyan-500 fill-cyan-500" />
                <span className="text-[8px] font-black text-cyan-400 uppercase tracking-[0.3em]">SYSTEM_v1.0.0</span>
              </motion.div>
            </motion.div>

            {/* Text and Progress */}
            <div className="flex flex-col items-center gap-4 w-64 lg:w-80">
              <div className="flex justify-between w-full">
                <motion.h1 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl uppercase tracking-[0.2em] italic"
                >
                  <span className="text-white font-black">VOX</span>
                  <span className="text-cyan-500 font-bold ml-1">CADD</span>
                </motion.h1>
                <span className="text-cyan-500 font-mono text-sm self-end mb-1 font-bold">{Math.floor(progress)}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                <motion.div 
                  className="absolute inset-y-0 left-0 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>

              {/* Status Text */}
              <div className="h-4 flex items-center justify-center">
                <motion.span 
                  key={Math.floor(progress / 25)}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-[10px] font-black text-neutral-600 uppercase tracking-widest text-center"
                >
                  {progress < 25 && "INITIALIZING_KERNELS..."}
                  {progress >= 25 && progress < 50 && "CALIBRATING_SNAPPING_ENGINE..."}
                  {progress >= 50 && progress < 75 && "AWAKENING_PRINCIPAL_ARCHITECT..."}
                  {progress >= 75 && progress < 100 && "READY_FOR_DEPLOYMENT..."}
                  {progress >= 100 && "ESTABLISHING_UPLINK..."}
                </motion.span>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="absolute bottom-12 flex flex-col items-center gap-2">
             <div className="flex items-center gap-4 text-neutral-800 text-[9px] font-black uppercase tracking-[0.4em]">
                <span>MODULAR</span>
                <span className="w-1 h-1 bg-neutral-800 rounded-full" />
                <span>PRECISION</span>
                <span className="w-1 h-1 bg-neutral-800 rounded-full" />
                <span>SYSTEM</span>
             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
